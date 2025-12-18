# Job Application Tracker

A comprehensive job application tracking tool that automatically extracts job application information from emails using AI (Ollama) and provides a beautiful dashboard to manage your applications.

## Features

- 📧 **Email Integration**: Automatically syncs with Gmail or Outlook to extract job application information
- 🤖 **AI-Powered Extraction**: Uses Ollama LLM to intelligently parse emails and extract:
  - Company name and position
  - Application status (pending, interview, rejected, accepted)
  - Interview dates
  - Rejection dates and reasons
  - Job URLs, contact emails, and location
- 📸 **Image Upload & Auto-Fill**: Upload screenshots of job postings and automatically extract information using AI vision models
- 📊 **Dashboard**: Beautiful React dashboard to view and manage all applications
- 🔍 **Filtering**: Filter applications by status
- 📈 **Statistics**: View overview statistics of your applications
- ✏️ **Manual Entry**: Add or edit applications manually

## Tech Stack

- **Backend**: FastAPI (Python)
- **Frontend**: React + Vite
- **Database**: SQLite
- **Email**: imaplib (Gmail/Outlook support)
- **AI**: Ollama Python SDK
- **Storage**: SQLite

## Prerequisites

1. **Python 3.8+**
2. **Node.js 16+**
3. **Ollama** installed and running locally
   - Download from: https://ollama.ai
   - Install a text model: `ollama pull llama2` (or mistral, codellama, etc.)
   - Install a vision model for image processing: `ollama pull llava` (recommended for image upload feature)

## Setup

### 1. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install Python dependencies
pip install -r ../requirements.txt

# Create .env file
cp .env.example .env
```

Edit `.env` file with your email credentials:

```env
EMAIL_PROVIDER=gmail
EMAIL_ADDRESS=your-email@gmail.com
EMAIL_APP_PASSWORD=your-app-password
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama2
```

**For Gmail:**
- Enable 2-factor authentication
- Generate an App Password: https://myaccount.google.com/apppasswords

**For Outlook:**
- Use your regular password or app password if 2FA is enabled

### 2. Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install
```

### 3. Run the Application

**Terminal 1 - Backend:**
```bash
cd backend
python main.py
```

The API will be available at `http://localhost:8000`

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

The dashboard will be available at `http://localhost:3000`

## Usage

1. **Sync Emails**: Click the "Sync Emails" button to fetch and process emails from the last 30 days
2. **Upload Image**: Click "Add Application" and upload a screenshot of a job posting - the form will auto-fill with extracted information
3. **View Applications**: Browse all your applications with filtering options
4. **Add Manually**: Manually enter a job application if preferred
5. **Edit/Delete**: Use the Edit and Delete buttons on each application card
6. **Track Status**: Update application status as you progress through the hiring process

## API Endpoints

- `GET /api/applications` - Get all applications (with optional status filter)
- `GET /api/applications/{id}` - Get specific application
- `POST /api/applications` - Create new application
- `PUT /api/applications/{id}` - Update application
- `DELETE /api/applications/{id}` - Delete application
- `POST /api/sync-emails` - Sync and process emails
- `GET /api/stats` - Get application statistics

## Database

The SQLite database (`job_applications.db`) is automatically created in the backend directory. It stores:
- Application details
- Status tracking
- Interview and rejection dates
- Notes and additional information

## Troubleshooting

1. **Ollama Connection Error**: Make sure Ollama is running (`ollama serve`) and the model is installed
2. **Email Connection Error**: Verify your email credentials and app password in `.env`
3. **CORS Errors**: Ensure the frontend proxy is configured correctly in `vite.config.js`

## License

MIT

