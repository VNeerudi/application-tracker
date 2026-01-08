import imaplib
import email
from email.header import decode_header
from datetime import datetime
from typing import List, Dict, Optional
import re
import ollama
from sqlalchemy.orm import Session

from models import Application
from config import settings

class EmailProcessor:
    def __init__(self):
        self.ollama_client = ollama.Client(host=settings.ollama_base_url)
        self.model = settings.ollama_model
        
    def connect_email(self):
        """Connect to email server"""
        if settings.email_provider == "gmail":
            imap_server = settings.imap_server or "imap.gmail.com"
            imap_port = settings.imap_port or 993
        elif settings.email_provider == "outlook":
            imap_server = settings.imap_server or "outlook.office365.com"
            imap_port = settings.imap_port or 993
        else:
            raise ValueError(f"Unsupported email provider: {settings.email_provider}")
        
        mail = imaplib.IMAP4_SSL(imap_server, imap_port)
        
        # Use app password for Gmail, regular password for Outlook
        password = settings.email_app_password or settings.email_password
        if not settings.email_address or not password:
            raise ValueError(
                "Email address and password must be set in .env file.\n"
                "For Gmail: You need an App Password (not your regular password).\n"
                "Generate one at: https://myaccount.google.com/apppasswords\n"
                "Make sure 2FA is enabled first!"
            )
        
        try:
            # Remove spaces from app password if present
            password = password.replace(" ", "")
            mail.login(settings.email_address, password)
        except imaplib.IMAP4.error as e:
            error_msg = str(e)
            if "AUTHENTICATIONFAILED" in error_msg or "Invalid credentials" in error_msg:
                raise ValueError(
                    "Email authentication failed. Please check:\n"
                    "1. For Gmail: Use an App Password (not your regular password)\n"
                    "2. Generate App Password at: https://myaccount.google.com/apppasswords\n"
                    "3. Make sure 2FA is enabled on your Google account\n"
                    "4. Remove spaces from the app password in .env file\n"
                    "5. Restart the server after updating .env"
                ) from e
            raise
        return mail
    
    def parse_email_content(self, msg) -> Dict[str, str]:
        """Extract text content from email"""
        body = ""
        subject = ""
        
        # Decode subject
        try:
            subject_header = decode_header(msg.get("Subject", ""))
            if subject_header:
                decoded_parts = []
                for part, encoding in subject_header:
                    if isinstance(part, bytes):
                        decoded_parts.append(part.decode(encoding or 'utf-8'))
                    else:
                        decoded_parts.append(part)
                subject = "".join(decoded_parts)
            else:
                subject = msg.get("Subject", "")
        except Exception as e:
            subject = msg.get("Subject", "")
            print(f"Error decoding subject: {e}")
        
        # Get email body
        html_body = ""
        text_body = ""
        
        if msg.is_multipart():
            for part in msg.walk():
                content_type = part.get_content_type()
                content_disposition = str(part.get("Content-Disposition"))
                
                if "attachment" not in content_disposition:
                    if content_type == "text/html":
                        try:
                            html_body = part.get_payload(decode=True).decode()
                        except:
                            pass
                    elif content_type == "text/plain":
                        try:
                            text_body = part.get_payload(decode=True).decode()
                        except:
                            pass
        else:
            content_type = msg.get_content_type()
            try:
                payload = msg.get_payload(decode=True).decode()
                if content_type == "text/html":
                    html_body = payload
                else:
                    text_body = payload
            except:
                text_body = str(msg.get_payload())
        
        # Prefer HTML if available (as requested), otherwise text
        body = html_body if html_body else text_body
        
        return {"subject": subject, "body": body}
    
    def extract_with_llm(self, email_content: Dict[str, str]) -> Optional[Dict]:
        """Use Ollama LLM to extract job application information from email"""
        prompt = f"""Analyze the following email (which may be HTML) and extract job application information. 
This email is about a job application - extract the company name and position from the subject line and email body.

IMPORTANT: 
- Extract the FULL company name (e.g., "Intercontinental Exchange, Inc." not just "ICE")
- Extract the FULL position title from the subject or body
- If the email says "Thank you for your application" or similar, this is a confirmation email for an application
- Status should be "pending" for confirmation emails unless explicitly stated otherwise

Return a JSON object with the following fields if available:
- company_name: Full name of the company (extract from subject line or email body)
- position: Complete job position/title (extract from subject line or email body)
- applied_date: Date when the application was submitted (format: YYYY-MM-DD or YYYY-MM-DD HH:MM) - only if explicitly mentioned in the email
- status: One of: "pending", "interview", "rejected", "accepted" (default to "pending" for confirmation emails)
- interview_date: Date and time if interview is scheduled (format: YYYY-MM-DD HH:MM or YYYY-MM-DD)
- rejection_date: Date if rejection mentioned (format: YYYY-MM-DD)
- rejection_reason: Reason for rejection if mentioned
- job_url: URL to job posting if mentioned
- contact_email: Contact email if mentioned
- location: Job location if mentioned
- notes: Any additional relevant information

Email Subject: {email_content['subject']}
Email Body: {email_content['body'][:8000]}

Return ONLY valid JSON, no additional text. If information is not available, use null for that field."""

        try:
            response = self.ollama_client.generate(
                model=self.model,
                prompt=prompt,
                format="json"
            )
            
            # Extract JSON from response - handle different response formats
            if isinstance(response, dict):
                response_text = response.get('response', '').strip()
            else:
                response_text = str(response).strip()
            
            if not response_text:
                return None
            
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
            # Remove wrapping quotes if they exist (e.g. LLM returned '{"a":1}')
            if response_text.startswith("'") and response_text.endswith("'"):
                response_text = response_text[1:-1]
            elif response_text.startswith('"') and response_text.endswith('"'):
                response_text = response_text[1:-1]
            
            # Remove any leading/trailing whitespace
            response_text = response_text.strip()
            
            # Handle escaped newlines - if response contains literal \n, decode them
            # The LLM might return JSON with escaped newlines as strings
            if '\\n' in response_text:
                try:
                    # Decode the string representation (convert \n to actual newlines)
                    response_text = response_text.encode('utf-8').decode('unicode_escape')
                except:
                    # Fallback: manual replacement
                    response_text = response_text.replace('\\n', '\n').replace('\\t', '\t').replace('\\"', '"').replace("\\'", "'")
            
            import json
            import ast
            
            try:
                result = json.loads(response_text)
            except json.JSONDecodeError as e:
                print(f"JSON decode error: {e}")
                print(f"Response text (first 500 chars): {response_text[:500]}")
                # Try to handle Python-style dicts or fix common issues
                try:
                    # Handle null/true/false for ast.literal_eval
                    text_for_eval = response_text.replace('null', 'None').replace('true', 'True').replace('false', 'False')
                    result = ast.literal_eval(text_for_eval)
                    if not isinstance(result, dict):
                        raise ValueError("Parsed result is not a dictionary")
                    # Convert None/True/False back to null/true/false for JSON compatibility
                    result = {k: (None if v is None else (True if v is True else (False if v is False else v))) for k, v in result.items()}
                except Exception as e2:
                    print(f"Failed to parse JSON: {repr(response_text[:200])}")
                    print(f"Eval error: {e2}")
                    return None
            
            # Parse dates
            if result.get('interview_date'):
                try:
                    result['interview_date'] = datetime.strptime(result['interview_date'], "%Y-%m-%d %H:%M")
                except:
                    try:
                        result['interview_date'] = datetime.strptime(result['interview_date'], "%Y-%m-%d")
                    except:
                        result['interview_date'] = None
            else:
                result['interview_date'] = None
                
            if result.get('rejection_date'):
                try:
                    result['rejection_date'] = datetime.strptime(result['rejection_date'], "%Y-%m-%d")
                except:
                    result['rejection_date'] = None
            else:
                result['rejection_date'] = None
            
            # Parse applied_date if extracted by LLM
            if result.get('applied_date'):
                try:
                    result['applied_date'] = datetime.strptime(result['applied_date'], "%Y-%m-%d %H:%M")
                except:
                    try:
                        result['applied_date'] = datetime.strptime(result['applied_date'], "%Y-%m-%d")
                    except:
                        result['applied_date'] = None
            else:
                result['applied_date'] = None
            
            return result
            
        except Exception as e:
            print(f"Error extracting with LLM: {e}")
            return None
    
    def process_emails(self, db: Session, days_back: int = 0) -> List[Dict]:
        """Process emails from today (or last N days) and extract job applications"""
        mail = self.connect_email()
        mail.select("INBOX")
        
        # Search for emails from today (or specified days back)
        from datetime import timedelta
        date_since = (datetime.now() - timedelta(days=days_back)).strftime("%d-%b-%Y")
        status, messages = mail.search(None, f'(SINCE {date_since})')
        
        email_ids = messages[0].split()
        new_applications = []
        
        # Keywords to identify job-related emails
        job_keywords = [
            "application", "applied", "interview", "rejection", "job", "position", 
            "hiring", "candidate", "thank you for applying", "thank you for your application",
            "next steps", "thank you for", "your application", "we received", "received your application",
            "thank you for applying", "position", "role", "opportunity"
        ]
        
        for email_id in email_ids[-50:]:  # Process last 50 emails
            try:
                status, msg_data = mail.fetch(email_id, "(RFC822)")
                email_body = msg_data[0][1]
                msg = email.message_from_bytes(email_body)
                
                email_content = self.parse_email_content(msg)
                
                # Get email date - this is the actual date the email was received
                email_date = msg.get("Date")
                if email_date:
                    try:
                        from email.utils import parsedate_to_datetime
                        email_date = parsedate_to_datetime(email_date)
                        # Convert to naive datetime and set to midnight to use just the date
                        if email_date.tzinfo:
                            email_date = email_date.replace(tzinfo=None)
                        email_date = email_date.replace(hour=0, minute=0, second=0, microsecond=0)
                    except:
                        # Fallback to yesterday if parsing fails
                        from datetime import timedelta
                        email_date = (datetime.now() - timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
                else:
                    # Default to yesterday if no date
                    from datetime import timedelta
                    email_date = (datetime.now() - timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
                
                # Check if email is job-related
                subject_lower = email_content['subject'].lower()
                body_lower = email_content['body'].lower()
                
                if any(keyword in subject_lower or keyword in body_lower for keyword in job_keywords):
                    # Check if we already processed this email
                    existing = db.query(Application).filter(
                        Application.email_id == email_id.decode()
                    ).first()
                    
                    if existing:
                        continue
                    
                    # Extract information using LLM
                    extracted_data = self.extract_with_llm(email_content)
                    
                    # Debug: Print extraction results
                    if extracted_data:
                        print(f"Extracted data: {extracted_data}")
                        print(f"Company name: {extracted_data.get('company_name')}")
                        print(f"Position: {extracted_data.get('position')}")
                    
                    if extracted_data and extracted_data.get('company_name'):
                        # Ensure required fields have values (handle None explicitly)
                        company_name = extracted_data.get('company_name') or 'Unknown'
                        position = extracted_data.get('position') or 'Not Specified'
                        
                        # Use email date as applied_date, or extracted date if LLM found one
                        if extracted_data.get('applied_date'):
                            applied_date = extracted_data.get('applied_date')
                            # Ensure it's naive datetime and set to midnight
                            if applied_date.tzinfo:
                                applied_date = applied_date.replace(tzinfo=None)
                            applied_date = applied_date.replace(hour=0, minute=0, second=0, microsecond=0)
                        else:
                            applied_date = email_date
                        
                        # Create application record
                        application = Application(
                            company_name=company_name,
                            position=position,
                            status=extracted_data.get('status', 'pending'),
                            interview_date=extracted_data.get('interview_date'),
                            rejection_date=extracted_data.get('rejection_date'),
                            rejection_reason=extracted_data.get('rejection_reason'),
                            notes=extracted_data.get('notes'),
                            job_url=extracted_data.get('job_url'),
                            contact_email=extracted_data.get('contact_email'),
                            location=extracted_data.get('location'),
                            source="email",
                            email_id=email_id.decode(),
                            applied_date=applied_date
                        )
                        
                        db.add(application)
                        db.commit()
                        db.refresh(application)
                        
                        new_applications.append({
                            "id": application.id,
                            "company_name": application.company_name,
                            "position": application.position,
                            "status": application.status
                        })
                        
            except Exception as e:
                print(f"Error processing email {email_id}: {e}")
                continue
        
        mail.close()
        mail.logout()
        
        return new_applications
    
    def list_emails(self, db: Session, days_back: int = 0, limit: int = 50, unread_only: bool = False) -> List[Dict]:
        """List emails from today (or last N days), optionally only unread emails"""
        mail = self.connect_email()
        mail.select("INBOX")
        
        # Search for emails from today (or specified days back)
        from datetime import timedelta
        date_since = (datetime.now() - timedelta(days=days_back)).strftime("%d-%b-%Y")
        
        # Build search criteria
        if unread_only:
            # Search for unread emails from the specified date
            search_criteria = f'(UNSEEN SINCE {date_since})'
        else:
            search_criteria = f'(SINCE {date_since})'
        
        status, messages = mail.search(None, search_criteria)
        
        email_ids = messages[0].split()
        emails = []
        
        # Keywords to identify job-related emails
        job_keywords = [
            "application", "applied", "interview", "rejection", "job", "position", 
            "hiring", "candidate", "thank you for applying", "thank you for your application",
            "next steps", "thank you for", "your application", "we received", "received your application",
            "offer", "accepted", "declined", "role", "opportunity"
        ]
        
        # Get last N emails and reverse to show newest first
        recent_email_ids = email_ids[-limit:]
        recent_email_ids.reverse()  # Reverse to show newest first
        
        # Get existing applications to check status
        existing_apps = db.query(Application).filter(
            Application.email_id.in_([eid.decode() for eid in recent_email_ids])
        ).all()
        existing_map = {app.email_id: app for app in existing_apps}
        
        for email_id in recent_email_ids:  # Process in reverse order (newest first)
            try:
                status, msg_data = mail.fetch(email_id, "(RFC822)")
                email_body = msg_data[0][1]
                msg = email.message_from_bytes(email_body)
                
                email_content = self.parse_email_content(msg)
                
                # Check if email is job-related
                subject_lower = email_content['subject'].lower()
                body_lower = email_content['body'].lower()
                
                if any(keyword in subject_lower or keyword in body_lower for keyword in job_keywords):
                    # Get email date
                    email_date = msg.get("Date")
                    if email_date:
                        try:
                            from email.utils import parsedate_to_datetime
                            email_date = parsedate_to_datetime(email_date)
                            # Convert to naive datetime and set to midnight to use just the date
                            if email_date.tzinfo:
                                email_date = email_date.replace(tzinfo=None)
                            email_date = email_date.replace(hour=0, minute=0, second=0, microsecond=0)
                        except:
                            # Fallback to yesterday if parsing fails
                            from datetime import timedelta
                            email_date = (datetime.now() - timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
                    else:
                        # Default to yesterday if no date
                        from datetime import timedelta
                        email_date = (datetime.now() - timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
                    
                    # Get sender
                    sender = msg.get("From", "Unknown")

                    body_text = email_content["body"] or ""
                    
                    # Strip HTML tags for preview
                    clean_text = re.sub(r'<[^>]+>', '', body_text)
                    clean_text = re.sub(r'\s+', ' ', clean_text).strip()
                    
                    # Check if already processed
                    app_info = None
                    existing_app = existing_map.get(email_id.decode())
                    if existing_app:
                        app_info = {
                            "status": existing_app.status,
                            "company": existing_app.company_name,
                            "position": existing_app.position,
                            "id": existing_app.id
                        }
                    
                    # Get Message-ID for email linking
                    message_id = msg.get("Message-ID", "")
                    
                    emails.append({
                        "id": email_id.decode(),
                        "subject": email_content['subject'],
                        "from": sender,
                        "date": email_date.isoformat() if isinstance(email_date, datetime) else str(email_date),
                        "preview": clean_text[:200] + "..." if len(clean_text) > 200 else clean_text,
                        "body": body_text,
                        "application": app_info,
                        "message_id": message_id
                    })
            except Exception as e:
                print(f"Error processing email {email_id}: {e}")
                continue
        
        mail.close()
        mail.logout()
        
        # Return emails sorted by date (newest first) - already reversed by processing order
        # But also sort by date to ensure proper ordering
        emails.sort(key=lambda x: x.get('date', ''), reverse=True)
        
        return emails
    
    def process_single_email(self, email_id: str, db: Session) -> Optional[Dict]:
        """Process a single email and extract information, check for rejections"""
        mail = None
        try:
            mail = self.connect_email()
            mail.select("INBOX")
            
            status, msg_data = mail.fetch(email_id.encode(), "(RFC822)")
            email_body = msg_data[0][1]
            msg = email.message_from_bytes(email_body)
            
            email_content = self.parse_email_content(msg)
            
            # Extract information using LLM
            extracted_data = self.extract_with_llm(email_content)
            
            if not extracted_data:
                return None
            
            # Get email date
            email_date = msg.get("Date")
            if email_date:
                try:
                    from email.utils import parsedate_to_datetime
                    email_date = parsedate_to_datetime(email_date)
                    # Convert to naive datetime and set to midnight to use just the date
                    if email_date.tzinfo:
                        email_date = email_date.replace(tzinfo=None)
                    email_date = email_date.replace(hour=0, minute=0, second=0, microsecond=0)
                except:
                    # Fallback to yesterday if parsing fails
                    from datetime import timedelta
                    email_date = (datetime.now() - timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
            else:
                # Default to yesterday if no date
                from datetime import timedelta
                email_date = (datetime.now() - timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
            
            # Check if it's a rejection
            is_rejection = (
                extracted_data.get('status', '').lower() == 'rejected' or
                'reject' in email_content['subject'].lower() or
                'reject' in email_content['body'].lower() or
                extracted_data.get('rejection_date') is not None
            )
            
            # If rejection, try to match with existing application
            matched_application = None
            if is_rejection and extracted_data.get('company_name'):
                # Try to find matching application
                matched_application = db.query(Application).filter(
                    Application.company_name.ilike(f"%{extracted_data['company_name']}%")
                ).first()
                
                if not matched_application and extracted_data.get('position'):
                    # Try matching by position
                    matched_application = db.query(Application).filter(
                        Application.position.ilike(f"%{extracted_data['position']}%")
                    ).first()
            
            result = {
                "email_id": email_id,
                "email_date": email_date.isoformat(),
                "extracted_data": extracted_data,
                "is_rejection": is_rejection,
                "matched_application_id": matched_application.id if matched_application else None
            }
            
            return result
            
        except Exception as e:
            print(f"Error processing email {email_id}: {e}")
            # Re-raise authentication errors so they can be handled properly
            if "authentication failed" in str(e).lower():
                raise
            return None
        finally:
            if mail:
                try:
                    mail.close()
                    mail.logout()
                except:
                    pass

