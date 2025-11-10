# ✅ SHEF LMS - Setup & Launch Checklist

## 📋 Pre-Installation Checklist

- [ ] Node.js installed (v14 or higher)
  - Check: `node --version`
- [ ] npm installed
  - Check: `npm --version`
- [ ] Firebase account created
  - URL: https://console.firebase.google.com/
- [ ] Git installed (optional)
  - Check: `git --version`
- [ ] Text editor installed (VS Code recommended)
- [ ] Two terminal windows available

---

## 🔥 Firebase Setup Checklist

### Firebase Console Setup
- [ ] Created new Firebase project
- [ ] Project name: `shef-lms` (or your choice)
- [ ] Enabled Google Analytics (optional)
- [ ] Project created successfully

### Firestore Database Setup
- [ ] Clicked "Create Database" in Firestore
- [ ] Selected "Start in test mode" (for development)
- [ ] Selected database location (closest to you)
- [ ] Database created successfully

### Web App Configuration
- [ ] Clicked "Add App" → Web (</> icon)
- [ ] App nickname: `SHEF LMS Web`
- [ ] Copied Firebase configuration object
- [ ] Pasted into `frontend/src/firebase/config.js`

### Service Account Setup (Backend)
- [ ] Went to Project Settings → Service Accounts
- [ ] Clicked "Generate New Private Key"
- [ ] Downloaded JSON file
- [ ] Saved as `serviceAccountKey.json` in backend folder
- [ ] OR configured environment variables in `.env`

---

## 💻 Application Setup Checklist

### Installation
- [ ] Cloned/downloaded project
- [ ] Opened project in terminal/command prompt
- [ ] Ran installation script:
  - Windows: `install.bat`
  - Mac/Linux: `./install.sh`
- [ ] All dependencies installed successfully

### Backend Configuration
- [ ] Opened `backend/.env` file
- [ ] Verified PORT is set to 5000
- [ ] Verified JWT_SECRET is set
- [ ] Added Firebase credentials:
  - [ ] Option 1: Set `GOOGLE_APPLICATION_CREDENTIALS` path
  - [ ] Option 2: Set individual Firebase variables
- [ ] Saved `.env` file

### Frontend Configuration
- [ ] Opened `frontend/src/firebase/config.js`
- [ ] Replaced all "YOUR_" placeholders with actual values:
  - [ ] apiKey
  - [ ] authDomain
  - [ ] projectId
  - [ ] storageBucket
  - [ ] messagingSenderId
  - [ ] appId
- [ ] Saved config file

---

## 🚀 Launch Checklist

### Start Backend
- [ ] Opened terminal in project root
- [ ] Navigated to backend: `cd backend`
- [ ] Started server: `npm start`
- [ ] Verified message: "Server running on port 5000"
- [ ] Verified message: "Firebase Admin initialized successfully"
- [ ] No error messages in console

### Start Frontend
- [ ] Opened NEW terminal in project root
- [ ] Navigated to frontend: `cd frontend`
- [ ] Started app: `npm start`
- [ ] Browser opened automatically to http://localhost:3000
- [ ] No compilation errors
- [ ] Login page displayed

---

## 🧪 Testing Checklist

### Admin Login Test
- [ ] Navigated to http://localhost:3000/login
- [ ] Entered admin credentials:
  - Email: `admin@sheflms.com`
  - Password: `SuperAdmin@123`
- [ ] Clicked "Login"
- [ ] Redirected to admin dashboard (/admin)
- [ ] Admin panel displayed correctly
- [ ] Sidebar navigation working
- [ ] Statistics showing (may be 0 initially)

### Student Login Test
- [ ] Logged out from admin
- [ ] Entered student credentials:
  - Email: `lqdeleon@gmail.com`
  - Password: `Admin@123`
- [ ] Clicked "Login"
- [ ] Redirected to student dashboard (/dashboard)
- [ ] Student dashboard displayed correctly
- [ ] All sections accessible (Home, Learn, Practice, etc.)

---

## 📊 Admin Panel Testing

### Data Management
- [ ] **Add Course**
  - Clicked Courses → Add Course
  - Filled form
  - Successfully created
- [ ] **Add Module**
  - Clicked Modules → Add Module
  - Selected course
  - Successfully created
- [ ] **Add Lesson**
  - Clicked Lessons → Add Lesson
  - Selected module
  - Successfully created
- [ ] **Add Project**
  - Clicked Projects → Add Project
  - Filled form
  - Successfully created
- [ ] **Add Assessment**
  - Clicked Assessments → Add Assessment
  - Filled form
  - Successfully created
- [ ] **Add Job**
  - Clicked Job Board → Add Job
  - Filled form
  - Successfully created
- [ ] **Add Mentor**
  - Clicked Mentors → Add Mentor
  - Filled form
  - Successfully created
- [ ] **Add Student**
  - Clicked Students → Add Student
  - Filled form
  - Successfully created

### CRUD Operations
- [ ] **Edit Test**
  - Clicked edit button on any item
  - Modified data
  - Successfully updated
- [ ] **Delete Test**
  - Clicked delete button on any item
  - Confirmed deletion
  - Successfully deleted
- [ ] **View Test**
  - Verified data appears in tables/cards
  - All information displayed correctly

### Navigation
- [ ] All sidebar menu items work
- [ ] Overview section loads
- [ ] All management sections accessible
- [ ] Analytics section displays
- [ ] Content management works
- [ ] Logout button works

---

## 🎓 Student Dashboard Testing

### Navigation
- [ ] Home section displays
- [ ] Learn section displays course modules
- [ ] Practice section shows challenges
- [ ] Projects section shows capstone projects
- [ ] Job Board section shows listings
- [ ] Career section displays services
- [ ] Mentorship section shows mentors
- [ ] Profile modal opens and shows details

### Content Display
- [ ] Course information displays (if added via admin)
- [ ] Modules appear in Learn section
- [ ] Practice challenges visible
- [ ] Projects cards display
- [ ] Jobs listings appear
- [ ] Mentors grid displays
- [ ] Progress tracking works

### Features
- [ ] Sidebar navigation works
- [ ] Section switching works
- [ ] Help button works
- [ ] Profile modal opens
- [ ] Logout works
- [ ] Returns to login page after logout

---

## 🔍 Firebase Verification

### Firestore Console Check
- [ ] Opened Firebase Console
- [ ] Clicked Firestore Database
- [ ] Verified collections exist:
  - [ ] courses
  - [ ] modules
  - [ ] lessons
  - [ ] projects
  - [ ] assessments
  - [ ] jobs
  - [ ] mentors
  - [ ] users
- [ ] Clicked on a collection
- [ ] Verified documents appear
- [ ] Data matches what was added in admin panel

### Data Sync Check
- [ ] Added item in admin panel
- [ ] Checked Firestore Console
- [ ] Verified item appears in Firestore
- [ ] Refreshed student dashboard
- [ ] Verified item appears for student

---

## 🐛 Troubleshooting Checklist

### Backend Issues
- [ ] Check terminal for error messages
- [ ] Verify backend is running on port 5000
- [ ] Check `.env` file exists and is configured
- [ ] Verify Firebase credentials are correct
- [ ] Test backend: http://localhost:5000
  - Should show: "Welcome to SHEF LMS API - Firebase Edition"

### Frontend Issues
- [ ] Check browser console for errors (F12)
- [ ] Verify frontend is running on port 3000
- [ ] Check Firebase config is updated
- [ ] Clear browser cache
- [ ] Try incognito/private browsing

### Firebase Issues
- [ ] Verify Firestore is enabled
- [ ] Check Firebase Console for errors
- [ ] Verify service account has permissions
- [ ] Check network tab for failed requests
- [ ] Verify Firebase project is active

### Login Issues
- [ ] Verify exact credentials (case-sensitive)
- [ ] Check backend is running
- [ ] Check network tab for API calls
- [ ] Verify JWT_SECRET is set
- [ ] Check browser console for errors

---

## 📈 Performance Checklist

- [ ] Pages load within 2 seconds
- [ ] No lag when navigating sections
- [ ] Forms submit quickly
- [ ] Data loads without delays
- [ ] No console errors or warnings
- [ ] Images/icons display correctly
- [ ] Animations smooth
- [ ] Responsive on different screen sizes

---

## 🔒 Security Checklist

### Development
- [ ] `.env` file not committed to Git
- [ ] `serviceAccountKey.json` not committed to Git
- [ ] `.gitignore` file includes sensitive files
- [ ] Firebase credentials not exposed in frontend code

### Production (When Deploying)
- [ ] Change JWT_SECRET to strong random value
- [ ] Enable Firebase security rules
- [ ] Set up Firebase Authentication
- [ ] Configure CORS properly
- [ ] Use environment variables for all secrets
- [ ] Enable HTTPS
- [ ] Set up proper user roles
- [ ] Implement rate limiting

---

## 📱 Browser Compatibility Checklist

Tested and working on:
- [ ] Google Chrome
- [ ] Firefox
- [ ] Microsoft Edge
- [ ] Safari
- [ ] Mobile Chrome
- [ ] Mobile Safari

---

## 📚 Documentation Checklist

Documentation files available:
- [ ] `README.md` - Project overview
- [ ] `FIREBASE_SETUP_GUIDE.md` - Firebase setup instructions
- [ ] `ADMIN_GUIDE.md` - Admin panel guide
- [ ] `CREDENTIALS.md` - Login credentials
- [ ] `IMPLEMENTATION_SUMMARY.md` - Implementation details
- [ ] `INSTALLATION_CHECKLIST.md` - This file

---

## ✅ Final Verification

### Everything Working
- [ ] Backend server running without errors
- [ ] Frontend app running without errors
- [ ] Admin can login
- [ ] Student can login
- [ ] Admin can add/edit/delete data
- [ ] Student can view data
- [ ] Firebase sync working
- [ ] All sections accessible
- [ ] No console errors
- [ ] No 404 errors
- [ ] Responsive design working

### Ready for Use
- [ ] Initial courses added
- [ ] Sample modules created
- [ ] Some lessons added
- [ ] Projects available
- [ ] Jobs posted
- [ ] Mentors added
- [ ] Test students enrolled
- [ ] Announcements posted (optional)

---

## 🎉 Success!

If all items are checked, congratulations! 🎊

Your SHEF LMS is now fully functional with:
- ✅ Super Admin Panel
- ✅ Student Dashboard
- ✅ Firebase Integration
- ✅ Complete CRUD Operations
- ✅ Role-Based Access
- ✅ Professional UI/UX

### Next Steps:
1. Start adding your actual course content
2. Invite real students
3. Customize the design if needed
4. Set up Firebase security rules
5. Plan for production deployment

### Need Help?
- Review documentation files
- Check Firebase Console
- Inspect browser console
- Review server logs

---

**Checklist Last Updated**: November 8, 2025

**Status**: Ready for Production Content! 🚀
