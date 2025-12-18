import React, { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import { format } from 'date-fns'
import './App.css'
import Sidebar from './components/Sidebar'
import { LightPullThemeSwitcher } from './components/ui/LightPullThemeSwitcher'

const API_BASE = 'http://localhost:8000/api'

function App() {
  const [applications, setApplications] = useState([])
  const [stats, setStats] = useState({})
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [filter, setFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editingApp, setEditingApp] = useState(null)

  const [formData, setFormData] = useState({
    company_name: '',
    position: '',
    status: 'pending',
    applied_date: '',
    interview_date: '',
    rejection_date: '',
    rejection_reason: '',
    notes: '',
    job_url: '',
    contact_email: '',
    location: '',
    salary_range: '',
    image_path: ''
  })
  const [uploadingImage, setUploadingImage] = useState(false)
  const [imagePreview, setImagePreview] = useState(null)
  const [expandedEmailId, setExpandedEmailId] = useState(null)
  const [showEmailList, setShowEmailList] = useState(false)
  const [emails, setEmails] = useState([])
  const [loadingEmails, setLoadingEmails] = useState(false)
  const [processingEmail, setProcessingEmail] = useState(null)
  const [autoSyncing, setAutoSyncing] = useState(false)
  const [showAutoSyncModal, setShowAutoSyncModal] = useState(false)
  const [emailCount, setEmailCount] = useState(1)
  const [autoSyncProgress, setAutoSyncProgress] = useState({ current: 0, total: 0, results: [] })
  const [collapsedDates, setCollapsedDates] = useState(new Set())
  const [collapsedCompanies, setCollapsedCompanies] = useState(new Set())
  const [currentPage, setCurrentPage] = useState('tracker') // 'tracker' or 'resume-builder'
  const [isDark, setIsDark] = useState(() => {
    // Check localStorage for saved theme preference
    const saved = localStorage.getItem('darkTheme')
    return saved ? JSON.parse(saved) : false
  })
  
  // Resume builder state
  const [jobDescription, setJobDescription] = useState('')
  const [selectedApplicationId, setSelectedApplicationId] = useState(null)
  const [resumeData, setResumeData] = useState(null)
  const [generatingResume, setGeneratingResume] = useState(false)
  const [creatingPdf, setCreatingPdf] = useState(false)
  const [resumePreview, setResumePreview] = useState(null)
  const [editingResume, setEditingResume] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [userProfile, setUserProfile] = useState(null)
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [extractingPortfolio, setExtractingPortfolio] = useState(false)

  const processImageFile = useCallback(async (file) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please paste an image file')
      return
    }

    // Show preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setImagePreview(reader.result)
    }
    reader.readAsDataURL(file)

    // Upload and extract data
    setUploadingImage(true)
    try {
      const formData = new FormData()
      formData.append('file', file, 'pasted-image.png')

      const response = await axios.post(`${API_BASE}/upload-image`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })

      // Auto-fill form with extracted data
      if (response.data) {
        setFormData(prev => ({
          ...prev,
          company_name: response.data.company_name || prev.company_name,
          position: response.data.position || prev.position,
          location: response.data.location || prev.location,
          job_url: response.data.job_url || prev.job_url,
          contact_email: response.data.contact_email || prev.contact_email,
          salary_range: response.data.salary_range || prev.salary_range,
          notes: response.data.notes || prev.notes,
          image_path: response.data.image_path || prev.image_path
        }))
        alert('Image processed! Form fields have been auto-filled.')
      }
    } catch (error) {
      alert('Error uploading image: ' + (error.response?.data?.detail || error.message))
    } finally {
      setUploadingImage(false)
    }
  }, [])

  useEffect(() => {
    fetchApplications()
    fetchStats()
  }, [filter])

  useEffect(() => {
    // Handle paste event when form is open
    const handlePaste = async (e) => {
      if (!showForm) return

      const items = e.clipboardData?.items
      if (!items) return

      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.type.indexOf('image') !== -1) {
          e.preventDefault()
          const blob = item.getAsFile()
          if (blob) {
            await processImageFile(blob)
          }
          break
        }
      }
    }

    if (showForm) {
      window.addEventListener('paste', handlePaste)
      return () => {
        window.removeEventListener('paste', handlePaste)
      }
    }
  }, [showForm, processImageFile])

  const fetchApplications = async () => {
    try {
      const url = filter === 'all'
        ? `${API_BASE}/applications`
        : `${API_BASE}/applications?status=${filter}`
      const response = await axios.get(url)
      setApplications(response.data)
    } catch (error) {
      console.error('Error fetching applications:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API_BASE}/stats`)
      setStats(response.data)
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }

  const syncEmails = async () => {
    setSyncing(true)
    try {
      const response = await axios.post(`${API_BASE}/sync-emails`)
      alert(response.data.message)
      fetchApplications()
      fetchStats()
    } catch (error) {
      alert('Error syncing emails: ' + (error.response?.data?.detail || error.message))
    } finally {
      setSyncing(false)
    }
  }

  const fetchEmails = async () => {
    setLoadingEmails(true)
    try {
      // Only fetch emails from today (days_back=0)
      const response = await axios.get(`${API_BASE}/emails?days_back=0&limit=50`)
      setEmails(response.data)
    } catch (error) {
      alert('Error fetching emails: ' + (error.response?.data?.detail || error.message))
    } finally {
      setLoadingEmails(false)
    }
  }

  const captureScreenshot = async () => {
    try {
      // Use browser's screenshot API if available (requires permission)
      if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true })
        const video = document.createElement('video')
        video.srcObject = stream
        video.play()

        video.onloadedmetadata = () => {
          const canvas = document.createElement('canvas')
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
          const ctx = canvas.getContext('2d')
          ctx.drawImage(video, 0, 0)

          canvas.toBlob(async (blob) => {
            stream.getTracks().forEach(track => track.stop())
            if (blob) {
              await processImageFile(blob)
            }
          }, 'image/png')
        }
      } else {
        alert('Screenshot capture not supported in this browser. Please use the paste function (Ctrl+V) after taking a screenshot.')
      }
    } catch (error) {
      console.error('Error capturing screenshot:', error)
      alert('Could not capture screenshot. Please paste the image instead (Ctrl+V).')
    }
  }

  const processEmail = async (emailId) => {
    setProcessingEmail(emailId)
    try {
      const response = await axios.post(`${API_BASE}/process-email/${emailId}`)

      if (response.data.application_updated) {
        alert(`Rejection detected! Updated application: ${response.data.application.company_name} - ${response.data.application.position}`)
      } else if (response.data.application_created) {
        alert(`New application created: ${response.data.application.company_name} - ${response.data.application.position}`)
      } else {
        alert('Email processed. ' + response.data.message)
      }

      fetchApplications()
      fetchStats()
      fetchEmails() // Refresh email list
    } catch (error) {
      alert('Error processing email: ' + (error.response?.data?.detail || error.message))
    } finally {
      setProcessingEmail(null)
    }
  }

  const handleAutoSync = async () => {
    setShowAutoSyncModal(true)
  }

  const startAutoSync = async () => {
    if (emailCount < 1 || emailCount > 10) {
      alert('Please enter a number between 1 and 10')
      return
    }

    setShowAutoSyncModal(false)
    setAutoSyncing(true)
    setAutoSyncProgress({ current: 0, total: emailCount, results: [] })

    try {
      // Fetch recent emails (all emails, not just unread)
      const emailsResponse = await axios.get(`${API_BASE}/emails?days_back=0&limit=${emailCount}`)
      const recentEmails = emailsResponse.data

      if (recentEmails.length === 0) {
        alert('No emails found to process')
        setAutoSyncing(false)
        return
      }

      // Process each email
      const results = []
      for (let i = 0; i < Math.min(recentEmails.length, emailCount); i++) {
        const email = recentEmails[i]
        setAutoSyncProgress({
          current: i + 1,
          total: Math.min(recentEmails.length, emailCount),
          results: [...results]
        })

        try {
          const response = await axios.post(`${API_BASE}/process-email/${email.id}`)
          
          let resultMessage = ''
          if (response.data.application_updated) {
            resultMessage = `✓ Updated: ${response.data.application.company_name} - ${response.data.application.position}`
          } else if (response.data.application_created) {
            resultMessage = `✓ Created: ${response.data.application.company_name} - ${response.data.application.position}`
          } else {
            resultMessage = `✓ Processed: ${email.subject.substring(0, 50)}...`
          }

          results.push({ success: true, message: resultMessage, email: email.subject })
        } catch (error) {
          results.push({
            success: false,
            message: `✗ Error: ${error.response?.data?.detail || error.message}`,
            email: email.subject
          })
        }
      }

      setAutoSyncProgress({
        current: Math.min(recentEmails.length, emailCount),
        total: Math.min(recentEmails.length, emailCount),
        results: results
      })

      // Refresh data
      fetchApplications()
      fetchStats()
      fetchEmails()

      // Show summary
      const successCount = results.filter(r => r.success).length
      const failCount = results.filter(r => !r.success).length
      
      setTimeout(() => {
        alert(`Auto Sync Complete!\n\n✓ Successfully processed: ${successCount}\n✗ Failed: ${failCount}`)
        setAutoSyncing(false)
        setAutoSyncProgress({ current: 0, total: 0, results: [] })
      }, 500)
    } catch (error) {
      alert('Error during auto sync: ' + (error.response?.data?.detail || error.message))
      setAutoSyncing(false)
      setAutoSyncProgress({ current: 0, total: 0, results: [] })
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      // Prepare data - remove empty strings and convert to null for optional fields
      const submitData = { ...formData }
      
      // Format applied_date to datetime string (set to midnight)
      if (submitData.applied_date) {
        submitData.applied_date = `${submitData.applied_date}T00:00:00`
      }
      
      // Convert empty strings to null for optional fields
      const optionalFields = ['interview_date', 'rejection_date', 'rejection_reason', 'notes', 
                              'job_url', 'contact_email', 'location', 'salary_range', 'image_path']
      optionalFields.forEach(field => {
        if (submitData[field] === '') {
          submitData[field] = null
        }
      })
      
      // Remove empty date strings
      if (submitData.interview_date === '') submitData.interview_date = null
      if (submitData.rejection_date === '') submitData.rejection_date = null
      
      if (editingApp) {
        await axios.put(`${API_BASE}/applications/${editingApp.id}`, submitData)
      } else {
        await axios.post(`${API_BASE}/applications`, submitData)
      }
      setShowForm(false)
      setEditingApp(null)
      resetForm()
      fetchApplications()
      fetchStats()
    } catch (error) {
      let errorMessage = 'Unknown error occurred'
      if (error.response) {
        // Handle FastAPI validation errors
        if (error.response.data?.detail) {
          if (Array.isArray(error.response.data.detail)) {
            // Pydantic validation errors
            errorMessage = error.response.data.detail.map(err => 
              `${err.loc?.join('.')}: ${err.msg}`
            ).join('\n')
          } else if (typeof error.response.data.detail === 'string') {
            errorMessage = error.response.data.detail
          } else {
            errorMessage = JSON.stringify(error.response.data.detail, null, 2)
          }
        } else {
          errorMessage = error.response.data?.message || JSON.stringify(error.response.data)
        }
      } else if (error.message) {
        errorMessage = error.message
      }
      alert('Error saving application:\n' + errorMessage)
      console.error('Full error:', error)
    }
  }

  const handleEdit = (app) => {
    setEditingApp(app)
    setFormData({
      company_name: app.company_name || '',
      position: app.position || '',
      status: app.status || 'pending',
      applied_date: app.applied_date ? format(new Date(app.applied_date), "yyyy-MM-dd") : '',
      interview_date: app.interview_date ? format(new Date(app.interview_date), "yyyy-MM-dd'T'HH:mm") : '',
      rejection_date: app.rejection_date ? format(new Date(app.rejection_date), "yyyy-MM-dd") : '',
      rejection_reason: app.rejection_reason || '',
      notes: app.notes || '',
      job_url: app.job_url || '',
      contact_email: app.contact_email || '',
      location: app.location || '',
      salary_range: app.salary_range || '',
      image_path: app.image_path || ''
    })
    setImagePreview(app.image_path ? `http://localhost:8000${app.image_path}` : null)
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this application?')) return
    try {
      await axios.delete(`${API_BASE}/applications/${id}`)
      fetchApplications()
      fetchStats()
    } catch (error) {
      alert('Error deleting application: ' + (error.response?.data?.detail || error.message))
    }
  }

  const resetForm = () => {
    setFormData({
      company_name: '',
      position: '',
      status: 'pending',
      applied_date: format(new Date(), 'yyyy-MM-dd'), // Default to today's date
      interview_date: '',
      rejection_date: '',
      rejection_reason: '',
      notes: '',
      job_url: '',
      contact_email: '',
      location: '',
      salary_range: '',
      image_path: ''
    })
    setImagePreview(null)
  }

  const generateResume = async () => {
    if (!jobDescription.trim()) {
      alert('Please enter a job description')
      return
    }
    
    if (!selectedApplicationId) {
      alert('Please select an application')
      return
    }

    setGeneratingResume(true)
    try {
      const response = await axios.post(`${API_BASE}/resume/generate`, {
        job_description: jobDescription,
        application_id: selectedApplicationId
      })
      
      setResumeData(response.data.resume_data)
      setResumePreview(response.data.resume_data)
    } catch (error) {
      alert('Error generating resume: ' + (error.response?.data?.detail || error.message))
    } finally {
      setGeneratingResume(false)
    }
  }

  const createPdf = async () => {
    if (!resumeData || !selectedApplicationId) {
      alert('Please generate a resume first')
      return
    }

    setCreatingPdf(true)
    try {
      const response = await axios.post(`${API_BASE}/resume/create-pdf`, {
        resume_data: resumeData,
        application_id: selectedApplicationId
      })
      
      alert('Resume PDF created and saved successfully!')
      fetchApplications() // Refresh to show resume link
      setResumeData(null)
      setResumePreview(null)
      setJobDescription('')
    } catch (error) {
      alert('Error creating PDF: ' + (error.response?.data?.detail || error.message))
    } finally {
      setCreatingPdf(false)
    }
  }

  const loadResumeForApplication = async (appId) => {
    try {
      const response = await axios.get(`${API_BASE}/resume/${appId}`)
      if (response.data.resume_path) {
        window.open(`http://localhost:8000${response.data.resume_path}`, '_blank')
      }
    } catch (error) {
      if (error.response?.status === 404) {
        alert('No resume found for this application. Please generate one first.')
      } else {
        alert('Error loading resume: ' + (error.response?.data?.detail || error.message))
      }
    }
  }

  const fetchUserProfile = async () => {
    setLoadingProfile(true)
    try {
      const response = await axios.get(`${API_BASE}/user-profile`)
      setUserProfile(response.data)
    } catch (error) {
      console.error('Error fetching profile:', error)
      setUserProfile(null)
    } finally {
      setLoadingProfile(false)
    }
  }

  const saveUserProfile = async (profileData) => {
    try {
      await axios.post(`${API_BASE}/user-profile`, profileData)
      alert('Profile saved successfully!')
      await fetchUserProfile()
      setShowProfileModal(false)
    } catch (error) {
      alert('Error saving profile: ' + (error.response?.data?.detail || error.message))
    }
  }

  const extractFromPortfolio = async (portfolioText) => {
    if (!portfolioText.trim()) {
      alert('Please paste your portfolio text first')
      return
    }

    setExtractingPortfolio(true)
    try {
      const response = await axios.post(`${API_BASE}/extract-from-portfolio`, {
        portfolio_text: portfolioText
      })
      
      if (response.data.extracted_data) {
        // Merge extracted data with existing profile
        const currentProfile = userProfile || {
          personal_info: { name: '', email: '', phone: '', location: '', linkedin: '', portfolio: '', github: '' },
          summary: '',
          skills: [],
          experience: [],
          education: [],
          projects: [],
          certifications: [],
          publications: [],
          awards: [],
          volunteer_work: []
        }
        
        // Merge extracted data, keeping existing data where it exists
        const extracted = response.data.extracted_data
        const merged = {
          ...currentProfile,
          personal_info: { ...currentProfile.personal_info, ...extracted.personal_info },
          summary: extracted.summary || currentProfile.summary,
          skills: [...new Set([...currentProfile.skills, ...(extracted.skills || [])])],
          experience: [...currentProfile.experience, ...(extracted.experience || [])],
          education: [...currentProfile.education, ...(extracted.education || [])],
          projects: [...currentProfile.projects, ...(extracted.projects || [])],
          certifications: [...currentProfile.certifications, ...(extracted.certifications || [])],
          publications: [...(currentProfile.publications || []), ...(extracted.publications || [])],
          awards: [...(currentProfile.awards || []), ...(extracted.awards || [])],
          volunteer_work: [...(currentProfile.volunteer_work || []), ...(extracted.volunteer_work || [])],
          portfolio_text: currentProfile.portfolio_text || ''
        }
        
        // Create a new object to ensure React detects the change
        const newProfile = JSON.parse(JSON.stringify(merged))
        setUserProfile(newProfile)
        console.log('Profile updated after extraction:', Object.keys(newProfile))
        alert('Information extracted and merged with your profile! Please review and save.')
      } else if (response.data.error) {
        alert('Error: ' + response.data.error)
      }
    } catch (error) {
      console.error('Extraction error:', error)
      alert('Error extracting from portfolio: ' + (error.response?.data?.detail || error.message))
    } finally {
      setExtractingPortfolio(false)
    }
  }

  const updateResumeData = (field, value) => {
    if (!resumeData) return
    
    const updated = JSON.parse(JSON.stringify(resumeData))
    
    if (field.includes('.')) {
      const [parent, child] = field.split('.')
      if (parent === 'personal_info') {
        updated.personal_info = updated.personal_info || {}
        updated.personal_info[child] = value
      }
    } else if (field === 'skills' && Array.isArray(value)) {
      updated.skills = value
    } else {
      updated[field] = value
    }
    
    setResumeData(updated)
    setResumePreview(updated)
  }

  useEffect(() => {
    if (currentPage === 'resume-builder') {
      fetchUserProfile()
    }
  }, [currentPage])

  useEffect(() => {
    if (showProfileModal) {
      fetchUserProfile()
    }
  }, [showProfileModal])

  const handleImageUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    await processImageFile(file)
  }

  const getStatusColor = (status) => {
    const colors = {
      pending: '#f59e0b',
      interview: '#3b82f6',
      rejected: '#ef4444',
      accepted: '#10b981'
    }
    return colors[status] || '#6b7280'
  }

  // Update dark theme in localStorage and on document
  useEffect(() => {
    localStorage.setItem('darkTheme', JSON.stringify(isDark))
    if (isDark) {
      document.documentElement.classList.add('dark')
      document.body.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
      document.body.classList.remove('dark')
    }
  }, [isDark])

  const handleThemeToggle = (newValue) => {
    setIsDark(newValue)
  }

  if (loading) {
    return <div className="loading">Loading...</div>
  }

  return (
    <div className={`app ${isDark ? 'dark' : ''}`}>
      <Sidebar 
        isDark={isDark} 
        onThemeToggle={handleThemeToggle}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        onSyncEmails={syncEmails}
        onAutoSync={handleAutoSync}
        autoSyncing={autoSyncing}
        autoSyncProgress={autoSyncProgress}
        onAddApplication={() => { setShowForm(true); setEditingApp(null); resetForm() }}
        onViewEmails={() => { setShowEmailList(true); fetchEmails() }}
      />
      <LightPullThemeSwitcher isDark={isDark} onThemeToggle={handleThemeToggle} />
      <div className="main-content">
      <header className="header">
        <h1>Job Application Tracker</h1>
      </header>

      {currentPage === 'resume-builder' ? (
        <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <button 
                onClick={() => setCurrentPage('tracker')} 
                className="btn btn-secondary"
                style={{ 
                  background: '#6b7280', 
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '8px 16px'
                }}
              >
                ← Back to Tracker
              </button>
              <h2 style={{ margin: 0 }}>Resume Builder</h2>
            </div>
            <button 
              onClick={() => {
                console.log('Opening profile modal')
                setShowProfileModal(true)
                fetchUserProfile()
              }} 
              className="btn btn-secondary"
              style={{ background: '#6366f1', color: 'white' }}
            >
              👤 Manage Profile
            </button>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: editingResume ? '1fr 1fr 1fr' : '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
            {/* Left Column - Input */}
            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
              <h3 style={{ marginBottom: '15px' }}>Job Description</h3>
              
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                  Select Application:
                </label>
                <select
                  value={selectedApplicationId || ''}
                  onChange={(e) => setSelectedApplicationId(e.target.value ? parseInt(e.target.value) : null)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                >
                  <option value="">-- Select an application --</option>
                  {applications.map(app => (
                    <option key={app.id} value={app.id}>
                      {app.company_name} - {app.position}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                  Job Description:
                </label>
                <textarea
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Paste the job description here..."
                  style={{
                    width: '100%',
                    minHeight: '300px',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                />
              </div>

              <button
                onClick={generateResume}
                disabled={generatingResume || !jobDescription.trim() || !selectedApplicationId}
                className="btn btn-primary"
                style={{ width: '100%', marginBottom: '10px' }}
              >
                {generatingResume ? 'Generating...' : 'Generate Resume'}
              </button>

              {resumeData && (
                <>
                  <button
                    onClick={() => setEditingResume(!editingResume)}
                    className="btn btn-secondary"
                    style={{ width: '100%', marginBottom: '10px', background: '#f59e0b', color: 'white' }}
                  >
                    {editingResume ? '✓ Done Editing' : '✏️ Edit Resume'}
                  </button>
                  <button
                    onClick={createPdf}
                    disabled={creatingPdf}
                    className="btn btn-secondary"
                    style={{ width: '100%', background: '#10b981', color: 'white' }}
                  >
                    {creatingPdf ? 'Creating PDF...' : 'Create & Save PDF'}
                  </button>
                </>
              )}
            </div>

            {/* Middle Column - Editor (when editing) */}
            {editingResume && resumeData && (
              <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', maxHeight: '800px', overflowY: 'auto' }}>
                <h3 style={{ marginBottom: '15px' }}>Edit Resume</h3>
                
                {/* Personal Info */}
                <div style={{ marginBottom: '20px' }}>
                  <h4 style={{ marginBottom: '10px', fontSize: '14px', fontWeight: '600' }}>Personal Information</h4>
                  <input
                    type="text"
                    placeholder="Name"
                    value={resumeData.personal_info?.name || ''}
                    onChange={(e) => updateResumeData('personal_info.name', e.target.value)}
                    style={{ width: '100%', padding: '8px', marginBottom: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    value={resumeData.personal_info?.email || ''}
                    onChange={(e) => updateResumeData('personal_info.email', e.target.value)}
                    style={{ width: '100%', padding: '8px', marginBottom: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                  <input
                    type="text"
                    placeholder="Phone"
                    value={resumeData.personal_info?.phone || ''}
                    onChange={(e) => updateResumeData('personal_info.phone', e.target.value)}
                    style={{ width: '100%', padding: '8px', marginBottom: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                  <input
                    type="text"
                    placeholder="Location"
                    value={resumeData.personal_info?.location || ''}
                    onChange={(e) => updateResumeData('personal_info.location', e.target.value)}
                    style={{ width: '100%', padding: '8px', marginBottom: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                </div>

                {/* Summary */}
                <div style={{ marginBottom: '20px' }}>
                  <h4 style={{ marginBottom: '10px', fontSize: '14px', fontWeight: '600' }}>Professional Summary</h4>
                  <textarea
                    value={resumeData.summary || ''}
                    onChange={(e) => updateResumeData('summary', e.target.value)}
                    style={{ width: '100%', minHeight: '80px', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                    placeholder="Professional summary..."
                  />
                </div>

                {/* Skills */}
                <div style={{ marginBottom: '20px' }}>
                  <h4 style={{ marginBottom: '10px', fontSize: '14px', fontWeight: '600' }}>Skills (comma-separated)</h4>
                  <input
                    type="text"
                    value={Array.isArray(resumeData.skills) ? resumeData.skills.join(', ') : ''}
                    onChange={(e) => updateResumeData('skills', e.target.value.split(',').map(s => s.trim()).filter(s => s))}
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                    placeholder="Skill 1, Skill 2, Skill 3"
                  />
                </div>

                {/* Experience */}
                {resumeData.experience && resumeData.experience.length > 0 && (
                  <div style={{ marginBottom: '20px' }}>
                    <h4 style={{ marginBottom: '10px', fontSize: '14px', fontWeight: '600' }}>Experience</h4>
                    {resumeData.experience.map((exp, idx) => (
                      <div key={idx} style={{ marginBottom: '15px', padding: '10px', background: '#f9fafb', borderRadius: '4px' }}>
                        <input
                          type="text"
                          placeholder="Job Title"
                          value={exp.title || ''}
                          onChange={(e) => {
                            const updated = [...resumeData.experience]
                            updated[idx] = { ...updated[idx], title: e.target.value }
                            updateResumeData('experience', updated)
                          }}
                          style={{ width: '100%', padding: '6px', marginBottom: '6px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '12px' }}
                        />
                        <input
                          type="text"
                          placeholder="Company"
                          value={exp.company || ''}
                          onChange={(e) => {
                            const updated = [...resumeData.experience]
                            updated[idx] = { ...updated[idx], company: e.target.value }
                            updateResumeData('experience', updated)
                          }}
                          style={{ width: '100%', padding: '6px', marginBottom: '6px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '12px' }}
                        />
                        <textarea
                          placeholder="Description (one per line)"
                          value={Array.isArray(exp.description) ? exp.description.join('\n') : ''}
                          onChange={(e) => {
                            const updated = [...resumeData.experience]
                            updated[idx] = { ...updated[idx], description: e.target.value.split('\n').filter(d => d.trim()) }
                            updateResumeData('experience', updated)
                          }}
                          style={{ width: '100%', minHeight: '60px', padding: '6px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '12px' }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Right Column - Preview */}
            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
              <h3 style={{ marginBottom: '15px' }}>Resume Preview</h3>
              
              {resumePreview ? (
                <div style={{ 
                  border: '1px solid #ddd', 
                  borderRadius: '4px', 
                  padding: '20px',
                  maxHeight: '600px',
                  overflowY: 'auto',
                  background: '#f9fafb'
                }}>
                  {/* Personal Info */}
                  {resumePreview.personal_info && (
                    <div style={{ marginBottom: '20px', textAlign: 'center', borderBottom: '2px solid #2c3e50', paddingBottom: '15px' }}>
                      <h2 style={{ margin: '0 0 10px 0', color: '#1a1a1a' }}>
                        {resumePreview.personal_info.name || 'Your Name'}
                      </h2>
                      <div style={{ color: '#666', fontSize: '14px' }}>
                        {resumePreview.personal_info.email && <span>{resumePreview.personal_info.email}</span>}
                        {resumePreview.personal_info.phone && <span> | {resumePreview.personal_info.phone}</span>}
                        {resumePreview.personal_info.location && <span> | {resumePreview.personal_info.location}</span>}
                      </div>
                    </div>
                  )}

                  {/* Summary */}
                  {resumePreview.summary && (
                    <div style={{ marginBottom: '20px' }}>
                      <h3 style={{ color: '#2c3e50', borderBottom: '1px solid #ddd', paddingBottom: '5px', marginBottom: '10px' }}>
                        Professional Summary
                      </h3>
                      <p style={{ lineHeight: '1.6', color: '#333' }}>{resumePreview.summary}</p>
                    </div>
                  )}

                  {/* Skills */}
                  {resumePreview.skills && resumePreview.skills.length > 0 && (
                    <div style={{ marginBottom: '20px' }}>
                      <h3 style={{ color: '#2c3e50', borderBottom: '1px solid #ddd', paddingBottom: '5px', marginBottom: '10px' }}>
                        Skills
                      </h3>
                      <p style={{ lineHeight: '1.6', color: '#333' }}>
                        {resumePreview.skills.join(' • ')}
                      </p>
                    </div>
                  )}

                  {/* Experience */}
                  {resumePreview.experience && resumePreview.experience.length > 0 && (
                    <div style={{ marginBottom: '20px' }}>
                      <h3 style={{ color: '#2c3e50', borderBottom: '1px solid #ddd', paddingBottom: '5px', marginBottom: '10px' }}>
                        Professional Experience
                      </h3>
                      {resumePreview.experience.map((exp, idx) => (
                        <div key={idx} style={{ marginBottom: '15px' }}>
                          <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
                            {exp.title} | {exp.company} | {exp.location} | {exp.start_date} - {exp.end_date}
                          </div>
                          {exp.description && (
                            <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
                              {exp.description.map((desc, dIdx) => (
                                <li key={dIdx} style={{ marginBottom: '3px', lineHeight: '1.5' }}>{desc}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Education */}
                  {resumePreview.education && resumePreview.education.length > 0 && (
                    <div style={{ marginBottom: '20px' }}>
                      <h3 style={{ color: '#2c3e50', borderBottom: '1px solid #ddd', paddingBottom: '5px', marginBottom: '10px' }}>
                        Education
                      </h3>
                      {resumePreview.education.map((edu, idx) => (
                        <div key={idx} style={{ marginBottom: '10px' }}>
                          <strong>{edu.degree}</strong> | {edu.school} | {edu.location} | {edu.graduation_date}
                          {edu.gpa && <span> | GPA: {edu.gpa}</span>}
                          {edu.honors && <span> | {edu.honors}</span>}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Projects */}
                  {resumePreview.projects && resumePreview.projects.length > 0 && (
                    <div style={{ marginBottom: '20px' }}>
                      <h3 style={{ color: '#2c3e50', borderBottom: '1px solid #ddd', paddingBottom: '5px', marginBottom: '10px' }}>
                        Projects
                      </h3>
                      {resumePreview.projects.map((project, idx) => (
                        <div key={idx} style={{ marginBottom: '10px' }}>
                          <strong>{project.name}</strong>
                          {project.url && <span> | <a href={project.url} target="_blank" rel="noopener noreferrer">{project.url}</a></span>}
                          {project.description && <p style={{ margin: '5px 0', lineHeight: '1.5' }}>{project.description}</p>}
                          {project.technologies && (
                            <p style={{ margin: '5px 0', fontSize: '13px', color: '#666' }}>
                              Technologies: {project.technologies.join(', ')}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Certifications */}
                  {resumePreview.certifications && resumePreview.certifications.length > 0 && (
                    <div style={{ marginBottom: '20px' }}>
                      <h3 style={{ color: '#2c3e50', borderBottom: '1px solid #ddd', paddingBottom: '5px', marginBottom: '10px' }}>
                        Certifications
                      </h3>
                      {resumePreview.certifications.map((cert, idx) => (
                        <div key={idx} style={{ marginBottom: '10px' }}>
                          <strong>{cert.name}</strong> | {cert.issuer} | {cert.date}
                          {cert.expiry && <span> | Expires: {cert.expiry}</span>}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Publications */}
                  {resumePreview.publications && resumePreview.publications.length > 0 && (
                    <div style={{ marginBottom: '20px' }}>
                      <h3 style={{ color: '#2c3e50', borderBottom: '1px solid #ddd', paddingBottom: '5px', marginBottom: '10px' }}>
                        Publications
                      </h3>
                      {resumePreview.publications.map((pub, idx) => (
                        <div key={idx} style={{ marginBottom: '10px' }}>
                          <strong>{pub.title}</strong>
                          {pub.authors && <span> | {pub.authors}</span>}
                          {pub.journal && <span> | {pub.journal}</span>}
                          {pub.date && <span> | {pub.date}</span>}
                          {pub.url && <span> | <a href={pub.url} target="_blank" rel="noopener noreferrer">{pub.url}</a></span>}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Awards */}
                  {resumePreview.awards && resumePreview.awards.length > 0 && (
                    <div style={{ marginBottom: '20px' }}>
                      <h3 style={{ color: '#2c3e50', borderBottom: '1px solid #ddd', paddingBottom: '5px', marginBottom: '10px' }}>
                        Awards & Honors
                      </h3>
                      {resumePreview.awards.map((award, idx) => (
                        <div key={idx} style={{ marginBottom: '10px' }}>
                          <strong>{award.name}</strong> | {award.issuer} | {award.date}
                          {award.description && <span> | {award.description}</span>}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Volunteer Work */}
                  {resumePreview.volunteer_work && resumePreview.volunteer_work.length > 0 && (
                    <div style={{ marginBottom: '20px' }}>
                      <h3 style={{ color: '#2c3e50', borderBottom: '1px solid #ddd', paddingBottom: '5px', marginBottom: '10px' }}>
                        Volunteer Work
                      </h3>
                      {resumePreview.volunteer_work.map((vol, idx) => (
                        <div key={idx} style={{ marginBottom: '10px' }}>
                          <strong>{vol.role}</strong> | {vol.organization} | {vol.location} | {vol.start_date} - {vol.end_date}
                          {vol.description && <p style={{ margin: '5px 0', lineHeight: '1.5', fontSize: '13px', color: '#666' }}>{vol.description}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ 
                  border: '1px solid #ddd', 
                  borderRadius: '4px', 
                  padding: '40px',
                  textAlign: 'center',
                  color: '#999'
                }}>
                  Generate a resume to see preview here
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
      <div className="stats-container">
        <div className="stat-card">
          <div className="stat-value">{stats.total || 0}</div>
          <div className="stat-label">Total</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: '#f59e0b' }}>{stats.pending || 0}</div>
          <div className="stat-label">Pending</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: '#3b82f6' }}>{stats.interview || 0}</div>
          <div className="stat-label">Interview</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: '#ef4444' }}>{stats.rejected || 0}</div>
          <div className="stat-label">Rejected</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: '#10b981' }}>{stats.accepted || 0}</div>
          <div className="stat-label">Accepted</div>
        </div>
      </div>

      <div className="filters">
        <button
          className={filter === 'all' ? 'filter-btn active' : 'filter-btn'}
          onClick={() => setFilter('all')}
        >
          All
        </button>
        <button
          className={filter === 'pending' ? 'filter-btn active' : 'filter-btn'}
          onClick={() => setFilter('pending')}
        >
          Pending
        </button>
        <button
          className={filter === 'interview' ? 'filter-btn active' : 'filter-btn'}
          onClick={() => setFilter('interview')}
        >
          Interview
        </button>
        <button
          className={filter === 'rejected' ? 'filter-btn active' : 'filter-btn'}
          onClick={() => setFilter('rejected')}
        >
          Rejected
        </button>
        <button
          className={filter === 'accepted' ? 'filter-btn active' : 'filter-btn'}
          onClick={() => setFilter('accepted')}
        >
          Accepted
        </button>
      </div>

      {showEmailList && (
        <div className="modal-overlay" onClick={() => setShowEmailList(false)}>
          <div className="modal-content email-list-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2>Job-Related Emails</h2>
              <button onClick={() => setShowEmailList(false)} className="btn btn-secondary">Close</button>
            </div>

            {loadingEmails ? (
              <div className="loading">Loading emails...</div>
            ) : emails.length === 0 ? (
              <div className="empty-state">
                <p>No job-related emails found.</p>
              </div>
            ) : (
              <div className="email-list">
                {emails.map((email) => (
                  <div key={email.id} className="email-item">
                    <div className="email-header">
                      <div style={{ width: '100%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <strong>{email.subject}</strong>
                            {email.application && (
                              <div style={{ marginTop: '5px' }}>
                                <span className="status-badge" style={{
                                  backgroundColor: getStatusColor(email.application.status),
                                  fontSize: '0.75rem',
                                  padding: '2px 8px'
                                }}>
                                  {email.application.status}
                                </span>
                                <span style={{ marginLeft: '8px', fontSize: '0.875rem', fontWeight: '500' }}>
                                  {email.application.company} - {email.application.position}
                                </span>
                              </div>
                            )}
                          </div>
                          <div style={{ textAlign: 'right', fontSize: '0.875rem', color: '#6b7280' }}>
                            {format(new Date(email.date), 'MMM dd, yyyy HH:mm')}
                          </div>
                        </div>

                        <p style={{ margin: '5px 0', color: '#6b7280', fontSize: '0.875rem' }}>
                          From: {email.from}
                        </p>

                        <p style={{ margin: '8px 0', color: '#4b5563', fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}>
                          {expandedEmailId === email.id ? (
                            <div dangerouslySetInnerHTML={{ __html: email.body }} />
                          ) : (
                            email.preview
                          )}
                        </p>

                        {email.body && email.body.length > (email.preview ? email.preview.length : 0) && (
                          <button
                            type="button"
                            className="btn btn-small"
                            style={{ marginTop: '4px' }}
                            onClick={() =>
                              setExpandedEmailId(expandedEmailId === email.id ? null : email.id)
                            }
                          >
                            {expandedEmailId === email.id ? 'Hide full email' : 'Show full email'}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="email-actions">
                      <button
                        onClick={() => processEmail(email.id)}
                        disabled={processingEmail === email.id || (email.application && email.application.status !== 'rejected')}
                        className="btn btn-primary btn-small"
                      >
                        {processingEmail === email.id ? 'Loading...' : (email.application ? 'Update Status' : 'Load')}
                      </button>
                      <a
                        href={(() => {
                          // Extract email address from "From" field (handles "Name <email@domain.com>" format)
                          let emailAddress = email.from
                          const emailMatch = email.from.match(/<([^>]+)>/)
                          if (emailMatch) {
                            emailAddress = emailMatch[1]
                          }
                          
                          // Create Gmail search link using subject and sender email
                          const searchQuery = `subject:"${email.subject}" from:${emailAddress}`
                          return `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(searchQuery)}`
                        })()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-secondary btn-small"
                        style={{ textDecoration: 'none', display: 'inline-block' }}
                        title="Open this email in Gmail"
                      >
                        📧 Open Email
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => { setShowForm(false); setEditingApp(null); resetForm() }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: 0 }}>{editingApp ? '✏️ Edit Application' : '➕ Add New Application'}</h2>
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditingApp(null); resetForm() }}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#94a3b8',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => { e.target.style.background = '#f1f5f9'; e.target.style.color = '#64748b'; }}
                onMouseLeave={(e) => { e.target.style.background = 'none'; e.target.style.color = '#94a3b8'; }}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label style={{ marginBottom: '12px', display: 'block' }}>📸 Upload or Paste Job Posting Image (Auto-fill form)</label>
                <div style={{
                  border: '2px dashed #3b82f6',
                  borderRadius: '12px',
                  padding: '32px 20px',
                  textAlign: 'center',
                  background: 'linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%)',
                  marginBottom: '16px',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#2563eb';
                  e.currentTarget.style.transform = 'scale(1.01)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#3b82f6';
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
                  onPaste={(e) => {
                    e.preventDefault()
                    const items = e.clipboardData?.items
                    if (items) {
                      for (let i = 0; i < items.length; i++) {
                        const item = items[i]
                        if (item.type.indexOf('image') !== -1) {
                          const blob = item.getAsFile()
                          if (blob) {
                            processImageFile(blob)
                          }
                          break
                        }
                      }
                    }
                  }}
                  onClick={() => document.getElementById('file-input')?.click()}
                >
                  <div style={{ fontSize: '48px', marginBottom: '12px' }}>📎</div>
                  <p style={{ margin: '0 0 8px 0', color: '#475569', fontSize: '15px', fontWeight: '500' }}>
                    Click to upload or <strong style={{ color: '#3b82f6' }}>Ctrl+V / Cmd+V</strong> to paste screenshot
                  </p>
                  <p style={{ margin: 0, color: '#94a3b8', fontSize: '13px' }}>
                    Supports PNG, JPG, and other image formats
                  </p>
                  <input
                    id="file-input"
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploadingImage}
                    style={{ display: 'none' }}
                  />
                </div>
                {uploadingImage && (
                  <div style={{ 
                    color: '#3b82f6', 
                    marginTop: '16px', 
                    padding: '12px',
                    background: '#eff6ff',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontWeight: '500'
                  }}>
                    <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</span>
                    Processing image with AI...
                  </div>
                )}
                {imagePreview && (
                  <div style={{ 
                    marginTop: '16px',
                    padding: '8px',
                    background: '#f8fafc',
                    borderRadius: '12px',
                    border: '2px solid #e2e8f0'
                  }}>
                    <img
                      src={imagePreview}
                      alt="Preview"
                      style={{ 
                        maxWidth: '100%', 
                        maxHeight: '250px', 
                        borderRadius: '8px', 
                        border: '1px solid #e2e8f0',
                        display: 'block',
                        margin: '0 auto'
                      }}
                    />
                  </div>
                )}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Company Name *</label>
                  <input
                    type="text"
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Position *</label>
                  <input
                    type="text"
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    <option value="pending">Pending</option>
                    <option value="interview">Interview</option>
                    <option value="rejected">Rejected</option>
                    <option value="accepted">Accepted</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Applied Date *</label>
                  <input
                    type="date"
                    value={formData.applied_date}
                    onChange={(e) => setFormData({ ...formData, applied_date: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Location</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Interview Date</label>
                  <input
                    type="datetime-local"
                    value={formData.interview_date}
                    onChange={(e) => setFormData({ ...formData, interview_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Rejection Date</label>
                  <input
                    type="date"
                    value={formData.rejection_date}
                    onChange={(e) => setFormData({ ...formData, rejection_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Job URL</label>
                <input
                  type="url"
                  value={formData.job_url}
                  onChange={(e) => setFormData({ ...formData, job_url: e.target.value })}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Contact Email</label>
                  <input
                    type="email"
                    value={formData.contact_email}
                    onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Salary Range</label>
                  <input
                    type="text"
                    value={formData.salary_range || ''}
                    onChange={(e) => setFormData({ ...formData, salary_range: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Rejection Reason</label>
                <textarea
                  value={formData.rejection_reason}
                  onChange={(e) => setFormData({ ...formData, rejection_reason: e.target.value })}
                  rows="2"
                />
              </div>

              <div className="form-group">
                <label>Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows="3"
                />
              </div>

              <div className="form-actions">
                <button type="submit" className="btn btn-primary">
                  {editingApp ? 'Update' : 'Create'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => { setShowForm(false); setEditingApp(null); resetForm() }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="applications-table-container">
        {applications.length === 0 ? (
          <div className="empty-state">
            <p>No applications found. Click "Sync Emails" or "Add Application" to get started.</p>
          </div>
        ) : (
          (() => {
            // Group applications by date, then by company
            const groupedByDateAndCompany = applications.reduce((acc, app) => {
              // Parse applied_date as local date to avoid timezone issues
              let dateKey = 'no-date'
              if (app.applied_date) {
                const date = new Date(app.applied_date)
                // Get local date components to avoid timezone shifts
                const year = date.getFullYear()
                const month = String(date.getMonth() + 1).padStart(2, '0')
                const day = String(date.getDate()).padStart(2, '0')
                dateKey = `${year}-${month}-${day}`
              }
              const company = app.company_name || 'Unknown'
              
              if (!acc[dateKey]) {
                acc[dateKey] = {}
              }
              if (!acc[dateKey][company]) {
                acc[dateKey][company] = []
              }
              acc[dateKey][company].push(app)
              return acc
            }, {})

            // Sort dates (newest first)
            const sortedDates = Object.keys(groupedByDateAndCompany).sort((a, b) => {
              if (a === 'no-date') return 1
              if (b === 'no-date') return -1
              return b.localeCompare(a) // Newest first
            })

            // Sort companies within each date: companies with rejections go to bottom
            // Sort applications within each company: rejections last
            sortedDates.forEach(dateKey => {
              const companies = Object.keys(groupedByDateAndCompany[dateKey])
              
              // Sort companies: those with rejections go to bottom
              companies.sort((a, b) => {
                const aHasRejection = groupedByDateAndCompany[dateKey][a].some(app => app.status === 'rejected')
                const bHasRejection = groupedByDateAndCompany[dateKey][b].some(app => app.status === 'rejected')
                const aAllRejected = groupedByDateAndCompany[dateKey][a].every(app => app.status === 'rejected')
                const bAllRejected = groupedByDateAndCompany[dateKey][b].every(app => app.status === 'rejected')
                
                // Companies with all rejections go to very bottom
                if (aAllRejected && !bAllRejected) return 1
                if (!aAllRejected && bAllRejected) return -1
                
                // Companies with some rejections go below those without
                if (aHasRejection && !bHasRejection) return 1
                if (!aHasRejection && bHasRejection) return -1
                
                // Otherwise sort alphabetically
                return a.localeCompare(b)
              })
              
              companies.forEach(company => {
                // Sort applications: rejections last
                groupedByDateAndCompany[dateKey][company].sort((a, b) => {
                  if (a.status === 'rejected' && b.status !== 'rejected') return 1
                  if (a.status !== 'rejected' && b.status === 'rejected') return -1
                  return 0
                })
              })
            })

            const toggleDateCollapse = (dateKey) => {
              setCollapsedDates(prev => {
                const newSet = new Set(prev)
                if (newSet.has(dateKey)) {
                  newSet.delete(dateKey)
                } else {
                  newSet.add(dateKey)
                }
                return newSet
              })
            }

            return (
              <table className="applications-table">
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Position</th>
                    <th>Status</th>
                    <th>Applied Date</th>
                    <th>Interview Date</th>
                    <th>Rejection Date</th>
                    <th>Location</th>
                    <th>Salary Range</th>
                    <th>Job URL</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedDates.map((dateKey) => {
                    const dateCompanies = groupedByDateAndCompany[dateKey]
                    const isCollapsed = collapsedDates.has(dateKey)
                    // Parse dateKey as local date to avoid timezone issues
                    const dateDisplay = dateKey === 'no-date' 
                      ? 'No Date' 
                      : (() => {
                          const [year, month, day] = dateKey.split('-').map(Number)
                          return format(new Date(year, month - 1, day), 'MMM dd, yyyy')
                        })()
                    
                    // Count total applications for this date
                    const totalApps = Object.values(dateCompanies).reduce((sum, apps) => sum + apps.length, 0)

                    return (
                      <React.Fragment key={dateKey}>
                        <tr className="date-header-row">
                          <td colSpan="10" className="date-header-cell">
                            <button
                              onClick={() => toggleDateCollapse(dateKey)}
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                width: '100%',
                                textAlign: 'left',
                                padding: '8px 0',
                                fontSize: '1rem',
                                fontWeight: '600',
                                color: 'white'
                              }}
                            >
                              <span>{isCollapsed ? '▶' : '▼'}</span>
                              <span>{dateDisplay}</span>
                              <span style={{ fontSize: '0.875rem', fontWeight: '400', color: 'rgba(255, 255, 255, 0.9)', marginLeft: 'auto' }}>
                                ({totalApps} {totalApps === 1 ? 'application' : 'applications'})
                              </span>
                            </button>
                          </td>
                        </tr>
                        {!isCollapsed && Object.keys(dateCompanies).sort((a, b) => {
                          // Sort companies: those with rejections go to bottom
                          const aHasRejection = dateCompanies[a].some(app => app.status === 'rejected')
                          const bHasRejection = dateCompanies[b].some(app => app.status === 'rejected')
                          const aAllRejected = dateCompanies[a].every(app => app.status === 'rejected')
                          const bAllRejected = dateCompanies[b].every(app => app.status === 'rejected')
                          
                          // Companies with all rejections go to very bottom
                          if (aAllRejected && !bAllRejected) return 1
                          if (!aAllRejected && bAllRejected) return -1
                          
                          // Companies with some rejections go below those without
                          if (aHasRejection && !bHasRejection) return 1
                          if (!aHasRejection && bHasRejection) return -1
                          
                          // Otherwise sort alphabetically
                          return a.localeCompare(b)
                        }).map((companyName) => {
                          const companyApps = dateCompanies[companyName]
                          const isAllRejected = companyApps.every(app => app.status === 'rejected')
                          const companyKey = `${dateKey}-${companyName}`
                          const isCompanyCollapsed = collapsedCompanies.has(companyKey)
                          
                          return (
                            <React.Fragment key={companyKey}>
                              {isAllRejected && (
                                <tr className="company-header-row">
                                  <td colSpan="10" className="company-header-cell">
                                    <button
                                      onClick={() => {
                                        setCollapsedCompanies(prev => {
                                          const newSet = new Set(prev)
                                          if (newSet.has(companyKey)) {
                                            newSet.delete(companyKey)
                                          } else {
                                            newSet.add(companyKey)
                                          }
                                          return newSet
                                        })
                                      }}
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        width: '100%',
                                        textAlign: 'left',
                                        padding: '8px 12px',
                                        fontSize: '0.9rem',
                                        fontWeight: '600',
                                        color: '#64748b'
                                      }}
                                    >
                                      <span>{isCompanyCollapsed ? '▶' : '▼'}</span>
                                      <span style={{ color: '#ef4444' }}>{companyName}</span>
                                      <span style={{ fontSize: '0.8rem', fontWeight: '400', color: '#94a3b8', marginLeft: 'auto' }}>
                                        ({companyApps.length} {companyApps.length === 1 ? 'rejection' : 'rejections'}) - Click to {isCompanyCollapsed ? 'expand' : 'collapse'}
                                      </span>
                                    </button>
                                  </td>
                                </tr>
                              )}
                              {(!isAllRejected || !isCompanyCollapsed) && companyApps.map((app, index) => (
                                <tr key={app.id} className={index === 0 && !isAllRejected ? 'company-group-first' : ''}>
                                  {index === 0 && !isAllRejected && (
                                    <td rowSpan={companyApps.length} className="company-name-cell">
                                      <strong>{companyName}</strong>
                                      <span className="company-count">({companyApps.length})</span>
                                    </td>
                                  )}
                                  {isAllRejected && index === 0 && (
                                    <td rowSpan={companyApps.length} className="company-name-cell rejected-company">
                                      <strong style={{ color: '#ef4444' }}>{companyName}</strong>
                                      <span className="company-count">({companyApps.length} rejections)</span>
                                    </td>
                                  )}
                                  <td>{app.position || 'Not Specified'}</td>
                                  <td>
                                    <span
                                      className="status-badge"
                                      style={{ backgroundColor: getStatusColor(app.status) }}
                                    >
                                      {app.status}
                                    </span>
                                  </td>
                                  <td>
                                    {app.applied_date
                                      ? (() => {
                                          const date = new Date(app.applied_date)
                                          const year = date.getFullYear()
                                          const month = date.getMonth()
                                          const day = date.getDate()
                                          return format(new Date(year, month, day), 'MMM dd, yyyy')
                                        })()
                                      : '-'}
                                  </td>
                                  <td>
                                    {app.interview_date
                                      ? format(new Date(app.interview_date), 'MMM dd, yyyy HH:mm')
                                      : '-'}
                                  </td>
                                  <td>
                                    {app.rejection_date
                                      ? format(new Date(app.rejection_date), 'MMM dd, yyyy')
                                      : '-'}
                                  </td>
                                  <td>{app.location || '-'}</td>
                                  <td>{app.salary_range || '-'}</td>
                                  <td>
                                    {app.job_url ? (
                                      <a href={app.job_url} target="_blank" rel="noopener noreferrer" className="job-link">
                                        View
                                      </a>
                                    ) : (
                                      '-'
                                    )}
                                  </td>
                                  <td>
                                    <div className="table-actions">
                                      {app.resume_path && (
                                        <button 
                                          onClick={() => window.open(`http://localhost:8000${app.resume_path}`, '_blank')} 
                                          className="btn btn-small"
                                          style={{ background: '#10b981', color: 'white', marginRight: '5px' }}
                                          title="View Resume"
                                        >
                                          📄 Resume
                                        </button>
                                      )}
                                      <button onClick={() => handleEdit(app)} className="btn btn-small">
                                        Edit
                                      </button>
                                      <button onClick={() => handleDelete(app.id)} className="btn btn-small btn-danger">
                                        Delete
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </React.Fragment>
                          )
                        })}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            )
          })()
        )}
      </div>

      {/* Auto Sync Modal */}
      {showAutoSyncModal && (
        <div className="modal-overlay" onClick={() => setShowAutoSyncModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: 0 }}>🔄 Auto Sync</h2>
              <button
                type="button"
                onClick={() => setShowAutoSyncModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#94a3b8',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => { e.target.style.background = '#f1f5f9'; e.target.style.color = '#64748b'; }}
                onMouseLeave={(e) => { e.target.style.background = 'none'; e.target.style.color = '#94a3b8'; }}
              >
                ×
              </button>
            </div>
            
            <div className="form-group">
              <label>Number of recent emails to process (1-10):</label>
              <input
                type="number"
                min="1"
                max="10"
                value={emailCount}
                onChange={(e) => setEmailCount(parseInt(e.target.value) || 1)}
                style={{ width: '100%', padding: '12px', fontSize: '16px' }}
              />
              <p style={{ marginTop: '8px', color: '#64748b', fontSize: '0.875rem' }}>
                This will automatically process the {emailCount} most recent job-related emails and extract application details.
              </p>
            </div>

            <div className="form-actions">
              <button onClick={() => setShowAutoSyncModal(false)} className="btn btn-secondary">
                Cancel
              </button>
              <button onClick={startAutoSync} className="btn btn-primary" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
                Start Auto Sync
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auto Sync Progress Modal */}
      {autoSyncing && (
        <div className="modal-overlay">
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <h2 style={{ marginBottom: '20px' }}>🔄 Auto Sync Progress</h2>
            
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span>Processing emails...</span>
                <span style={{ fontWeight: '600' }}>{autoSyncProgress.current} / {autoSyncProgress.total}</span>
              </div>
              <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${(autoSyncProgress.current / autoSyncProgress.total) * 100}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #10b981, #059669)',
                    transition: 'width 0.3s ease'
                  }}
                />
              </div>
            </div>

            {autoSyncProgress.results.length > 0 && (
              <div style={{ maxHeight: '300px', overflowY: 'auto', marginTop: '20px' }}>
                <h3 style={{ fontSize: '1rem', marginBottom: '12px' }}>Results:</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {autoSyncProgress.results.map((result, index) => (
                    <div
                      key={index}
                      style={{
                        padding: '10px',
                        background: result.success ? '#f0fdf4' : '#fef2f2',
                        border: `1px solid ${result.success ? '#bbf7d0' : '#fecaca'}`,
                        borderRadius: '6px',
                        fontSize: '0.875rem'
                      }}
                    >
                      <div style={{ fontWeight: '500', marginBottom: '4px' }}>{result.message}</div>
                      <div style={{ color: '#64748b', fontSize: '0.8rem' }}>{result.email}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
        </>
      )}

      {/* Profile Management Modal - Always available */}
      {showProfileModal && (
        <div 
          className="modal-overlay" 
          onClick={() => {
            console.log('Modal overlay clicked, closing modal')
            setShowProfileModal(false)
          }}
        >
          <div 
            className="modal-content" 
            onClick={(e) => e.stopPropagation()} 
            style={{ 
              maxWidth: '800px', 
              maxHeight: '90vh', 
              overflowY: 'auto',
              position: 'relative',
              zIndex: 10001
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2>👤 Manage Your Profile</h2>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowProfileModal(false)
                }}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  fontSize: '24px', 
                  cursor: 'pointer', 
                  color: '#64748b',
                  padding: '4px 8px',
                  borderRadius: '4px'
                }}
                onMouseEnter={(e) => { e.target.style.background = '#f1f5f9' }}
                onMouseLeave={(e) => { e.target.style.background = 'none' }}
              >
                ×
              </button>
            </div>
            
            {loadingProfile ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>Loading profile...</div>
            ) : (
              <ProfileForm 
                profile={userProfile || {
                  personal_info: { name: '', email: '', phone: '', location: '', linkedin: '', portfolio: '', github: '' },
                  summary: '',
                  skills: [],
                  experience: [],
                  education: [],
                  projects: [],
                  certifications: [],
                  publications: [],
                  awards: [],
                  volunteer_work: [],
                  portfolio_text: ''
                }}
                onSave={saveUserProfile}
                onCancel={() => setShowProfileModal(false)}
                onExtractPortfolio={extractFromPortfolio}
                extractingPortfolio={extractingPortfolio}
              />
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  )
}

// Profile Form Component
function ProfileForm({ profile, onSave, onCancel, onExtractPortfolio, extractingPortfolio }) {
  const [formData, setFormData] = useState(profile)

  // Update form data when profile prop changes
  useEffect(() => {
    if (profile) {
      console.log('ProfileForm: Profile updated, setting formData', Object.keys(profile))
      setFormData({ ...profile }) // Create new object to ensure update
    }
  }, [profile])

  const updateField = (path, value) => {
    const keys = path.split('.')
    const updated = JSON.parse(JSON.stringify(formData))
    let current = updated
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) current[keys[i]] = {}
      current = current[keys[i]]
    }
    current[keys[keys.length - 1]] = value
    setFormData(updated)
  }

  const addArrayItem = (field) => {
    const updated = JSON.parse(JSON.stringify(formData))
    if (!updated[field]) updated[field] = []
    const newItem = field === 'experience' ? { title: '', company: '', location: '', start_date: '', end_date: '', description: [] } :
                    field === 'education' ? { degree: '', school: '', location: '', graduation_date: '', gpa: '', honors: '' } :
                    field === 'projects' ? { name: '', description: '', technologies: [], url: '' } :
                    field === 'certifications' ? { name: '', issuer: '', date: '', expiry: '' } :
                    field === 'publications' ? { title: '', authors: '', journal: '', date: '', url: '' } :
                    field === 'awards' ? { name: '', issuer: '', date: '', description: '' } :
                    field === 'volunteer_work' ? { organization: '', role: '', location: '', start_date: '', end_date: '', description: '' } :
                    ''
    updated[field].push(newItem)
    setFormData(updated)
  }

  const removeArrayItem = (field, index) => {
    const updated = JSON.parse(JSON.stringify(formData))
    updated[field].splice(index, 1)
    setFormData(updated)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave(formData)
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Personal Info */}
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ marginBottom: '15px' }}>Personal Information</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <input type="text" placeholder="Full Name" value={formData.personal_info?.name || ''} onChange={(e) => updateField('personal_info.name', e.target.value)} style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
          <input type="email" placeholder="Email" value={formData.personal_info?.email || ''} onChange={(e) => updateField('personal_info.email', e.target.value)} style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
          <input type="text" placeholder="Phone" value={formData.personal_info?.phone || ''} onChange={(e) => updateField('personal_info.phone', e.target.value)} style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
          <input type="text" placeholder="Location" value={formData.personal_info?.location || ''} onChange={(e) => updateField('personal_info.location', e.target.value)} style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
          <input type="url" placeholder="LinkedIn URL" value={formData.personal_info?.linkedin || ''} onChange={(e) => updateField('personal_info.linkedin', e.target.value)} style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
          <input type="url" placeholder="Portfolio URL" value={formData.personal_info?.portfolio || ''} onChange={(e) => updateField('personal_info.portfolio', e.target.value)} style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
          <input type="url" placeholder="GitHub URL" value={formData.personal_info?.github || ''} onChange={(e) => updateField('personal_info.github', e.target.value)} style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
        </div>
      </div>

      {/* Summary */}
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ marginBottom: '15px' }}>Professional Summary</h3>
        <textarea value={formData.summary || ''} onChange={(e) => updateField('summary', e.target.value)} placeholder="Write your professional summary..." style={{ width: '100%', minHeight: '100px', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
      </div>

      {/* Portfolio Text - Auto Extract */}
      <div style={{ marginBottom: '20px', padding: '15px', background: '#f0f9ff', borderRadius: '8px', border: '2px solid #3b82f6' }}>
        <h3 style={{ marginBottom: '15px', color: '#1e40af' }}>📋 Paste Your Portfolio/Resume Text</h3>
        <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '10px' }}>
          Paste your complete portfolio, resume, or CV text here. We'll automatically extract all information including publications, awards, and more.
        </p>
        <textarea 
          value={formData.portfolio_text || ''} 
          onChange={(e) => updateField('portfolio_text', e.target.value)} 
          placeholder="Paste your complete portfolio, resume, or CV text here..."
          style={{ width: '100%', minHeight: '150px', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px', marginBottom: '10px' }} 
        />
        <button
          type="button"
          onClick={async (e) => {
            e.preventDefault()
            e.stopPropagation()
            if (onExtractPortfolio && formData.portfolio_text?.trim()) {
              console.log('Button clicked, extracting portfolio text, length:', formData.portfolio_text.length)
              try {
                await onExtractPortfolio(formData.portfolio_text)
              } catch (error) {
                console.error('Extraction error in button handler:', error)
              }
            } else {
              alert('Please paste your portfolio text first')
            }
          }}
          disabled={extractingPortfolio || !formData.portfolio_text?.trim()}
          className="btn btn-primary"
          style={{ width: '100%' }}
        >
          {extractingPortfolio ? '🔄 Extracting Information...' : '✨ Extract & Auto-Populate All Fields'}
        </button>
      </div>

      {/* Skills */}
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ marginBottom: '15px' }}>Skills (comma-separated)</h3>
        <input type="text" value={Array.isArray(formData.skills) ? formData.skills.join(', ') : ''} onChange={(e) => updateField('skills', e.target.value.split(',').map(s => s.trim()).filter(s => s))} placeholder="Skill 1, Skill 2, Skill 3" style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
      </div>

      {/* Experience */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h3 style={{ margin: 0 }}>Experience</h3>
          <button type="button" onClick={() => addArrayItem('experience')} className="btn btn-small">+ Add</button>
        </div>
        {formData.experience?.map((exp, idx) => (
          <div key={idx} style={{ marginBottom: '15px', padding: '15px', background: '#f9fafb', borderRadius: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <strong>Experience #{idx + 1}</strong>
              <button type="button" onClick={() => removeArrayItem('experience', idx)} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}>Remove</button>
            </div>
            <input type="text" placeholder="Job Title" value={exp.title || ''} onChange={(e) => { const updated = [...formData.experience]; updated[idx] = { ...updated[idx], title: e.target.value }; updateField('experience', updated) }} style={{ width: '100%', padding: '6px', marginBottom: '6px', border: '1px solid #ddd', borderRadius: '4px' }} />
            <input type="text" placeholder="Company" value={exp.company || ''} onChange={(e) => { const updated = [...formData.experience]; updated[idx] = { ...updated[idx], company: e.target.value }; updateField('experience', updated) }} style={{ width: '100%', padding: '6px', marginBottom: '6px', border: '1px solid #ddd', borderRadius: '4px' }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginBottom: '6px' }}>
              <input type="text" placeholder="Location" value={exp.location || ''} onChange={(e) => { const updated = [...formData.experience]; updated[idx] = { ...updated[idx], location: e.target.value }; updateField('experience', updated) }} style={{ padding: '6px', border: '1px solid #ddd', borderRadius: '4px' }} />
              <input type="text" placeholder="Start Date (MM/YYYY)" value={exp.start_date || ''} onChange={(e) => { const updated = [...formData.experience]; updated[idx] = { ...updated[idx], start_date: e.target.value }; updateField('experience', updated) }} style={{ padding: '6px', border: '1px solid #ddd', borderRadius: '4px' }} />
              <input type="text" placeholder="End Date (MM/YYYY or Present)" value={exp.end_date || ''} onChange={(e) => { const updated = [...formData.experience]; updated[idx] = { ...updated[idx], end_date: e.target.value }; updateField('experience', updated) }} style={{ padding: '6px', border: '1px solid #ddd', borderRadius: '4px' }} />
            </div>
            <textarea placeholder="Description (one bullet point per line)" value={Array.isArray(exp.description) ? exp.description.join('\n') : ''} onChange={(e) => { const updated = [...formData.experience]; updated[idx] = { ...updated[idx], description: e.target.value.split('\n').filter(d => d.trim()) }; updateField('experience', updated) }} style={{ width: '100%', minHeight: '60px', padding: '6px', border: '1px solid #ddd', borderRadius: '4px' }} />
          </div>
        ))}
      </div>

      {/* Education */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h3 style={{ margin: 0 }}>Education</h3>
          <button type="button" onClick={() => addArrayItem('education')} className="btn btn-small">+ Add</button>
        </div>
        {formData.education?.map((edu, idx) => (
          <div key={idx} style={{ marginBottom: '15px', padding: '15px', background: '#f9fafb', borderRadius: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <strong>Education #{idx + 1}</strong>
              <button type="button" onClick={() => removeArrayItem('education', idx)} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}>Remove</button>
            </div>
            <input type="text" placeholder="Degree" value={edu.degree || ''} onChange={(e) => { const updated = [...formData.education]; updated[idx] = { ...updated[idx], degree: e.target.value }; updateField('education', updated) }} style={{ width: '100%', padding: '6px', marginBottom: '6px', border: '1px solid #ddd', borderRadius: '4px' }} />
            <input type="text" placeholder="School" value={edu.school || ''} onChange={(e) => { const updated = [...formData.education]; updated[idx] = { ...updated[idx], school: e.target.value }; updateField('education', updated) }} style={{ width: '100%', padding: '6px', marginBottom: '6px', border: '1px solid #ddd', borderRadius: '4px' }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
              <input type="text" placeholder="Location" value={edu.location || ''} onChange={(e) => { const updated = [...formData.education]; updated[idx] = { ...updated[idx], location: e.target.value }; updateField('education', updated) }} style={{ padding: '6px', border: '1px solid #ddd', borderRadius: '4px' }} />
              <input type="text" placeholder="Graduation Year" value={edu.graduation_date || ''} onChange={(e) => { const updated = [...formData.education]; updated[idx] = { ...updated[idx], graduation_date: e.target.value }; updateField('education', updated) }} style={{ padding: '6px', border: '1px solid #ddd', borderRadius: '4px' }} />
              <input type="text" placeholder="GPA (optional)" value={edu.gpa || ''} onChange={(e) => { const updated = [...formData.education]; updated[idx] = { ...updated[idx], gpa: e.target.value }; updateField('education', updated) }} style={{ padding: '6px', border: '1px solid #ddd', borderRadius: '4px' }} />
            </div>
          </div>
        ))}
      </div>

      {/* Publications */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h3 style={{ margin: 0 }}>Publications</h3>
          <button type="button" onClick={() => addArrayItem('publications')} className="btn btn-small">+ Add</button>
        </div>
        {formData.publications?.map((pub, idx) => (
          <div key={idx} style={{ marginBottom: '15px', padding: '15px', background: '#f9fafb', borderRadius: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <strong>Publication #{idx + 1}</strong>
              <button type="button" onClick={() => removeArrayItem('publications', idx)} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}>Remove</button>
            </div>
            <input type="text" placeholder="Title" value={pub.title || ''} onChange={(e) => { const updated = [...formData.publications]; updated[idx] = { ...updated[idx], title: e.target.value }; updateField('publications', updated) }} style={{ width: '100%', padding: '6px', marginBottom: '6px', border: '1px solid #ddd', borderRadius: '4px' }} />
            <input type="text" placeholder="Authors" value={pub.authors || ''} onChange={(e) => { const updated = [...formData.publications]; updated[idx] = { ...updated[idx], authors: e.target.value }; updateField('publications', updated) }} style={{ width: '100%', padding: '6px', marginBottom: '6px', border: '1px solid #ddd', borderRadius: '4px' }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '6px' }}>
              <input type="text" placeholder="Journal/Conference" value={pub.journal || ''} onChange={(e) => { const updated = [...formData.publications]; updated[idx] = { ...updated[idx], journal: e.target.value }; updateField('publications', updated) }} style={{ padding: '6px', border: '1px solid #ddd', borderRadius: '4px' }} />
              <input type="text" placeholder="Date (MM/YYYY)" value={pub.date || ''} onChange={(e) => { const updated = [...formData.publications]; updated[idx] = { ...updated[idx], date: e.target.value }; updateField('publications', updated) }} style={{ padding: '6px', border: '1px solid #ddd', borderRadius: '4px' }} />
            </div>
            <input type="url" placeholder="URL (optional)" value={pub.url || ''} onChange={(e) => { const updated = [...formData.publications]; updated[idx] = { ...updated[idx], url: e.target.value }; updateField('publications', updated) }} style={{ width: '100%', padding: '6px', border: '1px solid #ddd', borderRadius: '4px' }} />
          </div>
        ))}
      </div>

      {/* Awards */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h3 style={{ margin: 0 }}>Awards & Honors</h3>
          <button type="button" onClick={() => addArrayItem('awards')} className="btn btn-small">+ Add</button>
        </div>
        {formData.awards?.map((award, idx) => (
          <div key={idx} style={{ marginBottom: '15px', padding: '15px', background: '#f9fafb', borderRadius: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <strong>Award #{idx + 1}</strong>
              <button type="button" onClick={() => removeArrayItem('awards', idx)} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}>Remove</button>
            </div>
            <input type="text" placeholder="Award Name" value={award.name || ''} onChange={(e) => { const updated = [...formData.awards]; updated[idx] = { ...updated[idx], name: e.target.value }; updateField('awards', updated) }} style={{ width: '100%', padding: '6px', marginBottom: '6px', border: '1px solid #ddd', borderRadius: '4px' }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '6px' }}>
              <input type="text" placeholder="Issuing Organization" value={award.issuer || ''} onChange={(e) => { const updated = [...formData.awards]; updated[idx] = { ...updated[idx], issuer: e.target.value }; updateField('awards', updated) }} style={{ padding: '6px', border: '1px solid #ddd', borderRadius: '4px' }} />
              <input type="text" placeholder="Date (MM/YYYY)" value={award.date || ''} onChange={(e) => { const updated = [...formData.awards]; updated[idx] = { ...updated[idx], date: e.target.value }; updateField('awards', updated) }} style={{ padding: '6px', border: '1px solid #ddd', borderRadius: '4px' }} />
            </div>
            <textarea placeholder="Description (optional)" value={award.description || ''} onChange={(e) => { const updated = [...formData.awards]; updated[idx] = { ...updated[idx], description: e.target.value }; updateField('awards', updated) }} style={{ width: '100%', minHeight: '50px', padding: '6px', border: '1px solid #ddd', borderRadius: '4px' }} />
          </div>
        ))}
      </div>

      {/* Volunteer Work */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h3 style={{ margin: 0 }}>Volunteer Work</h3>
          <button type="button" onClick={() => addArrayItem('volunteer_work')} className="btn btn-small">+ Add</button>
        </div>
        {formData.volunteer_work?.map((vol, idx) => (
          <div key={idx} style={{ marginBottom: '15px', padding: '15px', background: '#f9fafb', borderRadius: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <strong>Volunteer Work #{idx + 1}</strong>
              <button type="button" onClick={() => removeArrayItem('volunteer_work', idx)} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}>Remove</button>
            </div>
            <input type="text" placeholder="Organization" value={vol.organization || ''} onChange={(e) => { const updated = [...formData.volunteer_work]; updated[idx] = { ...updated[idx], organization: e.target.value }; updateField('volunteer_work', updated) }} style={{ width: '100%', padding: '6px', marginBottom: '6px', border: '1px solid #ddd', borderRadius: '4px' }} />
            <input type="text" placeholder="Role/Position" value={vol.role || ''} onChange={(e) => { const updated = [...formData.volunteer_work]; updated[idx] = { ...updated[idx], role: e.target.value }; updateField('volunteer_work', updated) }} style={{ width: '100%', padding: '6px', marginBottom: '6px', border: '1px solid #ddd', borderRadius: '4px' }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginBottom: '6px' }}>
              <input type="text" placeholder="Location" value={vol.location || ''} onChange={(e) => { const updated = [...formData.volunteer_work]; updated[idx] = { ...updated[idx], location: e.target.value }; updateField('volunteer_work', updated) }} style={{ padding: '6px', border: '1px solid #ddd', borderRadius: '4px' }} />
              <input type="text" placeholder="Start Date (MM/YYYY)" value={vol.start_date || ''} onChange={(e) => { const updated = [...formData.volunteer_work]; updated[idx] = { ...updated[idx], start_date: e.target.value }; updateField('volunteer_work', updated) }} style={{ padding: '6px', border: '1px solid #ddd', borderRadius: '4px' }} />
              <input type="text" placeholder="End Date (MM/YYYY or Present)" value={vol.end_date || ''} onChange={(e) => { const updated = [...formData.volunteer_work]; updated[idx] = { ...updated[idx], end_date: e.target.value }; updateField('volunteer_work', updated) }} style={{ padding: '6px', border: '1px solid #ddd', borderRadius: '4px' }} />
            </div>
            <textarea placeholder="Description" value={vol.description || ''} onChange={(e) => { const updated = [...formData.volunteer_work]; updated[idx] = { ...updated[idx], description: e.target.value }; updateField('volunteer_work', updated) }} style={{ width: '100%', minHeight: '60px', padding: '6px', border: '1px solid #ddd', borderRadius: '4px' }} />
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
        <button type="submit" className="btn btn-primary">Save Profile</button>
        <button type="button" onClick={onCancel} className="btn btn-secondary">Cancel</button>
      </div>
    </form>
  )
}

export default App

