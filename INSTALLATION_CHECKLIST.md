# 🎯 SHEF LMS - Installation Checklist

## ✅ Pre-Installation Checklist

- [ ] Node.js installed (version 14+)
  - Check: `node --version`
  - Download: https://nodejs.org
  
- [ ] npm installed
  - Check: `npm --version`
  - Comes with Node.js

- [ ] MongoDB installed (optional - app works with demo data)
  - Check: `mongod --version`
  - Download: https://www.mongodb.com/try/download/community

- [ ] Code editor (VS Code recommended)
  - Download: https://code.visualstudio.com

- [ ] Terminal/Command Prompt access

## 🚀 Installation Steps

### Option A: Automated Setup (Recommended)

**Windows Users:**
- [ ] Open PowerShell or Command Prompt
- [ ] Navigate to project folder: `cd "c:\Users\hp\Desktop\SHEF LMS"`
- [ ] Run: `.\setup.bat` or `.\setup.ps1`
- [ ] Wait for installation to complete

**Mac/Linux Users:**
- [ ] Open Terminal
- [ ] Navigate to project folder
- [ ] Run: `chmod +x setup.sh`
- [ ] Run: `./setup.sh`
- [ ] Wait for installation to complete

### Option B: Manual Setup

**Backend Setup:**
- [ ] Open Terminal/CMD
- [ ] `cd backend`
- [ ] `npm install`
- [ ] Wait for dependencies to install
- [ ] Verify: Check for `node_modules` folder

**Frontend Setup:**
- [ ] Open new Terminal/CMD
- [ ] `cd frontend`
- [ ] `npm install`
- [ ] Wait for dependencies to install
- [ ] Verify: Check for `node_modules` folder

## ▶️ Running the Application

### Start Backend Server (Terminal 1)
- [ ] Open Terminal/CMD #1
- [ ] Navigate: `cd backend`
- [ ] Start: `npm start`
- [ ] Look for: "Server running on port 5000"
- [ ] Look for: "MongoDB Connected" (if using MongoDB)
- [ ] Keep this terminal open

### Start Frontend Server (Terminal 2)
- [ ] Open Terminal/CMD #2
- [ ] Navigate: `cd frontend`
- [ ] Start: `npm start`
- [ ] Wait for compilation
- [ ] Browser should auto-open to `http://localhost:3000`
- [ ] Keep this terminal open

## 🔐 First Login

- [ ] Browser opens to login page
- [ ] See "SHEF LMS" logo and welcome message
- [ ] Click "Use Demo Account" button OR
- [ ] Manually enter:
  - Email: `demo@sheflms.com`
  - Password: `demo123`
- [ ] Click "Sign In"
- [ ] Redirects to Dashboard

## ✨ Verify Dashboard Features

### Header
- [ ] See "Welcome back, Abhishek!" message
- [ ] Notification bell icon visible (with badge "3")
- [ ] User avatar showing "A"

### Sidebar
- [ ] See "SHEF LMS" logo with book icon
- [ ] Navigation items visible:
  - [ ] 🏠 Overview (active by default)
  - [ ] 📖 My Courses
  - [ ] 📊 Activity
  - [ ] 📅 Calendar
  - [ ] 💬 Messages
  - [ ] ⚙️ Settings
- [ ] Logout button at bottom

### Statistics Cards (6 total)
- [ ] 📚 Enrolled Courses: 4
- [ ] ✅ Completed: 1
- [ ] ⏳ In Progress: 3
- [ ] ⏱️ Learning Hours: 128h
- [ ] 🏆 Certificates: 1
- [ ] 📅 Upcoming Classes: 2

### Continue Learning Section
- [ ] See 3 course cards
- [ ] Each card shows:
  - [ ] Course thumbnail (emoji icon)
  - [ ] Course title
  - [ ] Instructor name
  - [ ] Module count and duration
  - [ ] Progress bar
  - [ ] Percentage complete
  - [ ] "Continue Learning" button
- [ ] Hover effects work on cards

### Recent Activity Section
- [ ] See 5 activity items
- [ ] Each shows icon, title, course, and time
- [ ] Activities include:
  - [ ] Module completion
  - [ ] Assignment submission
  - [ ] Class attendance
  - [ ] Certificate earned
  - [ ] Course enrollment

## 🎨 Test Interactive Features

### Navigation
- [ ] Click "My Courses" - shows all 4 courses
- [ ] Click "Activity" - shows full timeline view
- [ ] Click "Overview" - returns to main dashboard
- [ ] Filter buttons work on courses page

### Responsive Design
- [ ] Resize browser window
- [ ] Sidebar collapses on smaller screens
- [ ] Cards reorganize in grid
- [ ] Mobile layout looks good

### Animations
- [ ] Hover over stat cards - they lift up
- [ ] Hover over course cards - shadow increases
- [ ] Hover over buttons - color changes
- [ ] Progress bars animate smoothly

### Logout
- [ ] Click logout button in sidebar
- [ ] Redirects to login page
- [ ] Attempting to access dashboard redirects to login

## 🐛 Troubleshooting

### Backend Won't Start
- [ ] Check if port 5000 is available
- [ ] Verify `node_modules` exists in backend folder
- [ ] Check for syntax errors in console
- [ ] Verify `.env` file exists

### Frontend Won't Start
- [ ] Check if port 3000 is available (or use suggested port)
- [ ] Verify `node_modules` exists in frontend folder
- [ ] Clear browser cache
- [ ] Try `npm install` again

### Login Not Working
- [ ] Check if backend is running
- [ ] Verify credentials: `demo@sheflms.com` / `demo123`
- [ ] Check browser console for errors
- [ ] Check backend terminal for API errors

### Dashboard Empty/Not Loading
- [ ] Check browser console for errors
- [ ] Verify backend API is responding (visit `http://localhost:5000`)
- [ ] Check network tab in browser DevTools
- [ ] Ensure both servers are running

### Styling Issues
- [ ] Hard refresh browser (Ctrl+F5 or Cmd+Shift+R)
- [ ] Clear browser cache
- [ ] Check if CSS files exist
- [ ] Verify no CSS compilation errors

## 📊 Success Criteria

Your installation is successful if you can:
- ✅ Login with demo credentials
- ✅ See all 6 statistics cards
- ✅ View 4 courses with progress bars
- ✅ See 5 recent activities
- ✅ Navigate between sections
- ✅ Logout and login again
- ✅ Responsive design works

## 🎓 Next Steps After Installation

1. **Explore the Application**
   - [ ] Click through all navigation items
   - [ ] Test responsive design on mobile
   - [ ] Check all interactive elements

2. **Understand the Code**
   - [ ] Review `backend/server.js`
   - [ ] Check `frontend/src/App.js`
   - [ ] Explore components
   - [ ] Study API routes

3. **Customize**
   - [ ] Change company name/logo
   - [ ] Modify color scheme
   - [ ] Add more courses
   - [ ] Customize statistics

4. **Learn More**
   - [ ] Read README.md for full documentation
   - [ ] Check PROJECT_STRUCTURE.md
   - [ ] Review BUILD_SUMMARY.md

## 📞 Need Help?

If something isn't working:
1. Check this checklist thoroughly
2. Review error messages carefully
3. Check browser console (F12)
4. Review terminal output
5. Consult README.md documentation

## 🎉 Congratulations!

Once all items are checked, you have successfully:
- ✅ Installed SHEF LMS
- ✅ Started both servers
- ✅ Logged into the application
- ✅ Verified all features work
- ✅ Ready to customize and learn!

**Welcome to SHEF LMS! Happy Learning! 📚✨**

---

**Installation Date:** _______________
**Completed By:** _______________
**All Tests Passed:** [ ] Yes [ ] No
