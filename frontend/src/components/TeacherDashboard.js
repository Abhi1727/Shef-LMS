import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ToastContainer, showToast } from './Toast';
import axios from 'axios';
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
    duration: '',
    youtubeUrl: ''
  });
  const [batches, setBatches] = useState([]);
  const [studentName, setStudentName] = useState('');
  const [batchName, setBatchName] = useState('');
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [batchDetails, setBatchDetails] = useState(null);
  const [teacherNotes, setTeacherNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  useEffect(() => {
    loadTeacherData();
  }, []);

  // Handle batch deletion
  const handleDeleteBatch = async (batchId) => {
    if (!window.confirm('Are you sure you want to delete this batch?')) return;
    try {
      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
      const response = await fetch(`${apiUrl}/api/teacher/batches/${batchId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        setBatches(batches.filter(batch => batch.id !== batchId));
        showToast('Batch deleted successfully!', 'success');
      } else {
        showToast('Failed to delete batch', 'error');
      }
    } catch (error) {
      showToast('Error deleting batch', 'error');
    }
  };

  const loadTeacherData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';

      const coursesRes = await fetch(`${apiUrl}/api/teacher/courses`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const coursesData = coursesRes.ok ? await coursesRes.json() : {};
      const coursesList = coursesData.courses || [];
      setCourses(coursesList);

      // Load all batches with students for students list
      const batchesRes = await fetch(`${apiUrl}/api/teacher/batches`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const batchesData = batchesRes.ok ? await batchesRes.json() : {};
      const allBatches = batchesData.batches || [];
      const seen = new Set();
      const uniqueStudents = allBatches.flatMap(b => (b.studentsList || [])).filter(s => {
        const id = s.id || s.email;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });
      setStudents(uniqueStudents);
    } catch (error) {
      console.error('Error loading teacher data:', error);
      showToast('Error loading dashboard data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadBatchDetails = async (batchId) => {
    if (!batchId) {
      setSelectedBatch(null);
      setBatchDetails(null);
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
      const response = await fetch(`${apiUrl}/api/teacher/batches/${batchId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        const batch = data.batch;
        setSelectedBatch(batch);
        setBatchDetails(batch);
        setTeacherNotes(batch.teacherNotes || '');
      } else {
        setSelectedBatch(null);
        setBatchDetails(null);
      }
    } catch (e) {
      console.error('Error loading batch details:', e);
      setSelectedBatch(null);
      setBatchDetails(null);
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedBatch?.id) return;
    setSavingNotes(true);
    try {
      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
      const response = await fetch(`${apiUrl}/api/teacher/batches/${selectedBatch.id}/notes`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ teacherNotes })
      });
      if (response.ok) {
        showToast('Class details saved!', 'success');
        setBatchDetails(prev => prev ? { ...prev, teacherNotes } : null);
      } else {
        showToast('Failed to save notes', 'error');
      }
    } catch (e) {
      showToast('Failed to save notes', 'error');
    } finally {
      setSavingNotes(false);
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
        const json = await response.json();
        setLectures(json.lectures || []);
      } else {
        setLectures([]);
      }
    } catch (error) {
      console.error('Error loading lectures:', error);
      setLectures([]);
    }
  };

  // YouTube URL validation function
  const isValidYouTubeUrl = (url) => {
    if (!url || typeof url !== 'string') return false;
    
    const youtubeUrlPatterns = [
      /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+(&.*)?$/,
      /^https?:\/\/(www\.)?youtu\.be\/[\w-]+(\?.*)?$/,
      /^https?:\/\/(www\.)?youtube\.com\/embed\/[\w-]+(\?.*)?$/,
      /^https?:\/\/(www\.)?youtube\.com\/v\/[\w-]+(\?.*)?$/
    ];
    
    return youtubeUrlPatterns.some(pattern => pattern.test(url.trim()));
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    setUploading(true);

    try {
      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
      
      // Validate YouTube URL
      if (!uploadForm.youtubeUrl) {
        showToast('Please enter a YouTube video URL', 'error');
        setUploading(false);
        return;
      }
      
      if (!isValidYouTubeUrl(uploadForm.youtubeUrl)) {
        showToast('Please enter a valid YouTube URL (e.g., https://www.youtube.com/watch?v=...)', 'error');
        setUploading(false);
        return;
      }

      // Send lecture data with YouTube URL (courseId/batchId = selected batch)
      const lectureData = {
        title: uploadForm.title,
        description: uploadForm.description,
        courseId: uploadForm.courseId,
        batchId: uploadForm.batchId || uploadForm.courseId,
        domain: uploadForm.domain,
        duration: uploadForm.duration,
        youtubeUrl: uploadForm.youtubeUrl,
        videoSource: 'youtube'
      };

      const response = await fetch(`${apiUrl}/api/teacher/classroom/youtube-url`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(lectureData)
      });

      if (response.ok) {
        await response.json();
        showToast('Lecture uploaded successfully!', 'success');
        
        // Reset form
        setUploadForm({
          title: '',
          description: '',
          courseId: '',
          batchId: '',
          domain: user?.domain || '',
          duration: '',
          youtubeUrl: ''
        });
        
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

  const handleAddStudent = async (e) => {
    e.preventDefault();
    if (!selectedCourse || !studentName) {
      showToast('Please select a course and enter a student name', 'error');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';

      const response = await axios.post(`${apiUrl}/api/teacher/students`, {
        name: studentName,
        courseId: selectedCourse,
        batchId: uploadForm.batchId // Use batchId from uploadForm
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.status === 201) {
        showToast('Student added successfully!', 'success');
        setStudentName('');
        setSelectedCourse('');
        setUploadForm({ ...uploadForm, batchId: '' }); // Reset batchId in uploadForm
        // Optionally, reload students or perform other actions
      } else {
        showToast('Failed to add student. Please try again.', 'error');
      }
    } catch (error) {
      console.error('Error adding student:', error);
      showToast('Error adding student. Please try again.', 'error');
    }
  };

  const handleBatchSubmit = async (e) => {
    e.preventDefault();
    if (!batchName) {
      showToast('Please enter a batch name', 'error');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';

      const response = await axios.post(`${apiUrl}/api/teacher/batches`, {
        name: batchName,
        courseId: selectedCourse
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.status === 201) {
        showToast('Batch created successfully!', 'success');
        setBatchName('');
        // Reload batches for the selected course
        if (selectedCourse) {
          const batchResponse = await axios.get(`/api/batches/${selectedCourse}`);
          setBatches(batchResponse.data);
        }
      } else {
        showToast('Failed to create batch. Please try again.', 'error');
      }
    } catch (error) {
      console.error('Error creating batch:', error);
      showToast('Error creating batch. Please try again.', 'error');
    }
  };

  useEffect(() => {
    const fetchBatches = async () => {
      if (!selectedCourse) {
        setBatches([]);
        return;
      }
      try {
        const token = localStorage.getItem('token');
        const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
        const response = await fetch(`${apiUrl}/api/teacher/batches?courseId=${selectedCourse}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setBatches(data.batches || []);
        } else {
          setBatches([]);
        }
      } catch (e) {
        setBatches([]);
      }
    };
    fetchBatches();
  }, [selectedCourse]);

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
          � My Batches
        </button>
        {/* Commented out - My Students option disabled */}
        {/* <button
          className={`nav-item ${activeSection === 'students' ? 'active' : ''}`}
          onClick={() => setActiveSection('students')}
        >
          👥 My Students
        </button> */}
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
                  <span>{user?.age}</span> {/* Display teacher's age */}
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
            <h2>My Batches</h2>
            <div className="courses-grid">
              {courses.map(course => (
                <div key={course.id} className="course-card">
                  <div className="course-header">
                    <h3>{course.title}</h3>
                  </div>
                  <p>{course.description}</p>
                  <div className="course-stats">
                    <span>👥 {course.enrollmentCount || 0} students</span>
                  </div>
                  <div className="course-actions">
                    <button
                      className="view-btn"
                      onClick={() => loadBatchDetails(course.id)}
                    >
                      View Details
                    </button>
                    <button
                      className="manage-btn"
                      onClick={() => loadBatchDetails(course.id)}
                    >
                      Manage Students
                    </button>
                  </div>
                </div>
              ))}
              {courses.length === 0 && (
                <p className="no-data">No batches assigned yet.</p>
              )}
            </div>

            {/* Batch details panel: students + class notes */}
            {selectedBatch && batchDetails && (
              <div className="batch-details-panel" style={{ marginTop: '24px', padding: '20px', border: '1px solid #ddd', borderRadius: '8px', background: '#f9f9f9' }}>
                <h3>{batchDetails.name} – Class Details</h3>
                <button
                  type="button"
                  onClick={() => { setSelectedBatch(null); setBatchDetails(null); }}
                  style={{ float: 'right', marginBottom: '12px' }}
                >
                  Close
                </button>
                <div className="class-notes-section" style={{ marginBottom: '20px', clear: 'both' }}>
                  <label><strong>Class details / notes</strong></label>
                  <textarea
                    value={teacherNotes}
                    onChange={(e) => setTeacherNotes(e.target.value)}
                    placeholder="Add notes about this batch (schedule, topics, reminders...)"
                    rows={4}
                    style={{ width: '100%', padding: '8px', marginTop: '4px' }}
                  />
                  <button
                    type="button"
                    onClick={handleSaveNotes}
                    disabled={savingNotes}
                    style={{ marginTop: '8px' }}
                  >
                    {savingNotes ? 'Saving...' : 'Save notes'}
                  </button>
                </div>
                <div className="students-list-section">
                  <h4>Students ({batchDetails.studentCount || (batchDetails.studentsList || []).length})</h4>
                  {(batchDetails.studentsList || []).length > 0 ? (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #ddd' }}>
                          <th style={{ textAlign: 'left', padding: '8px' }}>Name</th>
                          <th style={{ textAlign: 'left', padding: '8px' }}>Email</th>
                          <th style={{ textAlign: 'left', padding: '8px' }}>Enrollment</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(batchDetails.studentsList || []).map(s => (
                          <tr key={s.id} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '8px' }}>{s.name}</td>
                            <td style={{ padding: '8px' }}>{s.email}</td>
                            <td style={{ padding: '8px' }}>{s.enrollmentNumber || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="no-data">No students in this batch yet.</p>
                  )}
                </div>
              </div>
            )}
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

            {/* Add Student Form */}
            <div className="add-student-section">
              <h3>Add New Student</h3>
              <form onSubmit={handleAddStudent} className="add-student-form">
                <div className="form-group">
                  <label htmlFor="course">Course *</label>
                  <select
                    id="course"
                    value={selectedCourse}
                    onChange={(e) => setSelectedCourse(e.target.value)}
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
                  <label htmlFor="batch">Batch *</label>
                  <select
                    id="batch"
                    value={uploadForm.batchId}
                    onChange={(e) => setUploadForm({...uploadForm, batchId: e.target.value})}
                    required
                  >
                    <option value="">Select a batch</option>
                    {batches.map(batch => (
                      <option key={batch.id} value={batch.id}>
                        {batch.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="form-group">
                  <label htmlFor="studentName">Student Name *</label>
                  <input
                    type="text"
                    id="studentName"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    required
                  />
                </div>
                
                <button type="submit" className="add-student-btn">
                  Add Student
                </button>
              </form>
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
                    <label htmlFor="batchId">Batch (Optional)</label>
                    <select
                      id="batchId"
                      value={uploadForm.batchId || uploadForm.courseId}
                      onChange={(e) => setUploadForm({...uploadForm, batchId: e.target.value})}
                    >
                      <option value="">Same as course</option>
                      {batches.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
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
                  
                  {/* Commented out - Duration field disabled */}
                  {/* <div className="form-group">
                    <label htmlFor="duration">Duration</label>
                    <input
                      type="text"
                      id="duration"
                      value={uploadForm.duration}
                      onChange={(e) => setUploadForm({...uploadForm, duration: e.target.value})}
                      placeholder="e.g., 45 minutes"
                    />
                  </div> */}
                  
                  <div className="form-group full-width">
                    <label htmlFor="youtubeUrl">YouTube Video URL *</label>
                    <input
                      type="url"
                      id="youtubeUrl"
                      value={uploadForm.youtubeUrl}
                      onChange={(e) => setUploadForm({...uploadForm, youtubeUrl: e.target.value})}
                      placeholder="https://www.youtube.com/watch?v=..."
                      required
                    />
                    <small>Enter a valid YouTube video URL (e.g., https://www.youtube.com/watch?v=... or https://youtu.be/...)</small>
                  </div>
                </div>
                
                <button type="submit" className="upload-btn" disabled={uploading}>
                  {uploading ? 'Adding Lecture...' : '🎬 Add Lecture'}
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
                        {(lecture.youtubeVideoUrl || lecture.youtubeUrl) && (
                          <div className="youtube-info">
                            <span>🎬 YouTube</span>
                            <button 
                              className="watch-btn" 
                              onClick={() => window.open(lecture.youtubeVideoUrl || lecture.youtubeUrl, '_blank')}
                              style={{ marginLeft: '10px', padding: '5px 10px', background: '#ff0000', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                            >
                              ▶️ Watch
                            </button>
                          </div>
                        )}
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

        {activeSection === 'batches' && (
          <div className="dashboard-section">
            <h2>My Batches</h2>
            <div className="batches-list">
              {batches.map(batch => (
                <div key={batch.id} className="batch-card">
                  <div className="batch-info">
                    <h3>{batch.name}</h3>
                    <p>Course: {courses.find(c => c.id === batch.courseId)?.title}</p>
                    <p>Students: {batch.studentCount || 0}</p>
                  </div>
                  <div className="batch-actions">
                    <button className="view-btn">View Students</button>
                    <button className="delete-btn" onClick={() => handleDeleteBatch(batch.id)}>
                      🗑️ Delete Batch
                    </button>
                  </div>
                </div>
              ))}
              {batches.length === 0 && (
                <p className="no-data">No batches found for this course.</p>
              )}
            </div>

            {/* Add Batch Form */}
            <div className="add-batch-section">
              <h3>Add New Batch</h3>
              <form onSubmit={handleBatchSubmit} className="add-batch-form">
                <div className="form-group">
                  <label htmlFor="batchName">Batch Name *</label>
                  <input
                    type="text"
                    id="batchName"
                    value={batchName}
                    onChange={(e) => setBatchName(e.target.value)}
                    required
                  />
                </div>
                
                <button type="submit" className="add-batch-btn">
                  Add Batch
                </button>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* Toast Notifications - Rendered via portal for proper stacking */}
      {createPortal(<ToastContainer />, document.body)}
    </div>
  );
};

export default TeacherDashboard;