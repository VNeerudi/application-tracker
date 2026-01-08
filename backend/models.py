from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

from database import Base

# SQLAlchemy Model
class Application(Base):
    __tablename__ = "applications"
    
    id = Column(Integer, primary_key=True, index=True)
    company_name = Column(String, nullable=False, index=True)
    position = Column(String, nullable=False)
    applied_date = Column(DateTime, default=datetime.utcnow, nullable=False)
    status = Column(String, default="pending", nullable=False)  # pending, interview, rejected, accepted
    interview_date = Column(DateTime, nullable=True)
    rejection_date = Column(DateTime, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    job_url = Column(String, nullable=True)
    contact_email = Column(String, nullable=True)
    location = Column(String, nullable=True)
    salary_range = Column(String, nullable=True)
    source = Column(String, nullable=True)  # email, manual, etc.
    email_id = Column(String, nullable=True)  # Store email ID for deduplication
    image_path = Column(String, nullable=True)  # Path to uploaded job posting image
    resume_path = Column(String, nullable=True)  # Path to generated resume PDF

# Pydantic Models
class ApplicationBase(BaseModel):
    company_name: str
    position: str
    applied_date: Optional[datetime] = None
    status: str = "pending"
    interview_date: Optional[datetime] = None
    rejection_date: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    notes: Optional[str] = None
    job_url: Optional[str] = None
    contact_email: Optional[str] = None
    location: Optional[str] = None
    salary_range: Optional[str] = None
    source: Optional[str] = None
    email_id: Optional[str] = None
    image_path: Optional[str] = None
    resume_path: Optional[str] = None

class ApplicationCreate(ApplicationBase):
    pass

class ApplicationUpdate(BaseModel):
    company_name: Optional[str] = None
    position: Optional[str] = None
    applied_date: Optional[datetime] = None
    status: Optional[str] = None
    interview_date: Optional[datetime] = None
    rejection_date: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    notes: Optional[str] = None
    job_url: Optional[str] = None
    contact_email: Optional[str] = None
    location: Optional[str] = None
    salary_range: Optional[str] = None
    source: Optional[str] = None
    email_id: Optional[str] = None
    image_path: Optional[str] = None
    resume_path: Optional[str] = None

class ApplicationResponse(ApplicationBase):
    id: int
    
    class Config:
        from_attributes = True

