# SHEF LMS - Comprehensive Project & Technical Summary

This document serves as a detailed reference guide for **ChatGPT** or any other LLM/developer to understand the entire architecture, technologies, data flows, routes, and features of the **SHEF Learning Management System (LMS)**.

---

## 🚀 1. Project Overview & Tech Stack
**SHEF LMS** is a modern, responsive Learning Management System designed to handle courses, batches, classroom video management, live Zoom classes, student analytics, and attendance tracking. It supports roles for **Super Admins**, **Teachers**, **Mentors**, and **Students**.

### 🛠️ Core Technology Stack
- **Frontend:** React 18, React Router v6, Axios, custom CSS3 with premium animations (Dark Mode, custom transitions).
- **Backend:** Node.js, Express.js.
- **Database:** MongoDB Atlas (Cloud) via Mongoose ODM.
- **Authentication:** JSON Web Tokens (JWT) and `bcryptjs` password hashing.
- **Conferencing Integration:** Zoom Server-to-Server OAuth (with auto-recording and automated/manual sync of cloud recordings into the Classroom section).
- **Hosting/Deployment:** Docker (containers for backend and frontend), PM2 for backend process management, Nginx as reverse proxy/static server.

---

## 📂 2. Directory Structure
```
Shef-LMS/
├── ARCHITECTURE.md                 # Brief architecture summary
├── PRODUCTION-READY-SUMMARY.md     # Production deployment instructions & security enhancements
├── ZOOM_RECORDING_GUIDE.md         # Guide to setting up Zoom Server-to-Server OAuth
├── backend/
│   ├── Dockerfile
│   ├── docker-compose.yml          # Production Docker compose
│   ├── docker-compose.dev.yml      # Development Docker compose
│   ├── server.js                   # Application entry point
│   ├── config/                     # Database connections
│   ├── controllers/                # Request handlers
│   ├── models/                     # Mongoose database models
│   │   ├── User.js                 # Unified User collection (Students, Teachers, Admins, Mentors)
│   │   ├── Batch.js                # Batches of students assigned to a course/teacher
│   │   ├── Classroom.js            # Video sessions, drive links, and Zoom recordings
│   │   ├── Course.js               # Available study programs
│   │   ├── ActivityLog.js          # Activity timeline records
│   │   └── OneToOneBatch.js        # One-to-one class configurations
│   ├── routes/                     # Express Router files (auth, admin, batches, classroom, zoom, etc.)
│   ├── services/                   # External services (zoomService.js, etc.)
│   ├── jobs/                       # Cron/scheduled jobs (syncRecordings.js)
│   └── scripts/                    # Maintenance & utility scripts
└── frontend/
    ├── src/
    │   ├── App.js                  # Routing, token monitoring, caching initialization
    │   ├── index.js
    │   ├── App.css / index.css     # Global layout and style system
    │   ├── components/             # React components (Dashboards, Page layouts, Custom Player)
    │   │   ├── AdminDashboard.js   # Super Admin dashboard
    │   │   ├── Dashboard.js        # Student dashboard
    │   │   ├── TeacherDashboard.js # Teacher dashboard
    │   │   ├── BatchDetailsPage.js # Admin batch management
    │   │   ├── CustomVideoPlayer.js# Video player for Drive/Zoom recordings
    │   │   ├── OneToOneBatchManagement.js
    │   │   └── ...
    │   ├── services/               # Frontend API service layer (tokenService.js, etc.)
    │   └── utils/                  # Client-side cache managers, freshness trackers, versioning
```

---

## 🗄️ 3. Database Schema Models (Mongoose)

### 👤 User Schema (`backend/models/User.js`)
Stores all users (Admins, Teachers, Mentors, Students).
- `name` (String, required)
- `email` (String, required, unique, lowercase)
- `password` (String, required)
- `role` (String: `'admin' | 'teacher' | 'mentor' | 'student'`, default `'student'`)
- `status` (String: `'active' | 'inactive'`, default `'active'`)
- `course` (String) - Associated course name (e.g., `"Data Science & AI"`)
- `batchId` (Schema.Types.ObjectId, ref: `'Batch'`) - Current active batch for students/teachers
- `lastLogin` (Date)

### 👥 Batch Schema (`backend/models/Batch.js`)
Groups students under a specific course and teacher.
- `name` (String, required)
- `course` (String, required)
- `teacherId` (Schema.Types.ObjectId, ref: `'User'`, required)
- `students` (`[{ type: Schema.Types.ObjectId, ref: 'User' }]`) - Array of student IDs
- `schedule` (Mixed) - e.g., `{ days: ['Monday', 'Wednesday'], time: '18:00' }`
- `createdAt` (Date)

### 📺 Classroom Schema (`backend/models/Classroom.js`)
Represents videos, recording resources, and study material.
- `title` (String, required)
- `course` (String, required)
- `courseId` (String)
- `batchId` (Schema.Types.ObjectId, ref: `'Batch'`) - Empty means available to all enrolled in course; otherwise restricted to batch
- `videoUrl` (String) - Zoom recording url or external link
- `driveId` (String) - Google Drive File ID (for custom embed player)
- `source` (String: `'drive' | 'zoom'`, default `'drive'`)
- `duration` (String)
- `instructor` (String)
- `createdAt` (Date)

### 📚 Course Schema (`backend/models/Course.js`)
- `title` (String, required, unique) - Supported values: `"Data Science & AI"`, `"Cyber Security & Ethical Hacking"`
- `code` (String)
- `description` (String)

---

## 🔑 4. User Roles & Expected Flow

1. **Super Admin:**
   - Manage users (add, edit, search, activate/deactivate, delete).
   - Create and edit Courses.
   - Create Batches, assign a Teacher, configure schedules, and enroll Students.
   - Assign/remove classroom videos for specific batches.
   - Schedule Live Zoom Classes (auto-created via Zoom API; no manual link entry required).
   - Manually trigger Zoom recording syncs.

2. **Teachers & Mentors:**
   - View assigned Batches.
   - Manage Student lists for their assigned batches.
   - Upload new classroom videos and lesson resources.

3. **Students:**
   - Access student-only Dashboard if authenticated.
   - If **Course-only (no batch assigned)**: Dashboard states "No batch assigned", showing no videos.
   - If **Course + Batch assigned**: Can view batch timeline, watch Classroom videos (embedded Google Drive files or authenticated Zoom replays), track learning progress, view analytics, and click join links for active live classes.

---

## ⚡ 5. Key Integrations & Core Logic

### 🎥 Zoom Integration
- **Server-to-Server OAuth:** Configured using `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, and `ZOOM_CLIENT_SECRET`.
- **Auto-Creation:** Scheduling a class triggers an API call (`POST /users/me/meetings`) requesting automatic Cloud Recording. The API returns unique Join URLs (for students) and Start URLs (for the teacher).
- **Automated Syncing:** An hourly Cron job (`backend/jobs/syncRecordings.js`) fetches recordings from the Zoom API for completed meetings and registers them as Classroom items.
- **Manual Sync:** Admins can press "Sync Zoom Recordings" on the dashboard to immediately run the ingestion process.

### 🛡️ Security & Performance Enhancements
- **No Universal Password in Production:** Dev/Demo fallback logins are disabled when `NODE_ENV=production`.
- **No Passwords in API:** User queries strip the `password` field before sending data to the frontend.
- **Regex Injection Protection:** Student search queries dynamically escape regex control characters.
- **Strict CORS & Headers:** Managed via Helmet and backend environmental parameters (`ALLOWED_ORIGINS`).
- **Client-Side Cache & Freshness Management:**
  - `cacheManager.js` handles data lifetime and clears cache on logout.
  - `dataFreshness.js` polls or requests refresh keys for dashboards and activity timelines.
  - Token warning banners prompt users before session expiry (handled in `App.js` with auto-logout handling).

---

## 📡 6. Primary API Routes (Backend)

| Method | Endpoint | Description | Access Role |
| :--- | :--- | :--- | :--- |
| **POST** | `/api/auth/login` | Login user, issues JWT token | Public |
| **POST** | `/api/auth/register` | Create user account | Public |
| **GET** | `/api/dashboard/stats` | Retrieve learning metrics & hours | Student |
| **GET** | `/api/admin/users/search` | Search users with regex protection | Admin |
| **POST** | `/api/admin/batches` | Create a new student batch | Admin |
| **DELETE** | `/api/admin/batches/:id` | Cascading delete of batch | Admin |
| **PUT** | `/api/batches/:id/students` | Enroll students in a batch | Admin / Teacher |
| **PUT** | `/api/batches/:batchId/videos/:videoId` | Link video to batch | Admin |
| **POST** | `/api/zoom/meetings` | Auto-schedule Zoom Live Class | Admin |
| **POST** | `/api/zoom/sync-recordings` | Manual trigger for Cloud Sync | Admin |
