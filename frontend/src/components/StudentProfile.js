import React, { useState } from 'react';
import ChangePasswordPanel from './ChangePasswordPanel';
import './StudentProfile.css';

const StudentProfile = ({ user }) => {
  const [showPasswordChange, setShowPasswordChange] = useState(false);

  return (
    <div className="student-profile">
      <div className="profile-header">
        <div className="profile-avatar">
          <span>{user?.name?.charAt(0)?.toUpperCase() || 'S'}</span>
        </div>
        <div className="profile-header-info">
          <h2>{user?.name || 'Student'}</h2>
          <p>{user?.email}</p>
        </div>
      </div>

      <div className="profile-content">
        <div className="tab-content">
          <div className="profile-section">
            <h3>Personal information</h3>
            <div className="profile-grid">
              <div className="profile-field">
                <label>Full name</label>
                <div className="profile-value">{user?.name || '—'}</div>
              </div>
              <div className="profile-field">
                <label>Email</label>
                <div className="profile-value">{user?.email || '—'}</div>
              </div>
              <div className="profile-field">
                <label>Course</label>
                <div className="profile-value">
                  {user?.currentCourse || user?.course || 'Not assigned'}
                </div>
              </div>
              <div className="profile-field">
                <label>Role</label>
                <div className="profile-value">{user?.role || 'student'}</div>
              </div>
            </div>
          </div>

          <div className="profile-section">
            <h3>Security</h3>
            {!showPasswordChange ? (
              <div className="security-info">
                <div className="security-item">
                  <div>
                    <h4>Password</h4>
                    <p>Change your password using a one-time code sent to your email.</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => setShowPasswordChange(true)}
                >
                  Change password
                </button>
              </div>
            ) : (
              <ChangePasswordPanel
                mode="change"
                defaultEmail={user?.email || ''}
                onCancel={() => setShowPasswordChange(false)}
                onSuccess={() => setShowPasswordChange(false)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentProfile;
