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
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [showIframe, setShowIframe] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [lockTimeRemaining, setLockTimeRemaining] = useState(0);
  const iframeRef = useRef(null);

  const { email, password } = formData;

  // Detect IP address when component mounts
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

    // Optimized iframe loading strategy
    const loadIframe = () => {
      // Create a new iframe element for better performance
      const iframe = document.createElement('iframe');
      iframe.src = 'https://my.spline.design/reactiveorb-oBoMVyo5ZcPfpuQuaNzGdhQ4/';
      iframe.frameBorder = '0';
      iframe.width = '100%';
      iframe.height = '100%';
      iframe.className = 'spline-iframe';
      iframe.loading = 'eager';
      iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
      iframe.allowFullScreen = true;
      
      iframe.onload = () => {
        setIframeLoaded(true);
      };
      
      // Add to DOM after a short delay
      setTimeout(() => {
        if (iframeRef.current?.parentElement) {
          iframeRef.current.parentElement.replaceChild(iframe, iframeRef.current);
        }
        setShowIframe(true);
      }, 100);
    };

    // Start loading immediately but show after minimal delay
    const timer = setTimeout(loadIframe, 200);

    return () => clearTimeout(timer);
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
    <div className="login-container">
      <div className="login-background">
        {/* Fallback animated background */}
        <div className="animated-bg-fallback"></div>
        
        {showIframe && (
          <iframe 
            ref={iframeRef}
            src='https://my.spline.design/reactiveorb-oBoMVyo5ZcPfpuQuaNzGdhQ4/' 
            frameBorder='0' 
            width='100%' 
            height='100%'
            className={`spline-iframe ${iframeLoaded ? 'loaded' : 'loading'}`}
            onLoad={() => setIframeLoaded(true)}
            loading="eager"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        )}
        
        <div className="shape shape1"></div>
        <div className="shape shape2"></div>
        <div className="shape shape3"></div>
      </div>
      
      <div className="login-card">
        <div className="login-header">
          <div className="logo">
            <h2>LMS</h2>
          </div>
          <h2>Welcome Back! 👋</h2>
          <p>Sign in to continue your learning journey</p>
        </div>

        <form onSubmit={onSubmit} className="login-form">
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

          {ipData && (
            <div className="ip-info">
              <span>📍</span> Login from: {ipData.city}, {ipData.country}
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
                type="password"
                id="password"
                name="password"
                value={password}
                onChange={onChange}
                placeholder="Enter your password"
                required
                className={loginAttempts > 2 ? 'shake' : ''}
              />
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
    </div>
  );
};

export default Login;
