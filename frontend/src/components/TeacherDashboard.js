import React, { useState, useEffect } from 'react';
import { ToastContainer, showToast } from './Toast';
import './Dashboard.css';

const TeacherDashboard = ({ user, onLogout }) => {
  const [activeSection, setActiveSection] = useState('overview');
  const [courses, setCourses] = useState([]);
  const [students, setStudents] = useState([]);
  const [lectures, setLectures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [uploadForm, setUploadForm] = useState({
    title: '',
    description: '',
    courseId: '',
    batchId: '',
    domain: user?.domain || '',
    duration: ''
  });

  useEffect(() => {
    loadTeacherData();
  }, []);

  const loadTeacherData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';

      // Load teacher dashboard data
      const [dashboardRes, coursesRes] = await Promise.all([
        fetch(`${apiUrl}/api/teacher/dashboard`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${apiUrl}/api/teacher/courses`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      const dashboardData = dashboardRes.ok ? await dashboardRes.json() : null;
      const coursesData = coursesRes.ok ? await coursesRes.json() : [];

      setCourses(coursesData.courses || []);
      setStudents([]); // Students will be loaded from dashboard data
    } catch (error) {
      console.error('Error loading teacher data:', error);
      showToast('Error loading dashboard data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const loadLectures = async (courseId) => {
    try {
      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
      
      const response = await fetch(`${apiUrl}/api/teacher/classroom/${courseId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setLectures(data.lectures || []);
      } else {
        setLectures([]);
      }
    } catch (error) {
      console.error('Error loading lectures:', error);
      setLectures([]);
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    setUploading(true);

    try {
      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
      
      const formData = new FormData();
      const videoFile = document.getElementById('videoFile').files[0];
      
      if (!videoFile) {
        showToast('Please select a video file', 'error');
        setUploading(false);
        return;
      }

      formData.append('video', videoFile);
      formData.append('title', uploadForm.title);
      formData.append('description', uploadForm.description);
      formData.append('courseId', uploadForm.courseId);
      formData.append('batchId', uploadForm.batchId);
      formData.append('domain', uploadForm.domain);
      formData.append('duration', uploadForm.duration);

      const response = await fetch(`${apiUrl}/api/teacher/classroom/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        showToast('Lecture uploaded successfully!', 'success');
        
        // Reset form
        setUploadForm({
          title: '',
          description: '',
          courseId: '',
          batchId: '',
          domain: user?.domain || '',
          duration: ''
        });
        document.getElementById('videoFile').value = '';
        
        // Reload lectures for the course
        if (uploadForm.courseId) {
          await loadLectures(uploadForm.courseId);
        }
      } else {
        const errorData = await response.json();
        showToast(errorData.message || 'Upload failed', 'error');
      }
    } catch (error) {
      console.error('Upload error:', error);
      showToast('Upload failed. Please try again.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteLecture = async (lectureId) => {
    if (!window.confirm('Are you sure you want to delete this lecture?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
      
      const response = await fetch(`${apiUrl}/api/teacher/classroom/${lectureId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        showToast('Lecture deleted successfully', 'success');
        // Reload lectures
        if (selectedCourse) {
          await loadLectures(selectedCourse);
        }
      } else {
        const errorData = await response.json();
        showToast(errorData.message || 'Delete failed', 'error');
      }
    } catch (error) {
      console.error('Delete error:', error);
      showToast('Delete failed. Please try again.', 'error');
    }
  };

  if (loading) {
    return (
      <div className="dashboard">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading your teacher dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-left">
          <h1>Sky States Teacher Dashboard</h1>
          <p>Welcome back, {user?.name}!</p>
        </div>
        <div className="header-right">
          <button className="logout-btn" onClick={onLogout}>Logout</button>
        </div>
      </header>

      {/* Navigation */}
      <nav className="dashboard-nav">
        <button
          className={`nav-item ${activeSection === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveSection('overview')}
        >
          📊 Overview
        </button>
        <button
          className={`nav-item ${activeSection === 'courses' ? 'active' : ''}`}
          onClick={() => setActiveSection('courses')}
        >
          📚 My Courses
        </button>
        <button
          className={`nav-item ${activeSection === 'students' ? 'active' : ''}`}
          onClick={() => setActiveSection('students')}
        >
          👥 My Students
        </button>
        <button
          className={`nav-item ${activeSection === 'lectures' ? 'active' : ''}`}
          onClick={() => setActiveSection('lectures')}
        >
          🎥 My Lectures
        </button>
        <button
          className={`nav-item ${activeSection === 'schedule' ? 'active' : ''}`}
          onClick={() => setActiveSection('schedule')}
        >
          📅 Schedule
        </button>
      </nav>

      {/* Main Content */}
      <main className="dashboard-main">
        {activeSection === 'overview' && (
          <div className="dashboard-section">
            <h2>Dashboard Overview</h2>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">📚</div>
                <div className="stat-info">
                  <h3>{courses.length}</h3>
                  <p>Courses Assigned</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">👥</div>
                <div className="stat-info">
                  <h3>{students.length}</h3>
                  <p>Total Students</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">📊</div>
                <div className="stat-info">
                  <h3>{user?.domain || 'N/A'}</h3>
                  <p>Specialization</p>
                </div>
              </div>
            </div>

            <div className="teacher-info">
              <h3>Teacher Profile</h3>
              <div className="info-grid">
                <div className="info-item">
                  <label>Name:</label>
                  <span>{user?.name}</span>
                </div>
                <div className="info-item">
                  <label>Email:</label>
                  <span>{user?.email}</span>
                </div>
                <div className="info-item">
                  <label>Domain:</label>
                  <span>{user?.domain}</span>
                </div>
                <div className="info-item">
                  <label>Experience:</label>
                  <span>{user?.experience}</span>
                </div>
                <div className="info-item">
                  <label>Age:</label>
                  <span>{user?.age}</span>
                </div>
                <div className="info-item">
                  <label>Phone:</label>
                  <span>{user?.phone}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'courses' && (
          <div className="dashboard-section">
            <h2>My Courses</h2>
            <div className="courses-grid">
              {courses.map(course => (
                <div key={course.id} className="course-card">
                  <div className="course-header">
                    <h3>{course.title}</h3>
                    <span className="course-duration">{course.duration}</span>
                  </div>
                  <p>{course.description}</p>
                  <div className="course-stats">
                    <span>📖 {course.modules} modules</span>
                    <span>👥 {course.enrollmentCount || 0} students</span>
                  </div>
                  <div className="course-actions">
                    <button className="view-btn">View Details</button>
                    <button className="manage-btn">Manage Students</button>
                  </div>
                </div>
              ))}
              {courses.length === 0 && (
                <p className="no-data">No courses assigned yet.</p>
              )}
            </div>
          </div>
        )}

        {activeSection === 'students' && (
          <div className="dashboard-section">
            <h2>My Students</h2>
            <div className="students-list">
              {students.map(student => (
                <div key={student.id} className="student-card">
                  <div className="student-info">
                    <h3>{student.name}</h3>
                    <p>{student.email}</p>
                    <p>Course: {student.course}</p>
                    <p>Enrollment: {student.enrollmentNumber}</p>
                  </div>
                  <div className="student-actions">
                    <button className="contact-btn">Contact</button>
                    <button className="progress-btn">View Progress</button>
                  </div>
                </div>
              ))}
              {students.length === 0 && (
                <p className="no-data">No students enrolled yet.</p>
              )}
            </div>
          </div>
        )}

        {activeSection === 'lectures' && (
          <div className="dashboard-section">
            <h2>My Lectures</h2>
            
            {/* Upload Form */}
            <div className="upload-section">
              <h3>Upload New Lecture</h3>
              <form onSubmit={handleUploadSubmit} className="upload-form">
                <div className="form-grid">
                  <div className="form-group">
                    <label htmlFor="title">Lecture Title *</label>
                    <input
                      type="text"
                      id="title"
                      value={uploadForm.title}
                      onChange={(e) => setUploadForm({...uploadForm, title: e.target.value})}
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="courseId">Course *</label>
                    <select
                      id="courseId"
                      value={uploadForm.courseId}
                      onChange={(e) => {
                        const courseId = e.target.value;
                        setUploadForm({...uploadForm, courseId});
                        setSelectedCourse(courseId);
                        if (courseId) {
                          loadLectures(courseId);
                        }
                      }}
                      required
                    >
                      <option value="">Select a course</option>
                      {courses.map(course => (
                        <option key={course.id} value={course.id}>
                          {course.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="description">Description</label>
                    <textarea
                      id="description"
                      value={uploadForm.description}
                      onChange={(e) => setUploadForm({...uploadForm, description: e.target.value})}
                      rows="3"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="batchId">Batch ID (Optional)</label>
                    <input
                      type="text"
                      id="batchId"
                      value={uploadForm.batchId}
                      onChange={(e) => setUploadForm({...uploadForm, batchId: e.target.value})}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="domain">Domain</label>
                    <input
                      type="text"
                      id="domain"
                      value={uploadForm.domain}
                      onChange={(e) => setUploadForm({...uploadForm, domain: e.target.value})}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="duration">Duration</label>
                    <input
                      type="text"
                      id="duration"
                      value={uploadForm.duration}
                      onChange={(e) => setUploadForm({...uploadForm, duration: e.target.value})}
                      placeholder="e.g., 45 minutes"
                    />
                  </div>
                  
                  <div className="form-group full-width">
                    <label htmlFor="videoFile">Video File *</label>
                    <input
                      type="file"
                      id="videoFile"
                      accept="video/*"
                      required
                    />
                    <small>Supported formats: MP4, AVI, MOV, etc. Max size: 2GB</small>
                  </div>
                </div>
                
                <button type="submit" className="upload-btn" disabled={uploading}>
                  {uploading ? 'Uploading...' : '📤 Upload Lecture'}
                </button>
              </form>
            </div>

            {/* Lectures List */}
            {selectedCourse && (
              <div className="lectures-section">
                <h3>Lectures for {courses.find(c => c.id === selectedCourse)?.title}</h3>
                {lectures.length > 0 ? (
                  <div className="lectures-grid">
                    {lectures.map(lecture => (
                      <div key={lecture.id} className="lecture-card">
                        <div className="lecture-header">
                          <h4>{lecture.title}</h4>
                          <span className="lecture-duration">{lecture.duration || 'N/A'}</span>
                        </div>
                        <p>{lecture.description}</p>
                        <div className="lecture-meta">
                          <span>📚 Course: {courses.find(c => c.id === lecture.courseId)?.title}</span>
                          {lecture.batchId && <span>👥 Batch: {lecture.batchId}</span>}
                          <span>🌐 Domain: {lecture.domain}</span>
                          <span>📅 Uploaded: {formatDate(lecture.createdAt)}</span>
                        </div>
                        {lecture.fileInfo && (
                          <div className="file-info">
                            <span>📁 {lecture.fileInfo.originalName}</span>
                            <span>💾 {(lecture.fileInfo.size / (1024 * 1024)).toFixed(2)} MB</span>
                          </div>
                        )}
                        <div className="lecture-actions">
                          <button className="delete-btn" onClick={() => handleDeleteLecture(lecture.id)}>
                            🗑️ Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="no-data">No lectures uploaded for this course yet.</p>
                )}
              </div>
            )}
            
            {!selectedCourse && (
              <p className="no-data">Please select a course to view and upload lectures.</p>
            )}
          </div>
        )}

        {activeSection === 'schedule' && (
          <div className="dashboard-section">
            <h2>Class Schedule</h2>
            <div className="schedule-content">
              <p>Class scheduling functionality will be implemented here.</p>
              <p>Teachers will be able to:</p>
              <ul>
                <li>View their class schedules</li>
                <li>Schedule new classes</li>
                <li>Manage Zoom meetings</li>
                <li>Track attendance</li>
              </ul>
            </div>
          </div>
        )}
      </main>

      <ToastContainer />
    </div>
  );
};

export default TeacherDashboard;