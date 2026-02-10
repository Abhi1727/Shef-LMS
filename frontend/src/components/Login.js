import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { detectUserIP } from '../utils/ipDetector';
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
  const containerRef = useRef(null);

  const { email, password } = formData;

  // Detect IP address when component mounts (for security logging only)
  useEffect(() => {
    const fetchIP = async () => {
      try {
        const data = await detectUserIP();
        setIpData(data);
      } catch (error) {
        console.error('Failed to detect IP:', error);
      }
    };
    fetchIP();
  }, []);

  // Cursor-based ambient animation: floating lines/shapes repel from the cursor
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseMove = (e) => {
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Update CSS custom properties for gradient highlight
      container.style.setProperty('--cursor-x', `${x}px`);
      container.style.setProperty('--cursor-y', `${y}px`);

      // Repel floating shapes away from the cursor
      const shapes = container.querySelectorAll('.floating-shape');
      const maxDist = 220;
      const maxOffset = 32;

      shapes.forEach((shape) => {
        const sRect = shape.getBoundingClientRect();
        const sx = sRect.left + sRect.width / 2 - rect.left;
        const sy = sRect.top + sRect.height / 2 - rect.top;

        const dx = sx - x;
        const dy = sy - y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        if (dist < maxDist) {
          const force = (maxDist - dist) / maxDist;
          const offsetX = (dx / dist) * force * maxOffset;
          const offsetY = (dy / dist) * force * maxOffset;
          shape.style.transform = `translate3d(${offsetX}px, ${offsetY}px, 0)`;
        } else {
          shape.style.transform = 'translate3d(0, 0, 0)';
        }
      });
    };

    container.addEventListener('mousemove', handleMouseMove);

    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  const onChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    // Check if account is locked
    if (isLocked) {
      setError(`Account temporarily locked. Please try again in ${Math.ceil(lockTimeRemaining / 60)} minutes.`);
      return;
    }
    
    setLoading(true);

    try {
      // Send login data with IP information and security details
      const loginData = {
        ...formData,
        ipAddress: ipData?.ip || 'Unknown',
        ipDetails: ipData ? {
          city: ipData.city,
          country: ipData.country,
          isp: ipData.isp,
          timezone: ipData.timezone,
          latitude: ipData.latitude,
          longitude: ipData.longitude
        } : null,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        loginAttempts: loginAttempts + 1
      };

      const res = await axios.post('/api/auth/login', loginData);
      
      // Reset login attempts on successful login
      setLoginAttempts(0);
      setIsLocked(false);
      
      onLogin(res.data.token, res.data.user);
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Login failed. Please try again.';
      setError(errorMessage);
      
      // Increment login attempts on failure
      const newAttempts = loginAttempts + 1;
      setLoginAttempts(newAttempts);
      
      // Lock account after 5 failed attempts for 15 minutes
      if (newAttempts >= 5) {
        setIsLocked(true);
        setLockTimeRemaining(15 * 60); // 15 minutes in seconds
        
        // Start countdown timer
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
    <div className="login-container" ref={containerRef}>
      <div className="tech-grid"></div>
      <div className="floating-shapes">
        <span className="floating-shape shape-1"></span>
        <span className="floating-shape shape-2"></span>
        <span className="floating-shape shape-3"></span>
        <span className="floating-shape shape-4"></span>
        <span className="floating-shape shape-5"></span>
      </div>

      <div className="login-main">
        <div className="login-card">
          <div className="login-header">
            <div className="logo">
              <h2>LMS</h2>
            </div>
            <h2>Welcome Back! 👋</h2>
            <p>Sign in to continue your learning journey</p>
          </div>

          <form onSubmit={onSubmit} className="login-form" autoComplete="off">
            {error && (
              <div className="error-message">
                <span>⚠️</span> {error}
              </div>
            )}

            {loginAttempts > 0 && loginAttempts < 5 && (
              <div className="warning-message">
                <span>🔒</span> Login attempts remaining: {5 - loginAttempts}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <div className="input-wrapper">
                <span className="input-icon">📧</span>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={email}
                  onChange={onChange}
                  placeholder="Enter your email"
                  autoComplete="off"
                  required
                  className={loginAttempts > 2 ? 'shake' : ''}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <div className="input-wrapper">
                <span className="input-icon">🔐</span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  value={password}
                  onChange={onChange}
                  placeholder="Enter your password"
                  autoComplete="new-password"
                  required
                  className={loginAttempts > 2 ? 'shake' : ''}
                />
                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <span className="toggle-password-icon" aria-hidden="true">
                    {showPassword ? '🙈' : '👁️'}
                  </span>
                </button>
              </div>
            </div>

            <button
              type="submit"
              className={`login-btn ${loading ? 'loading' : ''} ${isLocked ? 'locked' : ''}`}
              disabled={loading || isLocked}
            >
              {loading ? (
                <>
                  <span className="spinner"></span>
                  Signing in...
                </>
              ) : isLocked ? (
                <>
                  <span>🔒</span>
                  Account Locked
                </>
              ) : (
                <>
                  <span>🚀</span>
                  Sign In
                </>
              )}
            </button>
          </form>

          <div className="login-footer">
            <p>&copy; 2025 LMS. All rights reserved.</p>
          </div>
        </div>

        <div className="hero-text hero-below">
          <h1>Shef LMS</h1>
          <p>Streamlined classes, recorded lectures, and progress in one place.</p>
          <div className="hero-tags">
            <span>Secure Login</span>
            <span>Live Cohorts</span>
            <span>Video Library</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
