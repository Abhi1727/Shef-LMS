// Token Service for managing JWT tokens and session validation
import axios from 'axios';

class TokenService {
  constructor() {
    this.validationInterval = null;
    this.axiosInterceptor = null;
  }

  // Get token from localStorage
  getToken() {
    return localStorage.getItem('token');
  }

  // Set token in localStorage
  setToken(token) {
    localStorage.setItem('token', token);
  }

  // Remove token from localStorage
  removeToken() {
    localStorage.removeItem('token');
  }

  // Decode JWT token
  decodeToken(token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  }

  // Check if token is expired
  isTokenExpired(token) {
    try {
      const decoded = this.decodeToken(token);
      if (!decoded || !decoded.exp) {
        return true;
      }
      const currentTime = Math.floor(Date.now() / 1000);
      return decoded.exp < currentTime;
    } catch (error) {
      console.error('Error checking token expiry:', error);
      return true;
    }
  }

  // Get time until token expires
  getTimeUntilExpiry(token) {
    try {
      const decoded = this.decodeToken(token);
      if (!decoded || !decoded.exp) {
        return 0;
      }
      const currentTime = Math.floor(Date.now() / 1000);
      return decoded.exp - currentTime;
    } catch (error) {
      console.error('Error getting time until expiry:', error);
      return 0;
    }
  }

  // Format time until expiry for display
  formatTimeUntilExpiry(seconds) {
    if (seconds <= 0) return 'Expired';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    } else {
      return 'Less than 1m';
    }
  }

  // Setup axios interceptor for automatic token handling
  setupAxiosInterceptor(onTokenExpired) {
    try {
      this.axiosInterceptor = axios.interceptors.response.use(
        (response) => response,
        (error) => {
          // Comprehensive error checking
          if (!error) {
            return Promise.reject(new Error('Unknown error occurred'));
          }
          
          // Check if error has a response with 401 status
          if (error.response && error.response.status === 401) {
            const message = error.response.data?.message || 'Session expired';
            onTokenExpired(message);
          }
          
          return Promise.reject(error);
        }
      );
    } catch (setupError) {
      console.error('Error setting up axios interceptor:', setupError);
      // Don't throw the error to prevent app crash
    }
  }

  // Start periodic token validation
  startTokenValidation(onTokenExpired, onTokenWarning) {
    // Clear any existing interval
    this.stopTokenValidation();

    const token = this.getToken();
    if (!token) {
      onTokenExpired('No token found');
      return;
    }

    // Check token every minute
    this.validationInterval = setInterval(() => {
      const token = this.getToken();
      if (!token || this.isTokenExpired(token)) {
        onTokenExpired('Token has expired');
        this.stopTokenValidation();
        return;
      }

      const timeUntilExpiry = this.getTimeUntilExpiry(token);
      
      // Show warning when less than 5 minutes remaining
      if (timeUntilExpiry > 0 && timeUntilExpiry <= 300) {
        const decoded = this.decodeToken(token);
        onTokenWarning(timeUntilExpiry, new Date(decoded.exp * 1000));
      }
    }, 60000); // Check every minute

    // Initial check
    if (this.isTokenExpired(token)) {
      onTokenExpired('Token has expired');
      this.stopTokenValidation();
    }
  }

  // Stop token validation
  stopTokenValidation() {
    if (this.validationInterval) {
      clearInterval(this.validationInterval);
      this.validationInterval = null;
    }
    
    if (this.axiosInterceptor) {
      axios.interceptors.response.eject(this.axiosInterceptor);
      this.axiosInterceptor = null;
    }
  }

  // Refresh token (if refresh token mechanism is implemented)
  async refreshToken() {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getToken()}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        this.setToken(data.token);
        return data.token;
      } else {
        throw new Error('Failed to refresh token');
      }
    } catch (error) {
      console.error('Error refreshing token:', error);
      return null;
    }
  }
}

// Create and export singleton instance
const tokenService = new TokenService();
export default tokenService;
