import axios from 'axios';

const API_BASE_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:5000' 
  : process.env.REACT_APP_API_URL || '';

// Retry utility with exponential backoff
const retryRequest = async (fn, maxRetries = 3, delay = 1000) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      // Don't retry on authentication errors or 4xx errors (except 429)
      if (error.response?.status === 401 || 
          error.response?.status === 403 || 
          (error.response?.status >= 400 && error.response?.status < 500 && error.response?.status !== 429)) {
        throw error;
      }
      
      // If this is the last attempt, throw the error
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Wait with exponential backoff
      const waitTime = delay * Math.pow(2, attempt - 1);
      console.log(`Request failed, retrying in ${waitTime}ms (attempt ${attempt}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
};

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add request interceptor to include auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add response interceptor to handle common errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

/**
 * Admin Analytics API Service
 * Handles all analytics-related API calls for admin dashboard
 */
export const adminAnalyticsService = {
  /**
   * Get comprehensive platform analytics
   * @param {Object} params - Analytics parameters
   * @param {string} params.period - Time period (7days, 30days, 90days, custom)
   * @param {string} params.startDate - Custom start date (ISO string)
   * @param {string} params.endDate - Custom end date (ISO string)
   * @returns {Promise} Comprehensive analytics data
   */
  getAnalytics: async (params = {}) => {
    return retryRequest(async () => {
      try {
        const response = await api.get('/api/admin/analytics', { params });
        return response.data;
      } catch (error) {
        console.error('Error fetching admin analytics:', error);
        
        // Enhanced error handling
        if (error.code === 'ERR_NETWORK' || !error.response) {
          throw new Error('Unable to connect to the server. Please check if the backend is running and accessible.');
        } else if (error.response?.status === 401) {
          throw new Error('Your session has expired. Please log in again.');
        } else if (error.response?.status === 403) {
          throw new Error('You do not have permission to access analytics data.');
        } else if (error.response?.status === 404) {
          throw new Error('Analytics endpoint not found. Please check the server configuration.');
        } else if (error.response?.status >= 500) {
          throw new Error('Server error occurred. Please try again later.');
        } else {
          throw new Error(error.response?.data?.message || 'Failed to fetch analytics data');
        }
      }
    });
  },

  /**
   * Get student activity report
   * @param {string} studentId - Student ID
   * @param {Object} params - Report parameters
   * @returns {Promise} Student activity report data
   */
  getStudentReport: async (studentId, params = {}) => {
    try {
      const response = await api.get(`/api/admin/activity/${studentId}`, { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching student report:', error);
      
      // Enhanced error handling
      if (error.code === 'ERR_NETWORK' || !error.response) {
        throw new Error('Unable to connect to the server. Please check if the backend is running and accessible.');
      } else if (error.response?.status === 401) {
        throw new Error('Your session has expired. Please log in again.');
      } else if (error.response?.status === 403) {
        throw new Error('You do not have permission to access student reports.');
      } else if (error.response?.status === 404) {
        throw new Error('Student report not found or student does not exist.');
      } else if (error.response?.status >= 500) {
        throw new Error('Server error occurred. Please try again later.');
      } else {
        throw new Error(error.response?.data?.message || 'Failed to fetch student report');
      }
    }
  },

  /**
   * Generate CSV report for student activity
   * @param {string} studentId - Student ID
   * @param {Object} params - Report parameters
   * @returns {Promise} CSV data
   */
  downloadStudentReport: async (studentId, params = {}) => {
    try {
      const response = await api.get(`/api/admin/activity/${studentId}/csv`, { 
        params,
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      console.error('Error downloading student report:', error);
      
      // Enhanced error handling
      if (error.code === 'ERR_NETWORK' || !error.response) {
        throw new Error('Unable to connect to the server. Please check if the backend is running and accessible.');
      } else if (error.response?.status === 401) {
        throw new Error('Your session has expired. Please log in again.');
      } else if (error.response?.status === 403) {
        throw new Error('You do not have permission to download student reports.');
      } else if (error.response?.status === 404) {
        throw new Error('Student report not found or student does not exist.');
      } else if (error.response?.status >= 500) {
        throw new Error('Server error occurred. Please try again later.');
      } else {
        throw new Error(error.response?.data?.message || 'Failed to download student report');
      }
    }
  }
};

/**
 * Utility functions for admin analytics data processing
 */
export const adminAnalyticsUtils = {
  /**
   * Format large numbers with abbreviations
   * @param {number} num - Number to format
   * @returns {string} Formatted number
   */
  formatLargeNumber: (num) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  },

  /**
   * Calculate growth percentage
   * @param {number} current - Current value
   * @param {number} previous - Previous value
   * @returns {number} Growth percentage
   */
  calculateGrowth: (current, previous) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  },

  /**
   * Get engagement level based on percentage
   * @param {number} percentage - Engagement percentage
   * @returns {Object} Engagement level info
   */
  getEngagementLevel: (percentage) => {
    if (percentage >= 80) {
      return { level: 'High', color: '#10b981', icon: '🔥' };
    } else if (percentage >= 60) {
      return { level: 'Medium', color: '#f59e0b', icon: '📈' };
    } else if (percentage >= 40) {
      return { level: 'Low', color: '#3b82f6', icon: '📊' };
    } else {
      return { level: 'Very Low', color: '#ef4444', icon: '⚠️' };
    }
  },

  /**
   * Format date for display
   * @param {string|Date} date - Date to format
   * @param {string} format - Format type ('short', 'long', 'relative')
   * @returns {string} Formatted date
   */
  formatDate: (date, format = 'short') => {
    const dateObj = new Date(date);
    
    switch (format) {
      case 'short':
        return dateObj.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric' 
        });
      case 'long':
        return dateObj.toLocaleDateString('en-US', { 
          weekday: 'long',
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
      case 'relative':
        const now = new Date();
        const diffMs = now - dateObj;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
        return `${Math.floor(diffDays / 30)} months ago`;
      default:
        return dateObj.toLocaleDateString();
    }
  },

  /**
   * Generate chart data for trends
   * @param {Array} data - Trend data array
   * @param {string} valueKey - Key for values
   * @returns {Array} Chart-ready data
   */
  generateChartData: (data, valueKey = 'count') => {
    return data.map(item => ({
      date: item.date,
      value: item[valueKey],
      label: adminAnalyticsUtils.formatDate(item.date, 'short')
    }));
  },

  /**
   * Calculate percentile rank
   * @param {number} value - Value to rank
   * @param {Array} values - All values to compare against
   * @returns {number} Percentile rank (0-100)
   */
  calculatePercentile: (value, values) => {
    const sorted = values.sort((a, b) => a - b);
    const index = sorted.indexOf(value);
    return Math.round((index / sorted.length) * 100);
  },

  /**
   * Get activity type display info
   * @param {string} action - Activity action type
   * @returns {Object} Display information
   */
  getActivityDisplayInfo: (action) => {
    const activityMap = {
      'login': { label: 'Logins', icon: '🔑', color: '#3b82f6' },
      'video_view': { label: 'Video Views', icon: '📹', color: '#ef4444' },
      'video_completed': { label: 'Videos Completed', icon: '✅', color: '#10b981' },
      'assessment_submit': { label: 'Assessments', icon: '📝', color: '#f59e0b' },
      'page_view': { label: 'Page Views', icon: '👁️', color: '#8b5cf6' },
      'download': { label: 'Downloads', icon: '📥', color: '#06b6d4' }
    };
    
    return activityMap[action] || { 
      label: action.replace('_', ' ').toUpperCase(), 
      icon: '📊', 
      color: '#6b7280' 
    };
  },

  /**
   * Generate performance insights
   * @param {Object} analyticsData - Analytics data object
   * @returns {Array} Array of insights
   */
  generateInsights: (analyticsData) => {
    const insights = [];
    const { overview, activityBreakdown, courseAnalytics, studentEngagement } = analyticsData;
    
    // Student engagement insight
    if (overview.studentEngagementRate < 50) {
      insights.push({
        type: 'warning',
        title: 'Low Student Engagement',
        description: `Only ${overview.studentEngagementRate}% of students are actively engaged. Consider implementing engagement strategies.`,
        action: 'Review engagement strategies'
      });
    } else if (overview.studentEngagementRate > 80) {
      insights.push({
        type: 'success',
        title: 'High Student Engagement',
        description: `Excellent! ${overview.studentEngagementRate}% of students are actively engaged.`,
        action: 'Keep up the great work!'
      });
    }
    
    // Course performance insight
    if (courseAnalytics.length > 0) {
      const topCourse = courseAnalytics[0];
      const totalViews = courseAnalytics.reduce((sum, course) => sum + course.totalViews, 0);
      const topCoursePercentage = Math.round((topCourse.totalViews / totalViews) * 100);
      
      if (topCoursePercentage > 60) {
        insights.push({
          type: 'info',
          title: 'Popular Course',
          description: `${topCourse.courseName} accounts for ${topCoursePercentage}% of all video views.`,
          action: 'Consider expanding this course'
        });
      }
    }
    
    // Activity pattern insight
    const videoViews = activityBreakdown.find(item => item.action === 'video_view')?.count || 0;
    const logins = activityBreakdown.find(item => item.action === 'login')?.count || 0;
    
    if (videoViews > 0 && logins > 0) {
      const viewsPerLogin = Math.round(videoViews / logins);
      if (viewsPerLogin > 5) {
        insights.push({
          type: 'success',
          title: 'High Activity per Session',
          description: `Students average ${viewsPerLogin} video views per login session.`,
          action: 'Excellent user engagement!'
        });
      }
    }
    
    return insights;
  }
};

export default adminAnalyticsService;
