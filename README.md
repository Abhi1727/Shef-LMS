# SHEF LMS - Learning Management System

A complete Learning Management System built with the MERN stack (MongoDB, Express, React, Node.js).

## 🚀 Features

- **Authentication System** with demo credentials
- **Interactive Dashboard** with statistics and course progress
- **Course Management** with enrollment and progress tracking
- **Activity Timeline** showing recent learning activities
- **Responsive Design** for all devices
- **Modern UI/UX** with gradient designs and animations

## 📋 Demo Credentials

**Email:** demo@sheflms.com  
**Password:** demo123

## 🛠️ Tech Stack

### Backend
- Node.js
- Express.js
- MongoDB with Mongoose
- JWT Authentication
- bcryptjs for password hashing

### Frontend
- React 18
- React Router v6
- Axios for API calls
- CSS3 with animations

## 📦 Installation

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (local or Atlas)
- npm or yarn

### Backend Setup

1. Navigate to the backend folder:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file (already created) with:
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/shef_lms
JWT_SECRET=shef_lms_secret_key_2025
```

4. Start the backend server:
```bash
npm start
```

Or for development with auto-reload:
```bash
npm run dev
```

The backend will run on `http://localhost:5000`

### Frontend Setup

1. Open a new terminal and navigate to the frontend folder:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the React development server:
```bash
npm start
```

The frontend will run on `http://localhost:3000`

## 🎯 Usage

1. **Start MongoDB** (if using local MongoDB):
```bash
mongod
```

2. **Start the Backend Server** (Terminal 1):
```bash
cd backend
npm start
```

3. **Start the Frontend Server** (Terminal 2):
```bash
cd frontend
npm start
```

4. **Access the Application**:
   - Open browser and go to `http://localhost:3000`
   - Use demo credentials or register a new account
   - Explore the dashboard, courses, and features

## 📱 Pages

### Login Page
- Clean, modern design with gradient background
- Demo credentials button for quick access
- Form validation and error handling

### Dashboard
- **Overview Section**: Statistics cards showing enrolled courses, completed courses, learning hours, etc.
- **My Courses**: Grid view of all enrolled courses with progress bars
- **Activity Timeline**: Recent learning activities and achievements
- **Sidebar Navigation**: Easy access to all sections
- **User Profile**: Avatar and notifications

## 🎨 Key Features

### Dashboard Overview
- 6 statistics cards with animated gradients
- Continue Learning section with progress tracking
- Recent Activity feed
- Responsive grid layout

### Course Cards
- Visual thumbnails with emojis
- Progress bars showing completion percentage
- Course details (modules, duration, instructor)
- Enrolled students count
- "Continue Learning" buttons

### Navigation
- Collapsible sidebar
- Active state indicators
- Icon-based navigation for mobile
- Smooth transitions

## 📊 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Courses
- `GET /api/courses` - Get all courses
- `GET /api/courses/:id` - Get course by ID
- `POST /api/courses` - Create new course (auth required)

### Dashboard
- `GET /api/dashboard/stats` - Get user statistics
- `GET /api/dashboard/activity` - Get recent activity

## 🔒 Security Features

- Password hashing with bcryptjs
- JWT token-based authentication
- Protected routes
- CORS enabled
- Environment variables for sensitive data

## 📱 Responsive Design

The application is fully responsive and works on:
- Desktop (1024px+)
- Tablet (768px - 1024px)
- Mobile (< 768px)

## 🎨 Color Scheme

- Primary Gradient: `#667eea` to `#764ba2`
- Background: `#f5f7fa`
- Text: `#2d3748`
- Secondary Text: `#718096`
- Success: `#4CAF50`
- Error: `#f56565`

## 🚀 Future Enhancements

- Video player integration
- Assignment submission
- Live classes with video conferencing
- Discussion forums
- Certificate generation
- Payment integration
- Admin panel
- Course creation interface
- Quiz and assessment system
- Mobile app

## 📄 License

This project is open source and available under the MIT License.

## 👨‍💻 Author

SHEF LMS Development Team

## 🙏 Acknowledgments

- React community
- Express.js team
- MongoDB team
- All open source contributors

---

**SHEF LMS** - Empowering education through technology 📚✨
