import base64
import ollama
from typing import Dict, Optional
import json
import re
from datetime import datetime

from config import settings

class ImageProcessor:
    def __init__(self):
        self.ollama_client = ollama.Client(host=settings.ollama_base_url)
        # Use a vision model if available, otherwise fall back to regular model
        self.model = settings.ollama_model
        # Try vision-capable models first
        self.vision_models = ["llava", "bakllava", "llava:latest"]
        
    def image_to_base64(self, image_path: str) -> str:
        """Convert image file to base64 string"""
        with open(image_path, "rb") as image_file:
            return base64.b64encode(image_file.read()).decode('utf-8')
    
    def extract_from_image(self, image_path: str) -> Optional[Dict]:
        """Extract job application information from an image using Ollama vision model"""
        try:
            # Read image data
            with open(image_path, "rb") as image_file:
                image_data = image_file.read()
            
            prompt = """Analyze this job posting image and extract the following information. 
Return a JSON object with these fields if available:
- company_name: Name of the company
- position: Job position/title
- location: Job location (city, state, remote, etc.)
- job_url: URL to job posting if visible
- contact_email: Contact email if mentioned
- salary_range: Salary range if mentioned
- notes: Any additional relevant information from the posting

Return ONLY valid JSON, no additional text. If information is not available, use null for that field."""

            # Try to find an available vision model
            vision_model_available = None
            try:
                models_response = self.ollama_client.list()
                available_models = [m['name'] for m in models_response.get('models', [])]
                
                # Check for vision models
                for vision_model_name in self.vision_models:
                    for available_model in available_models:
                        if vision_model_name in available_model.lower():
                            vision_model_available = available_model
                            break
                    if vision_model_available:
                        break
            except Exception as e:
                print(f"Error checking for vision models: {e}")
            
            # Use vision model if available, otherwise use regular model
            if vision_model_available:
                try:
                    response = self.ollama_client.generate(
                        model=vision_model_available,
                        prompt=prompt,
                        images=[image_data],
                        format="json"
                    )
                except Exception as e:
                    print(f"Error with vision model {vision_model_available}, trying regular model: {e}")
                    # Fallback to regular model (won't process image, but won't crash)
                    response = self.ollama_client.generate(
                        model=self.model,
                        prompt="Extract job information from text. Return JSON with company_name, position, location, job_url, contact_email, salary_range, notes. Use null for unavailable fields.",
                        format="json"
                    )
            else:
                # No vision model available
                error_msg = (
                    "Vision model not available. To enable image processing:\n"
                    "1. Make sure Ollama is installed: https://ollama.ai\n"
                    "2. Install a vision model: ollama pull llava\n"
                    "3. Restart the application"
                )
                print(error_msg)
                return {
                    "company_name": None,
                    "position": None,
                    "location": None,
                    "job_url": None,
                    "contact_email": None,
                    "salary_range": None,
                    "notes": error_msg
                }
            
            # Extract JSON from response
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
            
            result = json.loads(response_text)
            
            # Ensure all fields are present
            return {
                "company_name": result.get('company_name'),
                "position": result.get('position'),
                "location": result.get('location'),
                "job_url": result.get('job_url'),
                "contact_email": result.get('contact_email'),
                "salary_range": result.get('salary_range'),
                "notes": result.get('notes')
            }
            
        except json.JSONDecodeError as e:
            print(f"Error parsing JSON from LLM response: {e}")
            print(f"Response was: {response_text[:500]}")
            return None
        except Exception as e:
            print(f"Error extracting from image: {e}")
            return None

