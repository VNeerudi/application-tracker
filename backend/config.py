from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # Email settings
    email_provider: str = "gmail"  # gmail or outlook
    email_address: Optional[str] = None
    email_password: Optional[str] = None
    email_app_password: Optional[str] = None  # For Gmail app password
    imap_server: Optional[str] = None
    imap_port: int = 993
    
    # Ollama settings
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "gemma3:4b"  # or mistral, codellama, etc.
    
    # Gemini settings
    gemini_api_key: Optional[str] = None
    gemini_model: str = "gemini-pro"  # or gemini-1.5-pro, gemini-1.5-flash, etc.
    
    # Database
    database_url: str = "sqlite:///./job_applications.db"

    # Simple auth (for local dashboard access)
    auth_username: str = "admin"
    auth_password: str = "admin"  # Override in .env for better security
    
    class Config:
        env_file = ".env"
        case_sensitive = False
        extra = "ignore"  # Ignore extra fields from .env file

settings = Settings()

