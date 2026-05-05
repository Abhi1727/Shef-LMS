/**
 * Students Activity - Comprehensive activity dashboard for admin
 * Shows every detail: logins, video views, assessments with full metadata
 */
import React, { useState, useEffect, useCallback } from 'react';
import { formatDateTimeDisplay, formatDateForComponent } from '../utils/dateUtils';
import './StudentsActivity.css';

const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';

const ACTION_LABELS = {
  login: { icon: '🔐', label: 'Login', color: '#10b981' },
  video_view: { icon: '📹', label: 'Video View', color: '#3b82f6' },
  assessment_submit: { icon: '✏️', label: 'Assessment Submit', color: '#8b5cf6' },
  page_view: { icon: '📄', label: 'Page View', color: '#6b7280' },
  logout: { icon: '🚪', label: 'Logout', color: '#ef4444' }
};

const ROLE_LABELS = {
  student: { label: 'Student', color: '#3b82f6' },
  teacher: { label: 'Teacher', color: '#10b981' },
  admin: { label: 'Admin', color: '#f59e0b' },
  mentor: { label: 'Mentor', color: '#8b5cf6' },
  instructor: { label: 'Instructor', color: '#06b6d4' }
};

const StudentsActivity = ({ token: tokenProp }) => {
  const token = tokenProp || (typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null);
  const [activities, setActivities] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [filters, setFilters] = useState({
    role: 'student',
    action: '',
    search: '',
    limit: 200
  });
  const [autoRefresh, setAutoRefresh] = useState(false);
  
  // New states for individual user features
  const [showUserModal, setShowUserModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userSearchResults, setUserSearchResults] = useState([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const [userActivities, setUserActivities] = useState([]);
  const [userActivitiesLoading, setUserActivitiesLoading] = useState(false);
  const [userFilters, setUserFilters] = useState({
    action: '',
    startDate: '',
    endDate: '',
    limit: 100,
    page: 1
  });
  const [userPagination, setUserPagination] = useState({ total: 0, pages: 0 });
  const [userSearchInput, setUserSearchInput] = useState('');

  // Graph visualization states
  const [graphView, setGraphView] = useState('daily'); // 'daily', 'hourly', 'distribution'
  const [showGraph, setShowGraph] = useState(true);
  const [hoveredBar, setHoveredBar] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);


  const fetchActivities = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.role) params.set('role', filters.role);
      if (filters.action) params.set('action', filters.action);
      params.set('limit', filters.limit);
      const res = await fetch(`${API_BASE}/api/admin/activity?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load activity');
      const data = await res.json();
      setActivities(data.activities || []);
      setTotal(data.total ?? 0);
    } catch (err) {
      setError(err.message);
      setActivities([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [token, filters.role, filters.action, filters.limit]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(fetchActivities, 30000);
    return () => clearInterval(id);
  }, [autoRefresh, fetchActivities]);

  // Fetch user activities when selected user or filters change
  useEffect(() => {
    if (selectedUser) {
      fetchUserActivities();
    }
  }, [selectedUser, userFilters.action, userFilters.startDate, userFilters.endDate, userFilters.limit, userFilters.page]);

  const filteredActivities = activities.filter(a => {
    if (!filters.search.trim()) return true;
    const s = filters.search.toLowerCase();
    return (
      (a.userName || '').toLowerCase().includes(s) ||
      (a.userEmail || '').toLowerCase().includes(s) ||
      (a.ipAddress || '').includes(s) ||
      (a.city || '').toLowerCase().includes(s) ||
      (a.country || '').toLowerCase().includes(s) ||
      (a.videoTitle || '').toLowerCase().includes(s)
    );
  });

  const stats = React.useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const loginsToday = activities.filter(a => a.action === 'login' && new Date(a.timestamp).getTime() >= todayStart).length;
    const videoViews = activities.filter(a => a.action === 'video_view').length;
    const uniqueUsers = new Set(activities.map(a => a.userEmail)).size;
    const byAction = activities.reduce((acc, a) => {
      acc[a.action] = (acc[a.action] || 0) + 1;
      return acc;
    }, {});
    return { loginsToday, videoViews, uniqueUsers, byAction };
  }, [activities]);

  // Process activity data for graph visualization
  const processActivityData = useCallback(() => {
    if (!activities.length) return { dailyData: [], hourlyData: [], actionDistribution: [] };

    // Daily activity for last 7 days
    const dailyData = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dateStart = date.setHours(0, 0, 0, 0);
      const dateEnd = date.setHours(23, 59, 59, 999);
      
      const dayActivities = activities.filter(a => {
        const activityTime = new Date(a.timestamp).getTime();
        return activityTime >= dateStart && activityTime <= dateEnd;
      });

      dailyData.push({
        date: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        total: dayActivities.length,
        logins: dayActivities.filter(a => a.action === 'login').length,
        videoViews: dayActivities.filter(a => a.action === 'video_view').length,
        assessments: dayActivities.filter(a => a.action === 'assessment_submit').length,
        uniqueUsers: new Set(dayActivities.map(a => a.userEmail)).size
      });
    }

    // Hourly activity for today
    const hourlyData = [];
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const todayActivities = activities.filter(a => new Date(a.timestamp).getTime() >= todayStart);
    
    for (let hour = 0; hour < 24; hour++) {
      const hourStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, 0, 0).getTime();
      const hourEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, 59, 59).getTime();
      
      const hourActivities = todayActivities.filter(a => {
        const activityTime = new Date(a.timestamp).getTime();
        return activityTime >= hourStart && activityTime <= hourEnd;
      });

      hourlyData.push({
        hour: hour,
        time: `${hour.toString().padStart(2, '0')}:00`,
        total: hourActivities.length,
        logins: hourActivities.filter(a => a.action === 'login').length,
        videoViews: hourActivities.filter(a => a.action === 'video_view').length,
        assessments: hourActivities.filter(a => a.action === 'assessment_submit').length
      });
    }

    // Action distribution
    const actionCounts = activities.reduce((acc, a) => {
      acc[a.action] = (acc[a.action] || 0) + 1;
      return acc;
    }, {});

    const actionDistribution = Object.entries(actionCounts).map(([action, count]) => ({
      action,
      count,
      percentage: ((count / activities.length) * 100).toFixed(1),
      ...ACTION_LABELS[action]
    })).sort((a, b) => b.count - a.count);

    return { dailyData, hourlyData, actionDistribution };
  }, [activities]);

  const handleExportCSV = () => {
    const headers = ['Timestamp', 'User', 'Email', 'Role', 'Action', 'IP', 'City', 'Country', 'ISP', 'Video', 'Assessment', 'Score'];
    const rows = filteredActivities.map(a => [
      new Date(a.timestamp).toISOString(),
      a.userName || '',
      a.userEmail || '',
      a.userRole || '',
      a.action || '',
      a.ipAddress || '',
      a.city || '',
      a.country || '',
      a.isp || '',
      a.videoTitle || '',
      a.assessmentTitle || '',
      a.score ?? ''
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `students-activity-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // New functions for individual user features
  const searchUsers = React.useCallback(async (query) => {
    if (!query || query.length < 2) {
      setUserSearchResults([]);
      return;
    }
    
    setUserSearchLoading(true);
    try {
      const params = new URLSearchParams({ q: query, limit: 10 });
      const res = await fetch(`${API_BASE}/api/admin/activity/users/search?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to search users');
      const data = await res.json();
      setUserSearchResults(data.users || []);
    } catch (err) {
      console.error('Error searching users:', err);
      setUserSearchResults([]);
    } finally {
      setUserSearchLoading(false);
    }
  }, [token]);

  // Debounced search function
  const debouncedSearch = React.useCallback(
    (query) => {
      const timer = setTimeout(() => {
        searchUsers(query);
      }, 300);
      return () => clearTimeout(timer);
    },
    [searchUsers]
  );

  const fetchUserActivities = async () => {
    if (!selectedUser || !token) return;
    
    setUserActivitiesLoading(true);
    try {
      const params = new URLSearchParams();
      if (userFilters.action) params.set('action', userFilters.action);
      if (userFilters.startDate) params.set('startDate', userFilters.startDate);
      if (userFilters.endDate) params.set('endDate', userFilters.endDate);
      params.set('limit', userFilters.limit);
      params.set('page', userFilters.page);
      
      const res = await fetch(`${API_BASE}/api/admin/activity/user/${selectedUser.id}?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load user activity');
      const data = await res.json();
      setUserActivities(data.activities || []);
      setUserPagination({
        total: data.total || 0,
        pages: data.pages || 0
      });
    } catch (err) {
      console.error('Error fetching user activities:', err);
      setUserActivities([]);
      setUserPagination({ total: 0, pages: 0 });
    } finally {
      setUserActivitiesLoading(false);
    }
  };

  const handleUserExport = async (format = 'csv') => {
    if (!selectedUser || !token) return;
    
    try {
      const params = new URLSearchParams({ format });
      if (userFilters.action) params.set('action', userFilters.action);
      if (userFilters.startDate) params.set('startDate', userFilters.startDate);
      if (userFilters.endDate) params.set('endDate', userFilters.endDate);
      
      const res = await fetch(`${API_BASE}/api/admin/activity/user/${selectedUser.id}/export?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!res.ok) throw new Error('Failed to export user activity');
      
      if (format === 'json') {
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `user-data-${selectedUser.name.replace(/[^a-zA-Z0-9]/g, '_')}-${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
        URL.revokeObjectURL(link.href);
      } else {
        const blob = await res.blob();
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        const contentDisposition = res.headers.get('content-disposition');
        const filename = contentDisposition ? contentDisposition.split('filename=')[1].replace(/"/g, '') : `user-activity-${new Date().toISOString().slice(0, 10)}.csv`;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(link.href);
      }
    } catch (err) {
      console.error('Error exporting user activity:', err);
      alert('Failed to export user activity. Please try again.');
    }
  };

  const openUserModal = (user = null) => {
    setSelectedUser(user);
    setUserActivities([]);
    setUserSearchInput('');
    setUserSearchResults([]);
    setUserFilters({
      action: '',
      startDate: '',
      endDate: '',
      limit: 100,
      page: 1
    });
    setShowUserModal(true);
    
    if (user) {
      setTimeout(() => fetchUserActivities(), 100);
    }
  };

  const closeUserModal = () => {
    setShowUserModal(false);
    setSelectedUser(null);
    setUserActivities([]);
    setUserSearchResults([]);
    setUserSearchInput('');
  };

  const getActionStyle = (action) => {
    const s = ACTION_LABELS[action] || { icon: '•', label: action, color: '#6b7280' };
    return s;
  };

  const getRoleStyle = (role) => {
    return ROLE_LABELS[role] || { label: role, color: '#6b7280' };
  };

  // Close modal on Escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && showUserModal) {
        closeUserModal();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showUserModal]);

  // Close modal on overlay click
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      closeUserModal();
    }
  };



  return (
    <div className="students-activity-page">
      <div className="sa-header">
        <h1>📊 Activity</h1>
        <p className="sa-subtitle">Logins, video views, assessments. Default: students. Use role filter for teachers/admins.</p>
      </div>

      {/* Stats Cards */}
      <div className="sa-stats-grid">
        <div className="sa-stat-card">
          <span className="sa-stat-icon">🔐</span>
          <div>
            <span className="sa-stat-value">{stats.loginsToday}</span>
            <span className="sa-stat-label">Logins today</span>
          </div>
        </div>
        <div className="sa-stat-card">
          <span className="sa-stat-icon">�</span>
          <div>
            <span className="sa-stat-value">{stats.videoViews}</span>
            <span className="sa-stat-label">Video views</span>
          </div>
        </div>
        <div className="sa-stat-card">
          <span className="sa-stat-icon">👥</span>
          <div>
            <span className="sa-stat-value">{stats.uniqueUsers}</span>
            <span className="sa-stat-label">Unique users</span>
          </div>
        </div>
        <div className="sa-stat-card">
          <span className="sa-stat-icon">📋</span>
          <div>
            <span className="sa-stat-value">{total}</span>
            <span className="sa-stat-label">Total events</span>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="sa-toolbar">
        <div className="sa-filters">
          <select
            value={filters.role}
            onChange={(e) => setFilters(f => ({ ...f, role: e.target.value }))}
            className="sa-select"
          >
            <option value="student">Students</option>
            <option value="teacher">Teachers</option>
            <option value="admin">Admins</option>
            <option value="">All roles</option>
          </select>
          <select
            value={filters.action}
            onChange={(e) => setFilters(f => ({ ...f, action: e.target.value }))}
            className="sa-select"
          >
            <option value="">All actions</option>
            <option value="login">Login</option>
            <option value="video_view">Video view</option>
            <option value="assessment_submit">Assessment submit</option>
            <option value="page_view">Page view</option>
            <option value="logout">Logout</option>
          </select>
          <select
            value={filters.limit}
            onChange={(e) => setFilters(f => ({ ...f, limit: Number(e.target.value) }))}
            className="sa-select"
          >
            <option value={50}>50 rows</option>
            <option value={100}>100 rows</option>
            <option value={200}>200 rows</option>
            <option value={500}>500 rows</option>
          </select>
          <input
            type="text"
            placeholder="Search user, email, IP, city, country, video..."
            value={filters.search}
            onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
            className="sa-search-input"
          />
        </div>
        <div className="sa-actions">
          <label className="sa-auto-refresh">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh (30s)
          </label>
          <button onClick={() => openUserModal()} className="sa-btn sa-btn-secondary">
            👤 User Activity
          </button>
          <button onClick={fetchActivities} disabled={loading} className="sa-btn sa-btn-secondary">
            🔄 Refresh
          </button>
          <button onClick={handleExportCSV} disabled={loading || filteredActivities.length === 0} className="sa-btn sa-btn-primary">
            📥 Export CSV
          </button>
        </div>
      </div>

      {/* Activity Graph Section */}
      {showGraph && (
        <div className="sa-graph-section">
          <div className="sa-graph-header">
            <div className="sa-graph-title">
              <h3>📈 Activity Visualization</h3>
              <p>Visualize platform activity patterns and trends</p>
            </div>
            <div className="sa-graph-controls">
              <div className="sa-graph-view-toggle">
                <button
                  className={`sa-graph-btn ${graphView === 'daily' ? 'active' : ''}`}
                  onClick={() => setGraphView('daily')}
                >
                  Daily
                </button>
                <button
                  className={`sa-graph-btn ${graphView === 'hourly' ? 'active' : ''}`}
                  onClick={() => setGraphView('hourly')}
                >
                  Hourly
                </button>
                <button
                  className={`sa-graph-btn ${graphView === 'distribution' ? 'active' : ''}`}
                  onClick={() => setGraphView('distribution')}
                >
                  Distribution
                </button>
              </div>
              <button
                className="sa-graph-toggle-btn"
                onClick={() => setShowGraph(false)}
              >
                × Hide Graph
              </button>
            </div>
          </div>

          <div className="sa-graph-content">
            {(() => {
              const { dailyData, hourlyData, actionDistribution } = processActivityData();
              
              if (graphView === 'daily') {
                return (
                  <div className="sa-daily-graph">
                    <div className="sa-graph-bars">
                      {dailyData.map((day, index) => {
                        const maxValue = Math.max(...dailyData.map(d => d.total));
                        const heightPercentage = maxValue > 0 ? (day.total / maxValue) * 100 : 0;
                        const isHovered = hoveredBar === index;
                        const isSelected = selectedDate === index;
                        
                        return (
                          <div 
                            key={index} 
                            className="sa-bar-container"
                            onMouseEnter={() => setHoveredBar(index)}
                            onMouseLeave={() => setHoveredBar(null)}
                            onClick={() => setSelectedDate(selectedDate === index ? null : index)}
                          >
                            <div className="sa-bar-wrapper">
                              {/* Enhanced stacked bar chart */}
                              <div
                                className={`sa-bar sa-bar-total ${isHovered ? 'hovered' : ''} ${isSelected ? 'selected' : ''}`}
                                style={{ height: `${heightPercentage}%` }}
                                title={`${day.date}: ${day.total} activities`}
                              >
                                {day.total > 0 && (
                                  <span className="sa-bar-value">{day.total}</span>
                                )}
                              </div>
                              
                              {/* Activity breakdown segments */}
                              <div className="sa-bar-breakdown">
                                {day.logins > 0 && (
                                  <div
                                    className="sa-bar-segment sa-bar-logins"
                                    style={{ 
                                      height: `${(day.logins / day.total) * 100}%`,
                                      bottom: 0
                                    }}
                                    title={`Logins: ${day.logins}`}
                                  />
                                )}
                                {day.videoViews > 0 && (
                                  <div
                                    className="sa-bar-segment sa-bar-video-views"
                                    style={{ 
                                      height: `${(day.videoViews / day.total) * 100}%`,
                                      bottom: `${(day.logins / day.total) * 100}%`
                                    }}
                                    title={`Video views: ${day.videoViews}`}
                                  />
                                )}
                                {day.assessments > 0 && (
                                  <div
                                    className="sa-bar-segment sa-bar-assessments"
                                    style={{ 
                                      height: `${(day.assessments / day.total) * 100}%`,
                                      bottom: `${((day.logins + day.videoViews) / day.total) * 100}%`
                                    }}
                                    title={`Assessments: ${day.assessments}`}
                                  />
                                )}
                              </div>
                              
                              {/* Enhanced tooltip */}
                              {isHovered && (
                                <div className="sa-bar-tooltip">
                                  <div className="sa-tooltip-header">{day.date}</div>
                                  <div className="sa-tooltip-content">
                                    <div className="sa-tooltip-row">
                                      <span className="sa-tooltip-label">Total:</span>
                                      <span className="sa-tooltip-value">{day.total}</span>
                                    </div>
                                    {day.logins > 0 && (
                                      <div className="sa-tooltip-row">
                                        <span className="sa-tooltip-label sa-tooltip-logins">🔐 Logins:</span>
                                        <span className="sa-tooltip-value">{day.logins}</span>
                                      </div>
                                    )}
                                    {day.videoViews > 0 && (
                                      <div className="sa-tooltip-row">
                                        <span className="sa-tooltip-label sa-tooltip-video">📹 Video Views:</span>
                                        <span className="sa-tooltip-value">{day.videoViews}</span>
                                      </div>
                                    )}
                                    {day.assessments > 0 && (
                                      <div className="sa-tooltip-row">
                                        <span className="sa-tooltip-label sa-tooltip-assessment">✏️ Assessments:</span>
                                        <span className="sa-tooltip-value">{day.assessments}</span>
                                      </div>
                                    )}
                                    <div className="sa-tooltip-row">
                                      <span className="sa-tooltip-label">👥 Users:</span>
                                      <span className="sa-tooltip-value">{day.uniqueUsers}</span>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className={`sa-bar-label ${isSelected ? 'selected' : ''}`}>{day.date}</div>
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Enhanced legend with statistics */}
                    <div className="sa-graph-legend">
                      <div className="sa-legend-item">
                        <div className="sa-legend-color sa-bar-total"></div>
                        <span>Total Activities</span>
                      </div>
                      <div className="sa-legend-item">
                        <div className="sa-legend-color sa-bar-logins"></div>
                        <span>Logins</span>
                      </div>
                      <div className="sa-legend-item">
                        <div className="sa-legend-color sa-bar-video-views"></div>
                        <span>Video Views</span>
                      </div>
                      <div className="sa-legend-item">
                        <div className="sa-legend-color sa-bar-assessments"></div>
                        <span>Assessments</span>
                      </div>
                    </div>
                    
                    {/* Selected date details */}
                    {selectedDate !== null && dailyData[selectedDate] && (
                      <div className="sa-selected-details">
                        <h4>📊 {dailyData[selectedDate].date} - Detailed Breakdown</h4>
                        <div className="sa-details-grid">
                          <div className="sa-detail-card">
                            <div className="sa-detail-icon">🔐</div>
                            <div className="sa-detail-info">
                              <div className="sa-detail-value">{dailyData[selectedDate].logins}</div>
                              <div className="sa-detail-label">Logins</div>
                            </div>
                          </div>
                          <div className="sa-detail-card">
                            <div className="sa-detail-icon">📹</div>
                            <div className="sa-detail-info">
                              <div className="sa-detail-value">{dailyData[selectedDate].videoViews}</div>
                              <div className="sa-detail-label">Video Views</div>
                            </div>
                          </div>
                          <div className="sa-detail-card">
                            <div className="sa-detail-icon">✏️</div>
                            <div className="sa-detail-info">
                              <div className="sa-detail-value">{dailyData[selectedDate].assessments}</div>
                              <div className="sa-detail-label">Assessments</div>
                            </div>
                          </div>
                          <div className="sa-detail-card">
                            <div className="sa-detail-icon">👥</div>
                            <div className="sa-detail-info">
                              <div className="sa-detail-value">{dailyData[selectedDate].uniqueUsers}</div>
                              <div className="sa-detail-label">Unique Users</div>
                            </div>
                          </div>
                        </div>
                        <button 
                          className="sa-clear-selection"
                          onClick={() => setSelectedDate(null)}
                        >
                          ✕ Clear Selection
                        </button>
                      </div>
                    )}
                  </div>
                );
              } else if (graphView === 'hourly') {
                return (
                  <div className="sa-hourly-graph">
                    <div className="sa-hourly-bars">
                      {hourlyData.map((hour, index) => {
                        const maxValue = Math.max(...hourlyData.map(h => h.total));
                        const heightPercentage = maxValue > 0 ? (hour.total / maxValue) * 100 : 0;
                        
                        return (
                          <div key={index} className="sa-hourly-bar-container">
                            <div
                              className="sa-hourly-bar"
                              style={{ height: `${heightPercentage}%` }}
                              title={`${hour.time}: ${hour.total} activities`}
                            >
                              <span className="sa-hourly-value">{hour.total}</span>
                            </div>
                            <div className="sa-hourly-label">{hour.time}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              } else {
                return (
                  <div className="sa-distribution-graph">
                    <div className="sa-distribution-bars">
                      {actionDistribution.map((item, index) => {
                        const maxCount = Math.max(...actionDistribution.map(d => d.count));
                        const widthPercentage = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
                        
                        return (
                          <div key={index} className="sa-distribution-item">
                            <div className="sa-distribution-label">
                              <span className="sa-distribution-icon">{item.icon}</span>
                              <span className="sa-distribution-name">{item.label}</span>
                            </div>
                            <div className="sa-distribution-bar-wrapper">
                              <div
                                className="sa-distribution-bar"
                                style={{ 
                                  width: `${widthPercentage}%`,
                                  backgroundColor: item.color 
                                }}
                              />
                            </div>
                            <div className="sa-distribution-stats">
                              <span className="sa-distribution-count">{item.count}</span>
                              <span className="sa-distribution-percentage">{item.percentage}%</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              }
            })()}
          </div>
        </div>
      )}

      {!showGraph && (
        <div className="sa-graph-show-wrapper">
          <button 
            className="sa-graph-show-btn"
            onClick={() => setShowGraph(true)}
          >
            📈 Show Activity Graph
          </button>
        </div>
      )}

      {/* Loading and Error States */}
      {loading && (
        <div className="sa-loading">
          <div className="sa-loading-spinner"></div>
          Loading activity data...
        </div>
      )}
      
      {error && (
        <div className="sa-error">
          <strong>Error:</strong> {error}
          <button onClick={fetchActivities} className="sa-btn sa-btn-secondary">Retry</button>
        </div>
      )}

      {/* Activities Table */}
      {!loading && !error && (
        <div className="sa-table-wrapper">
          <table className="sa-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Action</th>
                <th>Details</th>
                <th>Location</th>
              </tr>
            </thead>
            <tbody>
              {filteredActivities.length === 0 ? (
                <tr>
                  <td colSpan={5} className="sa-empty-state">
                    {filters.search || filters.action || filters.role 
                      ? 'No activities match your filters.' 
                      : 'No activities found.'}
                  </td>
                </tr>
              ) : (
                filteredActivities.map((a, i) => {
                  const isExpanded = expandedId === a.id;
                  const actionStyle = getActionStyle(a.action);
                  const roleStyle = getRoleStyle(a.userRole);
                  
                  return (
                    <React.Fragment key={a.id || i}>
                      <tr 
                        className={`sa-row ${isExpanded ? 'expanded' : ''}`}
                        onClick={() => setExpandedId(isExpanded ? null : a.id)}
                      >
                        <td className="sa-time">{formatDateTimeDisplay(a.timestamp)}</td>
                        <td className="sa-user-cell">
                          <div className="sa-user-info">
                            <div className="sa-user-name">{a.userName || 'Unknown'}</div>
                            <div className="sa-user-email">{a.userEmail || '—'}</div>
                            <span className="sa-role" style={{ background: `${roleStyle.color}22`, color: roleStyle.color }}>
                              {roleStyle.label}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className="sa-action" style={{ background: `${actionStyle.color}22`, color: actionStyle.color }}>
                            {actionStyle.icon} {actionStyle.label}
                          </span>
                        </td>
                        <td className="sa-details-cell">
                          {a.action === 'video_view' && a.videoTitle && (
                            <span className="sa-detail">📹 {a.videoTitle}</span>
                          )}
                          {a.action === 'assessment_submit' && (
                            <span className="sa-detail">
                              ✏️ {a.assessmentTitle || 'Assessment'} {a.score != null && `(${a.score})`}
                            </span>
                          )}
                          {a.action === 'login' && <span className="sa-detail">—</span>}
                          {!['login', 'video_view', 'assessment_submit'].includes(a.action) && <span className="sa-detail">—</span>}
                        </td>
                        <td className="sa-location-cell">
                          <div className="sa-location">
                            {[a.city, a.country].filter(Boolean).join(', ') || '—'}
                            {a.ipAddress && <small className="sa-location-ip">IP: {a.ipAddress}</small>}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="sa-detail-row">
                          <td colSpan={5}>
                            <div className="sa-full-details">
                              <h4>Full activity details</h4>
                              <div className="sa-detail-grid">
                                <div className="sa-detail-item"><label>Timestamp</label><span>{new Date(a.timestamp).toISOString()}</span></div>
                                <div className="sa-detail-item"><label>User ID</label><span>{a.userId || '—'}</span></div>
                                <div className="sa-detail-item"><label>User Name</label><span>{a.userName || '—'}</span></div>
                                <div className="sa-detail-item"><label>Email</label><span>{a.userEmail || '—'}</span></div>
                                <div className="sa-detail-item"><label>Role</label><span>{a.userRole || '—'}</span></div>
                                <div className="sa-detail-item"><label>Action</label><span>{a.action || '—'}</span></div>
                                <div className="sa-detail-item"><label>IP Address</label><span><code>{a.ipAddress || '—'}</code></span></div>
                                <div className="sa-detail-item"><label>City</label><span>{a.city || '—'}</span></div>
                                <div className="sa-detail-item"><label>Country</label><span>{a.country || '—'}</span></div>
                                <div className="sa-detail-item"><label>ISP</label><span>{a.isp || '—'}</span></div>
                                {a.videoId && <div className="sa-detail-item"><label>Video ID</label><span>{a.videoId}</span></div>}
                                {a.videoTitle && <div className="sa-detail-item"><label>Video Title</label><span>{a.videoTitle}</span></div>}
                                {a.assessmentId && <div className="sa-detail-item"><label>Assessment ID</label><span>{a.assessmentId}</span></div>}
                                {a.assessmentTitle && <div className="sa-detail-item"><label>Assessment Title</label><span>{a.assessmentTitle}</span></div>}
                                {a.score != null && <div className="sa-detail-item"><label>Score</label><span>{a.score}</span></div>}
                                {a.path && <div className="sa-detail-item"><label>Path</label><span>{a.path}</span></div>}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
      {!loading && filteredActivities.length > 0 && (
        <div className="sa-footer">
          Showing {filteredActivities.length} of {total} events • Click a row to expand full details
        </div>
      )}

      {/* User Activity Modal */}
      {showUserModal && (
        <div className="sa-modal-overlay" onClick={handleOverlayClick}>
          <div 
            className="sa-modal" 
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <div className="sa-modal-header">
              <h3 id="modal-title">👤 Individual User Activity</h3>
              <button 
                onClick={closeUserModal} 
                className="sa-modal-close"
                aria-label="Close modal"
              >
                ×
              </button>
            </div>
            
            <div className="sa-modal-body">
              {!selectedUser ? (
                <div className="sa-user-search">
                  <h4>Search for a user</h4>
                  <input
                    type="text"
                    placeholder="Type name, email, or enrollment number..."
                    value={userSearchInput}
                    onChange={(e) => {
                      const value = e.target.value;
                      setUserSearchInput(value);
                      if (value.length >= 2) {
                        debouncedSearch(value);
                      } else if (value.length === 0) {
                        setUserSearchResults([]);
                      }
                    }}
                    className="sa-search-input"
                  />
                  {userSearchLoading && <div className="sa-loading-small">Searching...</div>}
                  {userSearchResults.length > 0 && (
                    <div className="sa-search-results">
                      {userSearchResults.map(user => (
                        <div 
                          key={user.id}
                          className="sa-user-result"
                          onClick={() => {
                            setSelectedUser(user);
                            setUserSearchInput('');
                            setUserSearchResults([]);
                          }}
                        >
                          <div className="sa-user-info">
                            <strong>{user.name}</strong>
                            <small>{user.email}</small>
                            <span className="sa-user-meta">
                              {user.role} • {user.activityCount} activities
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="sa-user-activity">
                  <div className="sa-user-header">
                    <div className="sa-user-details">
                      <h4>{selectedUser.name}</h4>
                      <p>{selectedUser.email} • {selectedUser.role}</p>
                      {selectedUser.course && <span className="sa-user-course">Course: {selectedUser.course}</span>}
                    </div>
                    <div className="sa-user-actions">
                      <button 
                        onClick={() => handleUserExport('csv')}
                        className="sa-btn sa-btn-primary"
                      >
                        📥 Export CSV
                      </button>
                      <button 
                        onClick={() => handleUserExport('json')}
                        className="sa-btn sa-btn-secondary"
                      >
                        📄 Export JSON
                      </button>
                      <button 
                        onClick={() => setSelectedUser(null)}
                        className="sa-btn sa-btn-secondary"
                      >
                        ← Change User
                      </button>
                    </div>
                  </div>

                  <div className="sa-user-filters">
                    <select
                      value={userFilters.action}
                      onChange={(e) => setUserFilters(f => ({ ...f, action: e.target.value }))}
                      className="sa-select"
                    >
                      <option value="">All actions</option>
                      <option value="login">Login</option>
                      <option value="video_view">Video view</option>
                      <option value="assessment_submit">Assessment submit</option>
                      <option value="page_view">Page view</option>
                      <option value="logout">Logout</option>
                    </select>
                    <input
                      type="date"
                      value={userFilters.startDate}
                      onChange={(e) => setUserFilters(f => ({ ...f, startDate: e.target.value }))}
                      className="sa-date-input"
                      placeholder="Start date"
                    />
                    <input
                      type="date"
                      value={userFilters.endDate}
                      onChange={(e) => setUserFilters(f => ({ ...f, endDate: e.target.value }))}
                      className="sa-date-input"
                      placeholder="End date"
                    />
                    <select
                      value={userFilters.limit}
                      onChange={(e) => setUserFilters(f => ({ ...f, limit: Number(e.target.value), page: 1 }))}
                      className="sa-select"
                    >
                      <option value={50}>50 rows</option>
                      <option value={100}>100 rows</option>
                      <option value={200}>200 rows</option>
                      <option value={500}>500 rows</option>
                    </select>
                  </div>

                  {userActivitiesLoading ? (
                    <div className="sa-loading">Loading user activities...</div>
                  ) : userActivities.length === 0 ? (
                    <div className="sa-empty">No activities found for this user.</div>
                  ) : (
                    <div className="sa-user-table-wrapper">
                      <table className="sa-table">
                        <thead>
                          <tr>
                            <th>Time</th>
                            <th>Action</th>
                            <th>Details</th>
                            <th>Location</th>
                          </tr>
                        </thead>
                        <tbody>
                          {userActivities.map((a, i) => {
                            const actionStyle = getActionStyle(a.action);
                            return (
                              <tr key={`user-activity-${i}`}>
                                <td className="sa-time">{formatDateTimeDisplay(a.timestamp)}</td>
                                <td>
                                  <span className="sa-action" style={{ background: `${actionStyle.color}22`, color: actionStyle.color }}>
                                    {actionStyle.icon} {actionStyle.label}
                                  </span>
                                </td>
                                <td className="sa-details-cell">
                                  {a.action === 'video_view' && a.videoTitle && (
                                    <span className="sa-detail">📹 {a.videoTitle}</span>
                                  )}
                                  {a.action === 'assessment_submit' && (
                                    <span className="sa-detail">
                                      ✏️ {a.assessmentTitle || 'Assessment'} {a.score != null && `(${a.score})`}
                                    </span>
                                  )}
                                  {a.action === 'login' && <span className="sa-detail">—</span>}
                                  {!['login', 'video_view', 'assessment_submit'].includes(a.action) && <span className="sa-detail">—</span>}
                                </td>
                                <td className="sa-location-cell">
                                  <div className="sa-location">
                                    {[a.city, a.country].filter(Boolean).join(', ') || '—'}
                                    {a.ipAddress && <small className="sa-location-ip">IP: {a.ipAddress}</small>}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      
                      {userPagination.pages > 1 && (
                        <div className="sa-pagination">
                          <button 
                            onClick={() => setUserFilters(f => ({ ...f, page: Math.max(1, f.page - 1) }))}
                            disabled={userFilters.page <= 1}
                            className="sa-btn sa-btn-secondary"
                          >
                            Previous
                          </button>
                          <span className="sa-page-info">
                            Page {userFilters.page} of {userPagination.pages} ({userPagination.total} total)
                          </span>
                          <button 
                            onClick={() => setUserFilters(f => ({ ...f, page: Math.min(userPagination.pages, f.page + 1) }))}
                            disabled={userFilters.page >= userPagination.pages}
                            className="sa-btn sa-btn-secondary"
                          >
                            Next 
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentsActivity;
