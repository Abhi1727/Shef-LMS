# SHEF LMS - Project Structure

```
SHEF LMS/
│
├── backend/                          # Backend Node.js/Express application
│   ├── models/                       # MongoDB models
│   │   ├── User.js                   # User schema (name, email, password, role)
│   │   └── Course.js                 # Course schema (title, description, instructor, etc.)
│   │
│   ├── routes/                       # API routes
│   │   ├── auth.js                   # Authentication routes (login, register)
│   │   ├── courses.js                # Course management routes
│   │   └── dashboard.js              # Dashboard data routes
│   │
│   ├── middleware/                   # Express middleware
│   │   └── auth.js                   # JWT authentication middleware
│   │
│   ├── .env                          # Environment variables (MongoDB URI, JWT secret)
│   ├── server.js                     # Main Express server file
│   └── package.json                  # Backend dependencies
│
├── frontend/                         # React frontend application
│   ├── public/                       # Public assets
│   │   └── index.html                # HTML template
│   │
│   ├── src/                          # Source files
│   │   ├── components/               # React components
│   │   │   ├── Login.js              # Login page component
│   │   │   ├── Login.css             # Login page styles
│   │   │   ├── Dashboard.js          # Dashboard component
│   │   │   └── Dashboard.css         # Dashboard styles
│   │   │
│   │   ├── App.js                    # Main App component with routing
│   │   ├── App.css                   # App styles
│   │   ├── index.js                  # React entry point
│   │   └── index.css                 # Global styles
│   │
│   └── package.json                  # Frontend dependencies
│
├── README.md                         # Project documentation
├── .gitignore                        # Git ignore file
├── setup.ps1                         # PowerShell setup script
└── setup.sh                          # Bash setup script

```

## 📁 Directory Details

### Backend Structure

#### `/models`
Contains MongoDB/Mongoose schema definitions:
- **User.js**: User authentication and profile data
- **Course.js**: Course information and metadata

#### `/routes`
API endpoint definitions:
- **auth.js**: Login, register, and authentication endpoints
- **courses.js**: CRUD operations for courses
- **dashboard.js**: Dashboard statistics and activity data

#### `/middleware`
Express middleware functions:
- **auth.js**: JWT token validation for protected routes

### Frontend Structure

#### `/components`
React components:
- **Login.js**: Login page with demo credentials
- **Dashboard.js**: Main dashboard with sidebar and content sections

#### Routing
- App.js handles routing between Login and Dashboard
- Protected routes redirect to login if not authenticated

## 🔧 Configuration Files

### Backend `.env`
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/shef_lms
JWT_SECRET=shef_lms_secret_key_2025
```

### Frontend `package.json`
- Includes proxy configuration to connect to backend
- Dependencies: React, React Router, Axios

## 📊 Data Flow

1. **User Login**
   - Frontend sends credentials to `/api/auth/login`
   - Backend validates and returns JWT token
   - Token stored in localStorage
   - User redirected to Dashboard

2. **Dashboard Load**
   - Frontend fetches data from multiple endpoints
   - `/api/dashboard/stats` - Statistics
   - `/api/courses` - Course list
   - `/api/dashboard/activity` - Recent activity

3. **Protected Routes**
   - All dashboard API calls include JWT token
   - Middleware validates token
   - Returns 401 if invalid/missing

## 🎨 Styling Approach

- **CSS Modules**: Component-specific styling
- **Gradient Themes**: Modern purple/blue gradient
- **Responsive Design**: Mobile-first approach
- **Animations**: Smooth transitions and hover effects

## 🔐 Security Features

- Password hashing with bcryptjs (10 salt rounds)
- JWT token authentication (7-day expiration)
- Protected API routes with middleware
- CORS enabled for cross-origin requests
- Environment variables for sensitive data

## 📱 Responsive Breakpoints

- **Desktop**: 1024px and above
- **Tablet**: 768px - 1024px
- **Mobile**: Below 768px

## 🚀 Deployment Considerations

### Backend
- Use MongoDB Atlas for production database
- Set strong JWT_SECRET in production
- Enable rate limiting
- Add logging (Morgan, Winston)
- Use PM2 for process management

### Frontend
- Build optimized production bundle
- Configure environment-specific API URLs
- Enable HTTPS
- Add service worker for PWA
- Optimize images and assets

## 📈 Future Enhancements Structure

```
├── controllers/          # Business logic separation
├── services/            # External service integrations
├── utils/               # Utility functions
├── config/              # Configuration management
├── tests/               # Unit and integration tests
└── uploads/             # File upload directory
```

---

This structure provides a clean, scalable foundation for the SHEF LMS application.
