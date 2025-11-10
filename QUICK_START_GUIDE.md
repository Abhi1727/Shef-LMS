# 🚀 SHEF LMS - Quick Start Guide

## ✅ Firebase Configuration: COMPLETE

Your Firebase credentials have been successfully configured!

---

## 🎯 Quick Start (3 Simple Steps)

### Step 1️⃣: Install Dependencies

**Windows (Command Prompt or PowerShell):**
```bash
cd "Shef LMS"
cd backend
npm install
```

Then in a new terminal:
```bash
cd "Shef LMS"
cd frontend
npm install
```

**Mac/Linux (Terminal):**
```bash
cd "Shef LMS"
cd backend
npm install

# In new terminal
cd "Shef LMS"
cd frontend
npm install
```

---

### Step 2️⃣: Start Backend Server

**In one terminal:**
```bash
cd "Shef LMS"
cd backend
npm start
```

**You should see:**
```
Server running on port 5000
Firebase Admin initialized successfully
```

✅ **Backend is ready!**

---

### Step 3️⃣: Start Frontend Application

**In a NEW terminal:**
```bash
cd "Shef LMS"
cd frontend
npm start
```

**You should see:**
```
Compiled successfully!
On Your Network: http://localhost:3000
```

✅ **Browser should open automatically at http://localhost:3000**

---

## 👤 Login & Test

### Option 1: Login as Admin
```
📧 Email: admin@sheflms.com
🔐 Password: SuperAdmin@123
```

**You can:**
- ✅ Add courses, modules, lessons
- ✅ Add projects and assessments
- ✅ Post jobs and add mentors
- ✅ Manage students
- ✅ Post announcements
- ✅ View analytics

### Option 2: Login as Student
```
📧 Email: lqdeleon@gmail.com
🔐 Password: Admin@123
```

**You can:**
- ✅ View courses and lessons
- ✅ Access projects
- ✅ Browse job board
- ✅ Connect with mentors
- ✅ View career services

---

## 📊 Admin Panel Features

Once logged in as admin, you can:

### 📚 Add Course
1. Click **Courses** in sidebar
2. Click **➕ Add Course**
3. Enter:
   - Title: "Cyber Security"
   - Description: "6-month program"
   - Duration: "6 months"
   - Modules: "10"
4. Click **Create**

### 📖 Add Module
1. Click **Modules**
2. Click **➕ Add Module**
3. Select course
4. Enter module details
5. Click **Create**

### 📝 Add Lesson
1. Click **Lessons**
2. Click **➕ Add Lesson**
3. Select module
4. Enter lesson content
5. Click **Create**

### 📁 Add Project
1. Click **Projects**
2. Click **➕ Add Project**
3. Enter project details
4. Click **Create**

### ✏️ Add Assessment
1. Click **Assessments**
2. Click **➕ Add Assessment**
3. Enter test details
4. Click **Create**

### 💼 Post Job
1. Click **Job Board**
2. Click **➕ Add Job**
3. Enter job details
4. Click **Create**

### 👨‍🏫 Add Mentor
1. Click **Mentors**
2. Click **➕ Add Mentor**
3. Enter mentor details
4. Click **Create**

### 👥 Add Student
1. Click **Students**
2. Click **➕ Add Student**
3. Enter student details
4. Click **Create**

---

## 🔄 How It Works

```
Admin Adds Content
        ↓
Content Saved to Firebase
        ↓
Student Logs In
        ↓
Student Sees All Content in Real-Time
```

**Everything is stored in Firebase Firestore and syncs automatically!**

---

## 🌐 URLs

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **Login Page**: http://localhost:3000/login
- **Admin Dashboard**: http://localhost:3000/admin (after login)
- **Student Dashboard**: http://localhost:3000/dashboard (after login)

---

## 🛠️ Terminal Setup (Recommended)

### For Windows Users - Easy Setup:

**Option 1: Use Batch Script**
```bash
cd "Shef LMS"
install.bat
```

**Option 2: Manual**
```
# Terminal 1 (Backend)
cd Shef LMS\backend
npm start

# Terminal 2 (Frontend) 
cd Shef LMS\frontend
npm start
```

---

## 📱 Mobile Access

You can access the app from your phone/tablet on the same network:

1. Find your computer's IP address:
   - **Windows**: Open PowerShell, type `ipconfig`
   - **Mac**: Open Terminal, type `ifconfig`

2. On your phone, open: `http://YOUR_IP:3000`

Example: `http://192.168.1.100:3000`

---

## ✅ Troubleshooting

### Problem: "Port 3000 already in use"
```bash
# Kill the process
# Windows
netstat -ano | findstr :3000
taskkill /PID <process_id> /F

# Mac/Linux
lsof -ti:3000 | xargs kill -9
```

### Problem: "npm command not found"
- Install Node.js from https://nodejs.org/

### Problem: Firebase Connection Error
- Verify internet connection
- Check `.env` file in backend
- Check `frontend/src/firebase/config.js`

### Problem: "Cannot GET /api/auth/login"
- Make sure backend is running
- Check backend is on port 5000

---

## 🎓 Learning Path

### As Admin:
1. **Login** with admin credentials
2. **Add a course** (e.g., "Python Programming")
3. **Add modules** to the course
4. **Add lessons** to modules
5. **Add projects** students can work on
6. **Add assessments** for practice
7. **Post some jobs** on job board
8. **Add mentors** from industry
9. **Enroll students**

### As Student:
1. **Login** with student credentials
2. **View dashboard** with all admin content
3. **Explore courses** in Learn section
4. **Check job board**
5. **Browse mentors**
6. **Explore projects**

---

## 📚 Project Files

**Key Files:**
- `frontend/src/components/AdminDashboard.js` - Admin panel
- `frontend/src/components/Dashboard.js` - Student dashboard
- `frontend/src/firebase/config.js` - Firebase config ✅ UPDATED
- `backend/.env` - Backend config ✅ UPDATED
- `backend/routes/admin.js` - Admin API routes
- `backend/server.js` - Express server

---

## 🔥 Firebase Console

Visit your Firebase project:
https://console.firebase.google.com/project/shef-lms-c8922

**You can:**
- Monitor Firestore data
- Check user authentication
- View storage files
- Monitor real-time activity

---

## 🎉 You're All Set!

**Everything is configured and ready to run!**

### Next Action:
1. Open PowerShell or Command Prompt
2. Run: `cd "Shef LMS" && cd backend && npm start`
3. Open another terminal: `cd "Shef LMS" && cd frontend && npm start`
4. Browser opens to http://localhost:3000
5. Login and start using!

---

**Happy Learning!** 🚀📚

**For detailed setup, see `FIREBASE_SETUP_GUIDE.md` and `ADMIN_GUIDE.md`**

Last Updated: November 9, 2025
