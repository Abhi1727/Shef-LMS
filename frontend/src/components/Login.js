import React, { useState, useEffect } from 'react';
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
  }, []);

  const onChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Send login data with IP information
      const loginData = {
        ...formData,
        ipAddress: ipData?.ip || 'Unknown',
        ipDetails: ipData ? {
          city: ipData.city,
          country: ipData.country,
          isp: ipData.isp,
          timezone: ipData.timezone
        } : null
      };

      const res = await axios.post('/api/auth/login', loginData);
      onLogin(res.data.token, res.data.user);
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-background">
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

          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              name="email"
              value={email}
              onChange={onChange}
              placeholder="Enter your email"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={password}
              onChange={onChange}
              placeholder="Enter your password"
              required
            />
          </div>

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
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
