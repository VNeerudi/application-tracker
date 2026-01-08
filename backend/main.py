from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import uvicorn
import os
import shutil
from pathlib import Path

from database import get_db, init_db
from models import Application, ApplicationCreate, ApplicationUpdate, ApplicationResponse
from email_processor import EmailProcessor
from image_processor import ImageProcessor
from resume_builder import ResumeBuilder
from user_profile import UserProfile
from config import settings

app = FastAPI(title="Job Application Tracker API")

# CORS middleware for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create uploads directory if it doesn't exist
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

# Create resumes directory if it doesn't exist
RESUMES_DIR = Path("resumes")
RESUMES_DIR.mkdir(exist_ok=True)

# Initialize database on startup
@app.on_event("startup")
async def startup_event():
    init_db()

# Mount static files for serving uploaded images and resumes
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
app.mount("/resumes", StaticFiles(directory="resumes"), name="resumes")

@app.get("/")
async def root():
    return {"message": "Job Application Tracker API"}

@app.get("/api/applications", response_model=List[ApplicationResponse])
def get_applications(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get all job applications with optional filtering"""
    query = db.query(Application)
    
    if status:
        query = query.filter(Application.status == status)
    
    applications = query.order_by(Application.applied_date.desc()).offset(skip).limit(limit).all()
    return applications

@app.get("/api/applications/{application_id}", response_model=ApplicationResponse)
def get_application(application_id: int, db: Session = Depends(get_db)):
    """Get a specific application by ID"""
    application = db.query(Application).filter(Application.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    return application

@app.post("/api/applications", response_model=ApplicationResponse)
def create_application(application: ApplicationCreate, db: Session = Depends(get_db)):
    """Create a new job application"""
    db_application = Application(**application.dict())
    db.add(db_application)
    db.commit()
    db.refresh(db_application)
    return db_application

@app.post("/api/upload-image")
async def upload_image(file: UploadFile = File(...)):
    """Upload an image and extract job information"""
    try:
        # Validate file type
        if not file.content_type or not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="File must be an image")
        
        # Save file
        file_ext = Path(file.filename).suffix
        file_path = UPLOAD_DIR / f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{file.filename}"
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Process image with LLM
        processor = ImageProcessor()
        extracted_data = processor.extract_from_image(str(file_path))
        
        if extracted_data:
            # Add image path to the extracted data
            extracted_data["image_path"] = f"/uploads/{file_path.name}"
            return extracted_data
        else:
            # Return image path even if extraction failed
            return {
                "image_path": f"/uploads/{file_path.name}",
                "company_name": None,
                "position": None,
                "location": None,
                "job_url": None,
                "contact_email": None,
                "salary_range": None,
                "notes": None
            }
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing image: {str(e)}")

@app.put("/api/applications/{application_id}", response_model=ApplicationResponse)
def update_application(
    application_id: int,
    application: ApplicationUpdate,
    db: Session = Depends(get_db)
):
    """Update an existing application"""
    try:
        db_application = db.query(Application).filter(Application.id == application_id).first()
        if not db_application:
            raise HTTPException(status_code=404, detail="Application not found")
        
        # Use dict() for Pydantic v1 compatibility, or model_dump() for v2
        try:
            update_data = application.model_dump(exclude_unset=True)
        except AttributeError:
            # Fallback for Pydantic v1
            update_data = application.dict(exclude_unset=True)
        
        # Debug: print what we received
        print(f"Update data received: {update_data}")
        
        # Handle date strings from frontend (empty strings should be None)
        if 'interview_date' in update_data:
            if isinstance(update_data['interview_date'], str):
                if not update_data['interview_date'].strip():
                    update_data['interview_date'] = None
                else:
                    try:
                        update_data['interview_date'] = datetime.fromisoformat(update_data['interview_date'].replace('Z', '+00:00'))
                    except:
                        try:
                            # Try parsing with different formats
                            from datetime import datetime as dt
                            update_data['interview_date'] = dt.strptime(update_data['interview_date'], "%Y-%m-%dT%H:%M")
                        except:
                            update_data['interview_date'] = None
        
        if 'rejection_date' in update_data:
            if isinstance(update_data['rejection_date'], str):
                if not update_data['rejection_date'].strip():
                    update_data['rejection_date'] = None
                else:
                    try:
                        update_data['rejection_date'] = datetime.fromisoformat(update_data['rejection_date'].replace('Z', '+00:00'))
                    except:
                        try:
                            from datetime import datetime as dt
                            update_data['rejection_date'] = dt.strptime(update_data['rejection_date'], "%Y-%m-%d")
                        except:
                            update_data['rejection_date'] = None
        
        if 'applied_date' in update_data:
            if isinstance(update_data['applied_date'], str):
                if not update_data['applied_date'].strip():
                    del update_data['applied_date']  # Don't update if empty
                else:
                    try:
                        update_data['applied_date'] = datetime.fromisoformat(update_data['applied_date'].replace('Z', '+00:00'))
                    except:
                        del update_data['applied_date']  # Keep existing if parsing fails
        
        # Ensure required fields are not set to None or empty
        if 'company_name' in update_data and (update_data['company_name'] is None or not update_data['company_name'].strip()):
            del update_data['company_name']
        if 'position' in update_data and (update_data['position'] is None or not update_data['position'].strip()):
            del update_data['position']
        
        # Remove empty strings and convert to None for optional fields
        for key in ['rejection_reason', 'notes', 'job_url', 'contact_email', 'location', 'salary_range', 'source', 'email_id', 'image_path']:
            if key in update_data and isinstance(update_data[key], str) and not update_data[key].strip():
                update_data[key] = None
        
        for field, value in update_data.items():
            setattr(db_application, field, value)
        
        db.commit()
        db.refresh(db_application)
        return db_application
    except Exception as e:
        db.rollback()
        print(f"Error updating application: {e}")
        raise HTTPException(status_code=500, detail=f"Error updating application: {str(e)}")

@app.delete("/api/applications/{application_id}")
def delete_application(application_id: int, db: Session = Depends(get_db)):
    """Delete an application"""
    db_application = db.query(Application).filter(Application.id == application_id).first()
    if not db_application:
        raise HTTPException(status_code=404, detail="Application not found")
    
    db.delete(db_application)
    db.commit()
    return {"message": "Application deleted successfully"}

@app.post("/api/sync-emails")
def sync_emails(db: Session = Depends(get_db)):
    """Sync emails and extract job application information"""
    try:
        processor = EmailProcessor()
        new_applications = processor.process_emails(db)
        return {
            "message": f"Email sync completed. Found {len(new_applications)} new applications.",
            "applications": new_applications
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error syncing emails: {str(e)}")

@app.get("/api/emails")
def list_emails(days_back: int = 0, limit: int = 50, unread_only: bool = False, db: Session = Depends(get_db)):
    """List job-related emails from today (or last N days), optionally only unread emails"""
    try:
        processor = EmailProcessor()
        emails = processor.list_emails(db, days_back=days_back, limit=limit, unread_only=unread_only)
        return emails
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing emails: {str(e)}")

@app.post("/api/process-email/{email_id}")
def process_email(email_id: str, db: Session = Depends(get_db)):
    """Process a specific email, extract details, and update application if rejection"""
    try:
        processor = EmailProcessor()
        result = processor.process_single_email(email_id, db)
        
        if not result:
            raise HTTPException(status_code=404, detail="Could not process email")
        
        extracted = result['extracted_data']
        is_rejection = result['is_rejection']
        matched_app_id = result['matched_application_id']
        
        # If rejection and we found a match, update the application
        if is_rejection and matched_app_id:
            application = db.query(Application).filter(Application.id == matched_app_id).first()
            if application:
                application.status = "rejected"
                if extracted.get('rejection_date'):
                    application.rejection_date = extracted['rejection_date']
                elif result.get('email_date'):
                    from datetime import datetime
                    application.rejection_date = datetime.fromisoformat(result['email_date'])
                if extracted.get('rejection_reason'):
                    application.rejection_reason = extracted['rejection_reason']
                application.email_id = email_id
                db.commit()
                db.refresh(application)
                
                return {
                    "message": "Rejection detected and application updated",
                    "application_updated": True,
                    "application": {
                        "id": application.id,
                        "company_name": application.company_name,
                        "position": application.position,
                        "status": application.status
                    },
                    "extracted_data": extracted
                }
        
        # If not a rejection or no match, create new application if we have company name
        if extracted.get('company_name') and not is_rejection:
            # Check if already exists
            existing = db.query(Application).filter(
                Application.email_id == email_id
            ).first()
            
            if not existing:
                # Ensure required fields have values
                company_name = extracted.get('company_name') or 'Unknown'
                position = extracted.get('position') or 'Not Specified'
                
                # Use email date as applied_date, or extracted date if LLM found one
                email_date_str = result.get('email_date')
                if email_date_str:
                    try:
                        from dateutil import parser as date_parser
                        email_date = date_parser.parse(email_date_str)
                        # Convert to naive datetime (remove timezone info) to store date only
                        if email_date.tzinfo:
                            email_date = email_date.replace(tzinfo=None)
                        # Set time to midnight to ensure we're using just the date
                        email_date = email_date.replace(hour=0, minute=0, second=0, microsecond=0)
                    except:
                        try:
                            email_date = datetime.fromisoformat(email_date_str.replace('Z', '+00:00'))
                            if email_date.tzinfo:
                                email_date = email_date.replace(tzinfo=None)
                            email_date = email_date.replace(hour=0, minute=0, second=0, microsecond=0)
                        except:
                            # Fallback: use yesterday's date if we can't parse
                            from datetime import timedelta
                            email_date = (datetime.now() - timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
                else:
                    # Default to yesterday if no email date
                    from datetime import timedelta
                    email_date = (datetime.now() - timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
                
                # Use extracted date if LLM found one, otherwise use email date
                if extracted.get('applied_date'):
                    applied_date = extracted.get('applied_date')
                    # Ensure it's naive datetime and set to midnight
                    if applied_date.tzinfo:
                        applied_date = applied_date.replace(tzinfo=None)
                    applied_date = applied_date.replace(hour=0, minute=0, second=0, microsecond=0)
                else:
                    applied_date = email_date
                
                application = Application(
                    company_name=company_name,
                    position=position,
                    status=extracted.get('status', 'pending'),
                    interview_date=extracted.get('interview_date'),
                    rejection_date=extracted.get('rejection_date'),
                    rejection_reason=extracted.get('rejection_reason'),
                    notes=extracted.get('notes'),
                    job_url=extracted.get('job_url'),
                    contact_email=extracted.get('contact_email'),
                    location=extracted.get('location'),
                    source="email",
                    email_id=email_id,
                    applied_date=applied_date
                )
                db.add(application)
                db.commit()
                db.refresh(application)
                
                return {
                    "message": "New application created from email",
                    "application_created": True,
                    "application": {
                        "id": application.id,
                        "company_name": application.company_name,
                        "position": application.position
                    },
                    "extracted_data": extracted
                }
        
        return {
            "message": "Email processed",
            "is_rejection": is_rejection,
            "matched_application_id": matched_app_id,
            "extracted_data": extracted
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing email: {str(e)}")

@app.get("/api/stats")
def get_stats(db: Session = Depends(get_db)):
    """Get statistics about applications"""
    total = db.query(Application).count()
    pending = db.query(Application).filter(Application.status == "pending").count()
    interview = db.query(Application).filter(Application.status == "interview").count()
    rejected = db.query(Application).filter(Application.status == "rejected").count()
    accepted = db.query(Application).filter(Application.status == "accepted").count()
    
    return {
        "total": total,
        "pending": pending,
        "interview": interview,
        "rejected": rejected,
        "accepted": accepted
    }

@app.post("/api/resume/generate")
def generate_resume(job_description: dict = Body(...), db: Session = Depends(get_db)):
    """Generate a resume from job description"""
    try:
        jd_text = job_description.get("job_description", "")
        application_id = job_description.get("application_id")
        existing_resume = job_description.get("existing_resume")
        
        if not jd_text:
            raise HTTPException(status_code=400, detail="Job description is required")
        
        builder = ResumeBuilder()
        use_profile = job_description.get("use_profile", True)
        resume_data = builder.generate_resume_from_jd(jd_text, existing_resume, use_profile)
        
        if "error" in resume_data:
            raise HTTPException(status_code=500, detail=resume_data["error"])
        
        return {
            "resume_data": resume_data,
            "application_id": application_id
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating resume: {str(e)}")

@app.post("/api/resume/create-pdf")
def create_resume_pdf(resume_request: dict = Body(...), db: Session = Depends(get_db)):
    """Create PDF from resume data and save it to an application"""
    try:
        resume_data = resume_request.get("resume_data")
        application_id = resume_request.get("application_id")
        
        if not resume_data:
            raise HTTPException(status_code=400, detail="Resume data is required")
        
        if not application_id:
            raise HTTPException(status_code=400, detail="Application ID is required")
        
        # Get application
        application = db.query(Application).filter(Application.id == application_id).first()
        if not application:
            raise HTTPException(status_code=404, detail="Application not found")
        
        # Generate PDF filename
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        safe_company = "".join(c for c in application.company_name if c.isalnum() or c in (' ', '-', '_')).strip()[:30]
        filename = f"resume_{application_id}_{safe_company}_{timestamp}.pdf"
        file_path = RESUMES_DIR / filename
        
        # Create PDF
        builder = ResumeBuilder()
        success = builder.create_pdf(resume_data, str(file_path))
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to create PDF")
        
        # Update application with resume path
        application.resume_path = f"/resumes/{filename}"
        db.commit()
        db.refresh(application)
        
        return {
            "message": "Resume PDF created successfully",
            "resume_path": application.resume_path,
            "application_id": application_id
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error creating PDF: {str(e)}")

@app.get("/api/resume/{application_id}")
def get_resume(application_id: int, db: Session = Depends(get_db)):
    """Get resume path for an application"""
    try:
        application = db.query(Application).filter(Application.id == application_id).first()
        if not application:
            raise HTTPException(status_code=404, detail="Application not found")
        
        if not application.resume_path:
            raise HTTPException(status_code=404, detail="No resume found for this application")
        
        return {
            "resume_path": application.resume_path,
            "application_id": application_id
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving resume: {str(e)}")

@app.get("/api/user-profile")
def get_user_profile():
    """Get user profile/personal details"""
    try:
        profile = UserProfile()
        return profile.get_profile()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving profile: {str(e)}")

@app.post("/api/user-profile")
def save_user_profile(profile_data: dict = Body(...)):
    """Save user profile/personal details"""
    try:
        profile = UserProfile()
        success = profile.save_profile(profile_data)
        if success:
            return {"message": "Profile saved successfully", "profile": profile.get_profile()}
        else:
            raise HTTPException(status_code=500, detail="Failed to save profile")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving profile: {str(e)}")

@app.post("/api/extract-from-portfolio")
def extract_from_portfolio(portfolio_data: dict = Body(...)):
    """Extract information from portfolio text using local Ollama model (gemma3:4b)"""
    try:
        portfolio_text = portfolio_data.get("portfolio_text", "")
        if not portfolio_text:
            raise HTTPException(status_code=400, detail="Portfolio text is required")
        
        import ollama
        import json
        import re
        
        # Initialize Ollama client with local model
        client = ollama.Client(host=settings.ollama_base_url)
        model = settings.ollama_model  # gemma3:4b
        
        prompt = f"""You are an expert at extracting structured information from resumes, CVs, and portfolio text. 
Extract all relevant information and return it as a valid JSON object. Be thorough and accurate.

Analyze the following portfolio/resume text and extract all relevant information. Return a JSON object with the following structure:

{{
  "personal_info": {{
    "name": "Full Name",
    "email": "email@example.com",
    "phone": "Phone Number",
    "location": "City, State",
    "linkedin": "LinkedIn URL",
    "portfolio": "Portfolio URL",
    "github": "GitHub URL"
  }},
  "summary": "Professional summary (2-3 sentences)",
  "skills": ["Skill 1", "Skill 2", "Skill 3"],
  "experience": [
    {{
      "title": "Job Title",
      "company": "Company Name",
      "location": "City, State",
      "start_date": "MM/YYYY",
      "end_date": "MM/YYYY or Present",
      "description": ["Achievement 1", "Achievement 2"]
    }}
  ],
  "education": [
    {{
      "degree": "Degree Name",
      "school": "School Name",
      "location": "City, State",
      "graduation_date": "YYYY",
      "gpa": "GPA (optional)",
      "honors": "Honors (optional)"
    }}
  ],
  "projects": [
    {{
      "name": "Project Name",
      "description": "Project description",
      "technologies": ["Tech 1", "Tech 2"],
      "url": "Project URL (optional)"
    }}
  ],
  "certifications": [
    {{
      "name": "Certification Name",
      "issuer": "Issuing Organization",
      "date": "MM/YYYY",
      "expiry": "MM/YYYY (optional)"
    }}
  ],
  "publications": [
    {{
      "title": "Publication Title",
      "authors": "Author names",
      "journal": "Journal/Conference Name",
      "date": "MM/YYYY",
      "url": "URL (optional)"
    }}
  ],
  "awards": [
    {{
      "name": "Award Name",
      "issuer": "Issuing Organization",
      "date": "MM/YYYY",
      "description": "Description (optional)"
    }}
  ],
  "volunteer_work": [
    {{
      "organization": "Organization Name",
      "role": "Role/Position",
      "location": "City, State",
      "start_date": "MM/YYYY",
      "end_date": "MM/YYYY or Present",
      "description": "Description"
    }}
  ]
}}

Portfolio Text:
{portfolio_text}

Return ONLY valid JSON, no additional text or markdown formatting."""

        # Call Ollama API
        response = client.generate(
            model=model,
            prompt=prompt,
            format="json",
            options={
                "temperature": 0.3
            }
        )
        
        # Extract JSON from response
        if isinstance(response, dict):
            response_text = response.get('response', '').strip()
        else:
            response_text = str(response).strip()
        
        if not response_text:
            return {"error": "Empty response from Ollama"}
        
        # Try to extract JSON if wrapped in markdown code blocks (fallback)
        json_match = re.search(r'```json\s*(\{.*?\})\s*```', response_text, re.DOTALL)
        if json_match:
            response_text = json_match.group(1)
        else:
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if json_match:
                response_text = json_match.group(0)
        
        # Clean up the response text
        response_text = response_text.strip()
        
        try:
            extracted_data = json.loads(response_text)
        except json.JSONDecodeError as e:
            print(f"JSON decode error: {e}")
            print(f"Response text (first 500 chars): {response_text[:500]}")
            # Try to extract JSON if wrapped in markdown code blocks
            json_match = re.search(r'```json\s*(\{.*?\})\s*```', response_text, re.DOTALL)
            if json_match:
                response_text = json_match.group(1)
            else:
                json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
                if json_match:
                    response_text = json_match.group(0)
            try:
                extracted_data = json.loads(response_text.strip())
            except json.JSONDecodeError as e2:
                return {"error": f"Failed to parse Ollama response: {str(e2)}"}
        
        return {
            "extracted_data": extracted_data,
            "message": "Information extracted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in extract_from_portfolio: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error extracting from portfolio: {str(e)}")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

