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
  const searchUsers = async (query) => {
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
  };

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
          <button onClick={() => openUserModal()} className="sa-btn sa-btn-secondary">
            👤 User Activity
          </button>
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
                <th>Actions</th>
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
                      <td className="sa-actions-cell">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            openUserModal({
                              id: a.userId,
                              name: a.userName,
                              email: a.userEmail,
                              role: a.userRole
                            });
                          }}
                          className="sa-btn-small"
                          title="View user activity"
                        >
                          📥
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="sa-detail-row">
                        <td colSpan={10}>
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

      {/* User Activity Modal */}
      {showUserModal && (
        <div className="sa-modal-overlay" onClick={closeUserModal}>
          <div className="sa-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sa-modal-header">
              <h3>👤 Individual User Activity</h3>
              <button onClick={closeUserModal} className="sa-modal-close">×</button>
            </div>
            
            <div className="sa-modal-body">
              {!selectedUser ? (
                <div className="sa-user-search">
                  <h4>Search for a user</h4>
                  <input
                    type="text"
                    placeholder="Type name, email, or enrollment number..."
                    onChange={(e) => searchUsers(e.target.value)}
                    className="sa-search-input"
                  />
                  {userSearchLoading && <div className="sa-loading-small">Searching...</div>}
                  {userSearchResults.length > 0 && (
                    <div className="sa-search-results">
                      {userSearchResults.map(user => (
                        <div 
                          key={user.id}
                          className="sa-user-result"
                          onClick={() => setSelectedUser(user)}
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
                            <th>IP</th>
                            <th>Location</th>
                          </tr>
                        </thead>
                        <tbody>
                          {userActivities.map((a, i) => {
                            const actionStyle = getActionStyle(a.action);
                            return (
                              <tr key={`user-activity-${i}`}>
                                <td className="sa-time">{new Date(a.timestamp).toLocaleString()}</td>
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
                            ← Previous
                          </button>
                          <span className="sa-page-info">
                            Page {userFilters.page} of {userPagination.pages} ({userPagination.total} total)
                          </span>
                          <button 
                            onClick={() => setUserFilters(f => ({ ...f, page: Math.min(userPagination.pages, f.page + 1) }))}
                            disabled={userFilters.page >= userPagination.pages}
                            className="sa-btn sa-btn-secondary"
                          >
                            Next →
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
