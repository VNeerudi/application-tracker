# Gmail Setup Guide

## Fixing Authentication Error

If you're getting `[AUTHENTICATIONFAILED] Invalid credentials`, follow these steps:

### Step 1: Enable 2-Factor Authentication

1. Go to your Google Account: https://myaccount.google.com
2. Click **Security** in the left sidebar
3. Under "Signing in to Google", click **2-Step Verification**
4. Follow the prompts to enable 2FA (you'll need your phone)

### Step 2: Generate App Password

1. Go to: https://myaccount.google.com/apppasswords
   - Or: Google Account → Security → 2-Step Verification → App passwords
2. Select **Mail** as the app
3. Select **Other (Custom name)** as the device
4. Enter a name like "Job Application Tracker"
5. Click **Generate**
6. **Copy the 16-character password** (it will look like: `abcd efgh ijkl mnop`)

### Step 3: Update .env File

1. Open `backend/.env` file
2. Update the `EMAIL_APP_PASSWORD` with the generated app password:
   ```
   EMAIL_APP_PASSWORD=abcdefghijklmnop
   ```
   **Important:** Remove spaces from the app password (it's shown with spaces but should be used without spaces)

3. Make sure your email address is correct:
   ```
   EMAIL_ADDRESS=your-email@gmail.com
   ```

### Step 4: Restart Backend Server

After updating the .env file, restart your FastAPI server.

## Troubleshooting

### Still getting authentication error?

1. **Verify app password format:**
   - Should be 16 characters, no spaces
   - Example: `abcdefghijklmnop` (not `abcd efgh ijkl mnop`)

2. **Check 2FA is enabled:**
   - You MUST have 2FA enabled to use app passwords
   - Regular password won't work with IMAP

3. **Try generating a new app password:**
   - Delete the old one
   - Generate a fresh app password
   - Update .env file

4. **Verify email address:**
   - Make sure it matches your Gmail account exactly
   - Check for typos

5. **Check .env file location:**
   - Must be in `backend/.env` (not `backend/env.example.txt`)
   - Restart server after changes

### For Outlook/Office 365

If using Outlook instead of Gmail:
1. Use your regular password or generate an app password
2. Set `EMAIL_PROVIDER=outlook` in .env
3. Use `EMAIL_PASSWORD` instead of `EMAIL_APP_PASSWORD`







