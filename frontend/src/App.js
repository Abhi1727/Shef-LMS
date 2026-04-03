import React, { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
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
    }
    
    // Register service worker for performance caching
    registerServiceWorker();
  }, []);

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
    
    // Debug: Log final user state
    console.log('🔍 Final user role after mapping:', userData.role);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    setUser(null);
  };

  return (
    <Router>
      <div className="App">
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
