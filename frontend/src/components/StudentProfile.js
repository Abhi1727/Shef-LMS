import React, { useState, useEffect } from 'react';
import './StudentProfile.css';

const StudentProfile = ({ user, onProfileUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [activeTab, setActiveTab] = useState('personal');
  
  // Profile data state
  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
    currentCourse: '',
    phone: '',
    bio: '',
    location: '',
    joinDate: ''
  });

  // Learning stats
  const [learningStats, setLearningStats] = useState({
    completedLessons: 0,
    totalLessons: 0,
    streakDays: 0,
    certificates: 0,
    studyHours: 0
  });

  // Password change state
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordStrength, setPasswordStrength] = useState('');

  useEffect(() => {
    if (user) {
      setProfileData({
        name: user.name || '',
        email: user.email || '',
        currentCourse: user.currentCourse || user.course || '',
        phone: user.phone || '',
        bio: user.bio || '',
        location: user.location || '',
        joinDate: user.enrollmentDate || user.createdAt || new Date().toISOString()
      });
      
      // Simulate learning stats (in real app, fetch from API)
      setLearningStats({
        completedLessons: Math.floor(Math.random() * 50) + 10,
        totalLessons: 157,
        streakDays: Math.floor(Math.random() * 30) + 1,
        certificates: Math.floor(Math.random() * 3),
        studyHours: Math.floor(Math.random() * 100) + 20
      });
    }
  }, [user]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setProfileData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear password error when user starts typing
    if (passwordError) {
      setPasswordError('');
    }

    // Real-time password matching validation
    if (name === 'confirmPassword' || name === 'newPassword') {
      const newPassword = name === 'newPassword' ? value : passwordData.newPassword;
      const confirmPassword = name === 'confirmPassword' ? value : passwordData.confirmPassword;
      
      if (confirmPassword && newPassword && confirmPassword !== newPassword) {
        setPasswordError('New passwords do not match');
      } else {
        setPasswordError('');
      }
    }

    // Password strength calculation
    if (name === 'newPassword') {
      calculatePasswordStrength(value);
    }
  };

  const calculatePasswordStrength = (password) => {
    if (!password) {
      setPasswordStrength('');
      return;
    }

    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;

    if (strength <= 2) setPasswordStrength('weak');
    else if (strength <= 4) setPasswordStrength('medium');
    else setPasswordStrength('strong');
  };

  const showMessage = (msg, type = 'success') => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => {
      setMessage('');
      setMessageType('');
    }, 3000);
  };

  const handleSaveProfile = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
      
      // Only send password data to backend, not name/email changes
      const response = await fetch(`${apiUrl}/api/student/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword
        })
      });

      const data = await response.json();

      if (response.ok) {
        showMessage('Password updated successfully!', 'success');
        setIsEditing(false);
        
        // Update user data in localStorage (only password changes)
        const updatedUser = { ...user, currentPassword: passwordData.newPassword };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        
        // If email was changed, we need to update the token
        if (user.email !== data.profile.email) {
          // For email changes, the user might need to re-login with new email
          showMessage('Email updated! You may need to login again with your new email.', 'success');
        }
        
        // Notify parent component of the update
        if (onProfileUpdate) {
          onProfileUpdate(updatedUser);
        }
      } else {
        showMessage(data.message || 'Failed to update profile', 'error');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      showMessage('Network error. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordUpdate = async () => {
    // Validate password matching
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters long');
      return;
    }

    if (!passwordData.currentPassword) {
      setPasswordError('Current password is required');
      return;
    }

    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';

      const response = await fetch(`${apiUrl}/api/student/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword
        })
      });

      const data = await response.json();

      if (response.ok) {
        showMessage('Password updated successfully!', 'success');
        setShowPasswordChange(false);
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
        setPasswordError('');
      } else {
        setPasswordError(data.message || 'Failed to update password');
      }
    } catch (error) {
      console.error('Error updating password:', error);
      setPasswordError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setShowPasswordChange(false);
    setPasswordError('');
    // Reset form data to original user data
    if (user) {
      setProfileData({
        name: user.name || '',
        email: user.email || '',
        currentCourse: user.currentCourse || user.course || ''
      });
    }
    // Reset password data
    setPasswordData({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
  };

  return (
    <div className="student-profile-container">
      {/* Profile Header with Avatar */}
      <div className="profile-header">
        <div className="profile-avatar-section">
          <div className="profile-avatar">
            <span className="avatar-text">
              {profileData.name ? profileData.name.charAt(0).toUpperCase() : 'U'}
            </span>
          </div>
          <div className="profile-info">
            <h2>{profileData.name || 'Student Name'}</h2>
            <p className="profile-email">{profileData.email || 'email@example.com'}</p>
            <div className="profile-badges">
              <span className="badge badge-primary">Active Learner</span>
              <span className="badge badge-secondary">{learningStats.streakDays} Day Streak</span>
            </div>
          </div>
        </div>
        {!isEditing && !showPasswordChange && (
          <button 
            className="edit-btn"
            onClick={() => setIsEditing(true)}
          >
            ✏️ Edit Profile
          </button>
        )}
      </div>

      {/* Navigation Tabs - keep only Personal Info active for now */}
      <div className="profile-tabs single-tab">
        <button 
          className="tab-btn active"
          type="button"
        >
          👤 Personal Info
        </button>
      </div>

      {message && (
        <div className={`message ${messageType}`}>
          {messageType === 'success' ? '✅' : '❌'} {message}
        </div>
      )}

      <div className="profile-content">
        {/* Personal Info Tab - only active section for now */}
        {activeTab === 'personal' && (
          <div className="tab-content">
            <div className="profile-section">
              <h3>📋 Personal Information</h3>
              <div className="profile-grid">
                <div className="profile-field">
                  <label>Full Name</label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="name"
                      value={profileData.name}
                      onChange={handleInputChange}
                      className="profile-input"
                      placeholder="Enter your full name"
                    />
                  ) : (
                    <span className="profile-value">{profileData.name || 'Not set'}</span>
                  )}
                </div>

                <div className="profile-field">
                  <label>Email Address</label>
                  <span className="profile-value readonly">{profileData.email || 'Not set'}</span>
                </div>

                <div className="profile-field">
                  <label>Phone Number</label>
                  {isEditing ? (
                    <input
                      type="tel"
                      name="phone"
                      value={profileData.phone}
                      onChange={handleInputChange}
                      className="profile-input"
                      placeholder="Enter your phone number"
                    />
                  ) : (
                    <span className="profile-value">{profileData.phone || 'Not set'}</span>
                  )}
                </div>

                <div className="profile-field">
                  <label>Location</label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="location"
                      value={profileData.location}
                      onChange={handleInputChange}
                      className="profile-input"
                      placeholder="Enter your location"
                    />
                  ) : (
                    <span className="profile-value">{profileData.location || 'Not set'}</span>
                  )}
                </div>

                <div className="profile-field full-width">
                  <label>Bio</label>
                  {isEditing ? (
                    <textarea
                      name="bio"
                      value={profileData.bio}
                      onChange={handleInputChange}
                      className="profile-input profile-textarea"
                      placeholder="Tell us about yourself..."
                      rows="4"
                    />
                  ) : (
                    <span className="profile-value">{profileData.bio || 'No bio added yet'}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Security Tab (temporarily disabled) */}
        {false && activeTab === 'security' && (
          <div className="tab-content">
            <div className="profile-section">
              <h3>🔒 Security Settings</h3>
              {!showPasswordChange ? (
                <div className="password-section">
                  <div className="security-info">
                    <div className="security-item">
                      <span className="security-icon">🔐</span>
                      <div>
                        <h4>Password</h4>
                        <p>Last changed recently</p>
                      </div>
                    </div>
                    <div className="security-item">
                      <span className="security-icon">📧</span>
                      <div>
                        <h4>Email Verification</h4>
                        <p>Verified</p>
                      </div>
                    </div>
                    <div className="security-item">
                      <span className="security-icon">🛡️</span>
                      <div>
                        <h4>Two-Factor Authentication</h4>
                        <p>Not enabled</p>
                      </div>
                    </div>
                  </div>
                  <button 
                    className="change-password-btn"
                    onClick={() => setShowPasswordChange(true)}
                  >
                    🔑 Change Password
                  </button>
                </div>
              ) : (
                <div className="password-form">
                  <div className="profile-field">
                    <label>Current Password</label>
                    <input
                      type="password"
                      name="currentPassword"
                      value={passwordData.currentPassword}
                      onChange={handlePasswordChange}
                      className="profile-input"
                      placeholder="Enter current password"
                    />
                  </div>

                  <div className="profile-field">
                    <label>New Password</label>
                    <input
                      type="password"
                      name="newPassword"
                      value={passwordData.newPassword}
                      onChange={handlePasswordChange}
                      className="profile-input"
                      placeholder="Enter new password (min 6 characters)"
                    />
                    {passwordStrength && (
                      <div className={`password-strength ${passwordStrength}`}>
                        <span className="strength-label">Password Strength:</span>
                        <span className="strength-value">{passwordStrength}</span>
                        <div className="strength-bar">
                          <div className={`strength-fill ${passwordStrength}`} />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="profile-field">
                    <label>Confirm New Password</label>
                    <input
                      type="password"
                      name="confirmPassword"
                      value={passwordData.confirmPassword}
                      onChange={handlePasswordChange}
                      className={`profile-input ${passwordError ? 'error' : ''}`}
                      placeholder="Confirm new password"
                    />
                    {passwordError && (
                      <div className="password-error">
                        {passwordError}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Achievements Tab (temporarily disabled) */}
        {false && activeTab === 'achievements' && (
          <div className="tab-content">
            <div className="profile-section">
              <h3>🏆 Achievements & Certificates</h3>
              <div className="achievements-grid">
                <div className="achievement-card">
                  <div className="achievement-icon">🌟</div>
                  <h4>First Steps</h4>
                  <p>Completed your first lesson</p>
                </div>
                <div className="achievement-card">
                  <div className="achievement-icon">🔥</div>
                  <h4>Week Warrior</h4>
                  <p>7-day learning streak</p>
                </div>
                <div className="achievement-card">
                  <div className="achievement-icon">📚</div>
                  <h4>Knowledge Seeker</h4>
                  <p>Completed 10 lessons</p>
                </div>
                {learningStats.certificates > 0 && (
                  <div className="achievement-card certificate">
                    <div className="achievement-icon">🏆</div>
                    <h4>Course Graduate</h4>
                    <p>Completed a full course</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {(isEditing || showPasswordChange) && (
          <div className="profile-actions">
            <button 
              className="save-btn"
              onClick={showPasswordChange ? handlePasswordUpdate : handleSaveProfile}
              disabled={isLoading}
            >
              {isLoading ? '💾 Saving...' : (showPasswordChange ? '🔑 Update Password' : '💾 Save Changes')}
            </button>
            <button 
              className="cancel-btn"
              onClick={handleCancel}
              disabled={isLoading}
            >
              ❌ Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentProfile;
