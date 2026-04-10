import React, { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import tokenService from './services/tokenService';
import './App.css';

// Lazy load heavy dashboard components for better performance
const Dashboard = lazy(() => import('./components/Dashboard'));
const MentorDashboard = lazy(() => import('./components/MentorDashboard'));
const TeacherDashboard = lazy(() => import('./components/TeacherDashboard'));
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));
const BatchDetailsPage = lazy(() => import('./components/BatchDetailsPage'));
const TeacherBatchDetailsPage = lazy(() => import('./components/TeacherBatchDetailsPage'));
const BatchDetail = lazy(() => import('./components/BatchDetail'));
const OneToOneBatchManagement = lazy(() => import('./components/OneToOneBatchManagement'));
const StudentAnalyticsDashboard = lazy(() => import('./components/StudentAnalyticsDashboard'));

// Loading component for lazy loaded components
const LoadingSpinner = () => (
  <div style={{ 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center', 
    height: '100vh',
    flexDirection: 'column',
    gap: '20px'
  }}>
    <div className="loader"></div>
    <p>Loading dashboard...</p>
  </div>
);

// Service Worker Registration
const registerServiceWorker = async () => {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js');
      console.log('Service Worker registered with scope:', registration.scope);
    } catch (error) {
      console.log('Service Worker registration failed:', error);
    }
  }
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [sessionWarning, setSessionWarning] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (token && userData) {
      const parsedUser = JSON.parse(userData);
      // Fix role mapping: treat 'mentor' as 'teacher' for proper routing
      if (parsedUser.role === 'mentor') {
        parsedUser.role = 'teacher';
      }
      setIsAuthenticated(true);
      setUser(parsedUser);
      
      // Setup token monitoring for authenticated users
      setupTokenMonitoring();
    }
    
    // Register service worker for performance caching
    registerServiceWorker();
    
    // Cleanup token monitoring on unmount
    return () => {
      tokenService.stopTokenValidation();
    };
  }, []);

  const setupTokenMonitoring = () => {
    try {
      // Setup axios interceptor for 401 handling
      tokenService.setupAxiosInterceptor((message) => {
        console.log('Auto-logout triggered:', message);
        handleAutoLogout(message);
      });

      // Start periodic token validation
      tokenService.startTokenValidation(
        // onTokenExpired callback
        (message) => {
          console.log('Token expired:', message);
          handleAutoLogout(message);
        },
        // onTokenWarning callback
        (timeUntilExpiry, expiresAt) => {
          const formattedTime = tokenService.formatTimeUntilExpiry(timeUntilExpiry);
          setSessionWarning({
            message: `Session expires in ${formattedTime}`,
            expiresAt: expiresAt,
            timeUntilExpiry: timeUntilExpiry
          });
          
          // Clear warning after 10 seconds
          setTimeout(() => setSessionWarning(null), 10000);
        }
      );
    } catch (error) {
      console.error('Error setting up token monitoring:', error);
      // Don't let token monitoring errors crash the app
    }
  };

  const handleAutoLogout = (reason) => {
    console.log('Performing auto-logout:', reason);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    setUser(null);
    setSessionWarning(null);
    tokenService.stopTokenValidation();
    
    // Show alert to user (in production, you might want a nicer notification)
    alert(`Session expired: ${reason}. Please login again.`);
  };

  const handleLogin = (token, userData) => {
    // Debug: Log the actual user data received
    console.log('🔍 Login user data:', userData);
    console.log('🔍 User role:', userData.role);
    
    // Fix role mapping: treat 'mentor' as 'teacher' for proper routing
    if (userData.role === 'mentor') {
      userData.role = 'teacher';
    }
    
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setIsAuthenticated(true);
    setUser(userData);
    
    // Setup token monitoring after successful login
    setupTokenMonitoring();
    
    // Debug: Log final user state
    console.log('🔍 Final user role after mapping:', userData.role);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    setUser(null);
    setSessionWarning(null);
    tokenService.stopTokenValidation();
  };

  return (
    <Router>
      <div className="App">
        {/* Session Warning Banner */}
        {sessionWarning && isAuthenticated && (
          <div style={{
            position: 'fixed',
            top: '0',
            left: '0',
            right: '0',
            backgroundColor: '#ff9800',
            color: 'white',
            padding: '12px',
            textAlign: 'center',
            zIndex: 9999,
            fontSize: '14px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
          }}>
            ⚠️ {sessionWarning.message}
            <button 
              onClick={() => setSessionWarning(null)}
              style={{
                marginLeft: '20px',
                background: 'none',
                border: '1px solid white',
                color: 'white',
                padding: '4px 8px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              Dismiss
            </button>
          </div>
        )}
        
        <Routes>
          <Route 
            path="/login" 
            element={
              !isAuthenticated ? 
              <Login onLogin={handleLogin} /> :
              user?.role === 'admin' ? 
              <Navigate to="/admin" replace /> : 
              user?.role === 'mentor' ?
              <Navigate to="/mentor" replace /> :
              user?.role === 'teacher' ?
              <Navigate to="/teacher" replace /> :
              <Navigate to="/dashboard" replace />
            } 
          />
          <Route 
            path="/dashboard" 
            element={
              <Suspense fallback={<LoadingSpinner />}>
                {isAuthenticated && user?.role === 'student' ? 
                <Dashboard user={user} onLogout={handleLogout} /> : 
                !isAuthenticated ?
                <Navigate to="/login" replace /> :
                user?.role === 'admin' ?
                <Navigate to="/admin" replace /> :
                <Navigate to="/mentor" replace />}
              </Suspense>
            } 
          />
          <Route 
            path="/mentor" 
            element={
              <Suspense fallback={<LoadingSpinner />}>
                {isAuthenticated && user?.role === 'mentor' ? 
                <MentorDashboard user={user} onLogout={handleLogout} /> : 
                !isAuthenticated ?
                <Navigate to="/login" replace /> :
                user?.role === 'admin' ?
                <Navigate to="/admin" replace /> :
                <Navigate to="/dashboard" replace />}
              </Suspense>
            } 
          />
          <Route 
            path="/teacher" 
            element={
              <Suspense fallback={<LoadingSpinner />}>
                {isAuthenticated && user?.role === 'teacher' ? 
                <TeacherDashboard user={user} onLogout={handleLogout} /> : 
                !isAuthenticated ?
                <Navigate to="/login" replace /> :
                user?.role === 'admin' ?
                <Navigate to="/admin" replace /> :
                user?.role === 'mentor' ?
                <Navigate to="/mentor" replace /> :
                <Navigate to="/dashboard" replace />}
              </Suspense>
            } 
          />
          <Route 
            path="/teacher/batch/:batchId" 
            element={
              <Suspense fallback={<LoadingSpinner />}>
                {isAuthenticated && user?.role === 'teacher' ? 
                <TeacherBatchDetailsPage /> : 
                !isAuthenticated ?
                <Navigate to="/login" replace /> :
                user?.role === 'admin' ?
                <Navigate to="/admin" replace /> :
                user?.role === 'mentor' ?
                <Navigate to="/mentor" replace /> :
                <Navigate to="/dashboard" replace />}
              </Suspense>
            } 
          />
          <Route 
            path="/admin" 
            element={
              <Suspense fallback={<LoadingSpinner />}>
                {isAuthenticated && user?.role === 'admin' ? 
                <AdminDashboard user={user} onLogout={handleLogout} /> : 
                !isAuthenticated ?
                <Navigate to="/login" replace /> :
                user?.role === 'mentor' ?
                <Navigate to="/mentor" replace /> :
                <Navigate to="/dashboard" replace />}
              </Suspense>
            } 
          />
          <Route 
            path="/admin/batch/:batchId" 
            element={
              <Suspense fallback={<LoadingSpinner />}>
                {isAuthenticated && user?.role === 'admin' ? 
                <BatchDetailsPage /> : 
                !isAuthenticated ?
                <Navigate to="/login" replace /> :
                user?.role === 'mentor' ?
                <Navigate to="/mentor" replace /> :
                <Navigate to="/dashboard" replace />}
              </Suspense>
            } 
          />
          <Route 
            path="/admin/one-to-one-batch/:batchId" 
            element={
              <Suspense fallback={<LoadingSpinner />}>
                {isAuthenticated && user?.role === 'admin' ? 
                <OneToOneBatchManagement /> : 
                !isAuthenticated ?
                <Navigate to="/login" replace /> :
                user?.role === 'mentor' ?
                <Navigate to="/mentor" replace /> :
                <Navigate to="/dashboard" replace />}
              </Suspense>
            } 
          />
          <Route 
            path="/analytics" 
            element={
              <Suspense fallback={<LoadingSpinner />}>
                {isAuthenticated && user?.role === 'student' ? 
                <StudentAnalyticsDashboard /> : 
                !isAuthenticated ?
                <Navigate to="/login" replace /> :
                user?.role === 'admin' ?
                <Navigate to="/admin" replace /> :
                user?.role === 'mentor' ?
                <Navigate to="/mentor" replace /> :
                <Navigate to="/teacher" replace />}
              </Suspense>
            } 
          />
          <Route 
            path="/" 
            element={
              !isAuthenticated ? 
              <Navigate to="/login" replace /> :
              user?.role === 'admin' ? 
              <Navigate to="/admin" replace /> : 
              user?.role === 'mentor' ?
              <Navigate to="/mentor" replace /> :
              user?.role === 'teacher' ?
              <Navigate to="/teacher" replace /> :
              (() => {
                console.log('🔍 Root route - Unknown role, redirecting to dashboard:', user?.role);
                return <Navigate to="/dashboard" replace />;
              })()
            } 
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
