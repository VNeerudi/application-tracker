import ollama
from typing import Dict, Optional
import json
import re
from datetime import datetime
from pathlib import Path
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

from config import settings
from user_profile import UserProfile

class ResumeBuilder:
    def __init__(self):
        self.ollama_client = ollama.Client(host=settings.ollama_base_url)
        self.model = settings.ollama_model
        self.resumes_dir = Path("resumes")
        self.resumes_dir.mkdir(exist_ok=True)
        self.user_profile = UserProfile()
        
    def generate_resume_from_jd(self, job_description: str, existing_resume: Optional[str] = None, use_profile: bool = True) -> Dict:
        """Generate a tailored resume based on job description using LLM"""
        try:
            # Get user profile if available
            profile_data = None
            if use_profile:
                profile = self.user_profile.get_profile()
                # Only use profile if it has meaningful data
                if profile.get('personal_info', {}).get('name') or profile.get('experience'):
                    profile_data = json.dumps(profile, indent=2)
            
            if existing_resume:
                base_context = existing_resume
            elif profile_data:
                base_context = f"My Profile Information:\n{profile_data}"
            else:
                base_context = None
            
            if base_context:
                prompt = f"""Based on the following job description and my profile information, create a tailored resume that highlights ONLY the most relevant skills, experiences, projects, publications, awards, and achievements for this specific job. Exclude anything that is not directly relevant.

Job Description:
{job_description}

{base_context}

IMPORTANT: Only include information that is relevant to this job. For example:
- If the job requires Python, include Python projects and experience, but skip unrelated technologies
- If the job is in research, include publications and research experience
- If the job values leadership, include awards and volunteer work that demonstrate leadership
- Tailor the summary to match the job requirements
- Select only the most relevant experiences and projects

Create a professional resume in the following JSON format:
{{
  "personal_info": {{
    "name": "Full Name",
    "email": "email@example.com",
    "phone": "Phone Number",
    "location": "City, State",
    "linkedin": "LinkedIn URL (optional)",
    "portfolio": "Portfolio URL (optional)"
  }},
  "summary": "Professional summary (2-3 sentences highlighting key qualifications)",
  "skills": ["Skill 1", "Skill 2", "Skill 3"],
  "experience": [
    {{
      "title": "Job Title",
      "company": "Company Name",
      "location": "City, State",
      "start_date": "MM/YYYY",
      "end_date": "MM/YYYY or Present",
      "description": ["Achievement 1", "Achievement 2", "Achievement 3"]
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

Return ONLY valid JSON, no additional text."""
            else:
                prompt = f"""Based on the following job description, create a professional resume that matches the requirements.

Job Description:
{job_description}

Create a professional resume in the following JSON format:
{{
  "personal_info": {{
    "name": "Full Name",
    "email": "email@example.com",
    "phone": "Phone Number",
    "location": "City, State",
    "linkedin": "LinkedIn URL (optional)",
    "portfolio": "Portfolio URL (optional)"
  }},
  "summary": "Professional summary (2-3 sentences highlighting key qualifications)",
  "skills": ["Skill 1", "Skill 2", "Skill 3"],
  "experience": [
    {{
      "title": "Job Title",
      "company": "Company Name",
      "location": "City, State",
      "start_date": "MM/YYYY",
      "end_date": "MM/YYYY or Present",
      "description": ["Achievement 1", "Achievement 2", "Achievement 3"]
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

Return ONLY valid JSON, no additional text."""

            response = self.ollama_client.generate(
                model=self.model,
                prompt=prompt,
                format="json"
            )
            
            # Extract JSON from response
            if isinstance(response, dict):
                response_text = response.get('response', '').strip()
            else:
                response_text = str(response).strip()
            
            if not response_text:
                return {"error": "Empty response from LLM"}
            
            # Try to extract JSON if wrapped in markdown code blocks
            json_match = re.search(r'```json\s*(\{.*?\})\s*```', response_text, re.DOTALL)
            if json_match:
                response_text = json_match.group(1)
            else:
                # Try to find JSON object directly
                json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
                if json_match:
                    response_text = json_match.group(0)
            
            # Clean up the response text
            if response_text.startswith("'") and response_text.endswith("'"):
                response_text = response_text[1:-1]
            elif response_text.startswith('"') and response_text.endswith('"'):
                response_text = response_text[1:-1]
            
            response_text = response_text.strip()
            
            # Handle escaped newlines
            if '\\n' in response_text:
                try:
                    response_text = response_text.encode('utf-8').decode('unicode_escape')
                except:
                    response_text = response_text.replace('\\n', '\n').replace('\\t', '\t').replace('\\"', '"').replace("\\'", "'")
            
            try:
                result = json.loads(response_text)
            except json.JSONDecodeError as e:
                print(f"JSON decode error: {e}")
                print(f"Response text (first 500 chars): {response_text[:500]}")
                # Try to handle Python-style dicts
                try:
                    import ast
                    text_for_eval = response_text.replace('null', 'None').replace('true', 'True').replace('false', 'False')
                    result = ast.literal_eval(text_for_eval)
                    if not isinstance(result, dict):
                        raise ValueError("Parsed result is not a dictionary")
                    result = {k: (None if v is None else (True if v is True else (False if v is False else v))) for k, v in result.items()}
                except Exception as e2:
                    print(f"Failed to parse JSON: {repr(response_text[:200])}")
                    return {"error": f"Failed to parse LLM response: {str(e2)}"}
            
            return result
            
        except Exception as e:
            print(f"Error generating resume: {e}")
            return {"error": str(e)}
    
    def create_pdf(self, resume_data: Dict, output_path: str) -> bool:
        """Create a PDF from resume data"""
        try:
            doc = SimpleDocTemplate(output_path, pagesize=letter,
                                  rightMargin=72, leftMargin=72,
                                  topMargin=72, bottomMargin=18)
            
            # Container for the 'Flowable' objects
            elements = []
            
            # Define styles
            styles = getSampleStyleSheet()
            
            # Custom styles
            title_style = ParagraphStyle(
                'CustomTitle',
                parent=styles['Heading1'],
                fontSize=24,
                textColor='#1a1a1a',
                spaceAfter=6,
                alignment=TA_CENTER
            )
            
            heading_style = ParagraphStyle(
                'CustomHeading',
                parent=styles['Heading2'],
                fontSize=14,
                textColor='#2c3e50',
                spaceAfter=12,
                spaceBefore=12,
                fontName='Helvetica-Bold'
            )
            
            normal_style = styles['Normal']
            normal_style.fontSize = 10
            normal_style.leading = 12
            
            # Personal Information
            personal = resume_data.get('personal_info', {})
            if personal.get('name'):
                elements.append(Paragraph(personal['name'], title_style))
                elements.append(Spacer(1, 0.1*inch))
            
            # Contact info
            contact_info = []
            if personal.get('email'):
                contact_info.append(personal['email'])
            if personal.get('phone'):
                contact_info.append(personal['phone'])
            if personal.get('location'):
                contact_info.append(personal['location'])
            if personal.get('linkedin'):
                contact_info.append(f"LinkedIn: {personal['linkedin']}")
            if personal.get('portfolio'):
                contact_info.append(f"Portfolio: {personal['portfolio']}")
            
            if contact_info:
                contact_style = ParagraphStyle(
                    'Contact',
                    parent=normal_style,
                    alignment=TA_CENTER,
                    fontSize=9
                )
                elements.append(Paragraph(" | ".join(contact_info), contact_style))
                elements.append(Spacer(1, 0.2*inch))
            
            # Summary
            if resume_data.get('summary'):
                elements.append(Paragraph("PROFESSIONAL SUMMARY", heading_style))
                elements.append(Paragraph(resume_data['summary'], normal_style))
                elements.append(Spacer(1, 0.2*inch))
            
            # Skills
            if resume_data.get('skills'):
                elements.append(Paragraph("SKILLS", heading_style))
                skills_text = " • ".join(resume_data['skills'])
                elements.append(Paragraph(skills_text, normal_style))
                elements.append(Spacer(1, 0.2*inch))
            
            # Experience
            if resume_data.get('experience'):
                elements.append(Paragraph("PROFESSIONAL EXPERIENCE", heading_style))
                for exp in resume_data['experience']:
                    # Job title and company
                    job_title = exp.get('title', '')
                    company = exp.get('company', '')
                    location = exp.get('location', '')
                    dates = f"{exp.get('start_date', '')} - {exp.get('end_date', '')}"
                    
                    exp_header = f"<b>{job_title}</b>"
                    if company:
                        exp_header += f" | {company}"
                    if location:
                        exp_header += f" | {location}"
                    if dates:
                        exp_header += f" | {dates}"
                    
                    elements.append(Paragraph(exp_header, normal_style))
                    
                    # Description bullets
                    if exp.get('description'):
                        for desc in exp['description']:
                            elements.append(Paragraph(f"• {desc}", normal_style))
                    
                    elements.append(Spacer(1, 0.15*inch))
                
                elements.append(Spacer(1, 0.1*inch))
            
            # Education
            if resume_data.get('education'):
                elements.append(Paragraph("EDUCATION", heading_style))
                for edu in resume_data['education']:
                    edu_text = f"<b>{edu.get('degree', '')}</b>"
                    if edu.get('school'):
                        edu_text += f" | {edu['school']}"
                    if edu.get('location'):
                        edu_text += f" | {edu['location']}"
                    if edu.get('graduation_date'):
                        edu_text += f" | {edu['graduation_date']}"
                    if edu.get('gpa'):
                        edu_text += f" | GPA: {edu['gpa']}"
                    if edu.get('honors'):
                        edu_text += f" | {edu['honors']}"
                    
                    elements.append(Paragraph(edu_text, normal_style))
                    elements.append(Spacer(1, 0.15*inch))
                
                elements.append(Spacer(1, 0.1*inch))
            
            # Projects
            if resume_data.get('projects'):
                elements.append(Paragraph("PROJECTS", heading_style))
                for project in resume_data['projects']:
                    proj_text = f"<b>{project.get('name', '')}</b>"
                    if project.get('url'):
                        proj_text += f" | <a href='{project['url']}' color='blue'>{project['url']}</a>"
                    elements.append(Paragraph(proj_text, normal_style))
                    
                    if project.get('description'):
                        elements.append(Paragraph(project['description'], normal_style))
                    
                    if project.get('technologies'):
                        tech_text = "Technologies: " + ", ".join(project['technologies'])
                        elements.append(Paragraph(tech_text, normal_style))
                    
                    elements.append(Spacer(1, 0.15*inch))
                
                elements.append(Spacer(1, 0.1*inch))
            
            # Certifications
            if resume_data.get('certifications'):
                elements.append(Paragraph("CERTIFICATIONS", heading_style))
                for cert in resume_data['certifications']:
                    cert_text = f"<b>{cert.get('name', '')}</b>"
                    if cert.get('issuer'):
                        cert_text += f" | {cert['issuer']}"
                    if cert.get('date'):
                        cert_text += f" | {cert['date']}"
                    if cert.get('expiry'):
                        cert_text += f" | Expires: {cert['expiry']}"
                    
                    elements.append(Paragraph(cert_text, normal_style))
                    elements.append(Spacer(1, 0.15*inch))
                
                elements.append(Spacer(1, 0.1*inch))
            
            # Publications
            if resume_data.get('publications'):
                elements.append(Paragraph("PUBLICATIONS", heading_style))
                for pub in resume_data['publications']:
                    pub_text = f"<b>{pub.get('title', '')}</b>"
                    if pub.get('authors'):
                        pub_text += f" | {pub['authors']}"
                    if pub.get('journal'):
                        pub_text += f" | {pub['journal']}"
                    if pub.get('date'):
                        pub_text += f" | {pub['date']}"
                    if pub.get('url'):
                        pub_text += f" | <a href='{pub['url']}' color='blue'>{pub['url']}</a>"
                    
                    elements.append(Paragraph(pub_text, normal_style))
                    elements.append(Spacer(1, 0.15*inch))
                
                elements.append(Spacer(1, 0.1*inch))
            
            # Awards
            if resume_data.get('awards'):
                elements.append(Paragraph("AWARDS & HONORS", heading_style))
                for award in resume_data['awards']:
                    award_text = f"<b>{award.get('name', '')}</b>"
                    if award.get('issuer'):
                        award_text += f" | {award['issuer']}"
                    if award.get('date'):
                        award_text += f" | {award['date']}"
                    if award.get('description'):
                        award_text += f" | {award['description']}"
                    
                    elements.append(Paragraph(award_text, normal_style))
                    elements.append(Spacer(1, 0.15*inch))
                
                elements.append(Spacer(1, 0.1*inch))
            
            # Volunteer Work
            if resume_data.get('volunteer_work'):
                elements.append(Paragraph("VOLUNTEER WORK", heading_style))
                for vol in resume_data['volunteer_work']:
                    vol_text = f"<b>{vol.get('role', '')}</b>"
                    if vol.get('organization'):
                        vol_text += f" | {vol['organization']}"
                    if vol.get('location'):
                        vol_text += f" | {vol['location']}"
                    if vol.get('start_date') or vol.get('end_date'):
                        dates = f"{vol.get('start_date', '')} - {vol.get('end_date', '')}"
                        vol_text += f" | {dates}"
                    
                    elements.append(Paragraph(vol_text, normal_style))
                    if vol.get('description'):
                        elements.append(Paragraph(vol['description'], normal_style))
                    elements.append(Spacer(1, 0.15*inch))
            
            # Build PDF
            doc.build(elements)
            return True
            
        except Exception as e:
            print(f"Error creating PDF: {e}")
            return False

