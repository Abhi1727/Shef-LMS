/**
 * Students Activity - Comprehensive activity dashboard for admin
 * Shows every detail: logins, video views, assessments with full metadata
 */
import React, { useState, useEffect, useCallback } from 'react';
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

  const getActionStyle = (action) => {
    const s = ACTION_LABELS[action] || { icon: '•', label: action, color: '#6b7280' };
    return s;
  };

  const getRoleStyle = (role) => {
    return ROLE_LABELS[role] || { label: role, color: '#6b7280' };
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
          <span className="sa-stat-icon">📹</span>
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

      {/* Filters & Actions */}
      <div className="sa-toolbar">
        <div className="sa-filters">
          <input
            type="search"
            placeholder="Search user, email, IP, location..."
            value={filters.search}
            onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
            className="sa-search"
          />
            <select
            value={filters.role}
            onChange={(e) => setFilters(f => ({ ...f, role: e.target.value }))}
            className="sa-select"
          >
            <option value="">All roles</option>
            <option value="student">Students only</option>
            <option value="teacher">Teachers only</option>
            <option value="admin">Admins only</option>
            <option value="mentor">Mentors only</option>
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
        </div>
        <div className="sa-actions">
          <label className="sa-toggle">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh (30s)
          </label>
          <button onClick={fetchActivities} disabled={loading} className="sa-btn sa-btn-secondary">
            {loading ? '⏳ Loading…' : '🔄 Refresh'}
          </button>
          <button onClick={handleExportCSV} disabled={filteredActivities.length === 0} className="sa-btn sa-btn-primary">
            📥 Export CSV
          </button>
        </div>
      </div>

      {/* Activity Table */}
      <div className="sa-table-wrapper">
        {error && (
          <div className="sa-error">
            ⚠️ {error}
          </div>
        )}
        {loading ? (
          <div className="sa-loading">Loading activity…</div>
        ) : filteredActivities.length === 0 ? (
          <div className="sa-empty">No activity found. Logins and video views will appear here.</div>
        ) : (
          <table className="sa-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}></th>
                <th>Time</th>
                <th>User</th>
                <th>Role</th>
                <th>Action</th>
                <th>Details</th>
                <th>IP</th>
                <th>Location</th>
                <th>ISP</th>
              </tr>
            </thead>
            <tbody>
              {filteredActivities.map((a, i) => {
                const actionStyle = getActionStyle(a.action);
                const roleStyle = getRoleStyle(a.userRole);
                const rowId = `row-${i}-${a.timestamp}`;
                const isExpanded = expandedId === rowId;
                return (
                  <React.Fragment key={rowId}>
                    <tr
                      className={`sa-row ${isExpanded ? 'expanded' : ''}`}
                      onClick={() => setExpandedId(isExpanded ? null : rowId)}
                    >
                      <td className="sa-expand">{isExpanded ? '▼' : '▶'}</td>
                      <td className="sa-time">{new Date(a.timestamp).toLocaleString()}</td>
                      <td>
                        <div className="sa-user">
                          <strong>{a.userName || '—'}</strong>
                          <small>{a.userEmail || ''}</small>
                        </div>
                      </td>
                      <td>
                        <span className="sa-role" style={{ background: `${roleStyle.color}22`, color: roleStyle.color }}>
                          {roleStyle.label}
                        </span>
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
                      <td className="sa-ip-cell"><code className="sa-ip">{a.ipAddress || '—'}</code></td>
                      <td className="sa-location-cell">{[a.city, a.country].filter(Boolean).join(', ') || '—'}</td>
                      <td className="sa-isp-cell">{a.isp || '—'}</td>
                    </tr>
                    {isExpanded && (
                      <tr className="sa-detail-row">
                        <td colSpan={9}>
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
              })}
            </tbody>
          </table>
        )}
      </div>
      {!loading && filteredActivities.length > 0 && (
        <div className="sa-footer">
          Showing {filteredActivities.length} of {total} events • Click a row to expand full details
        </div>
      )}
    </div>
  );
};

export default StudentsActivity;
