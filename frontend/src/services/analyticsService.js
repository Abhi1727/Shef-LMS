import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

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
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle common errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid, redirect to login
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

/**
 * Analytics API Service
 * Handles all analytics-related API calls for students
 */
export const analyticsService = {
  /**
   * Get comprehensive analytics data for the current student
   * @returns {Promise} Analytics data including summary, course progress, and recent activity
   */
  getAnalytics: async () => {
    try {
      const response = await api.get('/api/student/analytics');
      return response.data;
    } catch (error) {
      console.error('Error fetching analytics data:', error);
      throw error;
    }
  },

  /**
   * Get progress summary for the current student
   * @returns {Promise} Progress summary data
   */
  getProgressSummary: async () => {
    try {
      const response = await api.get('/api/student/progress-summary');
      return response.data;
    } catch (error) {
      console.error('Error fetching progress summary:', error);
      throw error;
    }
  },

  /**
   * Get course progress details
   * @returns {Promise} Course progress data
   */
  getCourseProgress: async () => {
    try {
      const response = await api.get('/api/student/course-progress');
      return response.data;
    } catch (error) {
      console.error('Error fetching course progress:', error);
      throw error;
    }
  },

  /**
   * Get student profile information
   * @returns {Promise} Student profile data
   */
  getProfile: async () => {
    try {
      const response = await api.get('/api/student/profile');
      return response.data;
    } catch (error) {
      console.error('Error fetching student profile:', error);
      throw error;
    }
  },

  /**
   * Get batch information for the student
   * @returns {Promise} Batch information
   */
  getBatchInfo: async () => {
    try {
      const response = await api.get('/api/student/batch-info');
      return response.data;
    } catch (error) {
      console.error('Error fetching batch info:', error);
      throw error;
    }
  }
};

/**
 * Utility functions for analytics data processing
 */
export const analyticsUtils = {
  /**
   * Format duration in seconds to human-readable format
   * @param {number} seconds - Duration in seconds
   * @returns {string} Formatted duration (e.g., "2h 30m", "45m", "30s")
   */
  formatDuration: (seconds) => {
    if (!seconds || seconds < 0) return '0m';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    if (hours > 0) {
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    } else if (minutes > 0) {
      return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
    } else {
      return `${remainingSeconds}s`;
    }
  },

  /**
   * Format date to relative time (e.g., "2 days ago", "1 hour ago")
   * @param {string|Date} date - Date to format
   * @returns {string} Relative time string
   */
  formatRelativeTime: (date) => {
    if (!date) return 'Never';
    
    const now = new Date();
    const targetDate = new Date(date);
    const diffMs = now - targetDate;
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);
    
    if (diffSeconds < 60) {
      return 'Just now';
    } else if (diffMinutes < 60) {
      return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else if (diffWeeks < 4) {
      return `${diffWeeks} week${diffWeeks > 1 ? 's' : ''} ago`;
    } else if (diffMonths < 12) {
      return `${diffMonths} month${diffMonths > 1 ? 's' : ''} ago`;
    } else {
      return targetDate.toLocaleDateString();
    }
  },

  /**
   * Get progress color based on percentage
   * @param {number} percentage - Progress percentage (0-100)
   * @returns {string} Color code
   */
  getProgressColor: (percentage) => {
    if (percentage >= 80) return '#10b981'; // green
    if (percentage >= 60) return '#3b82f6'; // blue
    if (percentage >= 40) return '#f59e0b'; // amber
    return '#ef4444'; // red
  },

  /**
   * Get progress status label
   * @param {number} percentage - Progress percentage (0-100)
   * @returns {string} Status label
   */
  getProgressStatus: (percentage) => {
    if (percentage >= 80) return 'Excellent';
    if (percentage >= 60) return 'Good';
    if (percentage >= 40) return 'Fair';
    return 'Needs Improvement';
  },

  /**
   * Calculate streak milestone reward
   * @param {number} streak - Current streak in days
   * @returns {object} Milestone information
   */
  getStreakMilestone: (streak) => {
    const milestones = [
      { days: 1, title: 'First Day!', icon: '🌱' },
      { days: 3, title: '3 Day Streak!', icon: '🔥' },
      { days: 7, title: 'Week Warrior!', icon: '💪' },
      { days: 14, title: '2 Week Champion!', icon: '🏆' },
      { days: 30, title: 'Month Master!', icon: '👑' },
      { days: 60, title: '2 Month Legend!', icon: '⭐' },
      { days: 100, title: '100 Day Hero!', icon: '🎖️' }
    ];
    
    const currentMilestone = milestones
      .filter(m => streak >= m.days)
      .pop();
    
    const nextMilestone = milestones
      .find(m => streak < m.days);
    
    return {
      current: currentMilestone || { days: 0, title: 'Start Your Journey!', icon: '🚀' },
      next: nextMilestone,
      progress: nextMilestone ? ((streak / nextMilestone.days) * 100) : 100
    };
  },

  /**
   * Generate weekly chart data for progress visualization
   * @param {Array} weeklyProgress - Array of weekly progress data
   * @returns {Array} Formatted chart data
   */
  generateWeeklyChartData: (weeklyProgress) => {
    return weeklyProgress.map((week, index) => ({
      name: week.week,
      progress: week.progress,
      fill: analyticsUtils.getProgressColor(week.progress)
    }));
  },

  /**
   * Calculate achievement badges based on progress
   * @param {object} analyticsData - Analytics data object
   * @returns {Array} Array of achievement badges
   */
  calculateAchievements: (analyticsData) => {
    const achievements = [];
    const { summary } = analyticsData;
    
    // Video watching achievements
    if (summary.totalVideosWatched >= 1) {
      achievements.push({
        id: 'first_video',
        title: 'First Video',
        description: 'Watched your first video',
        icon: '📹',
        earned: true
      });
    }
    
    if (summary.totalVideosWatched >= 10) {
      achievements.push({
        id: 'video_watcher',
        title: 'Video Watcher',
        description: 'Watched 10 videos',
        icon: '🎬',
        earned: true
      });
    }
    
    if (summary.totalVideosWatched >= 25) {
      achievements.push({
        id: 'video_enthusiast',
        title: 'Video Enthusiast',
        description: 'Watched 25 videos',
        icon: '🎥',
        earned: true
      });
    }
    
    // Streak achievements
    if (summary.currentStreak >= 3) {
      achievements.push({
        id: 'streak_3',
        title: '3 Day Streak',
        description: 'Maintained a 3-day streak',
        icon: '🔥',
        earned: true
      });
    }
    
    if (summary.currentStreak >= 7) {
      achievements.push({
        id: 'streak_7',
        title: 'Week Warrior',
        description: 'Maintained a 7-day streak',
        icon: '💪',
        earned: true
      });
    }
    
    // Progress achievements
    if (summary.averageProgress >= 50) {
      achievements.push({
        id: 'halfway',
        title: 'Halfway There',
        description: 'Reached 50% progress',
        icon: '🎯',
        earned: true
      });
    }
    
    if (summary.averageProgress >= 80) {
      achievements.push({
        id: 'almost_done',
        title: 'Almost Done',
        description: 'Reached 80% progress',
        icon: '🏁',
        earned: true
      });
    }
    
    return achievements;
  }
};

export default analyticsService;
