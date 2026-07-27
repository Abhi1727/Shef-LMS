# Zoom Cloud Recording Integration Guide

## Overview
Your LMS now automatically fetches Zoom cloud recordings after live classes and displays them in the **Classroom** section alongside Google Drive videos.

---

## Features Implemented ✅

### 1. **Automatic Cloud Recording**
- Every Zoom meeting created by admin is automatically configured with cloud recording enabled
- No manual setup needed per meeting

### 2. **Recording Sync System**
- **Automatic Sync**: Runs every hour to check for new recordings
- **Manual Sync**: Admin can trigger sync anytime via "Sync Zoom Recordings" button
- **Initial Sync**: Runs 2 minutes after server startup

### 3. **Dual Video Source Support**
- **Google Drive videos**: Existing videos continue to work
- **Zoom recordings**: New recordings appear automatically
- Students see a "☁️ Zoom Recording" badge for Zoom videos
- Download button available for Zoom recordings

---

## How It Works

### For Admins

#### 1. **Schedule a Live Class**
```
1. Go to Admin Dashboard → Live Classes
2. Click "Schedule Live Class"
3. Fill in details (topic, date, time, instructor, course)
4. Click Save
5. System automatically:
   - Creates Zoom meeting
   - Enables cloud recording
   - Stores meeting in database
```

#### 2. **After Class Ends**
```
Option A (Automatic):
- Wait for hourly sync (runs every hour)
- Recordings automatically appear in Classroom

Option B (Manual):
1. Go to Admin Dashboard → Live Classes
2. Click "☁️ Sync Zoom Recordings" button
3. System fetches all recordings from last 7 days
4. Recordings added to Classroom section
```

#### 3. **View Synced Recordings**
```
1. Go to Admin Dashboard → Classroom Videos
2. Recordings show with:
   - Title from live class
   - Instructor name
   - Duration
   - Date recorded
   - Source: "zoom"
```

### For Students

#### 1. **Join Live Class**
```
1. Go to Dashboard → Live Classes
2. Click "Join Class" button
3. Opens Zoom in new tab
4. System tracks attendance
```

#### 2. **Watch Recorded Class**
```
1. Go to Dashboard → Classroom
2. Recordings appear with class thumbnail
3. Click video card to play
4. Video plays directly from Zoom's cloud storage
5. Download button available (if needed)
```

---

## API Endpoints

### 1. **Get Recordings for Specific Meeting**
```bash
GET /api/zoom/recordings/:meetingId
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "recordings": [
    {
      "id": "recording123",
      "meetingId": "12345678",
      "recordingStart": "2025-01-07T10:00:00Z",
      "recordingEnd": "2025-01-07T11:00:00Z",
      "fileType": "MP4",
      "fileSize": 524288000,
      "playUrl": "https://zoom.us/rec/play/...",
      "downloadUrl": "https://zoom.us/rec/download/...",
      "status": "completed",
      "recordingType": "shared_screen_with_speaker_view"
    }
  ],
  "duration": 60,
  "totalSize": 524288000
}
```

### 2. **List All Recordings (Last 30 Days)**
```bash
GET /api/zoom/recordings?from=2025-01-01&to=2025-01-31
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "meetings": [
    {
      "uuid": "meeting-uuid",
      "id": "12345678",
      "topic": "Introduction to Python",
      "startTime": "2025-01-07T10:00:00Z",
      "duration": 60,
      "totalSize": 524288000,
      "recordingCount": 2,
      "recordingFiles": [...]
    }
  ],
  "pageCount": 1,
  "pageSize": 300,
  "totalRecords": 5
}
```

### 3. **Sync Recordings to Classroom**
```bash
POST /api/zoom/sync-recordings
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully synced 5 recording(s)",
  "synced": 5,
  "totalMeetingsChecked": 10
}
```

---

## Database Schema

### Classroom Collection (Firebase)
```json
{
  "id": "auto-generated",
  "title": "Introduction to Python - Live Session",
  "instructor": "John Doe",
  "duration": "60 min",
  "date": "2025-01-07T10:00:00Z",
  "videoUrl": "https://zoom.us/rec/play/...",
  "downloadUrl": "https://zoom.us/rec/download/...",
  "zoomRecordingId": "recording123",
  "zoomMeetingId": "12345678",
  "fileSize": 524288000,
  "recordingStart": "2025-01-07T10:00:00Z",
  "recordingEnd": "2025-01-07T11:00:00Z",
  "source": "zoom",
  "courseId": "course123",
  "views": 0,
  "createdAt": "2025-01-07T11:05:00Z"
}
```

### Live Classes Collection
```json
{
  "id": "auto-generated",
  "zoomMeetingId": "12345678",
  "title": "Introduction to Python",
  "instructor": "John Doe",
  "date": "2025-01-07T10:00:00Z",
  "time": "10:00 AM",
  "duration": "60 min",
  "students": 25,
  "joinUrl": "https://zoom.us/j/12345678",
  "startUrl": "https://zoom.us/s/12345678",
  "password": "abc123",
  "courseId": "course123",
  "status": "scheduled",
  "createdBy": "admin@sheflms.com",
  "createdAt": "2025-01-06T15:00:00Z"
}
```

---

## Configuration Required

### Zoom API Credentials (.env)
```bash
ZOOM_ACCOUNT_ID=your_account_id
ZOOM_CLIENT_ID=your_client_id
ZOOM_CLIENT_SECRET=your_client_secret
```

### Enable Cloud Recording in Zoom
1. Log in to Zoom Admin Portal (zoom.us)
2. Go to **Settings** → **Recording**
3. Enable **Cloud Recording**
4. Set default to **Record automatically**
5. Enable **Allow hosts to record in the cloud**

### Server-to-Server OAuth App
1. Go to marketplace.zoom.us
2. Click **Develop** → **Build App**
3. Choose **Server-to-Server OAuth**
4. Fill in app details
5. Add scopes:
   - `meeting:write:admin` - Create meetings
   - `meeting:read:admin` - Read meeting info
   - `recording:read:admin` - Access recordings
   - `recording:write:admin` - Manage recordings
6. Activate the app
7. Copy credentials to `.env`

---

## Scheduled Job Details

### Sync Scheduler
- **File**: `/backend/jobs/syncRecordings.js`
- **Frequency**: Every hour (cron: `0 * * * *`)
- **Startup Delay**: 2 minutes after server start
- **Lookback Period**: Last 7 days

### What Gets Synced
✅ MP4 video recordings  
✅ Completed recordings only  
✅ Recordings with meeting in database  
✅ Recordings not already in classroom  

❌ Audio-only recordings  
❌ Transcript files  
❌ Chat logs  
❌ Duplicate recordings  

---

## Testing

### 1. **Test Recording Sync**
```bash
# Login as admin
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@sheflms.com","password":"SuperAdmin@123"}'

# Sync recordings
curl -X POST http://localhost:5000/api/zoom/sync-recordings \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json"
```

### 2. **Check Logs**
```bash
pm2 logs shef-lms-backend --lines 100
```

Look for:
```
[Zoom Sync] Scheduler started - will run every hour
[Zoom Sync] Running initial sync...
[Zoom Sync] Starting recording sync...
[Zoom Sync] Added recording: Python Basics
[Zoom Sync] Completed: 3 synced, 2 skipped
```

### 3. **Verify in Frontend**
1. Login as admin: `admin@sheflms.com` / `SuperAdmin@123`
2. Go to Dashboard → Live Classes
3. Click "Sync Zoom Recordings"
4. Check Admin Dashboard → Classroom Videos
5. Login as student and check Dashboard → Classroom

---

## Troubleshooting

### No Recordings Appear
1. **Check Zoom credentials**: Verify `.env` has correct values
2. **Check Zoom account**: Ensure cloud recording is enabled
3. **Check meeting status**: Recording only available after class ends
4. **Check sync logs**: Look for errors in PM2 logs
5. **Manual sync**: Click "Sync Zoom Recordings" button

### Recordings Not Playing
1. **Check Zoom link**: Verify `videoUrl` in database
2. **Check Zoom expiry**: Links expire after 30 days (configurable)
3. **Check browser**: Some browsers block iframes
4. **Download option**: Students can download if playback fails

### Sync Fails
```bash
# Check Zoom API status
curl https://api.zoom.us/v2/users/me \
  -H "Authorization: Bearer <token>"

# Test meeting creation
curl -X POST http://localhost:5000/api/zoom/meetings \
  -H "Authorization: Bearer <your-lms-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "Test Meeting",
    "startTime": "2025-01-08T10:00:00Z",
    "duration": 30
  }'
```

---

## Admin Quick Actions

### Schedule Class with Recording
```
Dashboard → Live Classes → Schedule Live Class
→ Fill form → Save
✅ Zoom meeting created with recording enabled
```

### Sync Recordings
```
Dashboard → Live Classes → ☁️ Sync Zoom Recordings
→ Wait 5-10 seconds
→ Check Classroom Videos section
```

### View Recording Details
```
Dashboard → Classroom Videos → Click video
→ See title, instructor, date, duration, source
→ Edit or delete if needed
```

---

## Student Experience

### Before Class
- See upcoming classes in "Live Classes" section
- Click "Join Class" 15 minutes before start
- Opens Zoom in new tab

### During Class
- Participate in live Zoom session
- Cloud recording happens automatically
- No action needed from student

### After Class (1-2 hours later)
- Recording appears in "Classroom" section
- Grouped by date with other videos
- Click to watch anytime
- Download if needed for offline viewing

---

## Storage & Bandwidth

### Zoom Cloud Storage
- Included with paid Zoom plan
- 1 hour class ≈ 500 MB - 1 GB
- Check Zoom admin for storage limits
- Recordings auto-delete after retention period

### LMS Database
- Only metadata stored in Firebase
- Video files stay on Zoom servers
- Minimal database impact
- ~1 KB per recording metadata

### Student Bandwidth
- Streaming from Zoom's CDN
- High quality, low latency
- Adaptive bitrate streaming
- Same as watching Zoom recording directly

---

## Security

### Access Control
✅ Students can only view assigned course recordings  
✅ JWT authentication required for all API calls  
✅ Zoom URLs include access tokens  
✅ Recordings auto-expire based on Zoom settings  

### Data Privacy
- No video files stored on your server
- Only Zoom URLs and metadata in database
- Students access videos via authenticated Zoom links
- GDPR compliant (Zoom's responsibility)

---

## Future Enhancements

### Potential Features
- [ ] Automatic transcription sync
- [ ] Closed captions from Zoom
- [ ] Recording analytics (watch time, completion rate)
- [ ] Zoom chat log integration
- [ ] Polling data sync
- [ ] Breakout room recordings
- [ ] Download multiple recordings (bulk)
- [ ] Webhook for instant sync (no delay)

---

## Support

### Demo Credentials
- **Admin**: `admin@sheflms.com` / `SuperAdmin@123`
- **Student (Cyber)**: `lqdeleon@gmail.com` / `Admin@123`
- **Student (Data Science)**: `abhi@gmail.com` / `Admin@123`
- **Teacher**: `teacher@sheflms.com` / `Teacher@123`

### Documentation
- Main README: `/README.md`
- Zoom Integration: `/ZOOM_INTEGRATION_GUIDE.md`
- Teacher Architecture: `/TEACHER_ARCHITECTURE.md`
- Deployment: `/DEPLOYMENT_GUIDE.md`

---

## Summary

🎉 **Your LMS now has complete Zoom cloud recording integration!**

**What You Can Do:**
1. ✅ Schedule classes (Zoom meetings auto-created)
2. ✅ Conduct live classes via Zoom
3. ✅ Recordings automatically saved to Zoom cloud
4. ✅ Sync recordings with one click
5. ✅ Students watch recordings in Classroom section
6. ✅ Recordings grouped by date
7. ✅ Download option available
8. ✅ Runs hourly in background

**No More Manual Work:**
- ❌ No manual Zoom link creation
- ❌ No manual recording downloads
- ❌ No manual video uploads
- ❌ No storage management needed

**Next Steps:**
1. Configure Zoom credentials in `.env`
2. Conduct a test class
3. Wait for sync or click "Sync Zoom Recordings"
4. Check Classroom section
5. 🎊 Done!
