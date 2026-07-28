import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { ToastContainer, showToast } from './Toast';
import axios from 'axios';
import AssessmentStudio from './AssessmentStudio';
import ChangePasswordPanel from './ChangePasswordPanel';
import AccountMenu from './AccountMenu';
import './Dashboard.css';
import { getApiBaseUrl } from '../utils/apiBase';

const TeacherDashboard = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeSection, setActiveSection] = useState('overview');
  const [courses, setCourses] = useState(() => {
    try {
      const cached = sessionStorage.getItem('teacher_courses_cache');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [students, setStudents] = useState([]);
  const [lectures, setLectures] = useState([]);
  const [loading, setLoading] = useState(() => {
    try {
      return !sessionStorage.getItem('teacher_batches_cache');
    } catch {
      return true;
    }
  });
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
  const [editingLecture, setEditingLecture] = useState(null);
  const [showEditLectureModal, setShowEditLectureModal] = useState(false);
  const [editLectureForm, setEditLectureForm] = useState({
    title: '',
    description: '',
    duration: '',
    youtubeUrl: ''
  });
  const [savingLectureEdit, setSavingLectureEdit] = useState(false);
  const [editLectureNotesFile, setEditLectureNotesFile] = useState(null);
  const [batches, setBatches] = useState(() => {
    try {
      const cached = sessionStorage.getItem('teacher_batches_cache');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [teacherStudents, setTeacherStudents] = useState([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentName, setStudentName] = useState('');
  const [batchName, setBatchName] = useState('');
  const [batchSearch, setBatchSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingState, setLoadingState] = useState('Initializing dashboard...');

  useEffect(() => {
    const hasCache = batches.length > 0 || courses.length > 0;
    loadTeacherData({ soft: hasCache });
    // Only re-fetch when the signed-in teacher identity changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Handle navigation state when returning from TeacherBatchDetailsPage
  useEffect(() => {
    if (location.state?.activeSection) {
      setActiveSection(location.state.activeSection);
    }
  }, [location.state]);

  // Decorative particle effects disabled for performance / mobile
  useEffect(() => {
    return undefined;
  }, [activeSection]);

  useEffect(() => {
    return undefined;
  }, [loading]);

  // Handle batch deletion
  const handleDeleteBatch = async (batchId) => {
    if (!window.confirm('Are you sure you want to delete this batch?')) return;
    try {
      const token = localStorage.getItem('token');
      const apiUrl = getApiBaseUrl();
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

  const handleViewBatchDetail = (batchOrId) => {
    const id =
      typeof batchOrId === 'object' && batchOrId
        ? String(batchOrId.id || batchOrId._id || '')
        : String(batchOrId || '');
    if (!id || id === 'undefined' || id === 'null') {
      showToast('Could not open this batch — missing id.', 'error');
      return;
    }
    navigate(`/teacher/batch/${id}`, { state: { from: 'teacher-batches' } });
  };

  const getApiUrl = () => getApiBaseUrl();

  const loadTeacherStudents = async () => {
    setStudentsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${getApiUrl()}/api/teacher/students`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setTeacherStudents(data.students || []);
      } else {
        // Fallback: flatten from already-loaded batches (no email)
        const fromBatches = [];
        batches.forEach((batch) => {
          (batch.studentsList || batch.students || []).forEach((s) => {
            if (s && (s.name || s.id) && !String(s.name || '').includes('Total Students')) {
              fromBatches.push({
                id: s.id || s._id,
                name: s.name,
                enrollmentNumber: s.enrollmentNumber || '',
                course: s.course || batch.course || '',
                status: s.status || 'active',
                batchName: s.batchName || batch.name || ''
              });
            }
          });
        });
        setTeacherStudents(fromBatches);
      }
    } catch (error) {
      console.error('Error loading students:', error);
      setTeacherStudents([]);
    } finally {
      setStudentsLoading(false);
    }
  };

  const loadTeacherData = async ({ soft = false } = {}) => {
    // Soft refresh: keep current UI visible (no full-screen "Setting up dashboard")
    if (!soft) {
      setLoading(true);
      setLoadingProgress(0);
      setLoadingState('Initializing dashboard...');
    }
    
    try {
      const token = localStorage.getItem('token');
      const apiUrl = getApiBaseUrl();
      
      if (!soft) {
        setLoadingProgress(25);
        setLoadingState('Loading courses...');
      }
      
      // Load teacher dashboard data
      const coursesRes = await fetch(`${apiUrl}/api/teacher/courses`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const coursesData = coursesRes.ok ? await coursesRes.json() : [];
      const nextCourses = coursesData.courses || [];
      setCourses(nextCourses);
      try {
        sessionStorage.setItem('teacher_courses_cache', JSON.stringify(nextCourses));
      } catch (_) { /* ignore */ }

      if (!soft) {
        setLoadingProgress(50);
        setLoadingState('Loading batches...');
      }

      // Load teacher's batches using new teacher-specific endpoint
      const batchesRes = await fetch(`${apiUrl}/api/teacher/batches`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (batchesRes.ok) {
        const batchesData = await batchesRes.json();
        const nextBatches = batchesData.batches || batchesData || [];
        setBatches(nextBatches);
        try {
          sessionStorage.setItem('teacher_batches_cache', JSON.stringify(nextBatches));
        } catch (_) { /* ignore */ }

        if (!soft) {
          setLoadingProgress(75);
          setLoadingState('Loading student data...');
        }

        // Calculate total students from batches (now includes both regular and one-to-one)
        const totalStudents = nextBatches.reduce((total, batch) => {
          const studentCount = batch.studentCount || batch.students?.length || 0;
          return total + studentCount;
        }, 0);
        setStudents([{ id: 'total', name: 'Total Students', count: totalStudents }]);
      } else {
        // Fallback to admin endpoint if teacher endpoint fails
        if (!soft) setLoadingState('Switching to backup connection...');
        
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
          try {
            sessionStorage.setItem('teacher_batches_cache', JSON.stringify(teacherBatches));
          } catch (_) { /* ignore */ }

          if (!soft) {
            setLoadingProgress(75);
            setLoadingState('Loading student data...');
          }

          const totalStudents = teacherBatches.reduce((total, batch) => {
            const studentCount = batch.students?.length || batch.studentCount || 0;
            return total + studentCount;
          }, 0);
          setStudents([{ id: 'total', name: 'Total Students', count: totalStudents }]);
        } else {
          setBatches([]);
          setStudents([]);
        }
      }

      if (!soft) {
        setLoadingProgress(100);
        setLoadingState('Almost ready...');
      }
      
    } catch (error) {
      console.error('Error loading teacher data:', error);
      showToast('Error loading dashboard data', 'error');
      if (!soft) {
        setBatches([]);
        setStudents([]);
        setLoadingState('Connection error. Retrying...');
      }
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
      const apiUrl = getApiBaseUrl();
      
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
      const apiUrl = getApiBaseUrl();
      
      if (!uploadForm.batchId) {
        showToast('Please select a batch', 'error');
        setUploading(false);
        return;
      }

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
        courseId: uploadForm.batchId,
        batchId: uploadForm.batchId,
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


  const handleEditLecture = (lecture) => {
    setEditingLecture(lecture);
    setEditLectureForm({
      title: lecture.title || '',
      description: lecture.description || '',
      duration: lecture.duration || '',
      youtubeUrl: lecture.youtubeVideoUrl || lecture.youtubeUrl || ''
    });
    setEditLectureNotesFile(null);
    setShowEditLectureModal(true);
  };

  const handleSaveLectureEdit = async () => {
    if (!editingLecture) return;
    if (!editLectureForm.title.trim()) {
      showToast('Title is required', 'error');
      return;
    }
    setSavingLectureEdit(true);
    try {
      const token = localStorage.getItem('token');
      const apiUrl = getApiBaseUrl();
      const payload = {
        title: editLectureForm.title.trim(),
        description: editLectureForm.description.trim(),
        duration: editLectureForm.duration.trim()
      };
      if (editLectureForm.youtubeUrl.trim()) {
        payload.youtubeUrl = editLectureForm.youtubeUrl.trim();
      }

      const response = await fetch(`${apiUrl}/api/teacher/videos/${editingLecture.id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        showToast(data.message || 'Failed to update lecture', 'error');
        return;
      }

      if (editLectureNotesFile) {
        const formData = new FormData();
        formData.append('notesFile', editLectureNotesFile);
        const notesRes = await fetch(`${apiUrl}/api/teacher/videos/${editingLecture.id}/notes`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData
        });
        if (!notesRes.ok) {
          const notesData = await notesRes.json().catch(() => ({}));
          showToast(notesData.message || 'Lecture saved, but notes upload failed', 'error');
        }
      }

      showToast('Lecture updated successfully', 'success');
      setShowEditLectureModal(false);
      setEditingLecture(null);
      setEditLectureNotesFile(null);
      if (selectedCourse) {
        await loadLectures(selectedCourse);
      }
    } catch (error) {
      console.error('Edit lecture error:', error);
      showToast('Failed to update lecture. Please try again.', 'error');
    } finally {
      setSavingLectureEdit(false);
    }
  };

  const handleDeleteLecture = async (lectureId) => {
    if (!window.confirm('Are you sure you want to delete this lecture?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const apiUrl = getApiBaseUrl();
      
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
      const apiUrl = getApiBaseUrl();

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
      const apiUrl = getApiBaseUrl();

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
        await loadTeacherData({ soft: true });
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
        <div className="premium-loading-container">
          <div className="loading-backdrop">
            {/* Animated Background Elements */}
            <div className="loading-particles" id="loading-particles-container"></div>
            <div className="loading-geometric" id="loading-geometric-container"></div>
            
            <div className="loading-content">
              <div className="loading-animation">
                {/* Advanced Multi-Ring Spinner */}
                <div className="loading-spinner-advanced">
                  <div className="spinner-ring ring-1"></div>
                  <div className="spinner-ring ring-2"></div>
                  <div className="spinner-ring ring-3"></div>
                  <div className="spinner-core">
                    <div className="core-icon">📚</div>
                  </div>
                </div>
                
                {/* SVG Progress Ring */}
                <svg className="progress-ring" width="120" height="120">
                  <circle
                    className="progress-ring-background"
                    cx="60"
                    cy="60"
                    r="54"
                    fill="none"
                    stroke="rgba(79, 70, 229, 0.1)"
                    strokeWidth="4"
                  />
                  <circle
                    className="progress-ring-fill"
                    cx="60"
                    cy="60"
                    r="54"
                    fill="none"
                    stroke="url(#gradient)"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 54}`}
                    strokeDashoffset={`${2 * Math.PI * 54 * (1 - loadingProgress / 100)}`}
                    style={{
                      transition: 'stroke-dashoffset 0.3s ease'
                    }}
                  />
                  <defs>
                    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#4F46E5" />
                      <stop offset="50%" stopColor="#7C3AED" />
                      <stop offset="100%" stopColor="#06B6D4" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              
              <div className="loading-text">
                <h3 className="loading-title">Setting up your dashboard</h3>
                <p className="loading-status">{loadingState}</p>
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${loadingProgress}%` }}
                  ></div>
                </div>
                <div className="progress-percentage">{loadingProgress}%</div>
              </div>
              
              {/* Skeleton Cards representing dashboard sections */}
              <div className="loading-skeleton">
                <div className="skeleton-card skeleton-overview">
                  <div className="skeleton-header">
                    <div className="skeleton-title"></div>
                    <div className="skeleton-subtitle"></div>
                  </div>
                  <div className="skeleton-stats">
                    <div className="skeleton-stat"></div>
                    <div className="skeleton-stat"></div>
                    <div className="skeleton-stat"></div>
                  </div>
                </div>
                
                <div className="skeleton-card skeleton-batches">
                  <div className="skeleton-header">
                    <div className="skeleton-title"></div>
                    <div className="skeleton-badge"></div>
                  </div>
                  <div className="skeleton-content">
                    <div className="skeleton-row"></div>
                    <div className="skeleton-row"></div>
                    <div className="skeleton-row"></div>
                  </div>
                </div>
                
                <div className="skeleton-card skeleton-students">
                  <div className="skeleton-header">
                    <div className="skeleton-title"></div>
                  </div>
                  <div className="skeleton-grid">
                    <div className="skeleton-item"></div>
                    <div className="skeleton-item"></div>
                    <div className="skeleton-item"></div>
                    <div className="skeleton-item"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard ss-shell">
      <header className="ss-shell-header">
        <div className="ss-shell-header__row">
          <div className="ss-shell-brand">
            <h1 className="ss-shell-brand__name">Sky States LMS</h1>
            <p className="ss-shell-brand__role">Teacher</p>
          </div>
          <div className="ss-shell-actions">
            <AccountMenu
              user={user}
              onLogout={onLogout}
              onOpenAccount={() => setActiveSection('account')}
            />
          </div>
        </div>
        <nav className="ss-shell-nav" aria-label="Teacher">
          <button
            type="button"
            className={`ss-shell-nav__btn ${activeSection === 'overview' ? 'is-active' : ''}`}
            onClick={() => setActiveSection('overview')}
          >
            Overview
          </button>
          <button
            type="button"
            className={`ss-shell-nav__btn ${activeSection === 'courses' ? 'is-active' : ''}`}
            onClick={() => setActiveSection('courses')}
          >
            My batches
          </button>
          <button
            type="button"
            className={`ss-shell-nav__btn ${activeSection === 'students' ? 'is-active' : ''}`}
            onClick={() => {
              setActiveSection('students');
              loadTeacherStudents();
            }}
          >
            Students
          </button>
          <button
            type="button"
            className={`ss-shell-nav__btn ${activeSection === 'lectures' ? 'is-active' : ''}`}
            onClick={() => setActiveSection('lectures')}
          >
            Lectures
          </button>
          <button
            type="button"
            className={`ss-shell-nav__btn ${activeSection === 'assessment-studio' ? 'is-active' : ''}`}
            onClick={() => setActiveSection('assessment-studio')}
          >
            Assessment Studio
          </button>
          <button
            type="button"
            className={`ss-shell-nav__btn ${activeSection === 'account' ? 'is-active' : ''}`}
            onClick={() => setActiveSection('account')}
          >
            Account
          </button>
        </nav>
      </header>

      <div className="ss-shell-main">
        {activeSection === 'overview' && (
          <div className="dashboard-section">
            <h1 className="ss-page-title">Welcome back, {user?.name}</h1>
            <p className="ss-page-sub">Manage your batches, lectures, and student rosters.</p>

            <div className="ss-stat-row">
              <div className="ss-stat">
                <div className="ss-stat__value">{batches.length}</div>
                <div className="ss-stat__label">Batches</div>
              </div>
              <div className="ss-stat">
                <div className="ss-stat__value">
                  {batches.reduce((n, b) => n + (b.students?.length || b.studentCount || 0), 0)}
                </div>
                <div className="ss-stat__label">Students</div>
              </div>
              <div className="ss-stat">
                <div className="ss-stat__value">{lectures.length || '—'}</div>
                <div className="ss-stat__label">Lectures loaded</div>
              </div>
            </div>

            <div className="ss-panel">
              <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.05rem' }}>Quick actions</h2>
              <div className="ss-cta-row">
                <button type="button" className="ss-shell-btn ss-shell-btn--primary" onClick={() => setActiveSection('courses')}>
                  Open batches
                </button>
                <button type="button" className="ss-shell-btn" onClick={() => setActiveSection('lectures')}>
                  Add lecture
                </button>
                <button
                  type="button"
                  className="ss-shell-btn"
                  onClick={() => {
                    setActiveSection('students');
                    loadTeacherStudents();
                  }}
                >
                  View students
                </button>
              </div>
            </div>
          </div>
        )}


        {activeSection === 'courses' && (
          <div className="dashboard-section">
            <div className="section-header">
              <h1 className="ss-page-title">My batches</h1>
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
                        onClick={() => handleViewBatchDetail(batch)}
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
          <div className="dashboard-section teacher-students-section">
            <div className="section-header">
              <div>
                <h2>My Students</h2>
                <p className="section-subtitle">
                  Students in your batches. Contact details are private and not shared with teachers.
                </p>
              </div>
              <button
                type="button"
                className="btn-secondary"
                onClick={loadTeacherStudents}
                disabled={studentsLoading}
              >
                {studentsLoading ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>

            <div className="teacher-students-toolbar">
              <input
                type="search"
                className="form-input-modern"
                placeholder="Search by name, course, or batch…"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
              />
              <span className="stat-item">
                <span className="stat-number">
                  {teacherStudents.filter((s) => {
                    const q = studentSearch.trim().toLowerCase();
                    if (!q) return true;
                    return [s.name, s.course, s.batchName, s.enrollmentNumber]
                      .filter(Boolean)
                      .some((v) => String(v).toLowerCase().includes(q));
                  }).length}
                </span>
                <span className="stat-label">students</span>
              </span>
            </div>

            {studentsLoading ? (
              <p className="no-data">Loading students…</p>
            ) : (
              <div className="teacher-students-table-wrap">
                <table className="teacher-students-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Course</th>
                      <th>Batch</th>
                      <th>Enrollment</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {teacherStudents
                      .filter((s) => {
                        const q = studentSearch.trim().toLowerCase();
                        if (!q) return true;
                        return [s.name, s.course, s.batchName, s.enrollmentNumber]
                          .filter(Boolean)
                          .some((v) => String(v).toLowerCase().includes(q));
                      })
                      .map((student) => (
                        <tr key={student.id}>
                          <td>
                            <div className="teacher-student-name">
                              <span className="teacher-student-avatar">
                                {(student.name || '?').charAt(0).toUpperCase()}
                              </span>
                              {student.name}
                            </div>
                          </td>
                          <td>{student.course || '—'}</td>
                          <td>{student.batchName || '—'}</td>
                          <td>{student.enrollmentNumber || '—'}</td>
                          <td>
                            <span className={`status-chip ${(student.status || 'active').toLowerCase()}`}>
                              {student.status || 'active'}
                            </span>
                          </td>
                          <td>
                            {student.batchId && (
                              <button
                                type="button"
                                className="btn-secondary btn-sm"
                                onClick={() => handleViewBatchDetail(student.batchId)}
                              >
                                Open batch
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {teacherStudents.length === 0 && (
                  <p className="no-data">No students enrolled in your batches yet.</p>
                )}
              </div>
            )}
          </div>
        )}

        {activeSection === 'lectures' && (
          <div className="dashboard-section">
            <div className="section-header">
              <div>
                <h2>Lectures</h2>
                <p className="section-subtitle">Add YouTube lectures to a batch. Students will see them in Classroom.</p>
              </div>
            </div>
            
            {/* Upload Form */}
            <div className="upload-section">
              <h3>Add lecture</h3>
              <form onSubmit={handleUploadSubmit} className="upload-form">
                <div className="form-grid">
                  <div className="form-group">
                    <label htmlFor="title">Lecture title *</label>
                    <input
                      type="text"
                      id="title"
                      value={uploadForm.title}
                      onChange={(e) => setUploadForm({...uploadForm, title: e.target.value})}
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="batchId">Batch *</label>
                    <select
                      id="batchId"
                      value={uploadForm.batchId}
                      onChange={(e) => {
                        const batchId = e.target.value;
                        setUploadForm({ ...uploadForm, batchId, courseId: batchId });
                        setSelectedCourse(batchId);
                        if (batchId) loadLectures(batchId);
                      }}
                      required
                    >
                      <option value="">Select a batch</option>
                      {batches.map(batch => (
                        <option key={batch.id} value={batch.id}>
                          {batch.name}{batch.course ? ` · ${batch.course}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="form-group full-width">
                    <label htmlFor="description">Description</label>
                    <textarea
                      id="description"
                      value={uploadForm.description}
                      onChange={(e) => setUploadForm({...uploadForm, description: e.target.value})}
                      rows="3"
                    />
                  </div>
                  
                  <div className="form-group full-width">
                    <label htmlFor="youtubeUrl">YouTube video URL *</label>
                    <input
                      type="url"
                      id="youtubeUrl"
                      value={uploadForm.youtubeUrl}
                      onChange={(e) => setUploadForm({...uploadForm, youtubeUrl: e.target.value})}
                      placeholder="https://www.youtube.com/watch?v=..."
                      required
                    />
                    <small>Use youtube.com/watch?v=… or youtu.be/…</small>
                  </div>
                </div>
                
                <button type="submit" className="upload-btn" disabled={uploading}>
                  {uploading ? 'Adding lecture…' : 'Add lecture'}
                </button>
              </form>
            </div>

            {/* Lectures List */}
            {selectedCourse && (
              <div className="lectures-section">
                <h3>
                  Lectures for{' '}
                  {batches.find((b) => b.id === selectedCourse)?.name || 'selected batch'}
                </h3>
                {lectures.length > 0 ? (
                  <div className="lectures-grid">
                    {lectures.map(lecture => (
                      <div key={lecture.id} className="lecture-card">
                        <div className="lecture-header">
                          <h4>{lecture.title}</h4>
                          {lecture.duration && (
                            <span className="lecture-duration">{lecture.duration}</span>
                          )}
                        </div>
                        {lecture.description && <p>{lecture.description}</p>}
                        <div className="lecture-meta">
                          <span>Added {formatDate(lecture.createdAt)}</span>
                        </div>
                        {(lecture.youtubeVideoUrl || lecture.youtubeUrl) && (
                          <div className="youtube-info">
                            <button
                              type="button"
                              className="watch-btn"
                              onClick={() =>
                                window.open(lecture.youtubeVideoUrl || lecture.youtubeUrl, '_blank')
                              }
                            >
                              Watch on YouTube
                            </button>
                          </div>
                        )}
                        <div className="lecture-actions">
                          <button
                            type="button"
                            className="edit-btn"
                            onClick={() => handleEditLecture(lecture)}
                          >
                            Edit details
                          </button>
                          <button
                            type="button"
                            className="delete-btn"
                            onClick={() => handleDeleteLecture(lecture.id)}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="no-data">No lectures for this batch yet.</p>
                )}
              </div>
            )}
            
            {!selectedCourse && (
              <p className="no-data">Select a batch to view and add lectures.</p>
            )}
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
                    <button className="view-btn" onClick={() => handleViewBatchDetail(batch)}>
                      View Details
                    </button>
                    <button className="delete-btn" onClick={() => handleDeleteBatch(batch.id || batch._id)}>
                      Delete Batch
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
        {activeSection === 'assessment-studio' && (
          <div className="dashboard-section">
            <AssessmentStudio user={user} />
          </div>
        )}


        {activeSection === 'account' && (
          <div className="dashboard-section">
            <h1 className="ss-page-title">My account</h1>
            <p className="ss-page-sub">
              Signed in as {user?.email}. Change your password with an email verification code.
            </p>
            <div className="ss-panel" style={{ maxWidth: 520 }}>
              <p><strong>Name:</strong> {user?.name || '—'}</p>
              <p><strong>Email:</strong> {user?.email || '—'}</p>
              <p><strong>Role:</strong> {user?.role || 'teacher'}</p>
              <ChangePasswordPanel mode="change" defaultEmail={user?.email || ''} />
            </div>
          </div>
        )}
      </div>

      {/* Toast Notifications - Rendered via portal for proper stacking */}

      {showEditLectureModal && editingLecture && (
        <div className="modal-overlay" onClick={() => !savingLectureEdit && setShowEditLectureModal(false)}>
          <div className="modal edit-modal sky-edit-lecture-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="sky-modal-eyebrow">Lecture details</p>
                <h3>Edit lecture</h3>
              </div>
              <button
                type="button"
                className="close-button"
                disabled={savingLectureEdit}
                onClick={() => setShowEditLectureModal(false)}
              >
                ×
              </button>
            </div>
            <div className="edit-form">
              <div className="form-group">
                <label htmlFor="td-lecture-title">Title *</label>
                <input
                  id="td-lecture-title"
                  type="text"
                  value={editLectureForm.title}
                  onChange={(e) => setEditLectureForm({ ...editLectureForm, title: e.target.value })}
                  maxLength={200}
                />
              </div>
              <div className="form-group">
                <label htmlFor="td-lecture-youtube">YouTube URL</label>
                <input
                  id="td-lecture-youtube"
                  type="url"
                  value={editLectureForm.youtubeUrl}
                  onChange={(e) => setEditLectureForm({ ...editLectureForm, youtubeUrl: e.target.value })}
                  placeholder="https://www.youtube.com/watch?v=… or https://youtu.be/…"
                />
                <small>Update this to change the lecture content students see.</small>
              </div>
              <div className="form-group">
                <label htmlFor="td-lecture-duration">Duration</label>
                <input
                  id="td-lecture-duration"
                  type="text"
                  value={editLectureForm.duration}
                  onChange={(e) => setEditLectureForm({ ...editLectureForm, duration: e.target.value })}
                  placeholder="e.g. 45 min"
                  maxLength={50}
                />
              </div>
              <div className="form-group">
                <label htmlFor="td-lecture-description">Description / content notes</label>
                <textarea
                  id="td-lecture-description"
                  rows="4"
                  value={editLectureForm.description}
                  onChange={(e) => setEditLectureForm({ ...editLectureForm, description: e.target.value })}
                  maxLength={1000}
                />
              </div>
              <div className="form-group">
                <label htmlFor="td-lecture-notes">Replace notes file (optional)</label>
                <input
                  id="td-lecture-notes"
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => setEditLectureNotesFile(e.target.files?.[0] || null)}
                />
                <small>
                  {editLectureNotesFile
                    ? `Selected: ${editLectureNotesFile.name}`
                    : editingLecture.notesAvailable
                      ? `Current notes: ${editingLecture.notesFileName || 'attached'}`
                      : 'No notes attached yet'}
                </small>
              </div>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="sky-btn sky-btn-secondary"
                disabled={savingLectureEdit}
                onClick={() => setShowEditLectureModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="sky-btn sky-btn-primary"
                disabled={savingLectureEdit}
                onClick={handleSaveLectureEdit}
              >
                {savingLectureEdit ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}

            {createPortal(<ToastContainer />, document.body)}
    </div>
  );
};

export default TeacherDashboard;