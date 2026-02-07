import React, { useState, useEffect } from 'react';
import './StudentProfile.css';

const StudentProfile = ({ user, onProfileUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  
  // Profile data state
  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
    currentCourse: ''
  });

  // Password change state
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    if (user) {
      setProfileData({
        name: user.name || '',
        email: user.email || '',
        currentCourse: user.currentCourse || user.course || ''
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
      <div className="profile-header">
        <h2>My Profile</h2>
        {!isEditing && !showPasswordChange && (
          <button 
            className="edit-btn"
            onClick={() => setIsEditing(true)}
          >
            Edit Profile
          </button>
        )}
      </div>

      {message && (
        <div className={`message ${messageType}`}>
          {message}
        </div>
      )}

      <div className="profile-content">
        {/* Personal Information Section */}
        <div className="profile-section">
          <h3>Personal Information</h3>
          <div className="profile-grid">
            <div className="profile-field">
              <label>Full Name</label>
              <span className="profile-value">{profileData.name || 'Not set'}</span>
            </div>

            <div className="profile-field">
              <label>Email Address</label>
              <span className="profile-value">{profileData.email || 'Not set'}</span>
            </div>
          </div>
        </div>

        {/* Academic Information Section */}
        <div className="profile-section">
          <h3>Academic Information</h3>
          <div className="profile-grid">
            <div className="profile-field">
              <label>Enrolled Course</label>
              <span className="profile-value readonly">{profileData.currentCourse || 'Not enrolled'}</span>
            </div>
          </div>
        </div>

        {/* Password Change Section */}
        <div className="profile-section">
          <h3>Security</h3>
          {!showPasswordChange ? (
            <div className="password-section">
              <p>You can change your password to keep your account secure.</p>
              <button 
                className="change-password-btn"
                onClick={() => setShowPasswordChange(true)}
              >
                Change Password
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

        {/* Action Buttons */}
        {(isEditing || showPasswordChange) && (
          <div className="profile-actions">
            <button 
              className="save-btn"
              onClick={showPasswordChange ? handlePasswordUpdate : handleSaveProfile}
              disabled={isLoading}
            >
              {isLoading ? 'Saving...' : (showPasswordChange ? 'Update Password' : 'Save Changes')}
            </button>
            <button 
              className="cancel-btn"
              onClick={handleCancel}
              disabled={isLoading}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentProfile;
