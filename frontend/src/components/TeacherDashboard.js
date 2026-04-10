import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ToastContainer, showToast } from './Toast';
import axios from 'axios';
import './Dashboard.css';

const TeacherDashboard = ({ user, onLogout }) => {
  const navigate = useNavigate();
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
  const [batchSearch, setBatchSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    loadTeacherData();
  }, [user]);

  // Create floating particles and geometric shapes
  useEffect(() => {
    const createParticles = () => {
      const container = document.getElementById('particles-container');
      if (!container) return;
      
      // Clear existing particles
      container.innerHTML = '';
      
      // Create particles
      for (let i = 0; i < 50; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 20 + 's';
        particle.style.animationDuration = (15 + Math.random() * 10) + 's';
        container.appendChild(particle);
      }
    };

    const createGeometricShapes = () => {
      const container = document.getElementById('geometric-container');
      if (!container) return;
      
      // Clear existing shapes
      container.innerHTML = '';
      
      // Create geometric shapes
      for (let i = 0; i < 8; i++) {
        const shape = document.createElement('div');
        shape.className = 'geometric-shape';
        shape.style.left = Math.random() * 100 + '%';
        shape.style.animationDelay = Math.random() * 15 + 's';
        shape.style.animationDuration = (20 + Math.random() * 15) + 's';
        container.appendChild(shape);
      }
    };

    // Create animations when component mounts
    createParticles();
    createGeometricShapes();

    // Cleanup
    return () => {
      const particlesContainer = document.getElementById('particles-container');
      const geometricContainer = document.getElementById('geometric-container');
      if (particlesContainer) particlesContainer.innerHTML = '';
      if (geometricContainer) geometricContainer.innerHTML = '';
    };
  }, [activeSection]); // Recreate when section changes

  // Handle batch deletion
  const handleDeleteBatch = async (batchId) => {
    if (!window.confirm('Are you sure you want to delete this batch?')) return;
    try {
      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : '';
      const response = await fetch(`${apiUrl}/api/batches/${batchId}`, {
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

  // Filter batches based on search and filters
  const filteredBatches = React.useMemo(() => {
    let filtered = batches;
    
    // Apply search filter
    if (batchSearch.trim()) {
      filtered = filtered.filter(batch => 
        batch.name?.toLowerCase().includes(batchSearch.toLowerCase()) ||
        batch.course?.toLowerCase().includes(batchSearch.toLowerCase())
      );
    }
    
    // Apply course filter
    if (courseFilter !== 'all') {
      filtered = filtered.filter(batch => {
        const course = batch.course?.toLowerCase() || '';
        if (courseFilter === 'data-science') {
          return course.includes('data science') || course.includes('ds&ai');
        } else if (courseFilter === 'cyber-security') {
          return course.includes('cyber') || course.includes('security') || course.includes('cs&eh');
        } else if (courseFilter === 'devops-ai') {
          return course.includes('devops') && course.includes('ai');
        } else if (courseFilter === 'devops-cloud') {
          return course.includes('devops') && course.includes('cloud');
        } else if (courseFilter === 'one-to-one') {
          return course.includes('one-to-one');
        }
        return true;
      });
    }
    
    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(batch => 
        (batch.status || 'active').toLowerCase() === statusFilter.toLowerCase()
      );
    }
    
    return filtered;
  }, [batches, batchSearch, courseFilter, statusFilter]);

  const clearFilters = () => {
    setBatchSearch('');
    setCourseFilter('all');
    setStatusFilter('all');
  };

  const getCourseIcon = (course) => {
    const courseLower = (course || '').toLowerCase();
    if (courseLower.includes('data science') || courseLower.includes('ds&ai')) return '📊';
    if (courseLower.includes('cyber') || courseLower.includes('security') || courseLower.includes('cs&eh')) return '🔒';
    if (courseLower.includes('devops') && courseLower.includes('ai')) return '🚀';
    if (courseLower.includes('devops') && courseLower.includes('cloud')) return '☁️';
    if (courseLower.includes('one-to-one')) return '👥';
    return '📚';
  };

  const getStatusColor = (status) => {
    switch ((status || 'active').toLowerCase()) {
      case 'active': return '#10b981';
      case 'completed': return '#6b7280';
      case 'upcoming': return '#f59e0b';
      default: return '#64748b';
    }
  };

  const handleViewBatchDetail = (batchId) => {
    navigate(`/teacher/batch/${batchId}`);
  };

  const loadTeacherData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : '';
      
      // Load teacher dashboard data
      const coursesRes = await fetch(`${apiUrl}/api/teacher/courses`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const coursesData = coursesRes.ok ? await coursesRes.json() : [];
      setCourses(coursesData.courses || []);

      // Load teacher's batches using new teacher-specific endpoint
      const batchesRes = await fetch(`${apiUrl}/api/teacher/batches`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (batchesRes.ok) {
        const batchesData = await batchesRes.json();
        setBatches(batchesData.batches || batchesData || []);

        // Calculate total students from batches (now includes both regular and one-to-one)
        const batchesArray = batchesData.batches || batchesData || [];
        const totalStudents = batchesArray.reduce((total, batch) => {
          const studentCount = batch.studentCount || batch.students?.length || 0;
          console.log(`Batch ${batch.name}: ${studentCount} students (type: ${batch.batchType || 'unknown'})`);
          return total + studentCount;
        }, 0);
        console.log(`Total students calculated: ${totalStudents}`);
        setStudents([{ id: 'total', name: 'Total Students', count: totalStudents }]);
      } else {
        // Fallback to admin endpoint if teacher endpoint fails
        console.log('Teacher endpoint failed, using admin endpoint fallback...');
        const adminBatchesRes = await fetch(`${apiUrl}/api/batches`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (adminBatchesRes.ok) {
          const adminBatchesData = await adminBatchesRes.json();

          // Filter batches that belong to this teacher
          const teacherBatches = adminBatchesData.batches?.filter(batch =>
            batch.teacherId === user?.id || batch.teacherName === user?.name
          ) || [];

          setBatches(teacherBatches);

          const totalStudents = teacherBatches.reduce((total, batch) => {
            const studentCount = batch.students?.length || batch.studentCount || 0;
            console.log(`Fallback - Batch ${batch.name}: ${studentCount} students`);
            return total + studentCount;
          }, 0);
          console.log(`Fallback - Total students calculated: ${totalStudents}`);
          setStudents([{ id: 'total', name: 'Total Students', count: totalStudents }]);
        } else {
          setBatches([]);
          setStudents([]);
        }
      }
    } catch (error) {
      console.error('Error loading teacher data:', error);
      showToast('Error loading dashboard data', 'error');
      setBatches([]);
      setStudents([]);
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
      const apiUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : '';
      
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
      const apiUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : '';
      
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

      // Send lecture data with YouTube URL
      const lectureData = {
        title: uploadForm.title,
        description: uploadForm.description,
        courseId: uploadForm.courseId,
        batchId: uploadForm.batchId,
        domain: uploadForm.domain,
        duration: uploadForm.duration,
        youtubeUrl: uploadForm.youtubeUrl,
        videoSource: 'youtube'
      };

      const response = await fetch(`${apiUrl}/api/teacher/classroom/upload`, {
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
      const apiUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : '';
      
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
      const apiUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : '';

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
      const apiUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : '';

      // Get course information for the batch
      const selectedCourseObj = courses.find(c => c.id === selectedCourse);
      
      const response = await axios.post(`${apiUrl}/api/batches`, {
        name: batchName,
        course: selectedCourseObj?.title || 'General Course',
        courseId: selectedCourse,
        teacherId: user?.id,
        teacherName: user?.name,
        startDate: new Date(),
        status: 'active'
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.status === 200 || response.status === 201) {
        showToast('Batch created successfully!', 'success');
        setBatchName('');
        // Reload all batches
        await loadTeacherData();
      } else {
        showToast('Failed to create batch. Please try again.', 'error');
      }
    } catch (error) {
      console.error('Error creating batch:', error);
      showToast('Error creating batch. Please try again.', 'error');
    }
  };

  useEffect(() => {
    // This useEffect is not needed since we load batches in loadTeacherData
    // Keeping it empty to avoid any side effects
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
          📚 My Batches
        </button>
        {/* Commented out - My Students option disabled */}
        {/* <button
          className={`nav-item ${activeSection === 'students' ? 'active' : ''}`}
          onClick={() => setActiveSection('students')}
        >
          👥 My Students
        </button> */}
        {/* Commented out - My Lectures option disabled */}
        {/* <button
          className={`nav-item ${activeSection === 'lectures' ? 'active' : ''}`}
          onClick={() => setActiveSection('lectures')}
        >
          🎥 My Lectures
        </button> */}
        {/* Commented out - Schedule option disabled */}
        {/* <button
          className={`nav-item ${activeSection === 'schedule' ? 'active' : ''}`}
          onClick={() => setActiveSection('schedule')}
        >
          📅 Schedule
        </button> */}
      </nav>

      {/* Main Content */}
      <main className="dashboard-main">
        {activeSection === 'overview' && (
// ... (rest of the code remains the same)
          <div className="dashboard-section">
            {/* Hero Overview Section */}
            <div className="hero-overview">
              {/* Animated Gradient Background */}
              <div className="animated-gradient-background">
                <div className="gradient-overlay"></div>
                <div className="floating-particles" id="particles-container"></div>
                <div className="geometric-patterns" id="geometric-container"></div>
                
                {/* Glassmorphic Welcome Card */}
                <div className="welcome-glass-card">
                  <div className="welcome-content">
                    <div className="greeting-section">
                      <h1 className="welcome-title-modern">
                        Welcome back, <span className="user-name">{user?.name}</span>! 🤗
                      </h1>
                      <div className="typing-container">
                        <span className="typing-text">Ready to inspire and educate today?</span>
                        <span className="typing-cursor"></span>
                      </div>
                    </div>

                    {/* Quick Stats Row */}
                    <div className="quick-stats-row">
                      <div className="stat-pill">
                        <div className="stat-icon-modern">📊</div>
                        <div className="stat-info">
                          <div className="stat-value-modern">{user?.assignedCourses?.length || 1}</div>
                          <div className="stat-label-modern">Courses</div>
                        </div>
                      </div>
                      <div className="stat-pill">
                        <div className="stat-icon-modern">👥</div>
                        <div className="stat-info">
                          <div className="stat-value-modern">{students[0]?.count || 0}</div>
                          <div className="stat-label-modern">Students</div>
                        </div>
                      </div>
                      <div className="stat-pill">
                        <div className="stat-icon-modern">🎯</div>
                        <div className="stat-info">
                          <div className="stat-value-modern">{user?.domain || 'General'}</div>
                          <div className="stat-label-modern">Domain</div>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="action-buttons-row">
                      <button 
                        className="action-button primary"
                        onClick={() => setActiveSection('courses')}
                      >
                        <span className="button-icon">📚</span>
                        Manage Batches
                      </button>
                      <button 
                        className="action-button secondary"
                        onClick={() => setActiveSection('lectures')}
                      >
                        <span className="button-icon">🎬</span>
                        Upload Lecture
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'courses' && (
          <div className="dashboard-section">
            <div className="section-header">
              <h2>My Batches</h2>
              <div className="batch-stats">
                <span className="stat-item">
                  <span className="stat-number">{filteredBatches.length}</span>
                  <span className="stat-label">of {batches.length} batches</span>
                </span>
                {(batchSearch || courseFilter !== 'all' || statusFilter !== 'all') && (
                  <button className="clear-filters-btn" onClick={clearFilters}>
                    ✕ Clear Filters
                  </button>
                )}
              </div>
            </div>

            {/* Search and Filter Controls */}
            <div className="batch-controls">
              <div className="search-container">
                <div className="search-input-wrapper">
                  <span className="search-icon">🔍</span>
                  <input
                    type="text"
                    placeholder="Search batches by name or course..."
                    value={batchSearch}
                    onChange={(e) => setBatchSearch(e.target.value)}
                    className="search-input-modern"
                  />
                </div>
              </div>
              
              <div className="filter-container">
                <div className="filter-group">
                  <label>Course Type:</label>
                  <div className="filter-buttons">
                    <button 
                      className={`filter-btn ${courseFilter === 'all' ? 'active' : ''}`}
                      onClick={() => setCourseFilter('all')}
                    >
                      All Courses
                    </button>
                    <button 
                      className={`filter-btn ${courseFilter === 'data-science' ? 'active' : ''}`}
                      onClick={() => setCourseFilter('data-science')}
                    >
                      📊 Data Science
                    </button>
                    <button 
                      className={`filter-btn ${courseFilter === 'cyber-security' ? 'active' : ''}`}
                      onClick={() => setCourseFilter('cyber-security')}
                    >
                      🔒 Cyber Security
                    </button>
                    <button 
                      className={`filter-btn ${courseFilter === 'devops-ai' ? 'active' : ''}`}
                      onClick={() => setCourseFilter('devops-ai')}
                    >
                      🚀 DevOps & AI
                    </button>
                    <button 
                      className={`filter-btn ${courseFilter === 'devops-cloud' ? 'active' : ''}`}
                      onClick={() => setCourseFilter('devops-cloud')}
                    >
                      ☁️ DevOps & Cloud
                    </button>
                    <button 
                      className={`filter-btn ${courseFilter === 'one-to-one' ? 'active' : ''}`}
                      onClick={() => setCourseFilter('one-to-one')}
                    >
                      👥 One-to-One
                    </button>
                  </div>
                </div>
                
                <div className="filter-group">
                  <label>Status:</label>
                  <div className="filter-buttons">
                    <button 
                      className={`filter-btn ${statusFilter === 'all' ? 'active' : ''}`}
                      onClick={() => setStatusFilter('all')}
                    >
                      All Status
                    </button>
                    <button 
                      className={`filter-btn ${statusFilter === 'active' ? 'active' : ''}`}
                      onClick={() => setStatusFilter('active')}
                    >
                      ● Active
                    </button>
                    <button 
                      className={`filter-btn ${statusFilter === 'completed' ? 'active' : ''}`}
                      onClick={() => setStatusFilter('completed')}
                    >
                      ✓ Completed
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Modern Batch Grid */}
            <div className="batches-grid-modern">
              {filteredBatches.length > 0 ? (
                filteredBatches.map(batch => (
                  <div key={batch.id} className="batch-card-modern">
                    <div className="batch-header">
                      <div className="batch-title-section">
                        <span className="course-icon">{getCourseIcon(batch.course)}</span>
                        <h3>{batch.name}</h3>
                      </div>
                      <div className="batch-status">
                        <span 
                          className="status-badge" 
                          style={{ backgroundColor: getStatusColor(batch.status) }}
                        >
                          {(batch.status || 'active').charAt(0).toUpperCase() + (batch.status || 'active').slice(1)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="batch-content">
                      <div className="batch-info-row">
                        <span className="info-label">Course:</span>
                        <span className="info-value">{batch.course || 'General Course'}</span>
                      </div>
                      <div className="batch-info-row">
                        <span className="info-label">Students:</span>
                        <div className="student-count">
                          <span className="count-number">{batch.studentCount || batch.students?.length || 0}</span>
                          <span className="count-label">enrolled</span>
                        </div>
                      </div>
                      <div className="batch-info-row">
                        <span className="info-label">Type:</span>
                        <span className="batch-type">
                          {batch.batchType === 'one-to-one' ? '👥 One-to-One' : '📚 Regular Batch'}
                        </span>
                      </div>
                      {batch.startDate && (
                        <div className="batch-info-row">
                          <span className="info-label">Started:</span>
                          <span className="info-value">{formatDate(batch.startDate)}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="batch-actions-modern">
                      <button 
                        className="action-btn primary-btn" 
                        onClick={() => handleViewBatchDetail(batch.id)}
                      >
                        <span className="btn-icon">👁</span>
                        View Details
                      </button>
                      {/* Commented out - Delete batch functionality disabled for teachers */}
                      {/* <button 
                        className="action-btn secondary-btn" 
                        onClick={() => handleDeleteBatch(batch.id)}
                      >
                        <span className="btn-icon">🗑️</span>
                        Delete
                      </button> */}
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-state-modern">
                  <div className="empty-icon">📚</div>
                  <h3>No batches found</h3>
                  <p>
                    {batchSearch || courseFilter !== 'all' || statusFilter !== 'all' 
                      ? 'Try adjusting your search or filters to find what you\'re looking for.'
                      : 'No batches found. Create your first batch below!'}
                  </p>
                </div>
              )}
            </div>

            {/* Commented out - Add batch functionality disabled for teachers */}
            {/* <div className="add-batch-section-modern">
              <div className="add-batch-header">
                <h3>Create New Batch</h3>
                <span className="add-icon">➕</span>
              </div>
              <form onSubmit={handleBatchSubmit} className="add-batch-form-modern">
                <div className="form-row">
                  <div className="form-group-modern">
                    <label htmlFor="batchName">Batch Name *</label>
                    <input
                      type="text"
                      id="batchName"
                      value={batchName}
                      onChange={(e) => setBatchName(e.target.value)}
                      required
                      className="form-input-modern"
                      placeholder="Enter batch name..."
                    />
                  </div>
                </div>
                
                <button type="submit" className="add-batch-btn-modern">
                  <span className="btn-icon">✨</span>
                  Create Batch
                </button>
              </form>
            </div> */}
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
                        {lecture.youtubeUrl && (
                          <div className="youtube-info">
                            <span>🎬 YouTube: {lecture.youtubeUrl}</span>
                            <button 
                              className="watch-btn" 
                              onClick={() => window.open(lecture.youtubeUrl, '_blank')}
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
                    <button className="view-btn" onClick={() => handleViewBatchDetail(batch.id)}>
                      View Details
                    </button>
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