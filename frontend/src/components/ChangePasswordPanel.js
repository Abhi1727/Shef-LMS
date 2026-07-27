import React, { useState } from 'react';
import { getApiBaseUrl } from '../utils/apiBase';
import './ChangePasswordPanel.css';

/**
 * Shared password change / reset panel with email OTP.
 * mode: 'change' (logged-in) | 'reset' (forgot password on login)
 */
const ChangePasswordPanel = ({
  mode = 'change',
  defaultEmail = '',
  onSuccess,
  onCancel
}) => {
  const [step, setStep] = useState(mode === 'reset' ? 'email' : 'request');
  const [email, setEmail] = useState(defaultEmail || '');
  const [otp, setOtp] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const apiBase = getApiBaseUrl();

  const clearAlerts = () => {
    setMessage('');
    setError('');
  };

  const requestOtp = async () => {
    clearAlerts();
    setLoading(true);
    try {
      if (mode === 'reset') {
        if (!email.trim()) {
          setError('Email is required');
          return;
        }
        const res = await fetch(`${apiBase}/api/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim() })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.message || 'Failed to send verification code');
          return;
        }
        setMessage(data.message || 'If an account exists, a code was sent.');
        setStep('otp');
      } else {
        const token = localStorage.getItem('token');
        const res = await fetch(`${apiBase}/api/auth/password/request-otp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          }
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.message || 'Failed to send verification code');
          return;
        }
        setMessage(data.message || 'Verification code sent to your email.');
        setStep('otp');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const submitNewPassword = async (e) => {
    e.preventDefault();
    clearAlerts();

    if (!otp.trim()) {
      setError('Enter the verification code from your email');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'reset') {
        const res = await fetch(`${apiBase}/api/auth/reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: email.trim(),
            otp: otp.trim(),
            newPassword
          })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.message || 'Failed to reset password');
          return;
        }
        setMessage(data.message || 'Password updated. You can sign in.');
        setStep('done');
        if (onSuccess) onSuccess();
      } else {
        const token = localStorage.getItem('token');
        const res = await fetch(`${apiBase}/api/auth/password`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            otp: otp.trim(),
            newPassword,
            currentPassword: currentPassword || undefined
          })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.message || 'Failed to update password');
          return;
        }
        setMessage(data.message || 'Password updated successfully.');
        setStep('done');
        setOtp('');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        if (onSuccess) onSuccess();
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ss-password-panel">
      <h3 className="ss-password-panel__title">
        {mode === 'reset' ? 'Reset password' : 'Change password'}
      </h3>
      <p className="ss-password-panel__hint">
        We send a one-time code to your email. Codes expire in 10 minutes.
      </p>

      {error && <div className="ss-password-panel__alert ss-password-panel__alert--error">{error}</div>}
      {message && <div className="ss-password-panel__alert ss-password-panel__alert--ok">{message}</div>}

      {step === 'email' && (
        <div className="ss-password-panel__form">
          <label>
            Account email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="username"
              disabled={loading}
            />
          </label>
          <div className="ss-password-panel__actions">
            <button type="button" className="ss-password-panel__primary" onClick={requestOtp} disabled={loading}>
              {loading ? 'Sending…' : 'Send verification code'}
            </button>
            {onCancel && (
              <button type="button" className="ss-password-panel__ghost" onClick={onCancel} disabled={loading}>
                Back to sign in
              </button>
            )}
          </div>
        </div>
      )}

      {step === 'request' && (
        <div className="ss-password-panel__actions">
          <button type="button" className="ss-password-panel__primary" onClick={requestOtp} disabled={loading}>
            {loading ? 'Sending…' : 'Email me a verification code'}
          </button>
          {onCancel && (
            <button type="button" className="ss-password-panel__ghost" onClick={onCancel} disabled={loading}>
              Cancel
            </button>
          )}
        </div>
      )}

      {(step === 'otp' || step === 'done') && step !== 'done' && (
        <form className="ss-password-panel__form" onSubmit={submitNewPassword}>
          {mode === 'reset' && (
            <label>
              Email
              <input type="email" value={email} readOnly />
            </label>
          )}
          <label>
            Verification code
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="6-digit code"
              disabled={loading}
              required
            />
          </label>
          {mode === 'change' && (
            <label>
              Current password (optional)
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Only if you remember it"
                autoComplete="current-password"
                disabled={loading}
              />
            </label>
          )}
          <label>
            New password
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min 8 chars, upper + lower + number"
              autoComplete="new-password"
              disabled={loading}
              required
            />
          </label>
          <label>
            Confirm new password
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat new password"
              autoComplete="new-password"
              disabled={loading}
              required
            />
          </label>
          <div className="ss-password-panel__actions">
            <button type="submit" className="ss-password-panel__primary" disabled={loading}>
              {loading ? 'Saving…' : 'Update password'}
            </button>
            <button type="button" className="ss-password-panel__ghost" onClick={requestOtp} disabled={loading}>
              Resend code
            </button>
            {onCancel && (
              <button type="button" className="ss-password-panel__ghost" onClick={onCancel} disabled={loading}>
                Cancel
              </button>
            )}
          </div>
        </form>
      )}

      {step === 'done' && mode === 'reset' && onCancel && (
        <div className="ss-password-panel__actions">
          <button type="button" className="ss-password-panel__primary" onClick={onCancel}>
            Back to sign in
          </button>
        </div>
      )}
    </div>
  );
};

export default ChangePasswordPanel;
