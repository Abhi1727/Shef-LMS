import React, { useState } from 'react';
import './StudentTopNavbar.css';

const StudentTopNavbar = ({ user, onLogout, currentPage = 'Classroom' }) => {
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const getInitials = (name) => {
    if (!name) return 'S';
    const parts = name.split(' ');
    return (parts[0]?.[0] + (parts[1]?.[0] || '')).toUpperCase();
  };

  return (
    <>
      {/* Top Navbar */}
      <nav className="student-navbar">
        <div className="navbar-container">
          {/* Left Section - Logo & Branding */}
          <div className="navbar-left">
            <div className="navbar-logo">
              <span className="logo-icon">📚</span>
              <span className="logo-text">LMS</span>
            </div>
            <div className="navbar-divider"></div>
            
            {/* Breadcrumb Navigation */}
            <div className="breadcrumb">
              <a href="#/" className="breadcrumb-item">Home</a>
              <span className="breadcrumb-separator">/</span>
              <span className="breadcrumb-item active">{currentPage}</span>
            </div>
          </div>

          {/* Center Section - Removed Search for Students */}
          <div className="navbar-center">
            {/* Search removed for student dashboard - keeping space for balance */}
          </div>

          {/* Right Section - User Actions */}
          <div className="navbar-right">
            {/* Notifications */}
            <div className="navbar-item notifications" onClick={() => setShowNotifications(!showNotifications)}>
              <span className="notification-icon">🔔</span>
              <span className="notification-badge">2</span>
            </div>

            {/* Settings */}
            <a href="#/" className="navbar-item">
              <span className="icon">⚙️</span>
            </a>

            {/* User Profile Dropdown */}
            <div className="navbar-item profile-dropdown" onClick={() => setShowProfileDropdown(!showProfileDropdown)}>
              <div className="user-avatar">
                {getInitials(user?.name)}
              </div>
              <span className="dropdown-arrow">▼</span>

              {/* Dropdown Menu */}
              {showProfileDropdown && (
                <div className="profile-menu">
                  <div className="profile-menu-header">
                    <div className="profile-user-avatar">{getInitials(user?.name)}</div>
                    <div className="profile-menu-info">
                      <div className="profile-menu-name">{user?.name || 'Student'}</div>
                      <div className="profile-menu-email">{user?.email}</div>
                    </div>
                  </div>
                  <div className="profile-menu-divider"></div>
                  <a href="#/" className="profile-menu-item">👤 My Profile</a>
                  <a href="#/" className="profile-menu-item">📚 My Courses</a>
                  <a href="#/" className="profile-menu-item">📊 My Progress</a>
                  <a href="#/" className="profile-menu-item">⚙️ Settings</a>
                  <div className="profile-menu-divider"></div>
                  <button onClick={onLogout} className="profile-menu-item logout">
                    🚪 Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Notifications Dropdown */}
      {showNotifications && (
        <div className="notifications-dropdown">
          <div className="notifications-header">Notifications</div>
          <div className="notifications-list">
            <div className="notification-item">
              <span className="notification-type">🎥</span>
              <div className="notification-content">
                <div className="notification-title">New class recording added</div>
                <div className="notification-time">2 hours ago</div>
              </div>
            </div>
            <div className="notification-item">
              <span className="notification-type">📢</span>
              <div className="notification-content">
                <div className="notification-title">New announcement from teacher</div>
                <div className="notification-time">5 hours ago</div>
              </div>
            </div>
          </div>
          <a href="#/" className="notifications-view-all">View all notifications →</a>
        </div>
      )}

      {/* Overlay to close dropdown when clicking outside */}
      {(showProfileDropdown || showNotifications) && (
        <div 
          className="navbar-overlay" 
          onClick={() => {
            setShowProfileDropdown(false);
            setShowNotifications(false);
          }}
        ></div>
      )}
    </>
  );
};

export default StudentTopNavbar;
