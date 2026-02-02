import React, { useState, useEffect, useCallback } from 'react';
import { firebaseService, COLLECTIONS } from '../services/firebaseService';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import CustomVideoPlayer from './CustomVideoPlayer';
import './Dashboard-lms.css';

const Dashboard = ({ user, onLogout }) => {
  const [stats, setStats] = useState(null);
  const [courses, setCourses] = useState([]);
  const [classroomVideos, setClassroomVideos] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  
  // Progress tracking state
  const [viewedFiles, setViewedFiles] = useState([]);
  const [progressPercent, setProgressPercent] = useState(0);

  // Course data
  const courseData = {
    title: user?.currentCourse || 'Data Science & AI',
    duration: '6 months',
    modules: 6,
    modules_detail: [
      { name: 'Module 1: Introduction to Data Science' },
      { name: 'Module 2: Python Programming' },
      { name: 'Module 3: Machine Learning Basics' },
      { name: 'Module 4: Deep Learning' },
      { name: 'Module 5: Data Visualization' },
      { name: 'Module 6: Capstone Project' }
    ]
  };

  // Toggle sidebar
  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  // Determine course type
  const isDataScience = useCallback(() => {
    const courseName = user?.currentCourse || '';
    return courseName.toLowerCase().includes('data science') || 
           courseName.toLowerCase().includes('ai') || 
           courseName.toLowerCase().includes('machine learning');
  }, [user?.currentCourse]);

  // Load user progress
  const loadUserProgress = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const progressRef = doc(db, 'userProgress', user.id);
      const progressDoc = await getDoc(progressRef);
      
      if (progressDoc.exists()) {
        const data = progressDoc.data();
        setViewedFiles(data.viewedFiles || []);
        const progress = Math.round((data.viewedFiles?.length || 0) / 30 * 100);
        setProgressPercent(progress);
      } else {
        setViewedFiles([]);
        setProgressPercent(0);
      }
    } catch (error) {
      console.error('Error loading user progress:', error);
      setViewedFiles([]);
      setProgressPercent(0);
    }
  }, [user?.id]);

  // Load classroom videos
  const loadClassroomVideos = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
      
      const response = await fetch(`${apiUrl}/api/classroom`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const videos = await response.json();
        setClassroomVideos(videos);
      } else {
        // Fallback data for demo
        setClassroomVideos([
          {
            id: '1',
            title: 'Introduction to Machine Learning',
            instructor: 'Dr. Sarah Mitchell',
            duration: '1 hr 30 min',
            date: '2025-01-15',
            videoSource: 'youtube-url',
            youtubeEmbedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ'
          }
        ]);
      }
    } catch (error) {
      console.error('Error loading classroom videos:', error);
      setClassroomVideos([]);
    }
  }, []);

  // Load lessons
  const loadLessons = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
      
      const response = await fetch(`${apiUrl}/api/lessons`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const lessonsData = await response.json();
        setLessons(lessonsData);
      } else {
        setLessons([]);
      }
    } catch (error) {
      console.error('Error loading lessons:', error);
      setLessons([]);
    }
  }, []);

  // Initialize data
  useEffect(() => {
    const initializeData = async () => {
      setLoading(true);
      await Promise.all([
        loadUserProgress(),
        loadClassroomVideos(),
        loadLessons()
      ]);
      
      // Set stats
      setStats({
        totalModules: courseData.modules,
        completedModules: Math.floor(progressPercent / 100 * courseData.modules),
        totalVideos: classroomVideos.length,
        watchedVideos: Math.floor(progressPercent / 100 * classroomVideos.length)
      });
      
      setLoading(false);
    };

    initializeData();
  }, [loadUserProgress, loadClassroomVideos, loadLessons, courseData.modules, progressPercent, classroomVideos.length]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 1024) {
        setSidebarOpen(true);
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (loading) {
    return (
      <div className="loading">
        <div className="loading-spinner"></div>
        <p>Loading your learning dashboard...</p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* Mobile Menu Toggle */}
      <button 
        className="mobile-menu-toggle"
        onClick={toggleSidebar}
      >
        <span style={{ fontSize: '1.5rem' }}>☰</span>
      </button>

      {/* Sidebar Overlay */}
      <div className={`sidebar-overlay ${sidebarOpen ? 'visible' : ''}`} onClick={toggleSidebar} />

      {/* Learning Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <h2>SHEF LMS</h2>
          <div className="subtitle">Learning Portal</div>
        </div>

        <nav className="sidebar-nav">
          <button 
            className={`nav-item ${activeSection === 'overview' ? 'active' : ''}`}
            onClick={() => { setActiveSection('overview'); toggleSidebar(); }}
          >
            <span className="nav-icon">🏠</span>
            <span>Dashboard</span>
          </button>
          <button 
            className={`nav-item ${activeSection === 'courses' ? 'active' : ''}`}
            onClick={() => { setActiveSection('courses'); toggleSidebar(); }}
          >
            <span className="nav-icon">📚</span>
            <span>My Courses</span>
          </button>
          <button 
            className={`nav-item ${activeSection === 'liveClasses' ? 'active' : ''}`}
            onClick={() => { setActiveSection('liveClasses'); toggleSidebar(); }}
          >
            <span className="nav-icon">📡</span>
            <span>Live Classes</span>
          </button>
          <button 
            className={`nav-item ${activeSection === 'classroom' ? 'active' : ''}`}
            onClick={() => { setActiveSection('classroom'); toggleSidebar(); }}
          >
            <span className="nav-icon">🎥</span>
            <span>Recordings</span>
          </button>
          <button 
            className={`nav-item ${activeSection === 'progress' ? 'active' : ''}`}
            onClick={() => { setActiveSection('progress'); toggleSidebar(); }}
          >
            <span className="nav-icon">📊</span>
            <span>Progress</span>
          </button>
        </nav>

        {/* Learning Progress */}
        <div className="learning-progress">
          <div className="progress-label">Overall Progress</div>
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
          <div style={{ textAlign: 'center', marginTop: '0.5rem', fontSize: '0.875rem', color: '#718096' }}>
            {progressPercent}% Complete
          </div>
        </div>

        <div className="sidebar-footer">
          <div className="user-profile" onClick={() => setShowProfileModal(true)}>
            <div className="user-avatar">
              {user?.name?.charAt(0)?.toUpperCase()}
            </div>
            <div className="user-info">
              <div className="user-name">{user?.name}</div>
              <div className="user-role">Student</div>
            </div>
          </div>
          <button className="nav-item" onClick={onLogout} style={{ marginTop: '1rem' }}>
            <span className="nav-icon">🚪</span>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {/* Overview Section */}
        {activeSection === 'overview' && (
          <div className="animate-in">
            <div className="header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                <div className="learning-badge success" style={{ fontSize: '0.875rem' }}>
                  🏠 Home Dashboard
                </div>
              </div>
              <h1>Welcome back, {user?.name}! 👋</h1>
              <div className="subtitle">
                Ready to continue your {isDataScience() ? 'Data Science' : 'Cyber Security'} journey?
              </div>
            </div>

            {/* Learning Stats */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">📚</div>
                <div className="stat-value">{courseData.modules}</div>
                <div className="stat-label">Total Modules</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">✅</div>
                <div className="stat-value">{Math.floor(progressPercent / 100 * courseData.modules)}</div>
                <div className="stat-label">Completed</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">📈</div>
                <div className="stat-value">{progressPercent}%</div>
                <div className="stat-label">Progress</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">🎥</div>
                <div className="stat-value">{classroomVideos.length}</div>
                <div className="stat-label">Class Videos</div>
              </div>
            </div>

            {/* Current Course */}
            <div className="content-section">
              <div className="section-header">
                <div className="section-title">
                  <div className="section-icon">🎓</div>
                  Current Course
                </div>
                <div className="learning-badge success">
                  {progressPercent}% Complete
                </div>
              </div>

              <div className="course-grid">
                <div className="course-card">
                  <div className="course-header">
                    <div className="course-title">{courseData.title}</div>
                    <div className="course-meta">
                      {courseData.modules} modules • {courseData.duration}
                    </div>
                  </div>
                  <div className="course-body">
                    <div className="course-progress">
                      <div className="progress-stats">
                        <span>Course Progress</span>
                        <span>{progressPercent}%</span>
                      </div>
                      <div className="progress-bar">
                        <div 
                          className="progress-fill" 
                          style={{ width: `${progressPercent}%` }}
                        ></div>
                      </div>
                    </div>
                    <div className="learning-actions">
                      <button 
                        className="action-btn"
                        onClick={() => setActiveSection('courses')}
                      >
                        <span>📖</span>
                        <span>Continue Learning</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Videos */}
            {classroomVideos.length > 0 && (
              <div className="content-section">
                <div className="section-header">
                  <div className="section-title">
                    <div className="section-icon">🎥</div>
                    Recent Class Recordings
                  </div>
                </div>

                <div className="video-grid">
                  {classroomVideos.slice(0, 3).map((video) => (
                    <div 
                      key={video.id} 
                      className="video-card"
                      onClick={() => setSelectedVideo(video)}
                    >
                      <div className="video-thumbnail">
                        {video.videoSource === 'youtube-url' ? '📺' : '🎥'}
                      </div>
                      <div className="video-info">
                        <div className="video-title">{video.title}</div>
                        <div className="video-meta">
                          <div className="video-meta-row">
                            <span>👨‍🏫 {video.instructor}</span>
                            <span>⏱️ {video.duration}</span>
                          </div>
                          <div className="video-meta-row">
                            <span>📅 {new Date(video.date || video.createdAt).toLocaleDateString()}</span>
                            <span className="learning-badge">New</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Courses Section */}
        {activeSection === 'courses' && (
          <div className="animate-in">
            <div className="header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                <button 
                  className="action-btn"
                  onClick={() => setActiveSection('overview')}
                  style={{ padding: '0.75rem 1.5rem', fontSize: '0.875rem' }}
                >
                  <span>🏠</span>
                  <span>Back to Home</span>
                </button>
              </div>
              <h1>📚 My Courses</h1>
              <div className="subtitle">
                Track your learning progress and access course materials
              </div>
            </div>

            <div className="content-section">
              <div className="section-header">
                <div className="section-title">
                  <div className="section-icon">🎓</div>
                  Course Modules
                </div>
              </div>

              <div className="course-grid">
                {courseData.modules_detail.map((module, index) => (
                  <div key={index} className="course-card">
                    <div className="course-header">
                      <div className="course-title">{module.name}</div>
                      <div className="course-meta">
                        Module {index + 1} of {courseData.modules}
                      </div>
                    </div>
                    <div className="course-body">
                      <div className="course-progress">
                        <div className="progress-stats">
                          <span>Module Progress</span>
                          <span>{index < Math.floor(progressPercent / 100 * courseData.modules) ? '100%' : '0%'}</span>
                        </div>
                        <div className="progress-bar">
                          <div 
                            className="progress-fill" 
                            style={{ width: index < Math.floor(progressPercent / 100 * courseData.modules) ? '100%' : '0%' }}
                          ></div>
                        </div>
                      </div>
                      <div className="learning-actions">
                        <button 
                          className="action-btn"
                          disabled={index >= Math.floor(progressPercent / 100 * courseData.modules)}
                        >
                          <span>{index < Math.floor(progressPercent / 100 * courseData.modules) ? '📖' : '🔒'}</span>
                          <span>{index < Math.floor(progressPercent / 100 * courseData.modules) ? 'Continue' : 'Locked'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Live Classes Section */}
        {activeSection === 'liveClasses' && (
          <div className="animate-in">
            <div className="header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                <button 
                  className="action-btn"
                  onClick={() => setActiveSection('overview')}
                  style={{ padding: '0.75rem 1.5rem', fontSize: '0.875rem' }}
                >
                  <span>🏠</span>
                  <span>Back to Home</span>
                </button>
              </div>
              <h1>📡 Live Classes</h1>
              <div className="subtitle">
                Join upcoming live sessions and interact with instructors
              </div>
            </div>

            <div className="content-section">
              <div className="section-header">
                <div className="section-title">
                  <div className="section-icon">📅</div>
                  Upcoming Sessions
                </div>
              </div>

              {lessons && lessons.filter(l => l.classLink).length > 0 ? (
                <div className="video-grid">
                  {lessons.filter(l => l.classLink).slice(0, 6).map((lesson) => (
                    <div key={lesson.id} className="video-card">
                      <div className="video-thumbnail">📡</div>
                      <div className="video-info">
                        <div className="video-title">{lesson.title}</div>
                        <div className="video-meta">
                          <div className="video-meta-row">
                            <span>⏱️ {lesson.duration || 'TBD'}</span>
                            <span className="learning-badge warning">Live</span>
                          </div>
                          <div className="video-meta-row">
                            <span>🔴 Click to join</span>
                          </div>
                        </div>
                        <div className="learning-actions">
                          <a 
                            href={lesson.classLink} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="action-btn"
                            style={{ textDecoration: 'none', marginTop: '1rem' }}
                          >
                            <span>🔴</span>
                            <span>Join Class</span>
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-state-icon">📡</div>
                  <div className="empty-state-title">No Live Classes Scheduled</div>
                  <div className="empty-state-text">
                    Check back later for upcoming live sessions with your instructors.
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Classroom Section */}
        {activeSection === 'classroom' && (
          <div className="animate-in">
            <div className="header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                <button 
                  className="action-btn"
                  onClick={() => setActiveSection('overview')}
                  style={{ padding: '0.75rem 1.5rem', fontSize: '0.875rem' }}
                >
                  <span>🏠</span>
                  <span>Back to Home</span>
                </button>
              </div>
              <h1>🎥 Classroom Recordings</h1>
              <div className="subtitle">
                Access all your class recordings and learning materials
              </div>
            </div>

            {classroomVideos.length > 0 ? (
              <div className="content-section">
                <div className="section-header">
                  <div className="section-title">
                    <div className="section-icon">📹</div>
                    All Recordings
                  </div>
                </div>

                <div className="video-grid">
                  {classroomVideos.map((video) => (
                    <div 
                      key={video.id} 
                      className="video-card"
                      onClick={() => setSelectedVideo(video)}
                    >
                      <div className="video-thumbnail">
                        {video.videoSource === 'youtube-url' ? '📺' : '🎥'}
                      </div>
                      <div className="video-info">
                        <div className="video-title">{video.title}</div>
                        <div className="video-meta">
                          <div className="video-meta-row">
                            <span>👨‍🏫 {video.instructor}</span>
                            <span>⏱️ {video.duration}</span>
                          </div>
                          <div className="video-meta-row">
                            <span>📅 {new Date(video.date || video.createdAt).toLocaleDateString()}</span>
                            <span className="learning-badge">
                              {video.videoSource === 'youtube-url' ? 'YouTube' : 'Firebase'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="content-section">
                <div className="empty-state">
                  <div className="empty-state-icon">📹</div>
                  <div className="empty-state-title">No Recordings Available</div>
                  <div className="empty-state-text">
                    Class recordings will appear here within 24 hours after each live session.
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Progress Section */}
        {activeSection === 'progress' && (
          <div className="animate-in">
            <div className="header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                <button 
                  className="action-btn"
                  onClick={() => setActiveSection('overview')}
                  style={{ padding: '0.75rem 1.5rem', fontSize: '0.875rem' }}
                >
                  <span>🏠</span>
                  <span>Back to Home</span>
                </button>
              </div>
              <h1>📊 Learning Progress</h1>
              <div className="subtitle">
                Track your learning journey and achievements
              </div>
            </div>

            <div className="content-section">
              <div className="section-header">
                <div className="section-title">
                  <div className="section-icon">📈</div>
                  Overall Progress
                </div>
              </div>

              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon">📚</div>
                  <div className="stat-value">{progressPercent}%</div>
                  <div className="stat-label">Course Completion</div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">📁</div>
                  <div className="stat-value">{viewedFiles.length}</div>
                  <div className="stat-label">Files Viewed</div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">🎥</div>
                  <div className="stat-value">{classroomVideos.length}</div>
                  <div className="stat-label">Videos Available</div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">🏆</div>
                  <div className="stat-value">{Math.floor(progressPercent / 25)}</div>
                  <div className="stat-label">Achievements</div>
                </div>
              </div>

              <div style={{ marginTop: '2rem' }}>
                <div className="progress-stats">
                  <span>Course Progress</span>
                  <span>{progressPercent}%</span>
                </div>
                <div className="progress-bar" style={{ height: '20px' }}>
                  <div 
                    className="progress-fill" 
                    style={{ width: `${progressPercent}%` }}
                  ></div>
                </div>
                <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                  <span className="learning-badge success">
                    {progressPercent === 100 ? '🎉 Course Completed!' : `Keep going! ${100 - progressPercent}% to go`}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Video Player Modal */}
      {selectedVideo && (
        <CustomVideoPlayer
          video={selectedVideo}
          onClose={() => setSelectedVideo(null)}
        />
      )}
    </div>
  );
};

export default Dashboard;
