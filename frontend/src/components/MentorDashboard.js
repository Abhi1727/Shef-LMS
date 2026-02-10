import React, { useState, useEffect, useCallback } from 'react';
import { firebaseService, COLLECTIONS } from '../services/firebaseService';
import './AdminDashboard.css';

const MentorDashboard = ({ user, onLogout }) => {
  const [stats, setStats] = useState(null);
  const [courses, setCourses] = useState([]);
  const [activities, setActivities] = useState([]);
  const [liveClasses, setLiveClasses] = useState([]);
  const [classroomVideos, setClassroomVideos] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);

  const loadAllData = useCallback(async () => {
    try {
      setLoading(true);

      // Load courses, live classes, classroom videos, assessments
      const [coursesData, liveClassesData, classroomData, assessmentsData] = await Promise.all([
        firebaseService.getAll(COLLECTIONS.COURSES).catch(() => []),
        firebaseService.getAll(COLLECTIONS.LIVE_CLASSES).catch(() => []),
        firebaseService.getAll(COLLECTIONS.CLASSROOM).catch(() => []),
        firebaseService.getAll(COLLECTIONS.ASSESSMENTS).catch(() => [])
      ]);

      // Ensure all data is arrays
      const safeCoursesData = Array.isArray(coursesData) ? coursesData : [];
      const safeLiveClassesData = Array.isArray(liveClassesData) ? liveClassesData : [];
      const safeClassroomData = Array.isArray(classroomData) ? classroomData : [];
      const safeAssessmentsData = Array.isArray(assessmentsData) ? assessmentsData : [];

      setCourses(safeCoursesData);
      setLiveClasses(safeLiveClassesData);
      setClassroomVideos(safeClassroomData);
      setAssessments(safeAssessmentsData);

      // Calculate stats
      calculateStats(safeCoursesData, safeLiveClassesData, safeClassroomData, safeAssessmentsData);

      // Load activities (mock data for now)
      setActivities([
        { id: 1, type: 'course_access', description: 'Accessed Cyber Security Course', timestamp: new Date().toISOString() },
        { id: 2, type: 'meeting', description: 'Joined Zoom Meeting: Advanced Ethical Hacking', timestamp: new Date(Date.now() - 86400000).toISOString() },
        { id: 3, type: 'assessment', description: 'Completed Assessment: Network Security Basics', timestamp: new Date(Date.now() - 172800000).toISOString() },
        { id: 4, type: 'video', description: 'Watched Classroom Video: Introduction to Penetration Testing', timestamp: new Date(Date.now() - 259200000).toISOString() }
      ]);

    } catch (error) {
      console.error('Error loading data:', error);
      // Set default empty arrays on error
      setCourses([]);
      setLiveClasses([]);
      setClassroomVideos([]);
      setAssessments([]);
      setStats({
        totalCourses: 0,
        totalLiveClasses: 0,
        totalVideos: 0,
        totalAssessments: 0,
        completedAssessments: 0,
        upcomingMeetings: 0
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // Load all data on component mount
  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const calculateStats = (coursesData, liveClassesData, classroomData, assessmentsData) => {
    const safeCourses = Array.isArray(coursesData) ? coursesData : [];
    const safeLiveClasses = Array.isArray(liveClassesData) ? liveClassesData : [];
    const safeClassroom = Array.isArray(classroomData) ? classroomData : [];
    const safeAssessments = Array.isArray(assessmentsData) ? assessmentsData : [];

    const totalCourses = safeCourses.length;
    const totalLiveClasses = safeLiveClasses.length;
    const totalVideos = safeClassroom.length;
    const totalAssessments = safeAssessments.length;

    setStats({
      totalCourses,
      totalLiveClasses,
      totalVideos,
      totalAssessments,
      completedAssessments: Math.floor(totalAssessments * 0.7), // Mock completion rate
      upcomingMeetings: safeLiveClasses.filter(lc => lc.scheduledDate && new Date(lc.scheduledDate) > new Date()).length
    });
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="dashboard">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading your mentor dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      {/* Sidebar */}
      <aside className={`admin-sidebar ${sidebarOpen ? '' : 'collapsed'}`}>
        <div className="sidebar-header">
          <div className="logo">
            <span className="logo-icon">👨‍🏫</span>
            <span className="logo-text">Mentor Portal</span>
          </div>
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            ☰
          </button>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`nav-item ${activeSection === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveSection('overview')}
          >
            <span className="icon">📊</span>
            <span>Overview</span>
          </button>
          <button
            className={`nav-item ${activeSection === 'courses' ? 'active' : ''}`}
            onClick={() => setActiveSection('courses')}
          >
            <span className="icon">📚</span>
            <span>Courses</span>
          </button>
          <button
            className={`nav-item ${activeSection === 'liveClasses' ? 'active' : ''}`}
            onClick={() => setActiveSection('liveClasses')}
          >
            <span className="icon">🎥</span>
            <span>Live Classes</span>
          </button>
          <button
            className={`nav-item ${activeSection === 'classroom' ? 'active' : ''}`}
            onClick={() => setActiveSection('classroom')}
          >
            <span className="icon">🎬</span>
            <span>Classroom Videos</span>
          </button>
          <button
            className={`nav-item ${activeSection === 'assessments' ? 'active' : ''}`}
            onClick={() => setActiveSection('assessments')}
          >
            <span className="icon">📝</span>
            <span>Assessments</span>
          </button>
          <button
            className={`nav-item ${activeSection === 'activity' ? 'active' : ''}`}
            onClick={() => setActiveSection('activity')}
          >
            <span className="icon">📈</span>
            <span>Activity</span>
          </button>
          <button
            className={`nav-item ${activeSection === 'mentorship' ? 'active' : ''}`}
            onClick={() => setActiveSection('mentorship')}
          >
            <span className="icon">👨‍🏫</span>
            <span>Mentorship</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <button className="logout-btn" onClick={onLogout}>
            <span className="icon">🚪</span>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`admin-main-content ${sidebarOpen ? 'sidebar-open' : 'sidebar-collapsed'}`}>
        {/* Top Header */}
        <header className="admin-top-header">
          <div className="header-left">
            <h1 className="page-title">
              {activeSection === 'overview' && 'Dashboard Overview'}
              {activeSection === 'courses' && 'Available Courses'}
              {activeSection === 'liveClasses' && 'Live Classes & Zoom Meetings'}
              {activeSection === 'classroom' && 'Classroom Videos'}
              {activeSection === 'assessments' && 'Assessments & Quizzes'}
              {activeSection === 'activity' && 'Your Activity'}
              {activeSection === 'mentorship' && 'Mentorship Program'}
            </h1>
          </div>
          <div className="header-right">
            <div className="user-menu">
              <button className="notification-btn">🔔</button>
              <div className="user-avatar">
                {user?.name?.charAt(0)}
              </div>
              <span className="user-name">{user?.name}</span>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="admin-content">
          {/* Overview Section */}
          {activeSection === 'overview' && (
            <div className="admin-section">
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon">📚</div>
                  <div className="stat-info">
                    <h3>{stats?.totalCourses || 0}</h3>
                    <p>Courses Available</p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">🎥</div>
                  <div className="stat-info">
                    <h3>{stats?.totalLiveClasses || 0}</h3>
                    <p>Live Classes</p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">🎬</div>
                  <div className="stat-info">
                    <h3>{stats?.totalVideos || 0}</h3>
                    <p>Classroom Videos</p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">📝</div>
                  <div className="stat-info">
                    <h3>{stats?.completedAssessments || 0}/{stats?.totalAssessments || 0}</h3>
                    <p>Assessments Completed</p>
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="admin-section">
                <h3>Recent Activity</h3>
                <div className="activity-list">
                  {Array.isArray(activities) && activities.slice(0, 5).map(activity => (
                    <div key={activity.id} className="activity-item">
                      <div className="activity-icon">
                        {activity.type === 'course_access' && '📚'}
                        {activity.type === 'meeting' && '🎥'}
                        {activity.type === 'assessment' && '📝'}
                        {activity.type === 'video' && '🎬'}
                      </div>
                      <div className="activity-content">
                        <p>{activity.description}</p>
                        <span>{activity.timestamp ? formatDate(activity.timestamp) : 'Date N/A'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Upcoming Meetings */}
              <div className="admin-section">
                <h3>Upcoming Live Classes</h3>
                <div className="meetings-list">
                  {Array.isArray(liveClasses) && liveClasses.filter(lc => lc.scheduledDate && new Date(lc.scheduledDate) > new Date()).slice(0, 3).map(meeting => (
                    <div key={meeting.id} className="meeting-item">
                      <div className="meeting-info">
                        <h4>{meeting.title}</h4>
                        <p>{meeting.course}</p>
                        <span>{meeting.scheduledDate && meeting.scheduledTime ? formatDate(meeting.scheduledDate + 'T' + meeting.scheduledTime) : 'Date TBD'}</span>
                      </div>
                      <button className="join-btn">Join Meeting</button>
                    </div>
                  ))}
                  {(!Array.isArray(liveClasses) || liveClasses.filter(lc => lc.scheduledDate && new Date(lc.scheduledDate) > new Date()).length === 0) && (
                    <p className="no-meetings">No upcoming meetings scheduled</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Courses Section */}
          {activeSection === 'courses' && (
            <div className="admin-section">
              <div className="section-header">
                <h2>Available Courses</h2>
              </div>
              <div className="courses-grid">
                {Array.isArray(courses) && courses.map(course => (
                  <div key={course.id} className="course-card">
                    <div className="course-header">
                      <h3>{course.title}</h3>
                      <span className="course-duration">{course.duration}</span>
                    </div>
                    <p>{course.description}</p>
                    <div className="course-actions">
                      <button className="access-btn">Access Course</button>
                      <button className="view-btn">View Details</button>
                    </div>
                  </div>
                ))}
                {(!Array.isArray(courses) || courses.length === 0) && (
                  <p className="no-courses">No courses available</p>
                )}
              </div>
            </div>
          )}

          {/* Live Classes Section */}
          {activeSection === 'liveClasses' && (
            <div className="admin-section">
              <div className="section-header">
                <h2>Live Classes & Zoom Meetings</h2>
              </div>
              <div className="classes-list">
                {Array.isArray(liveClasses) && liveClasses.map(liveClass => (
                  <div key={liveClass.id} className="class-card">
                    <div className="class-info">
                      <h3>{liveClass.title}</h3>
                      <p>Course: {liveClass.course}</p>
                      <p>Instructor: {liveClass.instructor}</p>
                      <p>Date: {liveClass.scheduledDate && liveClass.scheduledTime ? formatDate(liveClass.scheduledDate + 'T' + liveClass.scheduledTime) : 'Date TBD'}</p>
                      <p>Duration: {liveClass.duration} minutes</p>
                    </div>
                    <div className="class-actions">
                      <button className="join-zoom-btn">Join Zoom Meeting</button>
                      <button className="view-details-btn">View Details</button>
                    </div>
                  </div>
                ))}
                {(!Array.isArray(liveClasses) || liveClasses.length === 0) && (
                  <p className="no-classes">No live classes available</p>
                )}
              </div>
            </div>
          )}

          {/* Classroom Videos Section */}
          {activeSection === 'classroom' && (
            <div className="admin-section">
              <div className="section-header">
                <h2>Classroom Videos</h2>
              </div>
              <div className="videos-grid">
                {Array.isArray(classroomVideos) && classroomVideos.map(video => (
                  <div key={video.id} className="video-card">
                    <div className="video-thumbnail">
                      <img src={video.thumbnail || '/placeholder-video.png'} alt={video.title} />
                      <div className="play-overlay">▶</div>
                    </div>
                    <div className="video-info">
                      <h3>{video.title}</h3>
                      <p>{video.description}</p>
                      <p>Instructor: {video.instructor}</p>
                      <p>Duration: {video.duration}</p>
                    </div>
                    <button
                      className="watch-btn"
                      onClick={() => setSelectedVideo(video)}
                    >
                      Watch Now
                    </button>
                  </div>
                ))}
                {(!Array.isArray(classroomVideos) || classroomVideos.length === 0) && (
                  <p className="no-videos">No classroom videos available</p>
                )}
              </div>
            </div>
          )}

          {/* Assessments Section */}
          {activeSection === 'assessments' && (
            <div className="admin-section">
              <div className="section-header">
                <h2>Assessments & Quizzes</h2>
              </div>
              <div className="assessments-list">
                {Array.isArray(assessments) && assessments.map(assessment => (
                  <div key={assessment.id} className="assessment-card">
                    <div className="assessment-info">
                      <h3>{assessment.title}</h3>
                      <p>{assessment.description}</p>
                      <p>Course: {assessment.course}</p>
                      <p>Duration: {assessment.duration} minutes</p>
                      <p>Questions: {assessment.totalQuestions}</p>
                    </div>
                    <div className="assessment-actions">
                      <button className="start-btn">Start Assessment</button>
                      <button className="review-btn">Review Results</button>
                    </div>
                  </div>
                ))}
                {(!Array.isArray(assessments) || assessments.length === 0) && (
                  <p className="no-assessments">No assessments available</p>
                )}
              </div>
            </div>
          )}

          {/* Activity Section */}
          {activeSection === 'activity' && (
            <div className="admin-section">
              <div className="section-header">
                <h2>Your Activity</h2>
              </div>
              <div className="activity-timeline">
                {Array.isArray(activities) && activities.map(activity => (
                  <div key={activity.id} className="timeline-item">
                    <div className="timeline-marker">
                      {activity.type === 'course_access' && '📚'}
                      {activity.type === 'meeting' && '🎥'}
                      {activity.type === 'assessment' && '📝'}
                      {activity.type === 'video' && '🎬'}
                    </div>
                    <div className="timeline-content">
                      <p>{activity.description}</p>
                      <span>{activity.timestamp ? formatDate(activity.timestamp) : 'Date N/A'}</span>
                    </div>
                  </div>
                ))}
                {(!Array.isArray(activities) || activities.length === 0) && (
                  <p className="no-activity">No activity recorded yet</p>
                )}
              </div>
            </div>
          )}

          {/* Mentorship Section */}
          {activeSection === 'mentorship' && (
            <div className="admin-section">
              <div className="section-header">
                <h2>Mentorship Program</h2>
              </div>
              <div className="mentorship-content">
                <div className="mentorship-info">
                  <h3>Your Mentorship Profile</h3>
                  <div className="profile-details">
                    <p><strong>Name:</strong> {user?.name}</p>
                    <p><strong>Title:</strong> {user?.title}</p>
                    <p><strong>Company:</strong> {user?.company}</p>
                    <p><strong>Domain:</strong> {user?.domain}</p>
                    <p><strong>Email:</strong> {user?.email}</p>
                  </div>
                </div>
                <div className="mentorship-actions">
                  <button className="schedule-btn">Schedule Mentoring Session</button>
                  <button className="resources-btn">Access Resources</button>
                  <button className="network-btn">Connect with Network</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Video Modal */}
      {selectedVideo && (
        <div className="video-modal" onClick={() => setSelectedVideo(null)}>
          <div className="video-modal-content" onClick={e => e.stopPropagation()}>
            <div className="video-modal-header">
              <h3>{selectedVideo.title}</h3>
              <button onClick={() => setSelectedVideo(null)}>×</button>
            </div>
            <div className="video-player">
              <iframe
                src={selectedVideo.videoUrl}
                title={selectedVideo.title}
                frameBorder="0"
                allowFullScreen
              ></iframe>
            </div>
          </div>
        </div>
      )}

      {/* Profile Modal */}
      {showProfileModal && (
        <div className="modal-overlay" onClick={() => setShowProfileModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Mentor Profile</h3>
              <button onClick={() => setShowProfileModal(false)}>×</button>
            </div>
            <div className="profile-details">
              <div className="profile-field">
                <label>Name:</label>
                <span>{user?.name}</span>
              </div>
              <div className="profile-field">
                <label>Email:</label>
                <span>{user?.email}</span>
              </div>
              <div className="profile-field">
                <label>Title:</label>
                <span>{user?.title}</span>
              </div>
              <div className="profile-field">
                <label>Company:</label>
                <span>{user?.company}</span>
              </div>
              <div className="profile-field">
                <label>Domain:</label>
                <span>{user?.domain}</span>
              </div>
              <div className="profile-field">
                <label>Role:</label>
                <span>Mentor</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MentorDashboard;