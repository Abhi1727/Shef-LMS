# Firebase Storage Migration Guide

## Overview
This implementation successfully migrates lecture videos from Zoom-based playback to Firebase Storage-based streaming with secure access control.

## What Was Implemented

### 1. Firebase Storage Integration
- **Updated Firebase config** (`config/firebase.js`):
  - Added Firebase Storage initialization
  - Configured storage bucket support
  - Added storage bucket environment variable

### 2. Classroom Service (`services/classroomService.js`)
- **Video Upload**: Handles large video files (up to 2GB) with proper metadata
- **Signed URLs**: Generates time-limited secure URLs (2 hours) for video playback
- **Metadata Management**: Stores lecture information in Firestore
- **Access Control**: Implements role-based access validation
- **File Management**: Handles video deletion from storage and database

### 3. API Endpoints

#### POST `/api/admin/classroom/upload`
- **Purpose**: Admin uploads video + metadata to Firebase Storage
- **Authentication**: Admin role required
- **Features**:
  - Multer middleware for large file handling
  - Video file validation (video/* mime types)
  - Required field validation (title, courseId)
  - Automatic file organization by course/year
  - Unique filename generation

#### GET `/api/classroom/:courseId`
- **Purpose**: List lectures visible to logged-in user
- **Authentication**: Any authenticated user
- **Access Rules**:
  - Admin: All lectures
  - Teacher: Their course lectures only
  - Student: Enrolled courses OR matching batch/domain

#### GET `/api/classroom/play/:lectureId`
- **Purpose**: Validate access and return signed URL
- **Authentication**: Any authenticated user
- **Security**:
  - Access validation before URL generation
  - Time-limited signed URLs (2 hours)
  - Firebase Storage only (no direct access)

#### DELETE `/api/admin/classroom/:lectureId`
- **Purpose**: Remove lecture (admin only)
- **Features**: Deletes from both storage and database

### 4. Data Model
```javascript
{
  id: lectureId,
  title: "Lecture Title",
  description: "Optional description",
  courseId: "course-123",
  batchId: "batch-001", // optional
  domain: "computer-science", // optional
  firebaseStoragePath: "lectures/course-123/2024/video.mp4",
  duration: "45 min", // optional
  uploadedBy: "admin-user-id",
  createdAt: "2024-01-01T00:00:00.000Z",
  videoSource: "firebase",
  isActive: true
}
```

### 5. Security Features
- **JWT Authentication**: All endpoints require valid tokens
- **Role-Based Access**: Admin/Teacher/Student permissions
- **Signed URLs**: No direct Firebase Storage access
- **Input Validation**: File type and size limits
- **Error Handling**: Comprehensive error responses

## Access Control Logic

### Admin
- Can upload, view, and delete all lectures
- Full access to all courses and batches

### Teacher
- Can view lectures for their assigned courses
- Cannot upload or delete lectures

### Student
- Can view lectures if:
  - Enrolled in the course (`courseId` matches)
  - Batch matches (`batchId` matches)
  - Domain matches (`domain` matches)

## File Organization
```
Firebase Storage Bucket/
├── lectures/
│   ├── {courseId}/
│   │   ├── {year}/
│   │   │   ├── lecture_{timestamp}_{hash}.mp4
│   │   │   ├── lecture_{timestamp}_{hash}.mov
│   │   │   └── ...
```

## Environment Variables
Add to `.env`:
```env
FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
```

## Dependencies Added
- `multer`: File upload handling
- `@google-cloud/storage`: Firebase Storage SDK (included with firebase-admin)

## Testing
- **API Tests**: `test-classroom-api.js` - Validates all endpoints
- **Upload Tests**: `test-classroom-upload.js` - Full upload workflow (requires Firebase Storage)

## Migration Steps

### 1. Setup Firebase Storage
```bash
# In Firebase Console:
# 1. Enable Storage
# 2. Configure security rules
# 3. Note bucket name
```

### 2. Update Environment
```bash
# Add to .env
FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Test Implementation
```bash
# Run API tests
node test-classroom-api.js

# Run upload tests (requires Firebase Storage)
node test-classroom-upload.js
```

### 5. Update Frontend
Frontend should use these new endpoints:
- Replace Zoom recording URLs with `/api/classroom/play/:lectureId`
- Use `/api/classroom/:courseId` for lecture listings
- Implement file upload UI for admin users

## Security Rules for Firebase Storage
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Only authenticated users can access files
    match /lectures/{courseId}/{year}/{fileName} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.token.role == 'admin';
    }
  }
}
```

## Benefits
1. **Scalable Storage**: Firebase Storage handles large video files efficiently
2. **Secure Access**: Signed URLs prevent unauthorized access
3. **Cost Effective**: Pay only for storage and bandwidth used
4. **CDN Integration**: Global edge caching for fast playback
5. **No Zoom Dependency**: Complete control over lecture content

## Notes
- Existing Zoom recordings remain in database for backward compatibility
- New lectures automatically use Firebase Storage
- Video files are organized by course and year for easy management
- Signed URLs expire after 2 hours for security
