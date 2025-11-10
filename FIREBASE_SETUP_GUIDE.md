# SHEF LMS - Learning Management System with Super Admin Panel

A comprehensive Learning Management System built with React, Node.js, Express, and Firebase, featuring a student dashboard and a powerful super admin panel.

## 🚀 Features

### Student Dashboard
- **Course Learning**: Complete cyber security course with 10 modules
- **Practice Labs**: Security challenges and CTF exercises
- **Projects**: Capstone projects and practical assignments
- **Assessments**: Mock exams and practice quizzes
- **Career Services**: Job board, resume building, interview prep
- **Mentorship**: Connect with industry professionals
- **Progress Tracking**: Real-time course progress monitoring

### Super Admin Panel
- **User Management**: Add, edit, delete students and manage enrollments
- **Course Management**: Create and manage courses, modules, and lessons
- **Content Control**: Manage all student dashboard content
- **Project Management**: Add and edit capstone projects
- **Assessment Management**: Create practice tests and challenges
- **Job Board Management**: Post and manage job opportunities
- **Mentor Management**: Add industry mentors and their profiles
- **Analytics Dashboard**: View student progress and system statistics
- **Announcements**: Post system-wide announcements

## 📋 Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Firebase account
- Modern web browser

## 🔧 Installation

### 1. Clone the Repository
\`\`\`bash
cd "Shef LMS"
\`\`\`

### 2. Install Backend Dependencies
\`\`\`bash
cd backend
npm install
\`\`\`

### 3. Install Frontend Dependencies
\`\`\`bash
cd ../frontend
npm install
\`\`\`

### 4. Firebase Setup

#### Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add Project"
3. Follow the setup wizard
4. Enable Firestore Database
5. Create a Web App in your Firebase project

#### Get Firebase Config
1. In Firebase Console, go to Project Settings
2. Scroll to "Your apps" section
3. Copy the Firebase configuration object
4. Update `frontend/src/firebase/config.js` with your credentials:

\`\`\`javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
\`\`\`

#### Setup Firebase Admin SDK (Backend)
1. In Firebase Console, go to Project Settings → Service Accounts
2. Click "Generate New Private Key"
3. Download the JSON file
4. Create a `.env` file in the `backend` directory:

\`\`\`env
PORT=5000
JWT_SECRET=shef_lms_secret_key_2025

# Option 1: Use service account file path
GOOGLE_APPLICATION_CREDENTIALS=path/to/serviceAccountKey.json

# Option 2: Use individual credentials
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-client-email
FIREBASE_PRIVATE_KEY="your-private-key"
\`\`\`

### 5. Initialize Firestore Database

The database collections will be created automatically when you add data through the admin panel. The following collections are used:

- `users` - Student and admin accounts
- `courses` - Course information
- `modules` - Course modules
- `lessons` - Individual lessons
- `projects` - Capstone projects
- `assessments` - Practice tests and quizzes
- `jobs` - Job board listings
- `mentors` - Mentor profiles
- `content` - Announcements and featured content

## 🚀 Running the Application

### Start Backend Server
\`\`\`bash
cd backend
npm start
# or for development with auto-reload
npm run dev
\`\`\`
Backend will run on `http://localhost:5000`

### Start Frontend Application
\`\`\`bash
cd frontend
npm start
\`\`\`
Frontend will run on `http://localhost:3000`

## 👤 Demo Credentials

### Student Account
- **Email**: lqdeleon@gmail.com
- **Password**: Admin@123
- **Access**: Student Dashboard

### Admin Account
- **Email**: admin@sheflms.com
- **Password**: SuperAdmin@123
- **Access**: Super Admin Panel

## 📱 Application Structure

\`\`\`
Shef LMS/
├── backend/
│   ├── config/
│   │   └── firebase.js          # Firebase Admin initialization
│   ├── routes/
│   │   ├── auth.js              # Authentication routes
│   │   ├── admin.js             # Admin CRUD operations
│   │   ├── courses.js           # Course routes
│   │   └── dashboard.js         # Dashboard routes
│   ├── server.js                # Express server setup
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Login.js         # Login component
│   │   │   ├── Login.css
│   │   │   ├── Dashboard.js     # Student dashboard
│   │   │   ├── Dashboard.css
│   │   │   ├── AdminDashboard.js # Admin panel
│   │   │   └── AdminDashboard.css
│   │   ├── firebase/
│   │   │   └── config.js        # Firebase client config
│   │   ├── services/
│   │   │   └── firebaseService.js # Firebase CRUD operations
│   │   ├── App.js               # Main app with routing
│   │   └── index.js
│   └── package.json
│
└── README.md
\`\`\`

## 🎯 Usage Guide

### For Administrators

1. **Login** with admin credentials
2. **Navigate** through different management sections using the sidebar
3. **Add Content**:
   - Click "Add" buttons in each section
   - Fill in the required information
   - Click "Create" to save

4. **Edit Content**:
   - Click the edit (✏️) button on any item
   - Update the information
   - Click "Update" to save changes

5. **Delete Content**:
   - Click the delete (🗑️) button on any item
   - Confirm the deletion

6. **View Analytics**:
   - Click "Analytics" in the sidebar
   - View student progress, enrollment trends, and system statistics

### For Students

1. **Login** with student credentials
2. **Dashboard** shows your course progress
3. **Learn** section displays all modules and lessons
4. **Practice** section has security challenges
5. **Projects** section contains capstone projects
6. **Career** section for job opportunities and career services
7. **Mentorship** section to connect with mentors

## 🔥 Firebase Collections Structure

### Users Collection
\`\`\`javascript
{
  name: "Student Name",
  email: "student@example.com",
  enrollmentNumber: "SU-2025-001",
  course: "Cyber Security & Ethical Hacking",
  status: "active", // active, inactive, graduated
  role: "student", // student, admin
  createdAt: "2025-11-08T00:00:00.000Z"
}
\`\`\`

### Courses Collection
\`\`\`javascript
{
  title: "Course Title",
  description: "Course description",
  duration: "6 months",
  modules: 10,
  status: "active"
}
\`\`\`

### Jobs Collection
\`\`\`javascript
{
  title: "Job Title",
  company: "Company Name",
  location: "Remote",
  salary: "$95K - $130K",
  type: "Full-time",
  status: "active",
  skills: ["Skill1", "Skill2"]
}
\`\`\`

## 🛠️ Technologies Used

### Frontend
- React 18
- React Router DOM
- Axios
- Firebase SDK
- CSS3 with Gradients

### Backend
- Node.js
- Express.js
- Firebase Admin SDK
- JWT Authentication
- bcryptjs

### Database
- Firebase Firestore (NoSQL)

## 🔒 Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Role-based access control
- Firebase security rules
- Protected API routes
- Secure admin panel access

## 📝 Environment Variables

Create a `.env` file in the backend directory:

\`\`\`env
PORT=5000
JWT_SECRET=your_jwt_secret_key
GOOGLE_APPLICATION_CREDENTIALS=path/to/serviceAccount.json
# Or use individual Firebase credentials
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_client_email
FIREBASE_PRIVATE_KEY=your_private_key
\`\`\`

## 🚧 Troubleshooting

### Firebase Connection Issues
- Verify your Firebase credentials are correct
- Check that Firestore is enabled in Firebase Console
- Ensure service account has proper permissions

### Port Already in Use
- Change PORT in backend `.env` file
- Or stop the process using the port

### CORS Issues
- Verify backend is running
- Check CORS configuration in `server.js`

## 📈 Future Enhancements

- Real-time chat between students and mentors
- Video conferencing integration
- Certificate generation
- Payment gateway integration
- Mobile app version
- Advanced analytics with charts
- Email notifications
- File upload for assignments
- Live coding environments

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 👨‍💻 Developer

Developed by the SHEF LMS Team

## 📞 Support

For support, email support@sheflms.com or create an issue in the repository.

---

**Note**: Remember to never commit your `.env` file or Firebase service account JSON to version control. Add them to `.gitignore`.
