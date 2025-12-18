"""
User Profile storage for resume generation.
Stores personal details that can be reused for generating resumes.
"""
import json
import os
from pathlib import Path
from typing import Dict, Optional

class UserProfile:
    def __init__(self):
        # Store profile in backend directory
        backend_dir = Path(__file__).parent
        self.profile_file = backend_dir / "user_profile.json"
    
    def get_profile(self) -> Dict:
        """Get user profile data"""
        if not self.profile_file.exists():
            return self._get_default_profile()
        
        try:
            with open(self.profile_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                # Merge with defaults to ensure all fields exist
                default = self._get_default_profile()
                default.update(data)
                return default
        except Exception as e:
            print(f"Error reading profile: {e}")
            return self._get_default_profile()
    
    def save_profile(self, profile_data: Dict) -> bool:
        """Save user profile data"""
        try:
            # Validate and merge with defaults
            default = self._get_default_profile()
            default.update(profile_data)
            
            with open(self.profile_file, 'w', encoding='utf-8') as f:
                json.dump(default, f, indent=2, ensure_ascii=False)
            return True
        except Exception as e:
            print(f"Error saving profile: {e}")
            return False
    
    def _get_default_profile(self) -> Dict:
        """Get default profile structure"""
        return {
            "personal_info": {
                "name": "",
                "email": "",
                "phone": "",
                "location": "",
                "linkedin": "",
                "portfolio": "",
                "github": ""
            },
            "summary": "",
            "skills": [],
            "experience": [],
            "education": [],
            "projects": [],
            "certifications": [],
            "languages": [],
            "publications": [],
            "awards": [],
            "volunteer_work": [],
            "portfolio_text": "",
            "additional_info": {}
        }

