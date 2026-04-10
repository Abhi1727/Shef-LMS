import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { analyticsService, analyticsUtils } from '../services/analyticsService';
import './Dashboard.css';

const StudentAnalyticsDashboard = () => {
  const navigate = useNavigate();
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [particles, setParticles] = useState([]);
  const [geometricShapes, setGeometricShapes] = useState([]);

  // Generate particles for hero background
  useEffect(() => {
    const newParticles = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 4 + 2,
      duration: Math.random() * 20 + 10,
      delay: Math.random() * 5
    }));
    setParticles(newParticles);

    const newShapes = Array.from({ length: 8 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 60 + 40,
      rotation: Math.random() * 360,
      duration: Math.random() * 30 + 20,
      delay: Math.random() * 10,
      shape: ['circle', 'square', 'triangle'][Math.floor(Math.random() * 3)]
    }));
    setGeometricShapes(newShapes);
  }, []);

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      const data = await analyticsService.getAnalytics();
      setAnalyticsData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-container">
        <div className="error-state">
          <h3>Unable to load analytics</h3>
          <p>{error}</p>
          <button onClick={fetchAnalyticsData} className="retry-button">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="dashboard-container">
        <div className="empty-state">
          <h3>No analytics data available</h3>
          <p>Start watching videos to see your progress analytics</p>
          <button onClick={() => navigate('/dashboard')} className="back-button">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Hero Section with Glassmorphic Design */}
      <section className="hero-overview">
        {/* Animated gradient background */}
        <div className="hero-background">
          <div className="gradient-sphere sphere-1"></div>
          <div className="gradient-sphere sphere-2"></div>
          <div className="gradient-sphere sphere-3"></div>
          
          {/* Floating particles */}
          {particles.map(particle => (
            <div
              key={particle.id}
              className="floating-particle"
              style={{
                left: `${particle.x}%`,
                top: `${particle.y}%`,
                width: `${particle.size}px`,
                height: `${particle.size}px`,
                animationDuration: `${particle.duration}s`,
                animationDelay: `${particle.delay}s`
              }}
            />
          ))}
          
          {/* Geometric shapes */}
          {geometricShapes.map(shape => (
            <div
              key={shape.id}
              className={`geometric-shape ${shape.shape}`}
              style={{
                left: `${shape.x}%`,
                top: `${shape.y}%`,
                width: `${shape.size}px`,
                height: `${shape.size}px`,
                transform: `rotate(${shape.rotation}deg)`,
                animationDuration: `${shape.duration}s`,
                animationDelay: `${shape.delay}s`
              }}
            />
          ))}
        </div>

        {/* Glassmorphic welcome card */}
        <div className="glass-card hero-welcome">
          <div className="hero-content">
            <div className="hero-text">
              <h1 className="hero-title">
                <span className="gradient-text">Your Analytics</span>
                <span className="shimmer"></span>
              </h1>
              <p className="hero-subtitle">Track your learning progress and performance</p>
            </div>
            
            <div className="hero-stats">
              <div className="stat-pill">
                <div className="stat-icon">📚</div>
                <div className="stat-info">
                  <div className="stat-value">{analyticsData.summary.totalCourses}</div>
                  <div className="stat-label">Courses</div>
                </div>
              </div>
              
              <div className="stat-pill">
                <div className="stat-icon">📹</div>
                <div className="stat-info">
                  <div className="stat-value">{analyticsData.summary.totalVideosWatched}</div>
                  <div className="stat-label">Videos</div>
                </div>
              </div>
              
              <div className="stat-pill">
                <div className="stat-icon">⏱️</div>
                <div className="stat-info">
                  <div className="stat-value">{Math.round(analyticsData.summary.totalWatchTime)}</div>
                  <div className="stat-label">Hours</div>
                </div>
              </div>
              
              <div className="stat-pill">
                <div className="stat-icon">📊</div>
                <div className="stat-info">
                  <div className="stat-value">{Math.round(analyticsData.summary.averageProgress)}%</div>
                  <div className="stat-label">Progress</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Analytics Content */}
      <div className="analytics-content">
        {/* Quick Stats */}
        <section className="analytics-section">
          <h2 className="section-title">Performance Overview</h2>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon">🎯</div>
              <div className="stat-content">
                <h3>Completion Rate</h3>
                <div className="stat-number">{Math.round(analyticsData.summary.completionRate)}%</div>
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ 
                      width: `${analyticsData.summary.completionRate}%`,
                      backgroundColor: analyticsUtils.getProgressColor(analyticsData.summary.completionRate)
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">🔥</div>
              <div className="stat-content">
                <h3>Current Streak</h3>
                <div className="stat-number">{analyticsData.summary.currentStreak} days</div>
                <p className="stat-description">Keep it going!</p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">📈</div>
              <div className="stat-content">
                <h3>Weekly Progress</h3>
                <div className="stat-number">{analyticsData.summary.weeklyProgress}%</div>
                <p className="stat-description">Last 7 days</p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">🏆</div>
              <div className="stat-content">
                <h3>Achievements</h3>
                <div className="stat-number">{analyticsData.summary.achievements}</div>
                <p className="stat-description">Milestones reached</p>
              </div>
            </div>
          </div>
        </section>

        {/* Course Progress */}
        <section className="analytics-section">
          <h2 className="section-title">Course Progress</h2>
          <div className="course-progress-grid">
            {analyticsData.courseProgress.map((course, index) => (
              <div key={index} className="course-card">
                <div className="course-header">
                  <h3>{course.courseName}</h3>
                  <span className="progress-badge" style={{ 
                    backgroundColor: analyticsUtils.getProgressColor(course.overallProgress),
                    color: 'white'
                  }}>
                    {Math.round(course.overallProgress)}%
                  </span>
                </div>
                
                <div className="course-stats">
                  <div className="course-stat">
                    <span className="stat-label">Videos:</span>
                    <span className="stat-value">{course.videosWatched}/{course.totalVideos}</span>
                  </div>
                  <div className="course-stat">
                    <span className="stat-label">Duration:</span>
                    <span className="stat-value">{Math.round(course.totalWatchTime)}h</span>
                  </div>
                  <div className="course-stat">
                    <span className="stat-label">Completed:</span>
                    <span className="stat-value">{course.completedVideos}</span>
                  </div>
                </div>
                
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ 
                      width: `${course.overallProgress}%`,
                      backgroundColor: analyticsUtils.getProgressColor(course.overallProgress)
                    }}
                  />
                </div>
                
                <div className="course-last-activity">
                  <span className="activity-label">Last activity:</span>
                  <span className="activity-date">
                    {course.lastActivityDate ? formatDate(course.lastActivityDate) : 'No activity'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Recent Activity */}
        <section className="analytics-section">
          <h2 className="section-title">Recent Activity</h2>
          <div className="activity-timeline">
            {analyticsData.recentActivity.length === 0 ? (
              <div className="empty-activity">
                <p>No recent activity. Start watching videos to see your progress here!</p>
              </div>
            ) : (
              analyticsData.recentActivity.map((activity, index) => (
                <div key={index} className="activity-item">
                  <div className="activity-icon">
                    {activity.activityType === 'video_watched' ? '📹' : '✅'}
                  </div>
                  <div className="activity-content">
                    <h4>{activity.videoTitle}</h4>
                    <p>{activity.courseName}</p>
                    <div className="activity-meta">
                      <span className="activity-date">{formatDate(activity.date)}</span>
                      <span className="activity-duration">
                        {Math.round(activity.watchDuration / 60)} min
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Action Buttons */}
        <div className="analytics-actions">
          <button 
            onClick={() => navigate('/dashboard')} 
            className="action-button secondary"
          >
            Back to Dashboard
          </button>
          <button 
            onClick={fetchAnalyticsData} 
            className="action-button primary"
          >
            Refresh Data
          </button>
        </div>
      </div>
    </div>
  );
};

export default StudentAnalyticsDashboard;
