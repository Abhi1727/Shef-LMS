import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import MentorDashboard from './components/MentorDashboard';
import TeacherDashboard from './components/TeacherDashboard';
import AdminDashboard from './components/AdminDashboard';
import './App.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (token && userData) {
      setIsAuthenticated(true);
      setUser(JSON.parse(userData));
    }
  }, []);

  const handleLogin = (token, userData) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setIsAuthenticated(true);
    setUser(userData);
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
              isAuthenticated && user?.role === 'student' ? 
              <Dashboard user={user} onLogout={handleLogout} /> : 
              !isAuthenticated ?
              <Navigate to="/login" replace /> :
              user?.role === 'admin' ?
              <Navigate to="/admin" replace /> :
              <Navigate to="/mentor" replace />
            } 
          />
          <Route 
            path="/mentor" 
            element={
              isAuthenticated && user?.role === 'mentor' ? 
              <MentorDashboard user={user} onLogout={handleLogout} /> : 
              !isAuthenticated ?
              <Navigate to="/login" replace /> :
              user?.role === 'admin' ?
              <Navigate to="/admin" replace /> :
              <Navigate to="/dashboard" replace />
            } 
          />
          <Route 
            path="/teacher" 
            element={
              isAuthenticated && user?.role === 'teacher' ? 
              <TeacherDashboard user={user} onLogout={handleLogout} /> : 
              !isAuthenticated ?
              <Navigate to="/login" replace /> :
              user?.role === 'admin' ?
              <Navigate to="/admin" replace /> :
              user?.role === 'mentor' ?
              <Navigate to="/mentor" replace /> :
              <Navigate to="/dashboard" replace />
            } 
          />
          <Route 
            path="/admin" 
            element={
              isAuthenticated && user?.role === 'admin' ? 
              <AdminDashboard user={user} onLogout={handleLogout} /> : 
              !isAuthenticated ?
              <Navigate to="/login" replace /> :
              user?.role === 'mentor' ?
              <Navigate to="/mentor" replace /> :
              <Navigate to="/dashboard" replace />
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
              <Navigate to="/dashboard" replace />
            } 
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
