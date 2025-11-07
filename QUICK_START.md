# 🚀 Quick Start Guide - SHEF LMS

## ⚡ Fast Setup (Choose One Method)

### Method 1: Automated Setup (Recommended)
Run the setup script to install all dependencies:

**Windows (PowerShell):**
```powershell
.\setup.ps1
```

**Mac/Linux:**
```bash
chmod +x setup.sh
./setup.sh
```

### Method 2: Manual Setup

**Backend:**
```bash
cd backend
npm install
```

**Frontend:**
```bash
cd frontend
npm install
```

## 🎯 Running the Application

### Step 1: Start Backend Server
Open Terminal/PowerShell window 1:
```bash
cd backend
npm start
```
✅ Backend running at: http://localhost:5000

### Step 2: Start Frontend Server
Open Terminal/PowerShell window 2:
```bash
cd frontend
npm start
```
✅ Frontend running at: http://localhost:3000

The browser will automatically open to http://localhost:3000

## 🔑 Login Credentials

### Demo Account
- **Email:** demo@sheflms.com
- **Password:** demo123

Click "Use Demo Account" button on login page for instant access!

## 📦 What You Get

### Login Page Features
✨ Beautiful gradient design
✨ Form validation
✨ Demo credentials button
✨ Responsive mobile design

### Dashboard Features
✨ 6 Statistics cards (Enrolled, Completed, In Progress, Hours, Certificates, Classes)
✨ Course cards with progress bars
✨ Recent activity timeline
✨ Sidebar navigation (Overview, Courses, Activity, Calendar, Messages, Settings)
✨ User profile with notifications
✨ Fully responsive design

## 🎨 Dashboard Sections

1. **Overview** - Statistics and summary
2. **My Courses** - All enrolled courses with filters
3. **Activity** - Timeline of recent activities
4. **Calendar** - Upcoming classes (coming soon)
5. **Messages** - Communication (coming soon)
6. **Settings** - User preferences (coming soon)

## 📱 Sample Data Included

### 4 Demo Courses:
1. Full Stack Data Science & AI Program (45% progress)
2. Web Development Bootcamp (60% progress)
3. Machine Learning Masterclass (30% progress)
4. Python Programming (75% progress)

### 5 Recent Activities:
- Course completion
- Assignment submission
- Class attendance
- Certificate earned
- Course enrollment

## 🛠️ Tech Stack

**Backend:**
- Node.js + Express
- MongoDB (demo data works without DB)
- JWT Authentication

**Frontend:**
- React 18
- React Router v6
- Axios
- Modern CSS with animations

## 🔧 Troubleshooting

**Port already in use?**
- Backend: Change PORT in backend/.env
- Frontend: It will prompt to use different port

**MongoDB not installed?**
- App works with demo data without MongoDB
- For full features, install MongoDB or use MongoDB Atlas

**Dependencies issues?**
- Delete node_modules folders
- Run `npm install` again

## 📚 Next Steps

After logging in:
1. ✅ Explore the dashboard overview
2. ✅ Check course progress
3. ✅ View activity timeline
4. ✅ Navigate between sections
5. ✅ Test responsive design on mobile

## 💡 Tips

- Use the sidebar to switch between sections
- Hover over cards for smooth animations
- Click "Continue Learning" to interact with courses
- Check the notifications icon (3 new notifications)

## 🎓 Project Structure

```
SHEF LMS/
├── backend/          # Express API
├── frontend/         # React App
├── README.md         # Full documentation
└── setup scripts     # Automated setup
```

---

**Ready to explore SHEF LMS!** 🚀📚

For detailed documentation, see README.md
