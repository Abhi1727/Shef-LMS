# 🔐 SHEF LMS - Demo Credentials & Access Information

## 👤 Demo User Accounts

### Super Admin Account
- **Email**: `admin@sheflms.com`
- **Password**: `SuperAdmin@123`
- **Role**: Admin
- **Access**: Full admin panel with all management features
- **URL**: http://localhost:3000/admin (after login)

**What Admin Can Do:**
- Manage all students
- Create/edit/delete courses, modules, lessons
- Add projects and assessments
- Post job opportunities
- Add mentors
- Post announcements
- View analytics
- Complete control over student dashboard content

---

### Student Account
- **Email**: `lqdeleon@gmail.com`
- **Password**: `Admin@123`
- **Name**: Leonardo De Leon
- **Enrollment Number**: SU-2025-001
- **Course**: Cyber Security & Ethical Hacking
- **Role**: Student
- **Access**: Student dashboard with learning features
- **URL**: http://localhost:3000/dashboard (after login)

**What Student Can Do:**
- View course modules and lessons
- Access practice labs and challenges
- Work on capstone projects
- Take assessments
- Browse job board
- Connect with mentors
- View career resources

---

## 🌐 Application URLs

### Development URLs
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **Login Page**: http://localhost:3000/login
- **Student Dashboard**: http://localhost:3000/dashboard
- **Admin Panel**: http://localhost:3000/admin

### API Endpoints
- **Auth**: http://localhost:5000/api/auth
  - POST /login - User login
  - POST /register - User registration
  - GET /me - Get current user

- **Admin**: http://localhost:5000/api/admin
  - GET/POST/PUT/DELETE /users - Manage students
  - GET/POST/PUT/DELETE /courses - Manage courses
  - GET/POST/PUT/DELETE /modules - Manage modules
  - GET/POST/PUT/DELETE /lessons - Manage lessons
  - GET/POST/PUT/DELETE /projects - Manage projects
  - GET/POST/PUT/DELETE /assessments - Manage assessments
  - GET/POST/PUT/DELETE /jobs - Manage jobs
  - GET/POST/PUT/DELETE /mentors - Manage mentors
  - GET /stats - Get admin statistics

---

## 🔥 Firebase Configuration

### Frontend Configuration
**File**: `frontend/src/firebase/config.js`

Replace with your Firebase project credentials:
```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

**How to get these:**
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Click Project Settings (⚙️)
4. Scroll to "Your apps" section
5. Copy the config object

---

### Backend Configuration
**File**: `backend/.env`

**Option 1: Using Service Account File**
```env
PORT=5000
JWT_SECRET=shef_lms_secret_key_2025
GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json
```

**Option 2: Using Environment Variables**
```env
PORT=5000
JWT_SECRET=shef_lms_secret_key_2025
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour key here\n-----END PRIVATE KEY-----\n"
```

**How to get Service Account:**
1. Go to Firebase Console
2. Project Settings → Service Accounts
3. Click "Generate New Private Key"
4. Download JSON file
5. Save as `serviceAccountKey.json` in backend folder

---

## 🚀 Quick Start Commands

### Installation
```bash
# Windows
install.bat

# Mac/Linux
chmod +x install.sh
./install.sh
```

### Running the Application

**Terminal 1 - Backend:**
```bash
cd backend
npm start
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm start
```

---

## 🎯 Test Workflow

### As Admin:

1. **Login**
   - Go to http://localhost:3000/login
   - Use: admin@sheflms.com / SuperAdmin@123

2. **Add a Course**
   - Click "Courses" → "➕ Add Course"
   - Fill in details
   - Click "Create"

3. **Add Students**
   - Click "Students" → "➕ Add Student"
   - Enter student details
   - Click "Create"

4. **Post a Job**
   - Click "Job Board" → "➕ Add Job"
   - Fill in job details
   - Click "Create"

5. **View Analytics**
   - Click "Analytics"
   - See all statistics

### As Student:

1. **Login**
   - Go to http://localhost:3000/login
   - Use: lqdeleon@gmail.com / Admin@123

2. **Explore Dashboard**
   - View home overview
   - Click "Learn" to see courses
   - Click "Practice" for challenges
   - Click "Projects" for capstone projects
   - Click "Job Board" for opportunities

3. **Check Progress**
   - View your enrollment
   - See course progress (0% initially)

---

## 🔒 Security Notes

### Important:
- Never commit `.env` file to version control
- Never commit `serviceAccountKey.json` to Git
- Change JWT_SECRET in production
- Enable Firebase security rules
- Use environment variables for sensitive data

### Firebase Security Rules (Recommended):
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow admin full access
    match /{document=**} {
      allow read, write: if request.auth != null && 
                         request.auth.token.role == 'admin';
    }
    
    // Students can only read
    match /courses/{course} {
      allow read: if request.auth != null;
    }
    
    match /jobs/{job} {
      allow read: if request.auth != null;
    }
  }
}
```

---

## 📱 Testing Checklist

### Admin Panel Testing
- [ ] Login as admin
- [ ] View dashboard statistics
- [ ] Add a course
- [ ] Add a module
- [ ] Add a lesson
- [ ] Add a project
- [ ] Add an assessment
- [ ] Post a job
- [ ] Add a mentor
- [ ] Add a student
- [ ] Edit existing items
- [ ] Delete items
- [ ] View analytics

### Student Dashboard Testing
- [ ] Login as student
- [ ] View home dashboard
- [ ] Navigate to Learn section
- [ ] Navigate to Practice section
- [ ] Navigate to Projects section
- [ ] Navigate to Job Board
- [ ] Navigate to Mentorship
- [ ] Navigate to Career section
- [ ] View profile modal
- [ ] Test logout

---

## 🛠️ Troubleshooting

### Can't Login
**Issue**: Invalid credentials error
**Solution**: 
- Verify you're using correct email/password
- Check backend is running on port 5000
- Check browser console for errors

### Firebase Connection Error
**Issue**: Firebase errors in console
**Solution**:
- Verify Firebase config in `frontend/src/firebase/config.js`
- Check `.env` file in backend
- Ensure Firestore is enabled in Firebase Console
- Verify service account permissions

### Data Not Appearing
**Issue**: Added data doesn't show
**Solution**:
- Refresh the page
- Check Firebase Console to verify data was saved
- Check browser console for errors
- Verify API endpoints are working

### Port Already in Use
**Issue**: Port 3000 or 5000 already in use
**Solution**:
```bash
# Windows - Kill process on port
netstat -ano | findstr :5000
taskkill /PID <process_id> /F

# Mac/Linux
lsof -ti:5000 | xargs kill -9
```

---

## 📞 Support Resources

### Documentation Files
- `FIREBASE_SETUP_GUIDE.md` - Complete Firebase setup
- `ADMIN_GUIDE.md` - Admin panel usage guide
- `IMPLEMENTATION_SUMMARY.md` - Project overview
- `README.md` - General project information

### Online Resources
- [Firebase Documentation](https://firebase.google.com/docs)
- [React Documentation](https://react.dev)
- [Express.js Guide](https://expressjs.com)

---

## 🎓 Additional Test Accounts

You can create additional test accounts:

### Create Student via Admin Panel
1. Login as admin
2. Go to Students → Add Student
3. Create new student account

### Create Student via Registration (If Enabled)
Use the registration API:
```bash
POST http://localhost:5000/api/auth/register
Body: {
  "name": "Test Student",
  "email": "test@example.com",
  "password": "Password123",
  "role": "student"
}
```

---

**Keep this file secure and don't share production credentials!**

**Last Updated**: November 8, 2025
