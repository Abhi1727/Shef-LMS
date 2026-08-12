/**
 * Students Activity - Comprehensive activity dashboard for admin
 * Shows every detail: logins, video views, assessments with full metadata
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { formatDateTimeDisplay, formatDateForComponent } from '../utils/dateUtils';
import './StudentsActivity.css';

const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';

const ACTION_LABELS = {
  login: { icon: '🔐', label: 'Login', color: '#10b981' },
  logout: { icon: '🚪', label: 'Logout', color: '#ef4444' },
  video_view: { icon: '📹', label: 'Lecture watched', color: '#3b82f6' },
  assessment_submit: { icon: '✏️', label: 'Assessment submitted', color: '#8b5cf6' },
  page_view: { icon: '📄', label: 'Page view', color: '#6b7280' },
  password_change: { icon: '🔑', label: 'Password changed', color: '#f59e0b' },
  password_reset: { icon: '🔄', label: 'Password reset', color: '#f97316' },
  resource_download: { icon: '📥', label: 'Resource download', color: '#06b6d4' }
};

const CHART_COLORS = {
  total: '#0b3d4a',
  logins: '#0b3d4a',      // deep brand navy-teal
  videoViews: '#2f6fed',  // clear professional blue
  assessments: '#c27803', // warm amber (high contrast)
  grid: '#e8eef1',
  axis: '#5a6d76',
  cursor: 'rgba(11, 61, 74, 0.07)'
};

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload || {};
  return (
    <div className="sa-chart-tooltip">
      <div className="sa-chart-tooltip__title">{label || row.label || row.time || row.date}</div>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="sa-chart-tooltip__row">
          <span style={{ color: entry.color || entry.fill }}>{entry.name}</span>
          <strong>{entry.value}</strong>
        </div>
      ))}
      {typeof row.uniqueUsers === 'number' && (
        <div className="sa-chart-tooltip__row">
          <span>Unique users</span>
          <strong>{row.uniqueUsers}</strong>
        </div>
      )}
    </div>
  );
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
    startDate: '',
    endDate: '',
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
    if (filters.startDate) {
      const start = new Date(`${filters.startDate}T00:00:00`);
      if (new Date(a.timestamp) < start) return false;
    }
    if (filters.endDate) {
      const end = new Date(`${filters.endDate}T23:59:59`);
      if (new Date(a.timestamp) > end) return false;
    }
    if (!filters.search.trim()) return true;
    const s = filters.search.toLowerCase();
    return (
      (a.userName || '').toLowerCase().includes(s) ||
      (a.userEmail || '').toLowerCase().includes(s) ||
      (a.ipAddress || '').includes(s) ||
      (a.city || '').toLowerCase().includes(s) ||
      (a.country || '').toLowerCase().includes(s) ||
      (a.videoTitle || '').toLowerCase().includes(s) ||
      (a.assessmentTitle || '').toLowerCase().includes(s) ||
      (a.action || '').toLowerCase().includes(s)
    );
  });

  const candidateSummary = React.useMemo(() => {
    const list = userActivities || [];
    if (!list.length) {
      return {
        lastLogin: null,
        lastSeen: null,
        logins: 0,
        videos: 0,
        assessments: 0,
        passwordEvents: 0,
        locations: [],
        ips: []
      };
    }
    const logins = list.filter((a) => a.action === 'login');
    const videos = list.filter((a) => a.action === 'video_view');
    const assessments = list.filter((a) => a.action === 'assessment_submit');
    const passwordEvents = list.filter((a) => a.action === 'password_change' || a.action === 'password_reset');
    const ips = [...new Set(list.map((a) => a.ipAddress).filter(Boolean))];
    const locations = [...new Set(
      list.map((a) => [a.city, a.country].filter(Boolean).join(', ')).filter(Boolean)
    )];
    const sorted = [...list].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const lastLogin = [...logins].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0] || null;
    return {
      lastLogin,
      lastSeen: sorted[0] || null,
      logins: logins.length,
      videos: videos.length,
      assessments: assessments.length,
      passwordEvents: passwordEvents.length,
      locations: locations.slice(0, 8),
      ips: ips.slice(0, 8)
    };
  }, [userActivities]);

  const stats = React.useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6).getTime();
    const loginsToday = activities.filter(a => a.action === 'login' && new Date(a.timestamp).getTime() >= todayStart).length;
    const videoViews = activities.filter(a => a.action === 'video_view').length;
    const assessments = activities.filter(a => a.action === 'assessment_submit').length;
    const uniqueUsers = new Set(activities.map(a => a.userId || a.userEmail).filter(Boolean)).size;
    const activeThisWeek = new Set(
      activities
        .filter(a => new Date(a.timestamp).getTime() >= weekStart)
        .map(a => a.userId || a.userEmail)
        .filter(Boolean)
    ).size;
    const uniqueIps = new Set(activities.map(a => a.ipAddress).filter(Boolean)).size;
    const byAction = activities.reduce((acc, a) => {
      acc[a.action] = (acc[a.action] || 0) + 1;
      return acc;
    }, {});
    return { loginsToday, videoViews, assessments, uniqueUsers, activeThisWeek, uniqueIps, byAction };
  }, [activities]);

  // Process activity data for graph visualization
  const chartData = useMemo(() => {
    if (!activities.length) return { dailyData: [], hourlyData: [], actionDistribution: [] };

    const dailyData = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dateStart = new Date(date).setHours(0, 0, 0, 0);
      const dateEnd = new Date(date).setHours(23, 59, 59, 999);

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
        hour,
        time: `${hour.toString().padStart(2, '0')}:00`,
        total: hourActivities.length,
        logins: hourActivities.filter(a => a.action === 'login').length,
        videoViews: hourActivities.filter(a => a.action === 'video_view').length,
        assessments: hourActivities.filter(a => a.action === 'assessment_submit').length
      });
    }

    const actionCounts = activities.reduce((acc, a) => {
      acc[a.action] = (acc[a.action] || 0) + 1;
      return acc;
    }, {});

    const actionDistribution = Object.entries(actionCounts).map(([action, count]) => ({
      action,
      name: (ACTION_LABELS[action] && ACTION_LABELS[action].label) || action,
      label: (ACTION_LABELS[action] && ACTION_LABELS[action].label) || action,
      icon: (ACTION_LABELS[action] && ACTION_LABELS[action].icon) || '•',
      color: (ACTION_LABELS[action] && ACTION_LABELS[action].color) || '#6b7280',
      count,
      percentage: Number(((count / activities.length) * 100).toFixed(1))
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
      const params = new URLSearchParams({ email: query, limit: 10 });
      const res = await fetch(`${API_BASE}/api/admin/users/search?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to search users');
      const data = await res.json();
      setUserSearchResults(Array.isArray(data) ? data : (data.users || []));
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
      
      const res = await fetch(`${API_BASE}/api/admin/activity/${selectedUser.id}?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load user activity');
      const data = await res.json();
      setUserActivities(data.activities || []);
      setUserPagination({
        total: data.pagination?.total || data.total || 0,
        pages: data.pagination?.pages || data.pages || 0
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
      const params = new URLSearchParams({ export: format === 'json' ? 'json' : 'csv' });
      if (userFilters.action) params.set('action', userFilters.action);
      if (userFilters.startDate) params.set('startDate', userFilters.startDate);
      if (userFilters.endDate) params.set('endDate', userFilters.endDate);
      
      const res = await fetch(`${API_BASE}/api/admin/activity/${selectedUser.id}?${params}`, {
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
        <p className="sa-eyebrow">Monitoring</p>
        <h1>Candidate Activity</h1>
        <p className="sa-subtitle">
          One place to monitor candidate logins, lecture views, assessments, password events, and locations.
          Click a candidate name to open their full activity dossier.
        </p>
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
          <span className="sa-stat-icon">👤</span>
          <div>
            <span className="sa-stat-value">{stats.activeThisWeek}</span>
            <span className="sa-stat-label">Active candidates (7d)</span>
          </div>
        </div>
        <div className="sa-stat-card">
          <span className="sa-stat-icon">📹</span>
          <div>
            <span className="sa-stat-value">{stats.videoViews}</span>
            <span className="sa-stat-label">Lecture views</span>
          </div>
        </div>
        <div className="sa-stat-card">
          <span className="sa-stat-icon">✏️</span>
          <div>
            <span className="sa-stat-value">{stats.assessments}</span>
            <span className="sa-stat-label">Assessments</span>
          </div>
        </div>
        <div className="sa-stat-card">
          <span className="sa-stat-icon">🌐</span>
          <div>
            <span className="sa-stat-value">{stats.uniqueIps}</span>
            <span className="sa-stat-label">Unique IPs</span>
          </div>
        </div>
        <div className="sa-stat-card">
          <span className="sa-stat-icon">📋</span>
          <div>
            <span className="sa-stat-value">{total}</span>
            <span className="sa-stat-label">Events loaded</span>
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
            <option value="logout">Logout</option>
            <option value="video_view">Lecture view</option>
            <option value="assessment_submit">Assessment submit</option>
            <option value="password_change">Password change</option>
            <option value="password_reset">Password reset</option>
            <option value="page_view">Page view</option>
          </select>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => setFilters(f => ({ ...f, startDate: e.target.value }))}
            className="sa-select"
            title="From date"
          />
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilters(f => ({ ...f, endDate: e.target.value }))}
            className="sa-select"
            title="To date"
          />
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
            👤 Inspect candidate
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
              <h3>Activity visualization</h3>
              <p>Platform activity patterns across logins, lectures, and assessments</p>
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
                Hide graph
              </button>
            </div>
          </div>

          <div className="sa-graph-content">
            {(() => {
              const { dailyData, hourlyData, actionDistribution } = chartData;

              if (!activities.length) {
                return (
                  <div className="sa-chart-empty">
                    <p>No activity yet to visualize.</p>
                    <span>Events will appear here as candidates log in, watch lectures, and submit assessments.</span>
                  </div>
                );
              }

              if (graphView === 'daily') {
                return (
                  <div className="sa-daily-graph">
                    <div className="sa-chart-canvas sa-chart-canvas--bars">
                      <ResponsiveContainer width="100%" height={340}>
                        <BarChart
                          data={dailyData}
                          margin={{ top: 16, right: 8, left: -8, bottom: 4 }}
                          barCategoryGap="8%"
                          barGap={0}
                          onClick={(state) => {
                            if (state && state.activeTooltipIndex != null) {
                              setSelectedDate(
                                selectedDate === state.activeTooltipIndex ? null : state.activeTooltipIndex
                              );
                            }
                          }}
                        >
                          <CartesianGrid strokeDasharray="2 6" stroke={CHART_COLORS.grid} vertical={false} />
                          <XAxis
                            dataKey="date"
                            tick={{ fill: CHART_COLORS.axis, fontSize: 11, fontWeight: 600 }}
                            axisLine={false}
                            tickLine={false}
                            dy={6}
                          />
                          <YAxis
                            allowDecimals={false}
                            tick={{ fill: CHART_COLORS.axis, fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                            width={36}
                          />
                          <Tooltip content={<ChartTooltip />} cursor={{ fill: CHART_COLORS.cursor }} />
                          <Legend
                            wrapperStyle={{ paddingTop: 12, fontSize: 12, fontWeight: 600 }}
                            iconType="circle"
                            iconSize={8}
                          />
                          <Bar dataKey="logins" name="Logins" stackId="a" fill={CHART_COLORS.logins} maxBarSize={112} />
                          <Bar dataKey="videoViews" name="Lectures" stackId="a" fill={CHART_COLORS.videoViews} maxBarSize={112} />
                          <Bar dataKey="assessments" name="Assessments" stackId="a" fill={CHART_COLORS.assessments} radius={[4, 4, 0, 0]} maxBarSize={112} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {selectedDate !== null && dailyData[selectedDate] && (
                      <div className="sa-selected-details">
                        <h4>{dailyData[selectedDate].date} — breakdown</h4>
                        <div className="sa-details-grid">
                          <div className="sa-detail-card">
                            <div className="sa-detail-info">
                              <div className="sa-detail-value">{dailyData[selectedDate].logins}</div>
                              <div className="sa-detail-label">Logins</div>
                            </div>
                          </div>
                          <div className="sa-detail-card">
                            <div className="sa-detail-info">
                              <div className="sa-detail-value">{dailyData[selectedDate].videoViews}</div>
                              <div className="sa-detail-label">Lectures</div>
                            </div>
                          </div>
                          <div className="sa-detail-card">
                            <div className="sa-detail-info">
                              <div className="sa-detail-value">{dailyData[selectedDate].assessments}</div>
                              <div className="sa-detail-label">Assessments</div>
                            </div>
                          </div>
                          <div className="sa-detail-card">
                            <div className="sa-detail-info">
                              <div className="sa-detail-value">{dailyData[selectedDate].uniqueUsers}</div>
                              <div className="sa-detail-label">Unique users</div>
                            </div>
                          </div>
                        </div>
                        <button className="sa-clear-selection" onClick={() => setSelectedDate(null)}>
                          Clear selection
                        </button>
                      </div>
                    )}
                  </div>
                );
              }

              if (graphView === 'hourly') {
                const peak = hourlyData.reduce(
                  (best, h) => (h.total > best.total ? h : best),
                  { total: 0, time: '—' }
                );
                return (
                  <div className="sa-hourly-graph">
                    <div className="sa-chart-meta">
                      <span>Today by hour</span>
                      <strong>Peak: {peak.time} ({peak.total} events)</strong>
                    </div>
                    <div className="sa-chart-canvas">
                      <ResponsiveContainer width="100%" height={320}>
                        <AreaChart data={hourlyData} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
                          <defs>
                            <linearGradient id="saHourlyFill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#2f6fed" stopOpacity={0.32} />
                              <stop offset="100%" stopColor="#2f6fed" stopOpacity={0.02} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
                          <XAxis
                            dataKey="time"
                            interval={2}
                            tick={{ fill: CHART_COLORS.axis, fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis allowDecimals={false} tick={{ fill: CHART_COLORS.axis, fontSize: 12 }} axisLine={false} tickLine={false} />
                          <Tooltip content={<ChartTooltip />} />
                          <Area
                            type="monotone"
                            dataKey="total"
                            name="Activities"
                            stroke={CHART_COLORS.total}
                            strokeWidth={2.5}
                            fill="url(#saHourlyFill)"
                            activeDot={{ r: 5, fill: CHART_COLORS.total }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                );
              }

              return (
                <div className="sa-distribution-graph">
                  <div className="sa-distribution-layout">
                    <div className="sa-chart-canvas sa-chart-canvas--pie">
                      <ResponsiveContainer width="100%" height={280}>
                        <PieChart>
                          <Pie
                            data={actionDistribution}
                            dataKey="count"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={58}
                            outerRadius={96}
                            paddingAngle={2}
                          >
                            {actionDistribution.map((item) => (
                              <Cell key={item.action} fill={item.color} />
                            ))}
                          </Pie>
                          <Tooltip content={<ChartTooltip />} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="sa-distribution-list">
                      {actionDistribution.map((item) => (
                        <div key={item.action} className="sa-distribution-row">
                          <div className="sa-distribution-row__label">
                            <span className="sa-distribution-swatch" style={{ background: item.color }} />
                            <span>{item.label}</span>
                          </div>
                          <div className="sa-distribution-row__bar">
                            <div style={{ width: `${item.percentage}%`, background: item.color }} />
                          </div>
                          <div className="sa-distribution-row__stats">
                            <strong>{item.count}</strong>
                            <span>{item.percentage}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
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
                            <button
                              type="button"
                              className="sa-user-name sa-user-link"
                              title="Inspect candidate activity"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (a.userId) {
                                  openUserModal({
                                    id: a.userId,
                                    name: a.userName,
                                    email: a.userEmail,
                                    role: a.userRole
                                  });
                                }
                              }}
                            >
                              {a.userName || 'Unknown'}
                            </button>
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
              <h3 id="modal-title">Candidate dossier</h3>
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
                  <h4>Find a candidate</h4>
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
                  <div className="sa-candidate-summary">
                    <div className="sa-candidate-identity">
                      <div className="sa-candidate-avatar">
                        {(selectedUser.name || selectedUser.email || 'C').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4>{selectedUser.name || 'Candidate'}</h4>
                        <p>{selectedUser.email || '—'}</p>
                        <span className="sa-role" style={{ background: '#3b82f622', color: '#3b82f6' }}>
                          {selectedUser.role || 'student'}
                        </span>
                      </div>
                    </div>
                    <div className="sa-candidate-kpis">
                      <div><strong>{candidateSummary.logins}</strong><span>Logins</span></div>
                      <div><strong>{candidateSummary.videos}</strong><span>Lectures</span></div>
                      <div><strong>{candidateSummary.assessments}</strong><span>Assessments</span></div>
                      <div><strong>{candidateSummary.passwordEvents}</strong><span>Password events</span></div>
                      <div><strong>{candidateSummary.ips.length}</strong><span>IPs</span></div>
                      <div><strong>{candidateSummary.locations.length}</strong><span>Locations</span></div>
                    </div>
                    <div className="sa-candidate-meta">
                      <div>
                        <label>Last login</label>
                        <span>{candidateSummary.lastLogin ? formatDateTimeDisplay(candidateSummary.lastLogin.timestamp) : '—'}</span>
                      </div>
                      <div>
                        <label>Last activity</label>
                        <span>{candidateSummary.lastSeen ? formatDateTimeDisplay(candidateSummary.lastSeen.timestamp) : '—'}</span>
                      </div>
                      <div>
                        <label>Recent locations</label>
                        <span>{candidateSummary.locations.join(' · ') || '—'}</span>
                      </div>
                      <div>
                        <label>Recent IPs</label>
                        <span>{candidateSummary.ips.join(' · ') || '—'}</span>
                      </div>
                    </div>
                    <div className="sa-user-actions sa-user-actions--dossier">
                      <button onClick={() => handleUserExport('csv')} className="sa-btn sa-btn-primary">Export CSV</button>
                      <button onClick={() => handleUserExport('json')} className="sa-btn sa-btn-secondary">Export JSON</button>
                      <button onClick={() => setSelectedUser(null)} className="sa-btn sa-btn-secondary">Change user</button>
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
