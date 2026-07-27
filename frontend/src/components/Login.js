import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { detectUserIP } from '../utils/ipDetector';
import ChangePasswordPanel from './ChangePasswordPanel';
import './Login.css';

const Login = ({ onLogin }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [ipData, setIpData] = useState(null);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [lockTimeRemaining, setLockTimeRemaining] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [view, setView] = useState('login'); // login | reset

  const { email, password } = formData;

  useEffect(() => {
    const fetchIP = async () => {
      try {
        const data = await detectUserIP();
        setIpData(data);
      } catch (err) {
        console.error('Failed to detect IP:', err);
      }
    };
    fetchIP();
  }, []);

  const onChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (isLocked) {
      setError(
        `Account temporarily locked. Please try again in ${Math.ceil(lockTimeRemaining / 60)} minutes.`
      );
      return;
    }

    setLoading(true);

    try {
      const loginData = {
        ...formData,
        ipAddress: ipData?.ip || 'Unknown',
        ipDetails: ipData
          ? {
              city: ipData.city,
              country: ipData.country,
              isp: ipData.isp,
              timezone: ipData.timezone,
              latitude: ipData.latitude,
              longitude: ipData.longitude
            }
          : null,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        loginAttempts: loginAttempts + 1
      };

      const res = await axios.post('/api/auth/login', loginData);

      setLoginAttempts(0);
      setIsLocked(false);
      onLogin(res.data.token, res.data.user);
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Login failed. Please try again.';
      setError(errorMessage);

      const newAttempts = loginAttempts + 1;
      setLoginAttempts(newAttempts);

      if (newAttempts >= 5) {
        setIsLocked(true);
        setLockTimeRemaining(15 * 60);

        const countdownInterval = setInterval(() => {
          setLockTimeRemaining((prev) => {
            if (prev <= 1) {
              clearInterval(countdownInterval);
              setIsLocked(false);
              setLoginAttempts(0);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lms-login">
      <section className="lms-login__brand" aria-label="Sky States LMS">
        <div className="lms-login__brand-media" aria-hidden="true">
          <img
            src="/images/login-hero.jpg"
            alt=""
            className="lms-login__brand-image"
          />
        </div>
        <div className="lms-login__brand-copy">
          <p className="lms-login__wordmark">Sky States LMS</p>
          <div className="lms-login__brand-footer">
            <h1 className="lms-login__headline">Learning solutions for the evolving organization.</h1>
            <p className="lms-login__support">
              Live sessions, classroom recordings, and progress — built for trainers and learners in one place.
            </p>
          </div>
        </div>
      </section>

      <section className="lms-login__panel">
        <div className="lms-login__panel-inner">
          <header className="lms-login__panel-header">
            <p className="lms-login__panel-brand">Sky States LMS</p>
            <h2 className="lms-login__panel-title">{view === 'reset' ? 'Reset password' : 'Sign in'}</h2>
            <p className="lms-login__panel-subtitle">
              {view === 'reset'
                ? 'Enter your email to receive a one-time verification code.'
                : 'Use your institution email to access your dashboard.'}
            </p>
          </header>

          {view === 'reset' ? (
            <ChangePasswordPanel
              mode="reset"
              defaultEmail={email}
              onCancel={() => setView('login')}
              onSuccess={() => {}}
            />
          ) : (
            <form onSubmit={onSubmit} className="lms-login__form" autoComplete="off" noValidate>
              {error && (
                <div className="lms-login__alert lms-login__alert--error" role="alert">
                  {error}
                </div>
              )}

              {loginAttempts > 0 && loginAttempts < 5 && (
                <div className="lms-login__alert lms-login__alert--warn" role="status">
                  {5 - loginAttempts} attempt{5 - loginAttempts === 1 ? '' : 's'} remaining before a
                  temporary lock.
                </div>
              )}

              <div className="lms-login__field">
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={email}
                  onChange={onChange}
                  placeholder="you@example.com"
                  autoComplete="username"
                  required
                  disabled={loading || isLocked}
                />
              </div>

              <div className="lms-login__field">
                <label htmlFor="password">Password</label>
                <div className="lms-login__password">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    name="password"
                    value={password}
                    onChange={onChange}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                    disabled={loading || isLocked}
                  />
                  <button
                    type="button"
                    className="lms-login__toggle"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    disabled={loading || isLocked}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <div style={{ textAlign: 'right', marginTop: '-0.35rem', marginBottom: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setView('reset')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#147a7a',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    padding: 0
                  }}
                >
                  Forgot password?
                </button>
              </div>

              <button
                type="submit"
                className="lms-login__submit"
                disabled={loading || isLocked}
              >
                {loading ? (
                  <span className="lms-login__submit-row">
                    <span className="lms-login__spinner" aria-hidden="true" />
                    Signing in…
                  </span>
                ) : isLocked ? (
                  'Account locked'
                ) : (
                  'Continue'
                )}
              </button>
            </form>
          )}

          <footer className="lms-login__footer">
            <p>Students, teachers, and administrators use the same secure sign-in.</p>
            <p className="lms-login__copyright">© {new Date().getFullYear()} Sky States LMS</p>
          </footer>
        </div>
      </section>
    </div>
  );
};

export default Login;
