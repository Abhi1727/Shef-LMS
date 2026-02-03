# 📺 YouTube API Integration Guide

This guide will help you set up YouTube API integration for uploading private videos to your SHEF LMS platform.

## 🚀 Overview

The YouTube integration allows:
- **Admins and Teachers** to upload videos directly to YouTube as private videos
- **Secure playback** using YouTube's embed URLs
- **Private access** - videos are not publicly searchable
- **Professional hosting** with YouTube's reliable infrastructure

## 📋 Prerequisites

1. Google Cloud Platform account
2. YouTube channel (for the organization)
3. Backend server access for environment variables

## 🔧 Step 1: Set up Google Cloud Project

### 1. Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "NEW PROJECT"
3. Enter project name (e.g., "shef-lms-youtube")
4. Click "CREATE"

### 2. Enable YouTube Data API v3
1. In your project, go to "APIs & Services" → "Library"
2. Search for "YouTube Data API v3"
3. Click on it and press "ENABLE"

### 3. Configure OAuth Consent Screen
1. Go to "APIs & Services" → "OAuth consent screen"
2. Choose **External** (unless you're using Google Workspace)
3. Fill in required fields:
   - **App name**: SHEF LMS
   - **User support email**: your-email@domain.com
   - **Developer contact information**: your-email@domain.com
4. Click "SAVE AND CONTINUE"
5. Add **Scopes** (click "ADD OR REMOVE SCOPES"):
   - `https://www.googleapis.com/auth/youtube.upload`
   - `https://www.googleapis.com/auth/youtube.readonly`
6. Click "SAVE AND CONTINUE"
7. Add **Test users** (add your email for testing)
8. Click "SAVE AND CONTINUE" → "BACK TO DASHBOARD"

## 🔑 Step 2: Create OAuth Credentials

### 1. Create Credentials
1. Go to "APIs & Services" → "Credentials"
2. Click "+ CREATE CREDENTIALS" → "OAuth client ID"
3. Select **Web application**
4. Configure:
   - **Name**: SHEF LMS YouTube Integration
   - **Authorized redirect URIs**: 
     ```
     http://localhost:5000/auth/youtube/callback
     https://your-production-domain.com/auth/youtube/callback
     ```
5. Click "CREATE"

### 2. Save Your Credentials
You'll get:
- **Client ID**: `your_youtube_client_id_here`
- **Client Secret**: `your_youtube_client_secret_here`

## ⚙️ Step 3: Configure Environment Variables

Add these to your backend `.env` file:

```bash
# YouTube API Configuration
YOUTUBE_CLIENT_ID=your_youtube_client_id_here
YOUTUBE_CLIENT_SECRET=your_youtube_client_secret_here
YOUTUBE_REDIRECT_URI=http://localhost:5000/auth/youtube/callback
YOUTUBE_REFRESH_TOKEN=your_youtube_refresh_token_here
```

## 🔄 Step 4: Get Refresh Token (One-time Setup)

### Option 1: Manual Setup (Recommended for initial setup)

1. Create a temporary script `get-youtube-tokens.js`:

```javascript
const { google } = require('googleapis');

const oauth2Client = new google.auth.OAuth2(
  process.env.YOUTUBE_CLIENT_ID,
  process.env.YOUTUBE_CLIENT_SECRET,
  process.env.YOUTUBE_REDIRECT_URI
);

const scopes = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly'
];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: scopes,
  prompt: 'consent'
});

console.log('Visit this URL to authorize:', authUrl);
console.log('After authorization, you will be redirected to:', process.env.YOUTUBE_REDIRECT_URI);
console.log('Copy the "code" parameter from the redirect URL');

// Then exchange code for tokens:
const code = 'PASTE_CODE_HERE';
oauth2Client.getToken(code, (err, tokens) => {
  if (err) {
    console.error('Error retrieving access token', err);
    return;
  }
  console.log('Refresh Token:', tokens.refresh_token);
  console.log('Add this to your YOUTUBE_REFRESH_TOKEN environment variable');
});
```

2. Run the script and follow the instructions
3. Copy the refresh token to your `.env` file

### Option 2: Automatic Setup (Advanced)

You can implement the OAuth flow in your application with endpoints:
- `GET /auth/youtube` - Redirect to Google for authorization
- `GET /auth/youtube/callback` - Handle Google redirect and get tokens

## 🎬 Step 5: Test the Integration

### 1. Restart Backend Server
```bash
cd backend
npm start
```

### 2. Test Upload via Admin Dashboard
1. Login as Admin
2. Go to "Manage Classroom Videos"
3. Select "YouTube Private" as video source
4. Upload a test video
5. Check console for success message

### 3. Verify on YouTube
1. Go to your YouTube Studio
2. Check "Videos" → "Private"
3. Your uploaded video should appear there

## 📊 Database Schema

The system stores YouTube video information in your Firestore `classroom` collection:

```javascript
{
  title: "Video Title",
  description: "Video Description",
  videoSource: "youtube",
  youtubeVideoId: "dQw4w9WgXcQ",
  youtubeVideoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  youtubeEmbedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
  courseId: "course123",
  instructor: "Teacher Name",
  uploadedBy: "user123",
  createdAt: "2025-01-01T00:00:00Z"
}
```

## 🔍 Troubleshooting

### Common Issues

1. **"YouTube API not configured"**
   - Check environment variables are set
   - Restart backend server

2. **"YouTube authentication failed"**
   - Refresh token might be expired
   - Re-run the token generation process

3. **"YouTube API quota exceeded"**
   - YouTube has daily upload limits
   - Check your Google Cloud quota settings

4. **"Video upload fails"**
   - Check video file format (MP4, MOV, AVI supported)
   - Ensure file size under 2GB
   - Check network connectivity

### Debug Mode

Add this to your YouTube service for debugging:

```javascript
// In youtubeService.js
console.log('YouTube Config Status:', {
  hasClientId: !!process.env.YOUTUBE_CLIENT_ID,
  hasClientSecret: !!process.env.YOUTUBE_CLIENT_SECRET,
  hasRefreshToken: !!process.env.YOUTUBE_REFRESH_TOKEN
});
```

## 🚀 Production Considerations

1. **Security**: Store refresh tokens securely
2. **Monitoring**: Track upload success/failure rates
3. **Backup**: Keep copies of important videos
4. **Compliance**: Ensure videos meet educational content policies

## 📚 API Limits

- **Daily Upload Quota**: Varies by Google Cloud project
- **Video Length**: Up to 12 hours
- **File Size**: Up to 128GB (but we limit to 2GB for performance)
- **Rate Limits**: Approximately 1000 uploads per day

## 🆘 Support

If you encounter issues:

1. Check Google Cloud Console for API errors
2. Review backend logs for detailed error messages
3. Verify YouTube channel is in good standing
4. Ensure OAuth consent screen is properly configured

---

**🎉 Your YouTube integration is now ready!**

Admins and teachers can now upload videos directly to YouTube as private content, and students can view them securely through the LMS platform.
