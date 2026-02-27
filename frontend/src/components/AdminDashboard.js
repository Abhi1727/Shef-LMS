import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { COLLECTIONS } from '../services/firebaseService';
import { ToastContainer, showToast } from './Toast';
import fallbackData from '../data/fallbackData';
import { YouTubeUtils } from '../utils/youtubeUtils';
import StudentsActivity from './StudentsActivity';
import OneToOneCourseSelection from './OneToOneCourseSelection';
import './AdminDashboard.css';

const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

// Student search bar that filters the main students table
const StudentSearch = memo(({ searchEmail, setSearchEmail, clearSearch }) => {
  const handleInputChange = useCallback((e) => {
    const value = e.target.value;
    setSearchEmail(value);
    if (value === '') {
      clearSearch();
    }
  }, [clearSearch, setSearchEmail]);

  const handleSearchSubmit = useCallback((e) => {
    // Prevent page reload; filtering happens as you type
    e.preventDefault();
  }, []);

  return (
    <div className="student-search-section">
      <div className="student-search-header">
        <h3>🔍 Search Students</h3>
        <p className="student-search-subtitle">Filter the students list by email or name.</p>
      </div>
      <form onSubmit={handleSearchSubmit} className="search-form">
        <div className="search-input-group">
          <input
            type="search"
            placeholder="Type an email or name to filter students..."
            value={searchEmail}
            onChange={handleInputChange}
            className="search-input"
          />
          {searchEmail && (
            <button type="button" onClick={clearSearch} className="btn-clear">
              ✖️ Clear
            </button>
          )}
        </div>
      </form>
    </div>
  );
});

const AdminDashboard = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
  const [activeSection, setActiveSection] = useState('overview');
  const [loading, setLoading] = useState(true);
  
  // Data states
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [batches, setBatches] = useState([]);
  const [oneToOneBatches, setOneToOneBatches] = useState([]);
  const [modules, setModules] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [projects, setProjects] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [mentors, setMentors] = useState([]);
  const [classroomVideos, setClassroomVideos] = useState([]);
  const [liveClasses, setLiveClasses] = useState([]);
  const [stats, setStats] = useState({});
  const [activities, setActivities] = useState([]);
  
  // Student Profile Modal states
  const [showStudentDetailsModal, setShowStudentDetailsModal] = useState(false);
  const [selectedStudentDetails, setSelectedStudentDetails] = useState(null);
  const [activeProfileTab, setActiveProfileTab] = useState('profile');
  const [editMode, setEditMode] = useState(false);
  const [editedProfile, setEditedProfile] = useState({});
  const [studentActivities, setStudentActivities] = useState([]);
  const [activityFilter, setActivityFilter] = useState({ action: '', dateRange: 'all' });
  const [activityPagination, setActivityPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [reportPeriod, setReportPeriod] = useState('7days');
  const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' });
  const [reportData, setReportData] = useState(null);
  
  // Loading states for individual data types
  const [dataLoading, setDataLoading] = useState({
    students: false,
    teachers: false,
    courses: false,
    batches: false,
    modules: false,
    lessons: false,
    projects: false,
    assessments: false,
    jobs: false,
    mentors: false,
    classroom: false,
    liveClasses: false,
    activity: false
  });
  
  // Cache management
  const CACHE_DURATION = 90 * 1000; // 90 seconds - reduces stale data, still limits API calls
  const getCachedData = useCallback((key) => {
    try {
      const cached = localStorage.getItem(`admin_cache_${key}`);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION) {
          return data;
        }
      }
    } catch (error) {
      console.error('Cache read error:', error);
    }
    return null;
  }, []);

  const setCachedData = useCallback((key, data) => {
    try {
      localStorage.setItem(`admin_cache_${key}`, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('Cache write error:', error);
    }
  }, []);

  const clearCache = useCallback((key = null) => {
    if (key) {
      localStorage.removeItem(`admin_cache_${key}`);
    } else {
      Object.keys(localStorage).forEach(localStorageKey => {
        if (localStorageKey.startsWith('admin_cache_')) {
          localStorage.removeItem(localStorageKey);
        }
      });
    }
  }, []);

  // Search functionality (filters the students table)
  const [searchEmail, setSearchEmail] = useState('');

  const clearSearch = useCallback(() => {
    setSearchEmail('');
    setStudentPage(1);
  }, []);

  const openStudentDetails = useCallback((student) => {
    setSelectedStudentDetails(student);
    setActiveProfileTab('profile');
    setEditMode(false);
    setEditedProfile({});
    setShowStudentDetailsModal(true);
    clearSearch();
  }, [clearSearch]);

  const handleBatchClick = useCallback((batch) => {
    const batchId = batch.id || batch._id;
    console.log('Navigating to batch:', {
      batchName: batch.name,
      batchId: batchId,
      fullBatch: batch
    });
    navigate(`/admin/batch/${batchId}`);
  }, [navigate]);

  const handleBatchViewSelect = useCallback((view) => {
    setBatchView(view);
  }, []);

  const closeBatchDetailsModal = useCallback(() => {
    setShowBatchDetailsModal(false);
    setSelectedBatch(null);
    setBatchView('');
  }, []);

  // Memoized stats component
  const StatsCards = memo(({ stats }) => (
    <div className="stats-grid">
      <div className="stat-card">
        <div className="stat-icon">👥</div>
        <div className="stat-info">
          <h3>{stats.totalStudents || 0}</h3>
          <p>Total Students</p>
          <span className="stat-change positive">+{stats.activeStudents || 0} active</span>
        </div>
      </div>
      
      <div className="stat-card">
        <div className="stat-icon">📚</div>
        <div className="stat-info">
          <h3>{stats.totalCourses || 0}</h3>
          <p>Total Courses</p>
          <span className="stat-change">Available</span>
        </div>
      </div>
      
      <div className="stat-card">
        <div className="stat-icon">💼</div>
        <div className="stat-info">
          <h3>{stats.activeJobs || 0}</h3>
          <p>Active Jobs</p>
          <span className="stat-change positive">Open positions</span>
        </div>
      </div>
      
      <div className="stat-card">
        <div className="stat-icon">📈</div>
        <div className="stat-info">
          <h3>{stats.completionRate || 0}%</h3>
          <p>Completion Rate</p>
          <span className="stat-change">Overall progress</span>
        </div>
      </div>
    </div>
  ));
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({});
  
  // Batch details modal state
  const [showBatchDetailsModal, setShowBatchDetailsModal] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [batchView, setBatchView] = useState(''); // 'videos' or 'students'
  const [studentPage, setStudentPage] = useState(1);
  const [studentsPerPage, setStudentsPerPage] = useState(5);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = React.useRef(null);

  // Manage body scroll when modal is open
  useEffect(() => {
    if (showModal) {
      document.body.style.overflow = 'hidden';
      document.body.classList.add('modal-open');
    } else {
      document.body.style.overflow = '';
      document.body.classList.remove('modal-open');
    }
    
    // Cleanup on unmount
    return () => {
      document.body.style.overflow = '';
      document.body.classList.remove('modal-open');
    };
  }, [showModal]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (moreRef.current && !moreRef.current.contains(e.target)) setMoreOpen(false);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);
  const [saving, setSaving] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);

  const handleFileUpload = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showToast('File size must be less than 5MB', 'error');
      e.target.value = '';
      return;
    }
    
    // Check file type
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (!allowedTypes.includes(file.type)) {
      showToast('Only PDF and Word documents are allowed', 'error');
      e.target.value = '';
      return;
    }
    
    setUploadedFile(file);
    setFormData(prev => ({
      ...prev,
      fileName: file.name,
      fileSize: file.size
    }));
  }, []);

  // Filter teachers by selected course for batch modal
  const getFilteredTeachers = useCallback(() => {
    if (modalType !== 'batch' || !formData.course) {
      return teachers;
    }
    return (teachers || []).filter(teacher => teacher.domain === formData.course);
  }, [modalType, formData.course, teachers]);

  useEffect(() => {
    loadAllData();
    // Intentionally run once on mount. Including `loadAllData` here can throw
    // at runtime because `loadAllData` is declared later in this file.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset form when modal type changes to prevent data leakage
  useEffect(() => {
    if (modalType && !editingItem) {
      // Only reset if we're not editing an existing item
      const cleanDefaults = getDefaultFormData(modalType);
      cleanDefaults.email = '';
      cleanDefaults.password = '';
      setFormData(cleanDefaults);
    }
  }, [modalType, editingItem]);

  // Derived filtered & paginated data for students section
  const filteredStudents = useMemo(() => {
    if (!searchEmail.trim()) return students;
    const term = searchEmail.trim().toLowerCase();
    return students.filter(student => {
      const email = (student.email || '').toLowerCase();
      const name = (student.name || '').toLowerCase();
      return email.includes(term) || name.includes(term);
    });
  }, [students, searchEmail]);

  const totalStudentPages = Math.max(1, Math.ceil(filteredStudents.length / studentsPerPage));
  const currentStudentPage = Math.min(studentPage, totalStudentPages);
  const studentStartIndex = (currentStudentPage - 1) * studentsPerPage;
  const studentEndIndex = studentStartIndex + studentsPerPage;
  const paginatedStudents = filteredStudents.slice(studentStartIndex, studentEndIndex);

  // Optimized individual data loading functions
  const loadStudents = useCallback(async (forceRefresh = false) => {
    const isLocalhost = window.location.hostname === 'localhost';
    const cachedData = getCachedData('students');
    if (cachedData && !forceRefresh) {
      setStudents(cachedData);
      return cachedData;
    }

    setDataLoading(prev => ({ ...prev, students: true }));
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    try {
      const token = localStorage.getItem('token');
      const apiUrl = isLocalhost ? 'http://localhost:5000' : '';
      const response = await fetch(`${apiUrl}/api/admin/users`, {
        headers: { 'Authorization': `Bearer ${token}` },
        signal: controller.signal
      });
      
      if (response.ok) {
        const data = await response.json();
        setStudents(data);
        setCachedData('students', data);
        setStudentPage(1);
        return data;
      } else {
        // In production, never silently fall back to demo data.
        const errorText = await response.text();
        console.error('Failed to load students:', response.status, errorText);
        showToast('Failed to load students from server. Please re-login and try again.', 'error');
        setStudents([]);
        setCachedData('students', []);
        setStudentPage(1);
        return [];
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.warn('Students request timed out');
        showToast('Students loading timed out. Showing last cached data if available.', 'warning');
        const cached = getCachedData('students');
        if (cached) {
          setStudents(cached);
          return cached;
        }
      } else {
        console.error('Error loading students:', error);
      }
      // Do not use demo data in production; surface the error instead.
      setStudents([]);
      setCachedData('students', []);
      setStudentPage(1);
      showToast('Failed to load students. Please check network and try again.', 'error');
      return [];
    } finally {
      clearTimeout(timeoutId);
      setDataLoading(prev => ({ ...prev, students: false }));
    }
  }, [getCachedData, setCachedData]);

  const loadTeachers = useCallback(async (forceRefresh = false) => {
    const cachedData = getCachedData('teachers');
    if (cachedData && !forceRefresh) {
      setTeachers(cachedData);
      return cachedData;
    }

    setDataLoading(prev => ({ ...prev, teachers: true }));
    try {
      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
      const response = await fetch(`${apiUrl}/api/admin/teachers`, { 
        headers: { 'Authorization': `Bearer ${token}` } 
      });
      
      if (response.ok) {
        const data = await response.json();
        setTeachers(data);
        setCachedData('teachers', data);
        return data;
      } else {
        // Use fallback data when API fails
        console.log('Using fallback teacher data');
        setTeachers(fallbackData.teachers);
        setCachedData('teachers', fallbackData.teachers);
        return fallbackData.teachers;
      }
    } catch (error) {
      console.error('Error loading teachers:', error);
      // Use fallback data when error occurs
      console.log('Using fallback teacher data due to error');
      setTeachers(fallbackData.teachers);
      setCachedData('teachers', fallbackData.teachers);
      return fallbackData.teachers;
    } finally {
      setDataLoading(prev => ({ ...prev, teachers: false }));
    }
  }, [getCachedData, setCachedData]);

  const loadCourses = useCallback(async (forceRefresh = false) => {
    const cachedData = getCachedData('courses');
    if (cachedData && !forceRefresh) {
      setCourses(cachedData);
      return cachedData;
    }

    setDataLoading(prev => ({ ...prev, courses: true }));
    try {
      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
      const response = await fetch(`${apiUrl}/api/admin/courses`, { 
        headers: { 'Authorization': `Bearer ${token}` } 
      });
      
      if (response.ok) {
        const data = await response.json();
        setCourses(data);
        setCachedData('courses', data);
        return data;
      } else {
        // Use fallback data when API fails
        console.log('Using fallback course data');
        setCourses(fallbackData.courses);
        setCachedData('courses', fallbackData.courses);
        return fallbackData.courses;
      }
    } catch (error) {
      console.error('Error loading courses:', error);
      // Use fallback data when error occurs
      console.log('Using fallback course data due to error');
      setCourses(fallbackData.courses);
      setCachedData('courses', fallbackData.courses);
      return fallbackData.courses;
    } finally {
      setDataLoading(prev => ({ ...prev, courses: false }));
    }
  }, [getCachedData, setCachedData]);

  const loadBatches = useCallback(async (forceRefresh = false) => {
    const cachedData = getCachedData('batches');
    if (cachedData && !forceRefresh) {
      setBatches(cachedData);
      // Also load one-to-one batches
      loadOneToOneBatches(forceRefresh);
      return cachedData;
    }

    setDataLoading(prev => ({ ...prev, batches: true }));
    try {
      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
      
      // Load regular batches
      const response = await fetch(`${apiUrl}/api/admin/batches`, { 
        headers: { 'Authorization': `Bearer ${token}` } 
      });
      
      if (response.ok) {
        const data = await response.json();
        const normalized = data.batches || data || [];
        setBatches(normalized);
        setCachedData('batches', normalized);
        
        // Also load one-to-one batches
        loadOneToOneBatches(forceRefresh);
        
        return normalized;
      } else {
        console.log('Using fallback batch data');
        setBatches(fallbackData.batches);
        setCachedData('batches', fallbackData.batches);
        return fallbackData.batches;
      }
    } catch (error) {
      console.error('Error loading batches:', error);
      console.log('Using fallback batch data due to error');
      setBatches(fallbackData.batches);
      setCachedData('batches', fallbackData.batches);
      return fallbackData.batches;
    } finally {
      setDataLoading(prev => ({ ...prev, batches: false }));
    }
  }, [getCachedData, setCachedData]);

  const loadOneToOneBatches = useCallback(async (forceRefresh = false) => {
    const cachedData = getCachedData('oneToOneBatches');
    if (cachedData && !forceRefresh) {
      setOneToOneBatches(cachedData);
      return cachedData;
    }

    try {
      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
      
      // Load one-to-one batches
      const response = await fetch(`${apiUrl}/api/admin/one-to-one-batches`, { 
        headers: { 'Authorization': `Bearer ${token}` } 
      });
      
      if (response.ok) {
        const data = await response.json();
        const normalized = (data.batches || data || []).map(batch => ({
          ...batch,
          id: batch.id || String(batch._id),
          name: batch.name || 'Unnamed Batch'
        }));
        setOneToOneBatches(normalized);
        setCachedData('oneToOneBatches', normalized);
        return normalized;
      } else {
        console.log('Failed to load one-to-one batches');
        setOneToOneBatches([]);
        return [];
      }
    } catch (error) {
      console.error('Error loading one-to-one batches:', error);
      setOneToOneBatches([]);
      return [];
    }
  }, [getCachedData, setCachedData]);

  const loadModules = useCallback(async (forceRefresh = false) => {
    const cachedData = getCachedData('modules');
    if (cachedData && !forceRefresh) {
      setModules(cachedData);
      return cachedData;
    }

    setDataLoading(prev => ({ ...prev, modules: true }));
    try {
      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
      const response = await fetch(`${apiUrl}/api/admin/modules`, { 
        headers: { 'Authorization': `Bearer ${token}` } 
      });
      
      if (response.ok) {
        const data = await response.json();
        setModules(data);
        setCachedData('modules', data);
        return data;
      } else {
        setModules([]);
        return [];
      }
    } catch (error) {
      console.error('Error loading modules:', error);
      setModules([]);
      return [];
    } finally {
      setDataLoading(prev => ({ ...prev, modules: false }));
    }
  }, [getCachedData, setCachedData]);

  const loadLessons = useCallback(async (forceRefresh = false) => {
    const cachedData = getCachedData('lessons');
    if (cachedData && !forceRefresh) {
      setLessons(cachedData);
      return cachedData;
    }

    setDataLoading(prev => ({ ...prev, lessons: true }));
    try {
      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
      const response = await fetch(`${apiUrl}/api/admin/lessons`, { 
        headers: { 'Authorization': `Bearer ${token}` } 
      });
      
      if (response.ok) {
        const data = await response.json();
        setLessons(data);
        setCachedData('lessons', data);
        return data;
      } else {
        setLessons([]);
        return [];
      }
    } catch (error) {
      console.error('Error loading lessons:', error);
      setLessons([]);
      return [];
    } finally {
      setDataLoading(prev => ({ ...prev, lessons: false }));
    }
  }, [getCachedData, setCachedData]);

  const loadClassroomVideos = useCallback(async (forceRefresh = false) => {
    const cachedData = getCachedData('classroom');
    if (cachedData && !forceRefresh) {
      setClassroomVideos(cachedData);
      return cachedData;
    }

    setDataLoading(prev => ({ ...prev, classroom: true }));
    try {
      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
      const response = await fetch(`${apiUrl}/api/admin/classroom`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setClassroomVideos(data);
        setCachedData('classroom', data);
        return data;
      }

      setClassroomVideos([]);
      return [];
    } catch (error) {
      console.error('Error loading classroom videos:', error);
      setClassroomVideos([]);
      return [];
    } finally {
      setDataLoading(prev => ({ ...prev, classroom: false }));
    }
  }, [getCachedData, setCachedData]);

  const loadMentors = useCallback(async (forceRefresh = false) => {
    const cachedData = getCachedData('mentors');
    if (cachedData && !forceRefresh) {
      setMentors(cachedData);
      return cachedData;
    }

    setDataLoading(prev => ({ ...prev, mentors: true }));
    try {
      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
      const response = await fetch(`${apiUrl}/api/admin/mentors`, { 
        headers: { 'Authorization': `Bearer ${token}` } 
      });
      
      if (response.ok) {
        const data = await response.json();
        setMentors(data);
        setCachedData('mentors', data);
        return data;
      } else {
        setMentors([]);
        return [];
      }
    } catch (error) {
      console.error('Error loading mentors:', error);
      setMentors([]);
      return [];
    } finally {
      setDataLoading(prev => ({ ...prev, mentors: false }));
    }
  }, [getCachedData, setCachedData]);

  const loadProjects = useCallback(async (forceRefresh = false) => {
    const cachedData = getCachedData('projects');
    if (cachedData && !forceRefresh) {
      setProjects(cachedData);
      return cachedData;
    }

    setDataLoading(prev => ({ ...prev, projects: true }));
    try {
      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
      const response = await fetch(`${apiUrl}/api/admin/projects`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setProjects(data);
        setCachedData('projects', data);
        return data;
      }

      setProjects([]);
      return [];
    } catch (error) {
      console.error('Error loading projects:', error);
      setProjects([]);
      return [];
    } finally {
      setDataLoading(prev => ({ ...prev, projects: false }));
    }
  }, [getCachedData, setCachedData]);

  const loadAssessments = useCallback(async (forceRefresh = false) => {
    const cachedData = getCachedData('assessments');
    if (cachedData && !forceRefresh) {
      setAssessments(cachedData);
      return cachedData;
    }

    setDataLoading(prev => ({ ...prev, assessments: true }));
    try {
      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
      const response = await fetch(`${apiUrl}/api/admin/assessments`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setAssessments(data);
        setCachedData('assessments', data);
        return data;
      }

      setAssessments([]);
      return [];
    } catch (error) {
      console.error('Error loading assessments:', error);
      setAssessments([]);
      return [];
    } finally {
      setDataLoading(prev => ({ ...prev, assessments: false }));
    }
  }, [getCachedData, setCachedData]);

  const loadJobs = useCallback(async (forceRefresh = false) => {
    const cachedData = getCachedData('jobs');
    if (cachedData && !forceRefresh) {
      setJobs(cachedData);
      return cachedData;
    }

    setDataLoading(prev => ({ ...prev, jobs: true }));
    try {
      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
      const response = await fetch(`${apiUrl}/api/admin/jobs`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setJobs(data);
        setCachedData('jobs', data);
        return data;
      }

      setJobs([]);
      return [];
    } catch (error) {
      console.error('Error loading jobs:', error);
      setJobs([]);
      return [];
    } finally {
      setDataLoading(prev => ({ ...prev, jobs: false }));
    }
  }, [getCachedData, setCachedData]);

  const loadLiveClasses = useCallback(async (forceRefresh = false) => {
    const cachedData = getCachedData('liveClasses');
    if (cachedData && !forceRefresh) {
      setLiveClasses(cachedData);
      return cachedData;
    }

    setDataLoading(prev => ({ ...prev, liveClasses: true }));
    try {
      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
      const response = await fetch(`${apiUrl}/api/admin/liveClasses`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setLiveClasses(data);
        setCachedData('liveClasses', data);
        return data;
      }

      setLiveClasses([]);
      return [];
    } catch (error) {
      console.error('Error loading live classes:', error);
      setLiveClasses([]);
      return [];
    } finally {
      setDataLoading(prev => ({ ...prev, liveClasses: false }));
    }
  }, [getCachedData, setCachedData]);

  const loadActivity = useCallback(async (forceRefresh = true) => {
    setDataLoading(prev => ({ ...prev, activity: true }));
    try {
      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
      const response = await fetch(`${apiUrl}/api/admin/activity?limit=200`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const { activities: list } = await response.json();
        setActivities(list || []);
        return list || [];
      }
      setActivities([]);
      return [];
    } catch (error) {
      console.error('Error loading activity:', error);
      setActivities([]);
      return [];
    } finally {
      setDataLoading(prev => ({ ...prev, activity: false }));
    }
  }, []);

  // Load data based on active section (on-demand loading with timeout)
  const loadSectionData = useCallback(async (section) => {
    const timeout = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error('Request timeout')), ms));

    try {
      switch (section) {
        case 'overview':
          await Promise.race([
            Promise.all([
              loadStudents(true),
              loadCourses(true),
              loadTeachers(true),
              loadBatches(true)
            ]),
            timeout(10000)
          ]);
          break;
        case 'students':
          await Promise.race([
            Promise.all([
              loadStudents(true),
              loadBatches(true)
            ]),
            timeout(8000)
          ]);
          break;
        case 'teachers':
          await Promise.race([loadTeachers(true), timeout(5000)]);
          break;
        case 'courses':
          await Promise.race([loadCourses(true), timeout(5000)]);
          break;
        case 'batches':
          await Promise.race([
            Promise.all([
              loadCourses(true),
              loadBatches(true),
              loadTeachers(true)
            ]),
            timeout(8000)
          ]);
          break;
        case 'modules':
          await Promise.race([
            Promise.all([
              loadCourses(true),
              loadModules(true),
              loadBatches(true)
            ]),
            timeout(8000)
          ]);
          break;
        case 'lessons':
          await Promise.race([
            Promise.all([
              loadCourses(true),
              loadModules(true),
              loadLessons(true)
            ]),
            timeout(8000)
          ]);
          break;
        case 'classroom':
          await Promise.race([
            Promise.all([
              loadCourses(true),
              loadBatches(true),
              loadClassroomVideos(true)
            ]),
            timeout(10000)
          ]);
          break;
        case 'projects':
          await Promise.race([loadProjects(true), timeout(5000)]);
          break;
        case 'assessments':
          await Promise.race([loadAssessments(true), timeout(5000)]);
          break;
        case 'jobs':
          await Promise.race([loadJobs(true), timeout(5000)]);
          break;
        case 'liveClasses':
          await Promise.race([loadLiveClasses(true), timeout(5000)]);
          break;
        case 'mentors':
          await Promise.race([loadMentors(true), timeout(5000)]);
          break;
        case 'activity':
          await Promise.race([loadActivity(true), timeout(8000)]);
          break;
        default:
          await Promise.race([loadCourses(true), timeout(5000)]);
          break;
      }
    } catch (error) {
      console.error(`Error loading ${section} data:`, error);
      if (error.message === 'Request timeout') {
        showToast('Loading timeout. Please try refreshing.', 'warning');
      } else {
        showToast('Failed to load data. Please try again.', 'error');
      }
    } finally {
      setLoading(false);
    }
  }, [
    loadStudents,
    loadCourses,
    loadTeachers,
    loadBatches,
    loadModules,
    loadLessons,
    loadClassroomVideos,
    loadMentors,
    loadProjects,
    loadAssessments,
    loadJobs,
    loadLiveClasses,
    loadActivity
  ]);

  // Initial load - only load overview data
  const loadAllData = useCallback(async () => {
    setLoading(true);
    await loadSectionData('overview');
  }, [loadSectionData]);

  // Load data when section changes
  useEffect(() => {
    if (activeSection !== 'overview') {
      loadSectionData(activeSection);
    }
  }, [activeSection, loadSectionData]);

  // Optimized refresh function - only refresh specific data types
  const refreshData = async (dataType = null, forceRefresh = true) => {
    if (dataType) {
      switch (dataType) {
        case 'students':
          await loadStudents(forceRefresh);
          break;
        case 'teachers':
          await loadTeachers(forceRefresh);
          break;
        case 'courses':
          await loadCourses(forceRefresh);
          break;
        case 'batches':
          await loadBatches(forceRefresh);
          break;
        case 'modules':
          await loadModules(forceRefresh);
          break;
        case 'lessons':
          await loadLessons(forceRefresh);
          break;
        case 'classroom':
          await loadClassroomVideos(forceRefresh);
          break;
        case 'mentors':
          await loadMentors(forceRefresh);
          break;
        case 'projects':
          await loadProjects(forceRefresh);
          break;
        case 'assessments':
          await loadAssessments(forceRefresh);
          break;
        case 'jobs':
          await loadJobs(forceRefresh);
          break;
        case 'liveClasses':
          await loadLiveClasses(forceRefresh);
          break;
        case 'activity':
          await loadActivity(forceRefresh);
          break;
        default:
          break;
      }
    } else {
      // Refresh current section data
      await loadSectionData(activeSection);
    }
  };

  const loadBatchesByCourse = useCallback(async (courseId) => {
    if (!courseId) {
      setBatches([]);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
      const response = await fetch(`${apiUrl}/api/admin/batches/${courseId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setBatches(data);
      } else {
        setBatches([]);
      }
    } catch (error) {
      console.error('Error loading batches by course:', error);
      setBatches([]);
    }
  }, []);

  useEffect(() => {
    const totalStudents = students.length;
    const activeStudents = students.filter(s => s.status === 'active').length;
    const totalCourses = courses.length;
    const activeJobs = jobs.filter(j => j.status === 'active').length;
    const totalRevenue = students.reduce((sum, s) => sum + (s.tuitionPaid || 0), 0);

    setStats({
      totalStudents,
      activeStudents,
      totalCourses,
      activeJobs,
      totalRevenue,
      completionRate: totalStudents > 0 ? ((activeStudents / totalStudents) * 100).toFixed(1) : 0
    });
  }, [students, courses, jobs]);

  const openModal = (type, item = null) => {
    setModalType(type);
    setEditingItem(item);
    
    // Force clean form data for new items (no editing)
    if (!item) {
      const cleanDefaults = getDefaultFormData(type);
      // Ensure email and password are always empty for new users
      cleanDefaults.email = '';
      cleanDefaults.password = '';
      setFormData(cleanDefaults);
      // Load batches if course is selected for new student, classroom, or module
      if ((type === 'student' || type === 'classroom' || type === 'module') && cleanDefaults.course) {
        loadBatchesByCourse(cleanDefaults.course);
      }
      // For modules, always load all batches since they might need to select one
      if (type === 'module') {
        loadBatches();
      }
    } else {
      // For classroom videos, map courseId to course field for form
      if (type === 'classroom') {
        const formData = {
          ...item,
          course: item.courseId || item.course, // Handle both courseId and course for backward compatibility
          // Ensure YouTube URL is properly mapped for editing
          youtubeVideoUrl: item.youtubeVideoUrl || (item.youtubeVideoId ? `https://www.youtube.com/watch?v=${item.youtubeVideoId}` : ''),
          instructor: item.instructor || 'Admin', // Default to Admin if not specified
          // Format date for input field (YYYY-MM-DD)
          date: item.date || new Date().toISOString().split('T')[0] // Use existing date or today's date
        };
        setFormData(formData);
        // Load batches if course is specified
        if (formData.course) {
          loadBatchesByCourse(formData.course);
        }
      } else if (type === 'module') {
        setFormData(item);
        // Load batches if editing module with course
        if (item.courseId || item.course) {
          loadBatchesByCourse(item.courseId || item.course);
        } else {
          // Load all batches for module editing
          loadBatches();
        }
      } else {
        setFormData(item);
        // Load batches if editing student with course
        if (type === 'student' && item.course) {
          loadBatchesByCourse(item.course);
        }
      }
    }
    
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setModalType('');
    setEditingItem(null);
    // Force complete form reset
    setFormData({
      name: '',
      email: '',
      password: '',
      enrollmentNumber: '',
      course: '',
      status: 'active',
      role: 'student',
      phone: '',
      address: '',
      age: '',
      domain: '',
      experience: '',
      title: '',
      company: '',
      linkedin: '',
      bio: '',
      skills: []
    });
  };

  const getDefaultFormData = (type) => {
    const defaults = {
      student: { name: '', email: '', password: '', course: '', batchId: '', status: 'active', role: 'student', phone: '', address: '' },
      teacher: { name: '', email: '', password: '', age: '', domain: '', experience: '', status: 'active', role: 'teacher', phone: '', address: '' },
      course: { title: '', description: '', duration: '', modules: 0, status: 'active', instructor: '', price: '' },
      batch: { name: '', course: '', startDate: '', teacherId: '', status: 'active' },
      module: { name: '', courseId: '', batchId: '', duration: '', contentType: 'link', content: '', externalLink: '', fileUrl: '', fileName: '', fileSize: 0 },
  lesson: { title: '', moduleId: '', content: '', duration: '', videoUrl: '', classLink: '', order: 1, resources: '' },
      project: { title: '', description: '', difficulty: 'Intermediate', duration: '', skills: [], requirements: '', deliverables: '' },
      assessment: { title: '', description: '', questions: 0, duration: '', difficulty: 'Medium', passingScore: 70 },
      job: { title: '', company: '', location: 'Remote', salary: '', type: 'Full-time', status: 'active', skills: [], description: '' },
      mentor: { name: '', title: '', company: '', experience: '', skills: [], bio: '', email: '', password: '', domain: '', linkedin: '' },
      content: { type: 'announcement', title: '', content: '', targetAudience: 'all', priority: 'normal' },
      classroom: { title: '', date: '', instructor: '', duration: '', zoomUrl: '', zoomPasscode: '', driveId: '', course: '', batchId: '', domain: '', type: 'Lecture', videoSource: 'firebase' },
      liveClass: { title: '', course: 'Data Science & AI', scheduledDate: '', scheduledTime: '', duration: '60 mins', instructor: '', meetingType: 'auto', status: 'scheduled', description: '' }
    };
    return defaults[type] || {};
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      // Validate required fields
      if (modalType === 'student') {
        if (!formData.name || !formData.email || (!editingItem && !formData.password) || !formData.course) {
          showToast('Please fill in all required fields (Name, Email, Password, Course)', 'warning');
          return;
        }

        // Special handling for student creation/update with password
        if (!editingItem) {
          // Creating new student - hash password before storing
          try {
            // Check if email already exists via API
            const token = localStorage.getItem('token');
            const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
            const usersResponse = await fetch(`${apiUrl}/api/admin/users`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            if (usersResponse.ok) {
              const existingUsers = await usersResponse.json();
              const emailExists = existingUsers.some(user => user.email === formData.email);
              if (emailExists) {
                showToast('A student with this email already exists!', 'error');
                return;
              }
            }

            // Prepare student data (password will be hashed on backend)
            const studentData = {
              name: formData.name,
              email: formData.email,
              password: formData.password, // Send plain text, backend will hash
              enrollmentNumber: '', // Send empty string since we removed this field
              phone: formData.phone || '',
              address: formData.address || '',
              course: formData.course || '',
              batchId: formData.batchId || '',
              status: formData.status || 'active',
              role: 'student'
            };

            const createResponse = await fetch(`${apiUrl}/api/admin/users`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify(studentData)
            });
            
            if (createResponse.ok) {
              showToast('Student created successfully! Email: ' + formData.email, 'success');
              closeModal();
              await loadStudents();
            } else {
              const errorData = await createResponse.json();
              showToast('Error: ' + (errorData.message || 'Failed to create student'), 'error');
            }
            return;
          } catch (error) {
            showToast('Failed to create student: ' + error.message, 'error');
            return;
          }
        } else {
          // Editing existing student
          const updateData = {
            name: formData.name,
            email: formData.email,
            phone: formData.phone || '',
            address: formData.address || '',
            course: formData.course || '',
            batchId: formData.batchId || '',
            status: formData.status || 'active'
          };
          
          // Password cannot be updated during edit for security
          // User should use password reset feature
          
          const token = localStorage.getItem('token');
          const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
          const updateResponse = await fetch(`${apiUrl}/api/admin/users/${editingItem.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(updateData)
          });

          if (updateResponse.ok) {
            showToast('Student updated successfully!', 'success');
            closeModal();
            await loadStudents();
          } else {
            const errorData = await updateResponse.json();
            showToast('Error: ' + (errorData.message || 'Failed to update student'), 'error');
          }
          return;
        }
      } else if (modalType === 'teacher') {
        if (!formData.name || !formData.email || (!editingItem && !formData.password) || !formData.domain) {
          showToast('Please fill in all required fields (Name, Email, Password, Domain)', 'warning');
          return;
        }

        // Special handling for teacher creation/update with password
        if (!editingItem) {
          // Creating new teacher - hash password before storing
          try {
            // Check if email already exists via API
            const token = localStorage.getItem('token');
            const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
            const teachersResponse = await fetch(`${apiUrl}/api/admin/teachers`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            if (teachersResponse.ok) {
              const existingTeachers = await teachersResponse.json();
              const emailExists = existingTeachers.some(teacher => teacher.email === formData.email);
              if (emailExists) {
                showToast('A teacher with this email already exists!', 'error');
                return;
              }
            }

            // Prepare teacher data (password will be hashed on backend)
            const teacherData = {
              name: formData.name,
              email: formData.email,
              password: formData.password, // Send plain text, backend will hash
              age: formData.age || null,
              domain: formData.domain,
              experience: formData.experience || '',
              phone: formData.phone || '',
              address: formData.address || '',
              status: formData.status || 'active',
              role: 'teacher'
            };

            const createResponse = await fetch(`${apiUrl}/api/admin/teachers`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify(teacherData)
            });

            if (createResponse.ok) {
              showToast('Teacher created successfully!', 'success');
              closeModal();
              await loadTeachers(true); // Force refresh to bypass cache
            } else {
              const errorData = await createResponse.json();
              showToast('Error: ' + (errorData.message || 'Failed to create teacher'), 'error');
            }
            return;
          } catch (error) {
            console.error('Error creating teacher:', error);
            showToast('Error creating teacher. Please try again.', 'error');
            return;
          }
        } else {
          // Updating existing teacher
          const updateData = {
            name: formData.name,
            email: formData.email,
            age: formData.age || null,
            domain: formData.domain,
            experience: formData.experience || '',
            phone: formData.phone || '',
            address: formData.address || '',
            status: formData.status || 'active'
          };

          // Password cannot be updated during edit for security
          // User should use password reset feature

          const token = localStorage.getItem('token');
          const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
          const updateResponse = await fetch(`${apiUrl}/api/admin/teachers/${editingItem.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(updateData)
          });

          if (updateResponse.ok) {
            showToast('Teacher updated successfully!', 'success');
            closeModal();
            await loadTeachers(true); // Force refresh to bypass cache
          } else {
            const errorData = await updateResponse.json();
            showToast('Error: ' + (errorData.message || 'Failed to update teacher'), 'error');
          }
          return;
        }
      } else if (modalType === 'mentor') {
        if (!formData.name || !formData.title || !formData.company || !formData.email || (!editingItem && !formData.password) || !formData.domain) {
          showToast('Please fill in all required fields (Name, Job Title, Company, Email, Password, Domain)', 'warning');
          return;
        }

        // Special handling for mentor creation/update with password
        if (!editingItem) {
          // Creating new mentor - hash password before storing
          try {
            // Check if email already exists via API
            const token = localStorage.getItem('token');
            const mentorsResponse = await fetch('/api/admin/mentors', {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            if (mentorsResponse.ok) {
              const existingMentors = await mentorsResponse.json();
              const emailExists = existingMentors.some(mentor => mentor.email === formData.email);
              if (emailExists) {
                showToast('A mentor with this email already exists!', 'error');
                return;
              }
            }

            // Prepare mentor data (password will be hashed on backend)
            const mentorData = {
              name: formData.name,
              email: formData.email,
              password: formData.password, // Send plain text, backend will hash
              title: formData.title,
              company: formData.company,
              domain: formData.domain,
              bio: formData.bio || '',
              linkedin: formData.linkedin || '',
              status: formData.status || 'active',
              role: 'mentor'
            };

            const createResponse = await fetch('/api/admin/mentors', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify(mentorData)
            });
            
            if (createResponse.ok) {
              showToast('Mentor created successfully! Email: ' + formData.email, 'success');
              closeModal();
              await loadMentors();
            } else {
              const errorData = await createResponse.json();
              showToast('Error: ' + (errorData.message || 'Failed to create mentor'), 'error');
            }
            return;
          } catch (error) {
            showToast('Failed to create mentor: ' + error.message, 'error');
            return;
          }
        } else {
          // Editing existing mentor
          const updateData = {
            name: formData.name,
            email: formData.email,
            title: formData.title,
            company: formData.company,
            domain: formData.domain,
            bio: formData.bio || '',
            linkedin: formData.linkedin || '',
            status: formData.status || 'active'
          };
          
          // Password cannot be updated during edit for security
          // User should use password reset feature
          
          const token = localStorage.getItem('token');
          const updateResponse = await fetch(`/api/admin/mentors/${editingItem.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(updateData)
          });

          if (updateResponse.ok) {
            showToast('Mentor updated successfully!', 'success');
            closeModal();
            await loadMentors();
          } else {
            const errorData = await updateResponse.json();
            showToast('Error: ' + (errorData.message || 'Failed to update mentor'), 'error');
          }
          return;
        }
      } else if (modalType === 'course') {
        if (!formData.title || !formData.description) {
          showToast('Please fill in all required fields (Title, Description)', 'warning');
          return;
        }
      } else if (modalType === 'batch') {
        if (!formData.name || !formData.course || !formData.teacherId) {
          showToast('Please fill in all required fields (Batch Name, Course, Teacher)', 'warning');
          return;
        }
      } else if (modalType === 'module') {
        if (!formData.name || !formData.courseId) {
          showToast('Please fill in all required fields (Name, Course)', 'warning');
          return;
        }
        
        // Additional validation based on content type
        if (formData.contentType === 'link' && !formData.externalLink) {
          showToast('Please provide an external link URL', 'warning');
          return;
        }
        
        // Handle module creation (external links only)
        try {
          const token = localStorage.getItem('token');
          const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
          
          const moduleData = {
            name: formData.name,
            courseId: formData.courseId,
            batchId: formData.batchId || '',
            duration: formData.duration || '',
            contentType: 'link',
            content: formData.content || '',
            externalLink: formData.externalLink || '',
            fileUrl: '',
            fileName: '',
            fileSize: 0
          };
          
          const endpoint = editingItem?.id 
            ? `${apiUrl}/api/admin/modules/${editingItem.id}`
            : `${apiUrl}/api/admin/modules`;
          const method = editingItem?.id ? 'PUT' : 'POST';
          
          const response = await fetch(endpoint, {
            method: method,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(moduleData)
          });
          
          const result = await response.json();
          
          if (response.ok) {
            const successMessage = editingItem ? 'Module updated successfully!' : 'Module created successfully!';
            showToast(successMessage, 'success');
            closeModal();
            await refreshData('modules');
            setUploadedFile(null); // Clear uploaded file
            return; // Prevent generic save logic from executing
          } else {
            showToast('Error: ' + (result.message || 'Failed to save module'), 'error');
            return;
          }
        } catch (error) {
          console.error('Error saving module:', error);
          showToast('Failed to save module. Please try again.', 'error');
          return;
        }
      } else if (modalType === 'lesson') {
        if (!formData.title || !formData.moduleId || !formData.content) {
          showToast('Please fill in all required fields (Title, Module, Content)', 'warning');
          return;
        }
      } else if (modalType === 'project') {
        if (!formData.title || !formData.description) {
          showToast('Please fill in all required fields (Title, Description)', 'warning');
          return;
        }
      } else if (modalType === 'assessment') {
        if (!formData.title) {
          showToast('Please fill in the Assessment Title', 'warning');
          return;
        }
      } else if (modalType === 'job') {
        if (!formData.title || !formData.company) {
          showToast('Please fill in all required fields (Job Title, Company)', 'warning');
          return;
        }
      } else if (modalType === 'mentor') {
        if (!formData.name || !formData.title || !formData.company || !formData.email || (!editingItem && !formData.password) || !formData.domain) {
          showToast('Please fill in all required fields (Name, Job Title, Company, Email, Password, Domain)', 'warning');
          return;
        }
      } else if (modalType === 'content') {
        if (!formData.title || !formData.content) {
          showToast('Please fill in all required fields (Title, Content)', 'warning');
          return;
        }
      }

      // Validate classroom fields
      if (modalType === 'classroom') {
        if (!formData.title || !formData.course || !formData.youtubeVideoUrl || !formData.date) {
          showToast('Please fill in all required fields (Title, Course, YouTube URL, Class Date)', 'warning');
          return;
        }
      }

      // Validate live class fields
      if (modalType === 'liveClass') {
        if (!formData.title || !formData.course || !formData.scheduledDate || !formData.scheduledTime) {
          showToast('Please fill in required fields (Title, Course, Date, Time)', 'warning');
          return;
        }
        
        // Create Zoom meeting if not editing
        if (!editingItem) {
          try {
            // Combine date and time to ISO format for Zoom
            const startTime = new Date(`${formData.scheduledDate}T${formData.scheduledTime}`).toISOString();
            const duration = parseInt(formData.duration) || 60;
            
            const token = localStorage.getItem('token');
            const zoomResponse = await fetch('/api/zoom/meetings', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                topic: formData.title,
                startTime: startTime,
                duration: duration,
                agenda: formData.description || '',
                courseId: formData.course,
                timezone: 'Asia/Kolkata'
              })
            });
            
            const zoomData = await zoomResponse.json();
            
            if (zoomData.success) {
              showToast('Zoom meeting created successfully!', 'success');
              closeModal();
              await refreshData('liveClasses');
              return;
            } else {
              showToast('Error creating Zoom meeting: ' + zoomData.message, 'error');
              return;
            }
          } catch (error) {
            console.error('Error creating Zoom meeting:', error);
            showToast('Failed to create Zoom meeting. Please try again.', 'error');
            return;
          }
        }
      }

      // Special handling for classroom videos - Manual YouTube URL only
      if (modalType === 'classroom') {
        try {
          const token = localStorage.getItem('token');
          const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
          
          // Validate YouTube URL is provided
          if (!formData.youtubeVideoUrl) {
            showToast('YouTube URL is required', 'error');
            return;
          }
          
          // Import YouTube utility
          const videoId = YouTubeUtils.extractVideoId(formData.youtubeVideoUrl);
          
          if (!videoId) {
            showToast('Invalid YouTube URL. Please use a valid YouTube video URL.', 'error');
            return;
          }

          // Create lecture data for manual YouTube URL via API
          const lectureData = {
            title: formData.title,
            instructor: 'Admin', // Default instructor since each batch has assigned teacher
            description: formData.description || '',
            courseId: formData.course,
            batchId: formData.batchId || '',
            type: 'Lecture', // Default type since we removed the selection
            videoSource: 'youtube-url',
            youtubeVideoId: videoId,
            youtubeVideoUrl: formData.youtubeVideoUrl,
            youtubeEmbedUrl: YouTubeUtils.getEmbedUrl(videoId),
            date: formData.date // Add class date
          };

          let response;
          
          // Check if we're editing an existing video or creating a new one
          if (editingItem && editingItem.id) {
            // Update existing video
            response = await fetch(`${apiUrl}/api/admin/classroom/${editingItem.id}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify(lectureData)
            });
          } else {
            // Create new video
            response = await fetch(`${apiUrl}/api/admin/classroom/youtube-url`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify(lectureData)
            });
          }

          const data = await response.json();

          if (response.ok) {
            const successMessage = editingItem ? 'YouTube video updated successfully!' : 'YouTube video added successfully!';
            showToast(successMessage, 'success');
            closeModal();
            await refreshData('classroom');
            return; // Prevent generic save logic from executing
          } else {
            showToast('Error: ' + (data.message || 'Failed to save YouTube video'), 'error');
            return;
          }
        } catch (error) {
          console.error('Error saving classroom video:', error);
          showToast('Failed to save YouTube video. Please try again.', 'error');
          return;
        }
      }

      const collectionMap = {
        student: 'users',
        course: 'courses',
        batch: 'batches',
        module: 'modules',
        lesson: 'lessons',
        project: 'projects',
        assessment: 'assessments',
        job: 'jobs',
        mentor: 'mentors',
        content: 'content',
        classroom: 'classroom',
        liveClass: 'liveClasses'
      };
      const collection = collectionMap[modalType];

      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
      let result;

      if (editingItem?.id) {
        const updateResponse = await fetch(`${apiUrl}/api/admin/${collection}/${editingItem.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(formData)
        });
        result = { success: updateResponse.ok, error: updateResponse.ok ? null : (await updateResponse.json()).message };
      } else {
        const createResponse = await fetch(`${apiUrl}/api/admin/${collection}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(formData)
        });
        result = { success: createResponse.ok, error: createResponse.ok ? null : (await createResponse.json()).message };
      }

      if (result.success) {
        const successMessage = editingItem ? `${modalType.charAt(0).toUpperCase() + modalType.slice(1)} updated successfully!` : `${modalType.charAt(0).toUpperCase() + modalType.slice(1)} created successfully!`;
        showToast(successMessage, 'success');
        closeModal();
        
        // Reload only the relevant data instead of everything
        if (modalType === 'student') {
          await refreshData('students');
        } else if (modalType === 'teacher') {
          await refreshData('teachers');
        } else if (modalType === 'batch') {
          await refreshData('batches');
        } else if (modalType === 'mentor') {
          await refreshData('mentors');
        } else {
          // For other types, refresh current section
          await refreshData();
        }
      } else {
        showToast('Error: ' + result.error, 'error');
      }
    } catch (error) {
      console.error('Error saving:', error);
      alert('Failed to save data: ' + error.message);
    }
    finally {
      setSaving(false);
    }
  };

  const handleDelete = async (collection, id) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      try {
        const token = localStorage.getItem('token');
        const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
        
        // Map collection names to API endpoints
        const collectionMap = {
          [COLLECTIONS.USERS]: 'users',
          'teachers': 'teachers',
          [COLLECTIONS.COURSES]: 'courses',
          [COLLECTIONS.MODULES]: 'modules',
          [COLLECTIONS.LESSONS]: 'lessons',
          [COLLECTIONS.PROJECTS]: 'projects',
          [COLLECTIONS.ASSESSMENTS]: 'assessments',
          [COLLECTIONS.JOBS]: 'jobs',
          [COLLECTIONS.MENTORS]: 'mentors',
          [COLLECTIONS.CONTENT]: 'content',
          [COLLECTIONS.CLASSROOM]: 'classroom',
          [COLLECTIONS.LIVE_CLASSES]: 'liveClasses',
          'batches': 'batches'
        };
        
        const apiEndpoint = collectionMap[collection];
        if (!apiEndpoint) {
          showToast('Unknown collection type', 'error');
          return;
        }

        const response = await fetch(`${apiUrl}/api/admin/${apiEndpoint}/${id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          showToast('Deleted successfully!', 'success');
          
          // Reload only the relevant data instead of everything
          if (collection === COLLECTIONS.USERS) {
            await refreshData('students');
          } else if (collection === 'teachers') {
            await refreshData('teachers');
          } else if (collection === 'batches') {
            await refreshData('batches');
          } else if (collection === COLLECTIONS.MENTORS) {
            await refreshData('mentors');
          } else {
            // For other types, refresh current section
            await refreshData(collection);
          }
        } else {
          const data = await response.json();
          showToast('Error: ' + (data.message || 'Failed to delete item'), 'error');
        }
      } catch (error) {
        console.error('Error deleting item:', error);
        showToast('Failed to delete item. Please try again.', 'error');
      }
    }
  };

  // Student Profile Modal Functions
  const handleViewStudentDetails = useCallback((student) => {
    setSelectedStudentDetails(student);
    setActiveProfileTab('profile');
    setEditMode(false);
    setEditedProfile({});
    setShowStudentDetailsModal(true);
  }, []);

  const loadStudentActivities = useCallback(async (studentId, page = 1, filters = {}) => {
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50'
      });

      if (filters.action) params.append('action', filters.action);
      if (filters.dateRange && filters.dateRange !== 'all') {
        const now = new Date();
        let startDate = new Date();
        
        switch (filters.dateRange) {
          case '7days':
            startDate.setDate(now.getDate() - 7);
            break;
          case '30days':
            startDate.setDate(now.getDate() - 30);
            break;
          case '90days':
            startDate.setDate(now.getDate() - 90);
            break;
        }
        
        params.append('startDate', startDate.toISOString());
        params.append('endDate', now.toISOString());
      }

      const response = await fetch(`${apiUrl}/api/admin/activity/${studentId}?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStudentActivities(data.activities || []);
        setActivityPagination({
          page: data.page || 1,
          totalPages: data.totalPages || 1,
          total: data.total || 0
        });
      } else {
        showToast('Failed to load student activities', 'error');
      }
    } catch (error) {
      console.error('Error loading student activities:', error);
      showToast('Error loading student activities', 'error');
    }
  }, []);

  const handleActivityFilter = useCallback(() => {
    if (selectedStudentDetails) {
      loadStudentActivities(selectedStudentDetails.id || selectedStudentDetails._id, 1, activityFilter);
    }
  }, [selectedStudentDetails, activityFilter, loadStudentActivities]);

  const handleActivityPageChange = useCallback((newPage) => {
    if (selectedStudentDetails) {
      loadStudentActivities(selectedStudentDetails.id || selectedStudentDetails._id, newPage, activityFilter);
    }
  }, [selectedStudentDetails, activityFilter, loadStudentActivities]);

  const handleEditProfile = useCallback(() => {
    setEditedProfile({
      name: selectedStudentDetails?.name || '',
      email: selectedStudentDetails?.email || '',
      phone: selectedStudentDetails?.phone || '',
      address: selectedStudentDetails?.address || '',
      course: selectedStudentDetails?.course || '',
      status: selectedStudentDetails?.status || 'active'
    });
    setEditMode(true);
  }, [selectedStudentDetails]);

  const handleSaveProfile = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const studentId = selectedStudentDetails?.id || selectedStudentDetails?._id;

      const response = await fetch(`${apiUrl}/api/admin/users/${studentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(editedProfile)
      });

      if (response.ok) {
        const updatedStudent = await response.json();
        setSelectedStudentDetails(updatedStudent);
        setEditMode(false);
        showToast('Profile updated successfully!', 'success');
        
        // Refresh students list
        await refreshData('students');
      } else {
        const data = await response.json();
        showToast('Error: ' + (data.message || 'Failed to update profile'), 'error');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      showToast('Failed to update profile. Please try again.', 'error');
    }
  }, [selectedStudentDetails, editedProfile]);

  const handleCancelEdit = useCallback(() => {
    setEditMode(false);
    setEditedProfile({});
  }, []);

  const handleDownloadActivityCSV = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const studentId = selectedStudentDetails?.id || selectedStudentDetails?._id;
      
      const params = new URLSearchParams({
        download: 'csv'
      });

      if (activityFilter.action) params.append('action', activityFilter.action);
      if (activityFilter.dateRange && activityFilter.dateRange !== 'all') {
        const now = new Date();
        let startDate = new Date();
        
        switch (activityFilter.dateRange) {
          case '7days':
            startDate.setDate(now.getDate() - 7);
            break;
          case '30days':
            startDate.setDate(now.getDate() - 30);
            break;
          case '90days':
            startDate.setDate(now.getDate() - 90);
            break;
        }
        
        params.append('startDate', startDate.toISOString());
        params.append('endDate', now.toISOString());
      }

      const response = await fetch(`${apiUrl}/api/admin/activity/${studentId}?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `activity-${selectedStudentDetails?.name || 'student'}-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        showToast('Activity CSV downloaded successfully!', 'success');
      } else {
        showToast('Failed to download activity CSV', 'error');
      }
    } catch (error) {
      console.error('Error downloading activity CSV:', error);
      showToast('Error downloading activity CSV', 'error');
    }
  }, [selectedStudentDetails, activityFilter]);

  const handleGenerateReport = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const studentId = selectedStudentDetails?.id || selectedStudentDetails?._id;
      
      let startDate = new Date();
      let endDate = new Date();
      
      switch (reportPeriod) {
        case '7days':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case '30days':
          startDate.setDate(endDate.getDate() - 30);
          break;
        case '90days':
          startDate.setDate(endDate.getDate() - 90);
          break;
        case 'custom':
          if (customDateRange.start && customDateRange.end) {
            startDate = new Date(customDateRange.start);
            endDate = new Date(customDateRange.end);
          } else {
            showToast('Please select both start and end dates', 'error');
            return;
          }
          break;
      }

      const response = await fetch(`${apiUrl}/api/admin/activity/${studentId}?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        const reportSummary = {
          period: reportPeriod,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          totalActivities: data.total || 0,
          activities: data.activities || [],
          summary: {
            videoViews: data.activities?.filter(a => a.action === 'video_view').length || 0,
            logins: data.activities?.filter(a => a.action === 'login').length || 0,
            assessments: data.activities?.filter(a => a.action === 'assessment_submit').length || 0,
            pageViews: data.activities?.filter(a => a.action === 'page_view').length || 0
          }
        };
        setReportData(reportSummary);
        showToast('Report generated successfully!', 'success');
      } else {
        showToast('Failed to generate report', 'error');
      }
    } catch (error) {
      console.error('Error generating report:', error);
      showToast('Error generating report', 'error');
    }
  }, [selectedStudentDetails, reportPeriod, customDateRange]);

  const handleDownloadReport = useCallback(() => {
    if (!reportData) return;

    const csvContent = [
      ['Student Activity Report'],
      ['Student:', selectedStudentDetails?.name || 'N/A'],
      ['Email:', selectedStudentDetails?.email || 'N/A'],
      ['Period:', reportPeriod],
      ['Generated:', new Date().toLocaleString()],
      [],
      ['Summary'],
      ['Total Activities:', reportData.totalActivities],
      ['Video Views:', reportData.summary.videoViews],
      ['Logins:', reportData.summary.logins],
      ['Assessments:', reportData.summary.assessments],
      ['Page Views:', reportData.summary.pageViews],
      [],
      ['Activity Details'],
      ['Date', 'Action', 'IP Address', 'Location', 'Details'],
      ...reportData.activities.map(activity => [
        new Date(activity.timestamp).toLocaleString(),
        activity.action,
        activity.ipAddress || 'N/A',
        [activity.city, activity.country].filter(Boolean).join(', ') || 'N/A',
        activity.videoTitle || activity.assessmentTitle || activity.path || 'N/A'
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${selectedStudentDetails?.name || 'student'}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    showToast('Report downloaded successfully!', 'success');
  }, [reportData, selectedStudentDetails, reportPeriod]);

  // Load activities when profile tab is opened
  useEffect(() => {
    if (showStudentDetailsModal && selectedStudentDetails && activeProfileTab === 'activity') {
      loadStudentActivities(selectedStudentDetails.id || selectedStudentDetails._id, 1, activityFilter);
    }
  }, [showStudentDetailsModal, selectedStudentDetails, activeProfileTab, loadStudentActivities, activityFilter]);

  // Sync Zoom recordings to classroom
  const handleSyncRecordings = async () => {
    try {
      setSaving(true);
      showToast('Syncing Zoom recordings...', 'info');

      const response = await fetch('/api/zoom/sync-recordings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (data.success) {
        showToast(`✅ ${data.message}`, 'success');
        // Reload classroom data to show new recordings
        await refreshData('classroom');
      } else {
        showToast(`❌ ${data.message}`, 'error');
      }
    } catch (error) {
      console.error('Error syncing recordings:', error);
      showToast('Failed to sync recordings. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleCourseChange = useCallback((e) => {
    const courseValue = e.target.value;
    handleInputChange('course', courseValue);
    loadBatchesByCourse(courseValue);
    // Clear batch selection when course changes
    handleInputChange('batchId', '');
  }, [handleInputChange, loadBatchesByCourse]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loader"></div>
        <p>Loading admin dashboard...</p>
      </div>
    );
  }

  // Check if admin account is deactivated
  if (user && user.status === 'inactive') {
    return (
      <div className="admin-dashboard">
        <div className="account-deactivated-container">
          <div className="deactivated-card">
            <h2>⚠️ Account Deactivated</h2>
            <p>Your admin account has been deactivated. Please contact the system administrator to reactivate your account.</p>
            <div className="account-info">
              <p><strong>Email:</strong> {user.email}</p>
              <p><strong>Status:</strong> <span className="status-badge inactive">Inactive</span></p>
            </div>
            <button onClick={onLogout} className="btn-logout">
              🚪 Logout
            </button>
          </div>
        </div>
      </div>
    );
  }

  const moreSections = ['teachers', 'modules', 'projects', 'assessments', 'jobs', 'mentors', 'content', 'activity'];
  const isMoreActive = moreSections.includes(activeSection);
  const moreItems = [
    { id: 'teachers', label: 'Teachers', icon: '👨‍🏫' },
    { id: 'modules', label: 'Modules', icon: '📖' },
    { id: 'projects', label: 'Projects', icon: '📁' },
    { id: 'assessments', label: 'Assessments', icon: '✏️' },
    { id: 'jobs', label: 'Jobs', icon: '💼' },
    { id: 'mentors', label: 'Mentors', icon: '👨‍🏫' },
    { id: 'content', label: 'Content', icon: '📢' },
    { id: 'activity', label: 'Activity Log', icon: '📋' }
  ];

  return (
    <div className="admin-dashboard admin-dashboard-horizontal">
      {/* Top Header with Horizontal Nav */}
      <header className="admin-top-header admin-header-full">
        <div className="header-row-1">
          <div className="header-brand">
            <h1 className="page-title">LMS Admin</h1>
          </div>
          <div className="header-actions">
            <button 
              onClick={() => {
                clearCache();
                showToast('Cache cleared successfully!', 'success');
                refreshData();
              }}
              className="btn-secondary btn-header"
            >
              🗑️ Clear Cache
            </button>
            <button 
              onClick={() => refreshData()}
              className="btn-primary btn-header"
              disabled={loading}
            >
              🔄 Refresh
            </button>
            <div className="user-menu">
              <span className="user-name">{user?.name}</span>
              <div className="user-avatar">{user?.name?.charAt(0)}</div>
              <button className="logout-btn-header" onClick={onLogout} title="Logout">
                🚪 Logout
              </button>
            </div>
          </div>
        </div>
        {/* Horizontal Nav Bar - Primary + More dropdown */}
        <nav className="admin-horizontal-nav">
          <div className="horizontal-nav-inner">
            <button className={`nav-btn-h ${activeSection === 'overview' ? 'active' : ''}`} onClick={() => setActiveSection('overview')}>📊 Overview</button>
            <button className={`nav-btn-h ${activeSection === 'students' ? 'active' : ''}`} onClick={() => setActiveSection('students')}>👥 Students</button>
            <button className={`nav-btn-h ${activeSection === 'studentsActivity' ? 'active' : ''}`} onClick={() => setActiveSection('studentsActivity')}>📊 Activity</button>
            <button className={`nav-btn-h ${activeSection === 'batches' ? 'active' : ''}`} onClick={() => setActiveSection('batches')}>📚 Batches</button>
            <button className={`nav-btn-h ${activeSection === 'oneToOne' ? 'active' : ''}`} onClick={() => setActiveSection('oneToOne')}>👤 One to One</button>
            <button className={`nav-btn-h ${activeSection === 'classroom' ? 'active' : ''}`} onClick={() => setActiveSection('classroom')}>🎥 Classroom</button>
            <div className="nav-more-wrapper" ref={moreRef}>
              <button
                className={`nav-btn-h nav-btn-more ${isMoreActive ? 'active' : ''} ${moreOpen ? 'open' : ''}`}
                onClick={(e) => { e.stopPropagation(); setMoreOpen(!moreOpen); }}
              >
                <span>More</span>
                <span className="more-chevron">▾</span>
              </button>
              {moreOpen && (
                <div className="nav-more-dropdown">
                  {moreItems.map(({ id, label, icon }) => (
                    <button
                      key={id}
                      className={`nav-more-item ${activeSection === id ? 'active' : ''}`}
                      onClick={() => { setActiveSection(id); setMoreOpen(false); }}
                    >
                      <span>{icon}</span>
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </nav>
      </header>

      {/* Main Content - Full Width */}
      <main className="admin-main-content admin-main-full">
        {/* Dashboard Content */}
        <div className="admin-content">
          {/* Overview Section */}
          {activeSection === 'overview' && (
            <div className="admin-section">
              <h2>Dashboard Overview</h2>
              
              {/* Student Search Section */}
              <StudentSearch 
                searchEmail={searchEmail}
                setSearchEmail={setSearchEmail}
                clearSearch={clearSearch}
              />
              
              <StatsCards stats={stats} />

              <div className="quick-actions">
                <h3>Quick Actions</h3>
                <div className="actions-grid">
                  <button onClick={() => openModal('student')} className="action-btn">
                    <span className="icon">➕</span>
                    <span>Add Student</span>
                  </button>
                  <button onClick={() => openModal('teacher')} className="action-btn">
                    <span className="icon">👨‍🏫</span>
                    <span>Add Teacher</span>
                  </button>
                  <button onClick={() => openModal('course')} className="action-btn">
                    <span className="icon">➕</span>
                    <span>Add Course</span>
                  </button>
                  <button onClick={() => openModal('job')} className="action-btn">
                    <span className="icon">➕</span>
                    <span>Add Job</span>
                  </button>
                  <button onClick={() => openModal('mentor')} className="action-btn">
                    <span className="icon">➕</span>
                    <span>Add Mentor</span>
                  </button>
                  <button onClick={() => openModal('content')} className="action-btn">
                    <span className="icon">📢</span>
                    <span>Post Announcement</span>
                  </button>
                  <button onClick={() => setActiveSection('analytics')} className="action-btn">
                    <span className="icon">📊</span>
                    <span>View Analytics</span>
                  </button>
                </div>
              </div>

              <div className="recent-activity">
                <h3>Recent Activity</h3>
                <div className="activity-list">
                  <div className="activity-item">
                    <span className="activity-icon">👤</span>
                    <div className="activity-content">
                      <p><strong>New student enrolled</strong></p>
                      <span className="activity-time">2 hours ago</span>
                    </div>
                  </div>
                  <div className="activity-item">
                    <span className="activity-icon">📚</span>
                    <div className="activity-content">
                      <p><strong>Course updated</strong></p>
                      <span className="activity-time">5 hours ago</span>
                    </div>
                  </div>
                  <div className="activity-item">
                    <span className="activity-icon">💼</span>
                    <div className="activity-content">
                      <p><strong>New job posted</strong></p>
                      <span className="activity-time">1 day ago</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Students Section */}
          {activeSection === 'students' && (
            <div className="admin-section">
              <div className="section-header">
                <h2>Manage Students</h2>
                <button onClick={() => openModal('student')} className="btn-add">
                  ➕ Add Student
                </button>
              </div>

              {/* Student Search Section */}
              <StudentSearch 
                searchEmail={searchEmail}
                setSearchEmail={setSearchEmail}
                clearSearch={clearSearch}
              />

              <div className="data-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Batch</th>
                      <th>Course</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(paginatedStudents || []).map(student => (
                      <tr key={student.id}>
                        <td>
                          <button 
                            onClick={() => openStudentDetails(student)}
                            className="btn-link"
                            title="View Student Details"
                          >
                            {student.name}
                          </button>
                        </td>
                        <td>{student.email}</td>
                        <td>{(batches || []).find(b => b.id === student.batchId)?.name || 
              (oneToOneBatches || []).find(b => b.id === student.batchId)?.name || 
              student.batchName || 'No Batch Assigned'}</td>
                        <td>{student.course || 'N/A'}</td>
                        <td>
                          <button onClick={() => openModal('student', student)} className="btn-edit">✏️</button>
                          <button onClick={() => handleDelete(COLLECTIONS.USERS, student.id)} className="btn-delete">🗑️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredStudents.length === 0 && (
                  <p className="no-data">No matching students. Try a different email or name.</p>
                )}

                {filteredStudents.length > 0 && (
                  <div className="table-footer">
                    <div className="rows-per-page">
                      <span>Rows per page:</span>
                      {[5, 10, 15].map(size => (
                        <button
                          key={size}
                          type="button"
                          className={`rows-per-page-button ${studentsPerPage === size ? 'active' : ''}`}
                          onClick={() => {
                            setStudentsPerPage(size);
                            setStudentPage(1);
                          }}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                    <div className="pagination-info">
                      Showing {studentStartIndex + 1}–{Math.min(studentEndIndex, filteredStudents.length)} of {filteredStudents.length} students
                    </div>
                  </div>
                )}

                {filteredStudents.length > studentsPerPage && (
                  <div className="pagination-controls">
                    <button
                      className="btn-secondary"
                      onClick={() => setStudentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentStudentPage === 1}
                    >
                      ← Previous
                    </button>
                    <span className="pagination-info">
                      Page {currentStudentPage} of {totalStudentPages} · Showing{' '}
                      {studentStartIndex + 1}–{Math.min(studentEndIndex, students.length)} of {students.length} students
                    </span>
                    <button
                      className="btn-secondary"
                      onClick={() => setStudentPage(prev => Math.min(totalStudentPages, prev + 1))}
                      disabled={currentStudentPage === totalStudentPages}
                    >
                      Next →
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Teachers Section */}
          {activeSection === 'teachers' && (
            <div className="admin-section">
              <div className="section-header">
                <h2>Manage Teachers</h2>
                <button onClick={() => openModal('teacher')} className="btn-add">
                  ➕ Add Teacher
                </button>
              </div>

              <div className="data-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Age</th>
                      <th>Domain</th>
                      <th>Experience</th>
                      <th>Phone</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(teachers || []).map(teacher => (
                      <tr key={teacher.id}>
                        <td>{teacher.name}</td>
                        <td>{teacher.email}</td>
                        <td>{teacher.age || 'N/A'}</td>
                        <td>{teacher.domain || 'N/A'}</td>
                        <td>{teacher.experience || 'N/A'}</td>
                        <td>{teacher.phone || 'N/A'}</td>
                        <td>
                          <span className={`status-badge ${teacher.status}`}>
                            {teacher.status}
                          </span>
                        </td>
                        <td>
                          <button onClick={() => openModal('teacher', teacher)} className="btn-edit">✏️</button>
                          <button onClick={() => handleDelete('teachers', teacher.id)} className="btn-delete">🗑️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {teachers.length === 0 && <p className="no-data">No teachers found. Add your first teacher!</p>}
              </div>
            </div>
          )}

          {/* Courses Section */}
          {activeSection === 'batches' && (
            <div className="admin-section">
              <div className="section-header">
                <h2>Manage Batches</h2>
                <button onClick={() => openModal('batch')} className="btn-add">
                  ➕ Add Batch
                </button>
              </div>

              <div className="data-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Batch Name</th>
                      <th>Course</th>
                      <th>Start Date</th>
                      <th>Teacher</th>
                      <th>Students</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(batches || []).map(batch => {
                      // Calculate actual student count based on batchId
                      const actualStudentCount = (students || []).filter(student => 
                        student.role === 'student' && student.batchId === (batch.id || batch._id)
                      ).length;
                      
                      return (
                        <tr key={batch.id || batch._id}>
                          <td>
                            <button 
                              onClick={() => handleBatchClick(batch)} 
                              className="btn-link" 
                              title="View Batch Details"
                            >
                              {batch.name}
                            </button>
                          </td>
                          <td>{batch.course}</td>
                          <td>{batch.startDate || 'N/A'}</td>
                          <td>{batch.teacherName || 'N/A'}</td>
                          <td>{actualStudentCount}</td>
                          <td>
                            <span className={`status-badge ${batch.status}`}>
                              {batch.status}
                            </span>
                          </td>
                          <td>
                            <button onClick={() => openModal('batch', batch)} className="btn-edit">✏️</button>
                            <button onClick={() => handleDelete('batches', batch.id || batch._id)} className="btn-delete">🗑️</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {batches.length === 0 && <p className="no-data">No batches found. Create your first batch!</p>}
              </div>
            </div>
          )}

          {/* Modules Section */}
          {activeSection === 'modules' && (
            <div className="admin-section">
              <div className="section-header">
                <h2>Manage Modules</h2>
                <button onClick={() => openModal('module')} className="btn-add">
                  ➕ Add Module
                </button>
              </div>

              <div className="data-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Module Name</th>
                      <th>Course</th>
                      <th>Batch</th>
                      <th>File Type</th>
                      <th>Duration</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(modules || []).map(module => (
                      <tr key={module.id}>
                        <td>{module.name}</td>
                        <td>{(courses || []).find(c => c.id === module.courseId)?.title || 'N/A'}</td>
                        <td>{(batches || []).find(b => b.id === module.batchId)?.name || 
              (oneToOneBatches || []).find(b => b.id === module.batchId)?.name || 'N/A'}</td>
                        <td>
                          <span className="content-type-badge">
                            {module.contentType === 'pdf' && '📄 PDF'}
                            {module.contentType === 'word' && '📝 Word'}
                            {module.contentType === 'link' && '🔗 Link'}
                            {module.contentType === 'text' && '📄 Text'}
                          </span>
                        </td>
                        <td>{module.duration}</td>
                        <td>
                          <button onClick={() => openModal('module', module)} className="btn-edit">✏️</button>
                          {(module.contentType === 'pdf' || module.contentType === 'word') && module.fileUrl && (
                            <a 
                              href={module.fileUrl} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="btn-view"
                              title="View/Download File"
                            >
                              📥
                            </a>
                          )}
                          {module.contentType === 'link' && module.externalLink && (
                            <a 
                              href={module.externalLink} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="btn-view"
                              title="Open External Link"
                            >
                              🔗
                            </a>
                          )}
                          <button onClick={() => handleDelete(COLLECTIONS.MODULES, module.id)} className="btn-delete">🗑️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {modules.length === 0 && <p className="no-data">No modules found. Add modules to your courses!</p>}
              </div>
            </div>
          )}

          {/* Lessons Section */}
          {activeSection === 'lessons' && (
            <div className="admin-section">
              <div className="section-header">
                <h2>Manage Lessons</h2>
                <button onClick={() => openModal('lesson')} className="btn-add">
                  ➕ Add Lesson
                </button>
              </div>

              <div className="data-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Lesson Title</th>
                      <th>Module</th>
                      <th>Duration</th>
                      <th>Order</th>
                      <th>Class</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(lessons || []).map(lesson => (
                      <tr key={lesson.id}>
                        <td>{lesson.title}</td>
                        <td>{(modules || []).find(m => m.id === lesson.moduleId)?.name || 'N/A'}</td>
                        <td>{lesson.duration}</td>
                        <td>{lesson.order}</td>
                        <td>
                          {lesson.classLink ? (
                            <a href={lesson.classLink} target="_blank" rel="noopener noreferrer" className="btn-join">Join</a>
                          ) : (
                            <span className="no-class">—</span>
                          )}
                        </td>
                        <td>
                          <button onClick={() => openModal('lesson', lesson)} className="btn-edit">✏️</button>
                          <button onClick={() => handleDelete(COLLECTIONS.LESSONS, lesson.id)} className="btn-delete">🗑️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {lessons.length === 0 && <p className="no-data">No lessons found. Start adding lessons to modules!</p>}
              </div>
            </div>
          )}

          {/* Projects Section */}
          {activeSection === 'projects' && (
            <div className="admin-section">
              <div className="section-header">
                <h2>Manage Projects</h2>
                <button onClick={() => openModal('project')} className="btn-add">
                  ➕ Add Project
                </button>
              </div>

              <div className="cards-grid">
                {(projects || []).map(project => (
                  <div key={project.id} className="project-card">
                    <h3>{project.title}</h3>
                    <p>{project.description}</p>
                    <div className="project-meta">
                      <span className="badge">{project.difficulty}</span>
                      <span>⏱️ {project.duration}</span>
                    </div>
                    <div className="card-actions">
                      <button onClick={() => openModal('project', project)} className="btn-edit">✏️ Edit</button>
                      <button onClick={() => handleDelete(COLLECTIONS.PROJECTS, project.id)} className="btn-delete">🗑️ Delete</button>
                    </div>
                  </div>
                ))}
              </div>
              {projects.length === 0 && <p className="no-data">No projects found. Add capstone projects!</p>}
            </div>
          )}

          {/* Assessments Section */}
          {activeSection === 'assessments' && (
            <div className="admin-section">
              <div className="section-header">
                <h2>Manage Assessments</h2>
                <button onClick={() => openModal('assessment')} className="btn-add">
                  ➕ Add Assessment
                </button>
              </div>

              <div className="cards-grid">
                {(assessments || []).map(assessment => (
                  <div key={assessment.id} className="assessment-card">
                    <h3>{assessment.title}</h3>
                    <p>{assessment.description}</p>
                    <div className="assessment-meta">
                      <span>{assessment.questions} Questions</span>
                      <span>⏱️ {assessment.duration}</span>
                      <span className="badge">{assessment.difficulty}</span>
                    </div>
                    <div className="card-actions">
                      <button onClick={() => openModal('assessment', assessment)} className="btn-edit">✏️ Edit</button>
                      <button onClick={() => handleDelete(COLLECTIONS.ASSESSMENTS, assessment.id)} className="btn-delete">🗑️ Delete</button>
                    </div>
                  </div>
                ))}
              </div>
              {assessments.length === 0 && <p className="no-data">No assessments found. Create practice tests!</p>}
            </div>
          )}

          {/* Jobs Section */}
          {activeSection === 'jobs' && (
            <div className="admin-section">
              <div className="section-header">
                <h2>Manage Job Board</h2>
                <button onClick={() => openModal('job')} className="btn-add">
                  ➕ Add Job
                </button>
              </div>

              <div className="data-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Job Title</th>
                      <th>Company</th>
                      <th>Location</th>
                      <th>Salary</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(jobs || []).map(job => (
                      <tr key={job.id}>
                        <td>{job.title}</td>
                        <td>{job.company}</td>
                        <td>{job.location}</td>
                        <td>{job.salary}</td>
                        <td>{job.type}</td>
                        <td>
                          <span className={`status-badge ${job.status}`}>
                            {job.status}
                          </span>
                        </td>
                        <td>
                          <button onClick={() => openModal('job', job)} className="btn-edit">✏️</button>
                          <button onClick={() => handleDelete(COLLECTIONS.JOBS, job.id)} className="btn-delete">🗑️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {jobs.length === 0 && <p className="no-data">No jobs found. Post job opportunities!</p>}
              </div>
            </div>
          )}

          {/* Mentors Section */}
          {activeSection === 'mentors' && (
            <div className="admin-section">
              <div className="section-header">
                <h2>Manage Mentors</h2>
                <button onClick={() => openModal('mentor')} className="btn-add">
                  ➕ Add Mentor
                </button>
              </div>

              <div className="cards-grid">
                {(mentors || []).map(mentor => (
                  <div key={mentor.id} className="mentor-card">
                    <div className="mentor-avatar">{mentor.name?.charAt(0)}</div>
                    <h3>{mentor.name}</h3>
                    <p className="mentor-title">{mentor.title}</p>
                    <p className="mentor-company">{mentor.company} | {mentor.experience}</p>
                    <div className="mentor-skills">
                      {(mentor.skills || []).slice(0, 3).map((skill, idx) => (
                        <span key={idx} className="skill-tag">{skill}</span>
                      ))}
                    </div>
                    <div className="card-actions">
                      <button onClick={() => openModal('mentor', mentor)} className="btn-edit">✏️ Edit</button>
                      <button onClick={() => handleDelete(COLLECTIONS.MENTORS, mentor.id)} className="btn-delete">🗑️ Delete</button>
                    </div>
                  </div>
                ))}
              </div>
              {mentors.length === 0 && <p className="no-data">No mentors found. Add industry mentors!</p>}
            </div>
          )}

          {/* One to One Section */}
          {activeSection === 'oneToOne' && (
            <div className="admin-section">
              <div className="section-header">
                <h2>One to One Batches</h2>
                <p className="section-description">Manage private one-to-one batches for individual students</p>
              </div>
              <OneToOneCourseSelection />
            </div>
          )}

          {/* Classroom Videos Section */}
          {activeSection === 'classroom' && (
            <div className="admin-section">
              <div className="section-header">
                <h2>Manage Classroom Videos</h2>
                <button onClick={() => openModal('classroom')} className="btn-add">
                  ➕ Add Video
                </button>
              </div>

              {/* Video Instructions - Commented Out */}
              {/* 
              <div className="info-box">
                <p>📹 Add live class recordings from Zoom or Google Drive. Students can watch these videos in their Classroom section.</p>
                <p><strong>Zoom Recording:</strong> Open your recording in Zoom → Click "Share" → Copy the complete shareable link (includes passcode).</p>
                <p><strong>Google Drive:</strong> Upload video to Drive → Get shareable link → Copy the file ID from the URL.</p>
              </div>
              */}

              <div className="data-table">
                <table>
                  <thead>
                    <tr>
                      <th>Class Date</th>
                      <th>Topic</th>
                      <th>Duration</th>
                      <th>Course</th>
                      <th>Video Source</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classroomVideos.length === 0 ? (
                      <tr>
                        <td colSpan="6" style={{textAlign: 'center', padding: '40px', color: '#888'}}>
                          No classroom videos added yet. Click "Add Video" to add your first recording.
                        </td>
                      </tr>
                    ) : (
                      (classroomVideos || [])
                        .sort((a, b) => new Date(b.date) - new Date(a.date))
                        .map(video => (
                          <tr key={video.id}>
                            <td>{video.date}</td>
                            <td><strong>{video.title}</strong></td>
                            <td>{video.duration}</td>
                            <td>
                              <span className={`course-badge ${video.courseId?.includes('Cyber') ? 'cyber' : 'data'}`}>
                                {video.courseId || 'General'}
                              </span>
                              {video.batchId && (
                                <small style={{display: 'block', color: '#666', marginTop: '2px'}}>
                                  Batch: {(batches || []).find(b => b.id === video.batchId)?.name || 
              (oneToOneBatches || []).find(b => b.id === video.batchId)?.name || 'No Batch Assigned'}
                                </small>
                              )}
                            </td>
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                {video.videoSource === 'youtube-url' ? (
                                  <>
                                    <span className={`source-badge youtube`}>
                                      📺 YouTube
                                    </span>
                                    <code className="drive-id">
                                      {video.youtubeVideoId}
                                    </code>
                                  </>
                                ) : (
                                  <>
                                    <span className={`source-badge firebase`}>
                                      🔥 Firebase
                                    </span>
                                    <code className="drive-id">
                                      {video.firebaseStoragePath?.substring(0, 25)}...
                                    </code>
                                  </>
                                )}
                              </div>
                            </td>
                            <td>
                              <div className="action-btns">
                                <button onClick={() => openModal('classroom', video)} className="btn-edit" title="Edit">✏️</button>
                                <button onClick={() => handleDelete(COLLECTIONS.CLASSROOM, video.id)} className="btn-delete" title="Delete">🗑️</button>
                                <a 
                                  href="#"
                                  className="btn-view"
                                  title="View in player"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    // Create a simple video player modal
                                    const modal = document.createElement('div');
                                    modal.style.cssText = `
                                      position: fixed;
                                      top: 0;
                                      left: 0;
                                      width: 100vw;
                                      height: 100vh;
                                      background: rgba(0,0,0,0.9);
                                      z-index: 10000;
                                      display: flex;
                                      align-items: center;
                                      justify-content: center;
                                    `;
                                    
                                    const content = document.createElement('div');
                                    content.style.cssText = `
                                      background: white;
                                      padding: 20px;
                                      border-radius: 8px;
                                      max-width: 600px;
                                      width: 90%;
                                      text-align: center;
                                    `;
                                    
                                    if (video.videoSource === 'youtube-url') {
                                      content.innerHTML = `
                                        <h3>📺 YouTube Video</h3>
                                        <p><strong>${video.title}</strong></p>
                                        <p>Instructor: ${video.instructor}</p>
                                        <div style="margin: 20px 0;">
                                          <iframe 
                                            width="100%" 
                                            height="315" 
                                            src="${video.youtubeEmbedUrl}" 
                                            frameborder="0" 
                                            allowfullscreen
                                            style="border-radius: 8px;"
                                          ></iframe>
                                        </div>
                                        <p style="color: #666; font-size: 14px;">Students can watch this video in their Dashboard → Classroom section</p>
                                        <button style="
                                          background: #007bff;
                                          color: white;
                                          border: none;
                                          padding: 10px 20px;
                                          border-radius: 4px;
                                          cursor: pointer;
                                          margin-top: 15px;
                                        " onclick="this.closest('div[style*=fixed]').remove()">Close</button>
                                      `;
                                    } else {
                                      content.innerHTML = `
                                        <h3>🔥 Firebase Storage Video</h3>
                                        <p><strong>${video.title}</strong></p>
                                        <p>This video is stored in Firebase Storage and can be played by students in their Dashboard.</p>
                                        <p style="color: #666; font-size: 14px;">To preview: Go to Student Dashboard → Classroom → Select this video</p>
                                        <button style="
                                          background: #007bff;
                                          color: white;
                                          border: none;
                                          padding: 10px 20px;
                                          border-radius: 4px;
                                          cursor: pointer;
                                          margin-top: 15px;
                                        " onclick="this.closest('div[style*=fixed]').remove()">Close</button>
                                      `;
                                    }
                                    
                                    modal.appendChild(content);
                                    document.body.appendChild(modal);
                                    
                                    modal.addEventListener('click', (e) => {
                                      if (e.target === modal) {
                                        modal.remove();
                                      }
                                    });
                                  }}
                                >
                                  👁️
                                </a>
                              </div>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Live Classes Section */}
          {activeSection === 'liveClasses' && (
            <div className="admin-section">
              <div className="section-header">
                <h2>Schedule Live Classes</h2>
                <div>
                  <button onClick={handleSyncRecordings} className="btn-sync" style={{marginRight: '10px'}}>
                    ☁️ Sync Zoom Recordings
                  </button>
                  <button onClick={() => openModal('liveClass')} className="btn-add">
                    ➕ Schedule Live Class
                  </button>
                </div>
              </div>

              <div className="info-box">
                <p>📡 Schedule live Zoom classes for your students. Zoom meetings are automatically created via API integration.</p>
                <p><strong>✨ Auto-Generated:</strong> No manual Zoom link needed! Just fill in the details and the system will create a unique Zoom meeting for each class.</p>
                <p><strong>☁️ Cloud Recordings:</strong> After classes end, click "Sync Zoom Recordings" to automatically fetch and add recordings to the Classroom section.</p>
              </div>

              <div className="data-table">
                <table>
                  <thead>
                    <tr>
                      <th>Date & Time</th>
                      <th>Topic</th>
                      <th>Instructor</th>
                      <th>Duration</th>
                      <th>Course</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liveClasses.length === 0 ? (
                      <tr>
                        <td colSpan="7" style={{textAlign: 'center', padding: '40px', color: '#888'}}>
                          No live classes scheduled yet. Click "Schedule Live Class" to add your first session.
                        </td>
                      </tr>
                    ) : (
                      (liveClasses || [])
                        .sort((a, b) => new Date(a.scheduledDate + ' ' + a.scheduledTime) - new Date(b.scheduledDate + ' ' + b.scheduledTime))
                        .map(liveClass => {
                          const classDateTime = new Date(liveClass.scheduledDate + ' ' + liveClass.scheduledTime);
                          const isUpcoming = classDateTime > new Date();
                          const isPast = classDateTime < new Date();
                          
                          return (
                            <tr key={liveClass.id}>
                              <td>
                                <strong>{liveClass.scheduledDate}</strong>
                                <br />
                                <span style={{fontSize: '0.85em', color: '#666'}}>{liveClass.scheduledTime}</span>
                              </td>
                              <td><strong>{liveClass.title}</strong></td>
                              <td>
                                <span className="instructor-badge">{liveClass.instructor}</span>
                              </td>
                              <td>{liveClass.duration}</td>
                              <td>
                                <span className={`course-badge ${liveClass.course?.includes('Cyber') ? 'cyber' : 'data'}`}>
                                  {liveClass.course}
                                </span>
                              </td>
                              <td>
                                <span className={`status-badge ${isPast ? 'completed' : isUpcoming ? 'active' : ''}`}>
                                  {isPast ? '✅ Completed' : '🔴 Live'}
                                </span>
                              </td>
                              <td>
                                <div className="action-btns">
                                  <button onClick={() => openModal('liveClass', liveClass)} className="btn-edit" title="Edit">✏️</button>
                                  <button onClick={() => handleDelete(COLLECTIONS.LIVE_CLASSES, liveClass.id)} className="btn-delete" title="Delete">🗑️</button>
                                  <a 
                                    href={liveClass.zoomLink} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="btn-view"
                                    title="Join Zoom"
                                  >
                                    📡
                                  </a>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Content Section */}
          {activeSection === 'content' && (
            <div className="admin-section">
              <div className="section-header">
                <h2>Manage Content & Announcements</h2>
                <button onClick={() => openModal('content')} className="btn-add">
                  ➕ Add Content
                </button>
              </div>

              <div className="content-management">
                <p>Manage announcements, supplementary courses, and featured content displayed to students.</p>
                <div className="content-actions-grid">
                  <button className="action-card" onClick={() => openModal('content')}>
                    <span className="icon">📢</span>
                    <h4>Post Announcement</h4>
                    <p>Notify all students</p>
                  </button>
                  <button className="action-card">
                    <span className="icon">📚</span>
                    <h4>Add Supplementary Course</h4>
                    <p>Extra learning materials</p>
                  </button>
                  <button className="action-card">
                    <span className="icon">⭐</span>
                    <h4>Feature Content</h4>
                    <p>Highlight on dashboard</p>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Students Activity Section - Full dedicated component */}
          {activeSection === 'studentsActivity' && (
            <div className="admin-section students-activity-section">
              <StudentsActivity token={typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null} />
            </div>
          )}

          {/* Activity Section */}
          {activeSection === 'activity' && (
            <div className="admin-section">
              <div className="section-header">
                <h2>📋 Activity Log</h2>
                <button onClick={() => refreshData('activity')} className="btn-add" disabled={dataLoading.activity}>
                  {dataLoading.activity ? '⏳ Loading…' : '🔄 Refresh'}
                </button>
              </div>
              <p className="section-description">
                Login activity from all users (students, teachers, mentors, admins). Shows IP, location, and ISP.
              </p>
              <div className="data-table-container">
                {dataLoading.activity ? (
                  <p className="no-data">Loading activity…</p>
                ) : activities.length === 0 ? (
                  <p className="no-data">No activity recorded yet. Logins will appear here.</p>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>User</th>
                        <th>Role</th>
                        <th>Action</th>
                        <th>IP</th>
                        <th>Location</th>
                        <th>ISP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activities.map((a, i) => (
                        <tr key={i}>
                          <td>{new Date(a.timestamp).toLocaleString()}</td>
                          <td>
                            <span className="activity-user">{a.userName}</span>
                            <br />
                            <small className="activity-email">{a.userEmail}</small>
                          </td>
                          <td>
                            <span className={`role-badge role-${a.userRole}`}>{a.userRole}</span>
                          </td>
                          <td>
                            {a.action === 'video_view' && a.videoTitle
                              ? `📹 ${a.videoTitle}`
                              : a.action === 'assessment_submit' && a.assessmentTitle
                                ? `✏️ ${a.assessmentTitle}${a.score != null ? ` (${a.score})` : ''}`
                                : a.action}
                          </td>
                          <td><span className="ip-address">{a.ipAddress || '—'}</span></td>
                          <td>{[a.city, a.country].filter(Boolean).join(', ') || '—'}</td>
                          <td>{a.isp || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* Analytics Section */}
          {activeSection === 'analytics' && (
            <div className="admin-section">
              <h2>Analytics & Reports</h2>
              
              <div className="analytics-summary">
                <div className="summary-card">
                  <div className="summary-icon" style={{background: '#e3f2fd'}}>📊</div>
                  <div className="summary-content">
                    <h4>Total Students</h4>
                    <p className="summary-number">{students.length}</p>
                    <span className="summary-change positive">+12% this month</span>
                  </div>
                </div>
                
                <div className="summary-card">
                  <div className="summary-icon" style={{background: '#f3e5f5'}}>📚</div>
                  <div className="summary-content">
                    <h4>Active Courses</h4>
                    <p className="summary-number">{courses.length}</p>
                    <span className="summary-change neutral">{modules.length} modules</span>
                  </div>
                </div>
                
                <div className="summary-card">
                  <div className="summary-icon" style={{background: '#e8f5e9'}}>💼</div>
                  <div className="summary-content">
                    <h4>Job Opportunities</h4>
                    <p className="summary-number">{(jobs || []).filter(j => j.status === 'active').length}</p>
                    <span className="summary-change positive">+5 new jobs</span>
                  </div>
                </div>
                
                <div className="summary-card">
                  <div className="summary-icon" style={{background: '#fff3e0'}}>🎯</div>
                  <div className="summary-content">
                    <h4>Completion Rate</h4>
                    <p className="summary-number">87%</p>
                    <span className="summary-change positive">+3% from last month</span>
                  </div>
                </div>
              </div>

              <div className="analytics-grid">
                <div className="analytics-card">
                  <h3>📈 Student Enrollment Trend</h3>
                  <div className="bar-chart">
                    <div className="chart-bars">
                      <div className="bar-group">
                        <div className="bar" style={{height: '60%'}}></div>
                        <span className="bar-label">Jan</span>
                      </div>
                      <div className="bar-group">
                        <div className="bar" style={{height: '75%'}}></div>
                        <span className="bar-label">Feb</span>
                      </div>
                      <div className="bar-group">
                        <div className="bar" style={{height: '85%'}}></div>
                        <span className="bar-label">Mar</span>
                      </div>
                      <div className="bar-group">
                        <div className="bar" style={{height: '70%'}}></div>
                        <span className="bar-label">Apr</span>
                      </div>
                      <div className="bar-group">
                        <div className="bar" style={{height: '90%'}}></div>
                        <span className="bar-label">May</span>
                      </div>
                      <div className="bar-group">
                        <div className="bar" style={{height: '100%'}}></div>
                        <span className="bar-label">Jun</span>
                      </div>
                    </div>
                    <div className="chart-stats">
                      <p>Total Enrollments: <strong>{students.length}</strong></p>
                      <p>Average per Month: <strong>{Math.round(students.length / 6)}</strong></p>
                    </div>
                  </div>
                </div>
                
                <div className="analytics-card">
                  <h3>📚 Course Distribution</h3>
                  <div className="progress-list">
                    {(courses || []).slice(0, 5).map((course, idx) => (
                      <div key={course.id} className="progress-item">
                        <div className="progress-info">
                          <span className="progress-name">{course.title || `Course ${idx + 1}`}</span>
                          <span className="progress-value">{Math.round(Math.random() * 40 + 60)}%</span>
                        </div>
                        <div className="progress-bar-analytics">
                          <div className="progress-fill-analytics" style={{width: `${Math.round(Math.random() * 40 + 60)}%`}}></div>
                        </div>
                      </div>
                    ))}
                    {courses.length === 0 && <p className="no-data">No courses available</p>}
                  </div>
                </div>
                
                <div className="analytics-card">
                  <h3>💼 Job Placement Stats</h3>
                  <div className="pie-chart-wrapper">
                    <div className="pie-chart">
                      <div className="pie-segment" style={{
                        background: `conic-gradient(
                          #667eea 0deg 252deg,
                          #48bb78 252deg 324deg,
                          #f59e0b 324deg 360deg
                        )`
                      }}></div>
                      <div className="pie-center">
                        <div className="pie-percentage">87%</div>
                        <div className="pie-label">Placed</div>
                      </div>
                    </div>
                    <div className="pie-legend">
                      <div className="legend-item">
                        <span className="legend-color" style={{background: '#667eea'}}></span>
                        <span>Placed (70%)</span>
                      </div>
                      <div className="legend-item">
                        <span className="legend-color" style={{background: '#48bb78'}}></span>
                        <span>Interviewing (20%)</span>
                      </div>
                      <div className="legend-item">
                        <span className="legend-color" style={{background: '#f59e0b'}}></span>
                        <span>Searching (10%)</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="analytics-card">
                  <h3>👥 User Engagement</h3>
                  <div className="line-chart">
                    <div className="chart-area">
                      <svg viewBox="0 0 300 150" className="line-svg">
                        <polyline
                          points="0,120 50,100 100,80 150,90 200,60 250,40 300,30"
                          fill="none"
                          stroke="#667eea"
                          strokeWidth="3"
                        />
                        <polyline
                          points="0,120 50,100 100,80 150,90 200,60 250,40 300,30"
                          fill="url(#gradient)"
                          opacity="0.2"
                        />
                        <defs>
                          <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#667eea" />
                            <stop offset="100%" stopColor="#667eea" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                      </svg>
                    </div>
                    <div className="chart-stats">
                      <p>Daily Active Users: <strong>245</strong></p>
                      <p>Peak Hours: <strong>2PM - 6PM</strong></p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="reports-section">
                <h3>📄 Generate Reports</h3>
                <div className="report-buttons">
                  <button className="btn-report" onClick={() => showToast('Generating Student Progress Report...', 'info')}>
                    <span className="report-icon">📊</span>
                    <span className="report-text">
                      <strong>Student Progress Report</strong>
                      <small>Detailed progress of all students</small>
                    </span>
                  </button>
                  <button className="btn-report" onClick={() => showToast('Generating Course Completion Report...', 'info')}>
                    <span className="report-icon">✅</span>
                    <span className="report-text">
                      <strong>Course Completion Report</strong>
                      <small>Completion rates and analytics</small>
                    </span>
                  </button>
                  <button className="btn-report" onClick={() => showToast('Generating Revenue Report...', 'info')}>
                    <span className="report-icon">💰</span>
                    <span className="report-text">
                      <strong>Revenue Report</strong>
                      <small>Financial summary and trends</small>
                    </span>
                  </button>
                  <button className="btn-report" onClick={() => showToast('Generating Monthly Analytics...', 'info')}>
                    <span className="report-icon">📈</span>
                    <span className="report-text">
                      <strong>Monthly Analytics</strong>
                      <small>Comprehensive monthly overview</small>
                    </span>
                  </button>
                </div>
              </div>

              {/* Commented out - Key Insights section disabled */}
              {/* <div className="insights-section">
                <h3>💡 Key Insights</h3>
                <div className="insights-grid">
                  <div className="insight-card">
                    <span className="insight-icon">🎯</span>
                    <p>Top performing course: <strong>Cyber Security & Ethical Hacking</strong></p>
                  </div>
                  <div className="insight-card">
                    <span className="insight-icon">⏰</span>
                    <p>Average completion time: <strong>4.5 months</strong></p>
                  </div>
                  <div className="insight-card">
                    <span className="insight-icon">🌟</span>
                    <p>Student satisfaction rate: <strong>94%</strong></p>
                  </div>
                  <div className="insight-card">
                    <span className="insight-icon">📚</span>
                    <p>Most popular module: <strong>Penetration Testing</strong></p>
                  </div>
                </div>
              </div> */}
            </div>
          )}
        </div>
      </main>

      {/* Modal - Rendered using Portal for proper centering */}
      {showModal && createPortal(
        <div className="modal-overlay">
          <div className="modal" onClick={(e) => e.stopPropagation()} key={`${modalType}-${editingItem ? editingItem.id : 'new'}`}>
            <div className="modal-header">
              <h2>{editingItem ? 'Edit' : 'Add'} {modalType.charAt(0).toUpperCase() + modalType.slice(1)}</h2>
              <button className="close-btn" onClick={closeModal}>✕</button>
            </div>

            <div className="modal-content">
              {modalType === 'student' && (
                <>
                  <input
                    type="text"
                    placeholder="Student full name *"
                    value={formData.name || ''}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    required
                  />
                  <input
                    type="email"
                    placeholder="Enter student email address *"
                    value={formData.email || ''}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    required
                    autoComplete="off"
                    readOnly
                    onFocus={(e) => e.target.removeAttribute('readonly')}
                    onBlur={(e) => e.target.setAttribute('readonly', true)}
                  />
                  {!editingItem && (
                    <input
                      type="password"
                      placeholder="Create password for student *"
                      value={formData.password || ''}
                      onChange={(e) => handleInputChange('password', e.target.value)}
                      required
                      autoComplete="off"
                      readOnly
                      onFocus={(e) => e.target.removeAttribute('readonly')}
                      onBlur={(e) => e.target.setAttribute('readonly', true)}
                    />
                  )}
                  {/* Enrollment Number Field - Commented Out */}
                  {/* <input
                    type="text"
                    placeholder="Enrollment Number *"
                    value={formData.enrollmentNumber || ''}
                    onChange={(e) => handleInputChange('enrollmentNumber', e.target.value)}
                    required
                  /> */}
                  <input
                    type="tel"
                    placeholder="Phone Number"
                    value={formData.phone || ''}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                  />
                  <textarea
                    placeholder="Address"
                    value={formData.address || ''}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    rows="2"
                  />
                  <select
                    value={formData.course || ''}
                    onChange={handleCourseChange}
                    required
                  >
                    <option value="">Select Course *</option>
                    <option value="Data Science & AI">Data Science & AI</option>
                    <option value="Cyber Security & Ethical Hacking">Cyber Security & Ethical Hacking</option>
                  </select>
                  <select
                    value={formData.batchId || ''}
                    onChange={(e) => handleInputChange('batchId', e.target.value)}
                  >
                    <option value="">Select Batch (Optional)</option>
                    {batches.map(batch => (
                      <option key={batch.id || batch._id} value={batch.id || batch._id}>
                        {batch.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={formData.status || 'active'}
                    onChange={(e) => handleInputChange('status', e.target.value)}
                  >
                    <option value="active">Active</option>
                    {/* Commented out - Deactivation options disabled */}
                    {/* <option value="inactive">Deactivated</option>
                    <option value="graduated">Graduated</option>
                    <option value="suspended">Suspended</option> */}
                  </select>
                  {editingItem && (editingItem.lastLogin || editingItem.lastLoginIP) && (
                    <div className="login-activity-section">
                      <h4>📍 Login Activity</h4>
                      <div className="activity-detail">
                        <strong>Last Login:</strong>{' '}
                        {editingItem.lastLogin?.timestamp ? new Date(editingItem.lastLogin.timestamp).toLocaleString() : editingItem.lastLoginTimestamp ? new Date(editingItem.lastLoginTimestamp).toLocaleString() : 'Never'}
                      </div>
                      <div className="activity-detail">
                        <strong>Last IP:</strong> <span className="ip-address">{editingItem.lastLoginIP || editingItem.lastLogin?.ipAddress || 'N/A'}</span>
                      </div>
                      <div className="activity-detail">
                        <strong>Location:</strong>{' '}
                        {[editingItem.lastLogin?.city, editingItem.lastLogin?.country].filter(Boolean).join(', ') || 'N/A'}
                      </div>
                      <div className="activity-detail">
                        <strong>ISP:</strong> {editingItem.lastLogin?.isp || 'N/A'}
                      </div>
                      {editingItem.loginHistory?.length > 0 && (
                        <div className="login-history">
                          <strong>Recent logins:</strong>
                          <ul>
                            {editingItem.loginHistory.slice(0, 5).map((h, i) => (
                              <li key={i}>
                                {new Date(h.timestamp).toLocaleString()} — {h.ipAddress} ({h.city && h.country ? `${h.city}, ${h.country}` : 'N/A'})
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {modalType === 'teacher' && (
                <>
                  <input
                    type="text"
                    placeholder="Teacher full name *"
                    value={formData.name || ''}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    required
                  />
                  <input
                    type="email"
                    placeholder="Enter teacher email address *"
                    value={formData.email || ''}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    required
                    autoComplete="off"
                    readOnly
                    onFocus={(e) => e.target.removeAttribute('readonly')}
                    onBlur={(e) => e.target.setAttribute('readonly', true)}
                  />
                  {!editingItem && (
                    <input
                      type="password"
                      placeholder="Create password for teacher *"
                      value={formData.password || ''}
                      onChange={(e) => handleInputChange('password', e.target.value)}
                      required
                      autoComplete="off"
                      readOnly
                      onFocus={(e) => e.target.removeAttribute('readonly')}
                      onBlur={(e) => e.target.setAttribute('readonly', true)}
                    />
                  )}
                  <input
                    type="number"
                    placeholder="Age"
                    value={formData.age || ''}
                    onChange={(e) => handleInputChange('age', parseInt(e.target.value) || '')}
                    min="18"
                    max="80"
                  />
                  <select
                    value={formData.domain || ''}
                    onChange={(e) => handleInputChange('domain', e.target.value)}
                    required
                  >
                    <option value="">Select Domain *</option>
                    <option value="Data Science & AI">Data Science & AI</option>
                    <option value="Cyber Security & Ethical Hacking">Cyber Security & Ethical Hacking</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Experience (e.g., 5 years, 3+ years in teaching)"
                    value={formData.experience || ''}
                    onChange={(e) => handleInputChange('experience', e.target.value)}
                  />
                  <input
                    type="tel"
                    placeholder="Phone Number"
                    value={formData.phone || ''}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                  />
                  <textarea
                    placeholder="Address"
                    value={formData.address || ''}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    rows="2"
                  />
                  <select
                    value={formData.status || 'active'}
                    onChange={(e) => handleInputChange('status', e.target.value)}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="on-leave">On Leave</option>
                  </select>
                </>
              )}

              {modalType === 'course' && (
                <>
                  <input
                    type="text"
                    placeholder="Course Title *"
                    value={formData.title || ''}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    required
                  />
                  <textarea
                    placeholder="Description *"
                    value={formData.description || ''}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    rows="4"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Instructor Name"
                    value={formData.instructor || ''}
                    onChange={(e) => handleInputChange('instructor', e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Duration (e.g., 6 months)"
                    value={formData.duration || ''}
                    onChange={(e) => handleInputChange('duration', e.target.value)}
                  />
                  <input
                    type="number"
                    placeholder="Number of Modules"
                    value={formData.modules || ''}
                    onChange={(e) => handleInputChange('modules', parseInt(e.target.value) || 0)}
                  />
                  <input
                    type="text"
                    placeholder="Price (e.g., $999 or Free)"
                    value={formData.price || ''}
                    onChange={(e) => handleInputChange('price', e.target.value)}
                  />
                  <select
                    value={formData.status || 'active'}
                    onChange={(e) => handleInputChange('status', e.target.value)}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="coming-soon">Coming Soon</option>
                  </select>
                </>
              )}

              {modalType === 'batch' && (
                <>
                  <input
                    type="text"
                    placeholder="Batch Name *"
                    value={formData.name || ''}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    required
                    readOnly={false}
                    onFocus={(e) => e.target.removeAttribute('readonly')}
                    onBlur={(e) => e.target.setAttribute('readonly', true)}
                  />
                  <select
                    value={formData.course || ''}
                    onChange={(e) => {
                      const course = e.target.value;
                      handleInputChange('course', course);
                      // Clear teacher selection when course changes
                      handleInputChange('teacherId', '');
                      handleInputChange('teacherName', '');
                    }}
                    required
                  >
                    <option value="">Select Course *</option>
                    <option value="Data Science & AI">Data Science & AI</option>
                    <option value="Cyber Security & Ethical Hacking">Cyber Security & Ethical Hacking</option>
                  </select>
                  <input
                    type="date"
                    placeholder="Start Date"
                    value={formData.startDate || ''}
                    onChange={(e) => handleInputChange('startDate', e.target.value)}
                  />
                  <select
                    value={formData.teacherId || ''}
                    onChange={(e) => {
                      const teacherId = e.target.value;
                      const selectedTeacher = (getFilteredTeachers() || []).find(t => t.id === teacherId);
                      handleInputChange('teacherId', teacherId);
                      handleInputChange('teacherName', selectedTeacher ? selectedTeacher.name : '');
                    }}
                    required
                  >
                    <option value="">
                      {formData.course ? `Select Teacher for ${formData.course} *` : 'Select Course First *'}
                    </option>
                    {getFilteredTeachers().map(teacher => (
                      <option key={teacher.id} value={teacher.id}>
                        {teacher.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={formData.status || 'active'}
                    onChange={(e) => handleInputChange('status', e.target.value)}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="completed">Completed</option>
                  </select>
                </>
              )}

              {modalType === 'module' && (
                <>
                  <input
                    type="text"
                    placeholder="Module Name *"
                    value={formData.name || ''}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    required
                  />
                  <select
                    value={formData.courseId || ''}
                    onChange={(e) => {
                      handleInputChange('courseId', e.target.value);
                      // Clear batch selection when course changes
                      handleInputChange('batchId', '');
                    }}
                    required
                  >
                    <option value="">Select Course *</option>
                    <option value="Data Science & AI">Data Science & AI</option>
                    <option value="Cyber Security & Ethical Hacking">Cyber Security & Ethical Hacking</option>
                  </select>
                  
                  <select
                    value={formData.batchId || ''}
                    onChange={(e) => handleInputChange('batchId', e.target.value)}
                  >
                    <option value="">Select Batch</option>
                    {(() => {
                      const selectedCourse = formData.courseId;
                      const filteredBatches = batches.filter(batch => {
                        // Debug logging
                        console.log('Comparing:', {
                          batchCourse: batch.course,
                          selectedCourse: selectedCourse,
                          batchCourseId: batch.courseId,
                          match: batch.course === selectedCourse || 
                                 batch.courseId === selectedCourse ||
                                 (typeof selectedCourse === 'string' && batch.course && batch.course.toLowerCase() === selectedCourse.toLowerCase())
                        });
                        
                        return batch.course === selectedCourse || 
                               batch.courseId === selectedCourse ||
                               (typeof selectedCourse === 'string' && batch.course && batch.course.toLowerCase() === selectedCourse.toLowerCase());
                      });
                      
                      console.log('Selected Course:', selectedCourse);
                      console.log('All Batches:', batches);
                      console.log('Filtered Batches:', filteredBatches);
                      
                      return filteredBatches;
                    })().map(batch => (
                      <option key={batch._id || batch.id} value={batch._id || batch.id}>
                        {batch.name}
                      </option>
                    ))}
                  </select>
                  
                  {/* File Type Selection */}
                  <select
                    value={formData.contentType || 'link'}
                    onChange={(e) => handleInputChange('contentType', e.target.value)}
                  >
                    <option value="link">External Link</option>
                  </select>

                  {/* Conditional fields based on content type */}
                  {(formData.contentType === 'pdf' || formData.contentType === 'word') && (
                    <div className="file-upload-section">
                      <label>Upload {formData.contentType === 'pdf' ? 'PDF' : 'Word'} File:</label>
                      <div 
                        className="drop-zone"
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          e.currentTarget.classList.add('drag-over');
                        }}
                        onDragLeave={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          e.currentTarget.classList.remove('drag-over');
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          e.currentTarget.classList.remove('drag-over');
                          const files = e.dataTransfer.files;
                          if (files.length > 0) {
                            handleFileUpload({ target: { files } });
                          }
                        }}
                      >
                        <div className="drop-zone-content">
                          <div className="drop-icon">📁</div>
                          <p>Drag and drop your {formData.contentType === 'pdf' ? 'PDF' : 'Word'} file here</p>
                          <p className="or-text">or</p>
                          <input
                            type="file"
                            accept={formData.contentType === 'pdf' ? '.pdf' : '.doc,.docx'}
                            onChange={(e) => handleFileUpload(e)}
                            className="file-input"
                            id="file-upload"
                          />
                          <label htmlFor="file-upload" className="file-select-btn">
                            Select Files
                          </label>
                        </div>
                      </div>
                      {formData.fileName && (
                        <div className="file-info">
                          <span>✅ {formData.fileName}</span>
                          {formData.fileSize && (
                            <span> ({(formData.fileSize / 1024 / 1024).toFixed(2)} MB)</span>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {formData.contentType === 'link' && (
                    <input
                      type="url"
                      placeholder="External Link URL *"
                      value={formData.externalLink || ''}
                      onChange={(e) => handleInputChange('externalLink', e.target.value)}
                    />
                  )}

                  {formData.contentType === 'text' && (
                    <textarea
                      placeholder="Module Content"
                      value={formData.content || ''}
                      onChange={(e) => handleInputChange('content', e.target.value)}
                      rows="4"
                    />
                  )}

                  <input
                    type="text"
                    placeholder="Duration (e.g., 4 weeks)"
                    value={formData.duration || ''}
                    onChange={(e) => handleInputChange('duration', e.target.value)}
                  />
                </>
              )}

              {modalType === 'lesson' && (
                <>
                  <input
                    type="text"
                    placeholder="Lesson Title *"
                    value={formData.title || ''}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    required
                  />
                  <select
                    value={formData.moduleId || ''}
                    onChange={(e) => handleInputChange('moduleId', e.target.value)}
                    required
                  >
                    <option value="">Select Module *</option>
                    {modules.map(module => {
                      const courseName = module.courseId === '1' ? 'Data Science & AI' : 
                                       module.courseId === '2' ? 'Cyber Security & Ethical Hacking' : '';
                      return (
                        <option key={module.id} value={module.id}>
                          {module.name} {courseName ? `(${courseName})` : ''}
                        </option>
                      );
                    })}
                  </select>
                  <textarea
                    placeholder="Lesson Content *"
                    value={formData.content || ''}
                    onChange={(e) => handleInputChange('content', e.target.value)}
                    rows="5"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Duration (e.g., 45 min)"
                    value={formData.duration || ''}
                    onChange={(e) => handleInputChange('duration', e.target.value)}
                  />
                  <input
                    type="url"
                    placeholder="Video URL (YouTube, Vimeo, etc.)"
                    value={formData.videoUrl || ''}
                    onChange={(e) => handleInputChange('videoUrl', e.target.value)}
                  />
                  <input
                    type="url"
                    placeholder="Class Link (Zoom / Google Meet)"
                    value={formData.classLink || ''}
                    onChange={(e) => handleInputChange('classLink', e.target.value)}
                  />
                  <textarea
                    placeholder="Additional Resources (links, PDFs, etc.)"
                    value={formData.resources || ''}
                    onChange={(e) => handleInputChange('resources', e.target.value)}
                    rows="2"
                  />
                  <input
                    type="number"
                    placeholder="Order / Sequence"
                    value={formData.order || ''}
                    onChange={(e) => handleInputChange('order', parseInt(e.target.value) || 1)}
                  />
                </>
              )}

              {modalType === 'project' && (
                <>
                  <input
                    type="text"
                    placeholder="Project Title *"
                    value={formData.title || ''}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    required
                  />
                  <textarea
                    placeholder="Project Description *"
                    value={formData.description || ''}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    rows="4"
                    required
                  />
                  <textarea
                    placeholder="Requirements"
                    value={formData.requirements || ''}
                    onChange={(e) => handleInputChange('requirements', e.target.value)}
                    rows="3"
                  />
                  <textarea
                    placeholder="Deliverables"
                    value={formData.deliverables || ''}
                    onChange={(e) => handleInputChange('deliverables', e.target.value)}
                    rows="3"
                  />
                  <select
                    value={formData.difficulty || 'Intermediate'}
                    onChange={(e) => handleInputChange('difficulty', e.target.value)}
                  >
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                    <option value="Expert">Expert</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Duration (e.g., 3 weeks)"
                    value={formData.duration || ''}
                    onChange={(e) => handleInputChange('duration', e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Skills Required (comma-separated)"
                    value={formData.skills?.join(', ') || ''}
                    onChange={(e) => handleInputChange('skills', e.target.value.split(',').map(s => s.trim()).filter(s => s))}
                  />
                </>
              )}

              {modalType === 'assessment' && (
                <>
                  <input
                    type="text"
                    placeholder="Assessment Title *"
                    value={formData.title || ''}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    required
                  />
                  <textarea
                    placeholder="Description"
                    value={formData.description || ''}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    rows="3"
                  />
                  <input
                    type="number"
                    placeholder="Number of Questions"
                    value={formData.questions || ''}
                    onChange={(e) => handleInputChange('questions', parseInt(e.target.value) || 0)}
                  />
                  <input
                    type="text"
                    placeholder="Duration (e.g., 90 min)"
                    value={formData.duration || ''}
                    onChange={(e) => handleInputChange('duration', e.target.value)}
                  />
                  <input
                    type="number"
                    placeholder="Passing Score (%)"
                    value={formData.passingScore || 70}
                    onChange={(e) => handleInputChange('passingScore', parseInt(e.target.value) || 70)}
                    min="0"
                    max="100"
                  />
                  <select
                    value={formData.difficulty || 'Medium'}
                    onChange={(e) => handleInputChange('difficulty', e.target.value)}
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </>
              )}

              {modalType === 'job' && (
                <>
                  <input
                    type="text"
                    placeholder="Job Title *"
                    value={formData.title || ''}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    required
                  />
                  <input
                    type="text"
                    placeholder="Company *"
                    value={formData.company || ''}
                    onChange={(e) => handleInputChange('company', e.target.value)}
                    required
                  />
                  <textarea
                    placeholder="Job Description"
                    value={formData.description || ''}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    rows="3"
                  />
                  <input
                    type="text"
                    placeholder="Location (e.g., Remote, New York, Hybrid)"
                    value={formData.location || ''}
                    onChange={(e) => handleInputChange('location', e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Salary Range (e.g., $95K - $130K)"
                    value={formData.salary || ''}
                    onChange={(e) => handleInputChange('salary', e.target.value)}
                  />
                  <select
                    value={formData.type || 'Full-time'}
                    onChange={(e) => handleInputChange('type', e.target.value)}
                  >
                    <option value="Full-time">Full-time</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Contract">Contract</option>
                    <option value="Internship">Internship</option>
                  </select>
                  <select
                    value={formData.status || 'active'}
                    onChange={(e) => handleInputChange('status', e.target.value)}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="filled">Filled</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Required Skills (comma-separated)"
                    value={formData.skills?.join(', ') || ''}
                    onChange={(e) => handleInputChange('skills', e.target.value.split(',').map(s => s.trim()).filter(s => s))}
                  />
                </>
              )}

              {modalType === 'mentor' && (
                <>
                  <input
                    type="text"
                    placeholder="Mentor full name *"
                    value={formData.name || ''}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    required
                  />
                  <input
                    type="text"
                    placeholder="Job Title *"
                    value={formData.title || ''}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    required
                  />
                  <input
                    type="text"
                    placeholder="Company *"
                    value={formData.company || ''}
                    onChange={(e) => handleInputChange('company', e.target.value)}
                    required
                  />
                  <input
                    type="email"
                    placeholder="Enter mentor email address *"
                    value={formData.email || ''}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    required
                    autoComplete="off"
                    readOnly
                    onFocus={(e) => e.target.removeAttribute('readonly')}
                    onBlur={(e) => e.target.setAttribute('readonly', true)}
                  />
                  {!editingItem && (
                    <input
                      type="password"
                      placeholder="Create password for mentor *"
                      value={formData.password || ''}
                      onChange={(e) => handleInputChange('password', e.target.value)}
                      required
                      autoComplete="off"
                      readOnly
                      onFocus={(e) => e.target.removeAttribute('readonly')}
                      onBlur={(e) => e.target.setAttribute('readonly', true)}
                    />
                  )}
                  <select
                    value={formData.domain}
                    onChange={(e) => handleInputChange('domain', e.target.value)}
                    required
                  >
                    <option value="">Select Domain *</option>
                    <option value="Data Science & AI">Data Science & AI</option>
                    <option value="Cyber Security & Ethical Hacking">Cyber Security & Ethical Hacking</option>
                  </select>
                  <input
                    type="url"
                    placeholder="LinkedIn Profile URL"
                    value={formData.linkedin || ''}
                    onChange={(e) => handleInputChange('linkedin', e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Experience (e.g., 10 years exp)"
                    value={formData.experience || ''}
                    onChange={(e) => handleInputChange('experience', e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Skills (comma-separated)"
                    value={formData.skills?.join(', ') || ''}
                    onChange={(e) => handleInputChange('skills', e.target.value.split(',').map(s => s.trim()).filter(s => s))}
                  />
                  <textarea
                    placeholder="Bio / About"
                    value={formData.bio || ''}
                    onChange={(e) => handleInputChange('bio', e.target.value)}
                    rows="4"
                  />
                </>
              )}

              {modalType === 'classroom' && (
                <>
                  <input
                    type="text"
                    placeholder="Video Title / Topic Name *"
                    value={formData.title || ''}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    required
                  />
                  
                  <textarea
                    placeholder="Video Description (optional)"
                    value={formData.description || ''}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    rows={3}
                    style={{resize: 'vertical', minHeight: '60px', marginBottom: '15px'}}
                  />
                  
                  <select
                    value={formData.course || ''}
                    onChange={(e) => {
                      const course = e.target.value;
                      handleInputChange('course', course);
                      // Reset batch when course changes
                      handleInputChange('batchId', '');
                      // Load batches for selected course
                      if (course) {
                        loadBatchesByCourse(course);
                      }
                    }}
                    required
                    style={{ marginBottom: '15px', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                  >
                    <option value="">Select Course *</option>
                    <option value="Data Science & AI">Data Science & AI</option>
                    <option value="Cyber Security & Ethical Hacking">Cyber Security & Ethical Hacking</option>
                  </select>
                  <small style={{color: '#888', marginTop: '-10px', display: 'block'}}>
                    Select the course this video is assigned to
                  </small>
                  
                  <select
                    value={formData.batchId || ''}
                    onChange={(e) => handleInputChange('batchId', e.target.value)}
                    style={{ marginBottom: '15px', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                  >
                    <option value="">Select Batch (Optional - Leave empty for all batches)</option>
                    {batches.map(batch => (
                      <option key={batch.id} value={batch.id}>
                        {batch.name}
                      </option>
                    ))}
                  </select>
                  <small style={{color: '#888', marginTop: '-10px', display: 'block'}}>
                    Select specific batch or leave empty to make available to all batches in this course
                  </small>
                  
                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                      Class Date *
                    </label>
                    <input
                      type="date"
                      value={formData.date || ''}
                      onChange={(e) => handleInputChange('date', e.target.value)}
                      required
                      style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                    />
                    <small style={{color: '#888', marginTop: '-10px', display: 'block'}}>
                      Select the date when this class was conducted or will be conducted
                    </small>
                  </div>
                  
                  {/* Manual YouTube URL Input */}
                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                      YouTube Video URL *
                    </label>
                    <input
                      type="url"
                      placeholder="https://www.youtube.com/watch?v=..."
                      value={formData.youtubeVideoUrl || ''}
                      onChange={(e) => handleInputChange('youtubeVideoUrl', e.target.value)}
                      required
                      style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                    />
                    {/* <small style={{color: '#888', marginTop: '-10px', display: 'block'}}>
                      Paste the YouTube video URL. Video should be uploaded as "Private" or "Unlisted" on YouTube.
                    </small>
                    <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#fff3cd', borderRadius: '4px', border: '1px solid #ffc107' }}>
                      <strong>📺 Manual YouTube URL:</strong><br/>
                      • Upload video to YouTube as Private/Unlisted first<br/>
                      • Copy the YouTube video URL here<br/>
                      • Students will only see videos for their enrolled course<br/>
                      • No API configuration needed
                    </div> */}
                  </div>
                </>
              )}

              {modalType === 'liveClass' && (
                <>
                  <input
                    type="text"
                    placeholder="Class Title / Topic *"
                    value={formData.title || ''}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    required
                  />
                  <select
                    value={formData.course || 'Data Science & AI'}
                    onChange={(e) => handleInputChange('course', e.target.value)}
                  >
                    <option value="">Select Course *</option>
                    <option value="Data Science & AI">Data Science & AI</option>
                    <option value="Cyber Security & Ethical Hacking">Cyber Security & Ethical Hacking</option>
                  </select>
                  <input
                    type="date"
                    placeholder="Scheduled Date *"
                    value={formData.scheduledDate || ''}
                    onChange={(e) => handleInputChange('scheduledDate', e.target.value)}
                    required
                  />
                  <input
                    type="time"
                    placeholder="Scheduled Time *"
                    value={formData.scheduledTime || ''}
                    onChange={(e) => handleInputChange('scheduledTime', e.target.value)}
                    required
                  />
                  <select
                    value={formData.duration || '60 mins'}
                    onChange={(e) => handleInputChange('duration', e.target.value)}
                  >
                    <option value="30 mins">30 mins</option>
                    <option value="45 mins">45 mins</option>
                    <option value="60 mins">60 mins</option>
                    <option value="90 mins">90 mins</option>
                    <option value="120 mins">2 hours</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Instructor Name"
                    value={formData.instructor || ''}
                    onChange={(e) => handleInputChange('instructor', e.target.value)}
                  />
                  <textarea
                    placeholder="Description / Agenda (optional)"
                    value={formData.description || ''}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    rows="3"
                  />
                  <small style={{color: '#28a745', marginTop: '-10px', display: 'block', fontWeight: 'bold'}}>
                    ✅ Zoom meeting link will be auto-generated when you save
                  </small>
                </>
              )}

              {modalType === 'content' && (
                <>
                  <select
                    value={formData.type || 'announcement'}
                    onChange={(e) => handleInputChange('type', e.target.value)}
                  >
                    <option value="announcement">Announcement</option>
                    <option value="feature">Featured Content</option>
                    <option value="supplementary">Supplementary Course</option>
                    <option value="news">News Update</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Title *"
                    value={formData.title || ''}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    required
                  />
                  <textarea
                    placeholder="Content *"
                    value={formData.content || ''}
                    onChange={(e) => handleInputChange('content', e.target.value)}
                    rows="5"
                    required
                  />
                  <select
                    value={formData.targetAudience || 'all'}
                    onChange={(e) => handleInputChange('targetAudience', e.target.value)}
                  >
                    <option value="all">All Students</option>
                    <option value="active">Active Students</option>
                    <option value="new">New Students</option>
                    <option value="graduated">Graduated Students</option>
                  </select>
                  <select
                    value={formData.priority || 'normal'}
                    onChange={(e) => handleInputChange('priority', e.target.value)}
                  >
                    <option value="low">Low Priority</option>
                    <option value="normal">Normal Priority</option>
                    <option value="high">High Priority</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </>
              )}
            </div>

            <div className="modal-actions">
              <button onClick={handleSave} className="btn-save" disabled={saving}>
                {saving ? (editingItem ? 'Updating...' : 'Creating...') : (editingItem ? 'Update' : 'Create')}
              </button>
              <button onClick={closeModal} className="btn-cancel" disabled={saving}>Cancel</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Batch Details Modal */}
      {showBatchDetailsModal && createPortal(
        <div className="modal-overlay">
          <div className="modal batch-details-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📚 Batch Details: {selectedBatch?.name}</h3>
              <button className="modal-close" onClick={closeBatchDetailsModal}>×</button>
            </div>
            
            <div className="batch-info">
              <div className="batch-details-grid">
                <div className="detail-item">
                  <label>Batch Name:</label>
                  <span>{selectedBatch?.name}</span>
                </div>
                <div className="detail-item">
                  <label>Course:</label>
                  <span>{selectedBatch?.course}</span>
                </div>
                <div className="detail-item">
                  <label>Teacher:</label>
                  <span>{selectedBatch?.teacherName || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <label>Start Date:</label>
                  <span>{selectedBatch?.startDate || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <label>End Date:</label>
                  <span>{selectedBatch?.endDate || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <label>Status:</label>
                  <span className={`status-badge ${selectedBatch?.status}`}>
                    {selectedBatch?.status}
                  </span>
                </div>
              </div>
            </div>

            {!batchView ? (
              <div className="batch-options">
                <h4>What would you like to view?</h4>
                <div className="option-buttons">
                  <button 
                    onClick={() => handleBatchViewSelect('videos')}
                    className="btn-option"
                  >
                    📹 Videos
                  </button>
                  <button 
                    onClick={() => handleBatchViewSelect('students')}
                    className="btn-option"
                  >
                    👥 Students
                  </button>
                </div>
              </div>
            ) : (
              <div className="batch-content-view">
                <div className="view-header">
                  <button 
                    onClick={() => setBatchView('')}
                    className="btn-back"
                  >
                    ← Back to Options
                  </button>
                  <h4>
                    {batchView === 'videos' ? '📹 Videos' : '👥 Students'} for {selectedBatch?.name}
                  </h4>
                </div>
                
                {batchView === 'videos' && (
                  <div className="videos-view">
                    {(() => {
                      const batchIdNorm = (v) => (v != null && v !== '' ? String(v).trim() : '');
                      const selId = batchIdNorm(selectedBatch?.id || selectedBatch?._id);
                      const batchVideos = classroomVideos
                        .filter(video =>
                          batchIdNorm(video.batchId) === selId
                        )
                        .sort((a, b) => {
                          // Sort by newest first - use multiple date fields for one-to-one videos
                          const dateA = new Date(a.addedAt || a.date || a.createdAt || 0);
                          const dateB = new Date(b.addedAt || b.date || b.createdAt || 0);
                          return dateB - dateA; // Newest first (descending order)
                        });
                      
                      return batchVideos.length > 0 ? (
                        <div className="videos-list">
                          {batchVideos.map(video => (
                            <div key={video.id} className="video-item">
                              <div className="video-info">
                                <h5>{video.title}</h5>
                                <p><strong>Instructor:</strong> {video.instructor}</p>
                                <p><strong>Date:</strong> {video.date}</p>
                                <p><strong>Duration:</strong> {video.duration}</p>
                                {video.videoSource === 'youtube' && video.youtubeVideoUrl && (
                                  <a 
                                    href={video.youtubeVideoUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="btn-view-video"
                                  >
                                    ▶️ Watch Video
                                  </a>
                                )}
                                {video.videoSource === 'youtube-url' && video.youtubeVideoUrl && (
                                  <a 
                                    href={video.youtubeVideoUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="btn-view-video"
                                  >
                                    ▶️ Watch Video
                                  </a>
                                )}
                                {video.zoomUrl && (
                                  <a 
                                    href={video.zoomUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="btn-view-video"
                                  >
                                    🎥 Join Zoom Class
                                  </a>
                                )}
                                {video.driveId && (
                                  <a 
                                    href={`https://drive.google.com/file/d/${video.driveId}/view`} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="btn-view-video"
                                  >
                                    📁 View on Drive
                                  </a>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="no-data">
                          <p>📹 No videos found for this batch</p>
                          <small>Videos may be assigned to this batch by course or directly by batch ID</small>
                        </div>
                      );
                    })()}
                  </div>
                )}
                
                {batchView === 'students' && (
                  <div className="students-view">
                    {(() => {
                      // Debug logging
                      console.log('Selected Batch:', selectedBatch);
                      console.log('All Students:', students);
                      
                      const batchStudents = students.filter(student => {
                        // Filter students by batchId only (no course fallback)
                        const normId = (v) => (v != null && v !== '' ? String(v).trim() : '');
                        const selectedBatchId = normId(selectedBatch?.id || selectedBatch?._id);
                        const studentMatch = normId(student.batchId) === selectedBatchId;
                        
                        console.log('Filtering student:', {
                          studentName: student.name,
                          studentBatchId: student.batchId,
                          studentCourse: student.course,
                          match: studentMatch
                        });
                        
                        return studentMatch;
                      });
                      
                      console.log('Filtered Students:', batchStudents);
                      
                      return batchStudents.length > 0 ? (
                        <div className="students-list">
                          <table className="students-table">
                            <thead>
                              <tr>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Batch</th>
                                <th>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {batchStudents.map(student => (
                                <tr key={student.id}>
                                  <td>{student.name}</td>
                                  <td>{student.email}</td>
                                  <td>{(batches || []).find(b => b.id === student.batchId)?.name || 
              (oneToOneBatches || []).find(b => b.id === student.batchId)?.name || 'No Batch Assigned'}</td>
                                  <td>
                                    <span className={`status-badge ${student.status}`}>
                                      {student.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="no-data">
                          <p>👥 No students found in this batch</p>
                          <small>Students may be enrolled by batch ID or course matching</small>
                          <br/>
                          <small>Selected Batch ID: {selectedBatch?.id || selectedBatch?._id}</small>
                          <br/>
                          <small>Selected Batch Course: {selectedBatch?.course}</small>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}

            <div className="modal-actions">
              <button onClick={closeBatchDetailsModal} className="btn-cancel">Close</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Student Profile Full-Screen Modal */}
      {showStudentDetailsModal && createPortal(
        <div className="fullscreen-modal-overlay" onClick={() => setShowStudentDetailsModal(false)}>
          <div className="fullscreen-modal" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="fullscreen-modal-header">
              <div className="student-header-info">
                <div className="student-avatar">
                  <span className="avatar-text">
                    {selectedStudentDetails?.name?.charAt(0).toUpperCase() || 'S'}
                  </span>
                </div>
                <div className="student-basic-info">
                  <h2>{selectedStudentDetails?.name || 'Student Name'}</h2>
                  <p className="student-email">{selectedStudentDetails?.email || 'N/A'}</p>
                  <div className="student-badges">
                    <span className={`badge ${selectedStudentDetails?.status || 'active'}`}>
                      {selectedStudentDetails?.status || 'Active'}
                    </span>
                    <span className="badge">
                      {selectedStudentDetails?.course || 'No Course'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="modal-header-actions">
                {activeProfileTab === 'profile' && !editMode && (
                  <button className="btn-edit-profile" onClick={handleEditProfile}>
                    ✏️ Edit Profile
                  </button>
                )}
                <button className="modal-close-fullscreen" onClick={() => setShowStudentDetailsModal(false)}>
                  ×
                </button>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="profile-tabs-nav">
              <button
                className={`tab-btn ${activeProfileTab === 'profile' ? 'active' : ''}`}
                onClick={() => setActiveProfileTab('profile')}
              >
                👤 Profile
              </button>
              <button
                className={`tab-btn ${activeProfileTab === 'activity' ? 'active' : ''}`}
                onClick={() => setActiveProfileTab('activity')}
              >
                📊 Activity Log
              </button>
              <button
                className={`tab-btn ${activeProfileTab === 'reports' ? 'active' : ''}`}
                onClick={() => setActiveProfileTab('reports')}
              >
                📈 Reports
              </button>
            </div>

            {/* Modal Content */}
            <div className="fullscreen-modal-content">
              {/* Profile Tab */}
              {activeProfileTab === 'profile' && (
                <div className="profile-tab-content">
                  {!editMode ? (
                    <div className="profile-grid">
                      <div className="profile-section">
                        <h3>📝 Personal Information</h3>
                        <div className="profile-details">
                          <div className="detail-item">
                            <label>Full Name:</label>
                            <span>{selectedStudentDetails?.name || 'N/A'}</span>
                          </div>
                          <div className="detail-item">
                            <label>Email Address:</label>
                            <span>{selectedStudentDetails?.email || 'N/A'}</span>
                          </div>
                          <div className="detail-item">
                            <label>Phone Number:</label>
                            <span>{selectedStudentDetails?.phone || 'N/A'}</span>
                          </div>
                          <div className="detail-item">
                            <label>Address:</label>
                            <span>{selectedStudentDetails?.address || 'N/A'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="profile-section">
                        <h3>🎓 Academic Information</h3>
                        <div className="profile-details">
                          <div className="detail-item">
                            <label>Course:</label>
                            <span>{selectedStudentDetails?.course || 'N/A'}</span>
                          </div>
                          <div className="detail-item">
                            <label>Status:</label>
                            <span className={`status-badge ${selectedStudentDetails?.status || 'inactive'}`}>
                              {selectedStudentDetails?.status || 'N/A'}
                            </span>
                          </div>
                          <div className="detail-item">
                            <label>Batch Name:</label>
                            <span>{selectedStudentDetails?.batchName || 'N/A'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="profile-section">
                        <h3>📍 Login Activity</h3>
                        <div className="profile-details">
                          <div className="detail-item">
                            <label>Last Login:</label>
                            <span>
                              {selectedStudentDetails?.lastLogin?.timestamp ? 
                                new Date(selectedStudentDetails.lastLogin.timestamp).toLocaleString() : 
                                selectedStudentDetails?.lastLoginTimestamp ? 
                                new Date(selectedStudentDetails.lastLoginTimestamp).toLocaleString() : 
                                'Never'
                              }
                            </span>
                          </div>
                          <div className="detail-item">
                            <label>Last IP:</label>
                            <span className="ip-address">
                              {selectedStudentDetails?.lastLoginIP || 
                               selectedStudentDetails?.lastLogin?.ipAddress || 
                               'N/A'
                              }
                            </span>
                          </div>
                          <div className="detail-item">
                            <label>Location:</label>
                            <span>
                              {[selectedStudentDetails?.lastLogin?.city, selectedStudentDetails?.lastLogin?.country]
                                .filter(Boolean).join(', ') || 'N/A'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="profile-grid">
                      <div className="profile-section">
                        <h3>✏️ Edit Profile</h3>
                        <form className="edit-profile-form" onSubmit={(e) => { e.preventDefault(); handleSaveProfile(); }}>
                          <div className="form-row">
                            <div className="form-group">
                              <label>Full Name</label>
                              <input
                                type="text"
                                className="profile-input"
                                value={editedProfile.name || ''}
                                onChange={(e) => setEditedProfile({...editedProfile, name: e.target.value})}
                                required
                              />
                            </div>
                            <div className="form-group">
                              <label>Email Address</label>
                              <input
                                type="email"
                                className="profile-input"
                                value={editedProfile.email || ''}
                                onChange={(e) => setEditedProfile({...editedProfile, email: e.target.value})}
                                required
                              />
                            </div>
                          </div>
                          <div className="form-row">
                            <div className="form-group">
                              <label>Phone Number</label>
                              <input
                                type="tel"
                                className="profile-input"
                                value={editedProfile.phone || ''}
                                onChange={(e) => setEditedProfile({...editedProfile, phone: e.target.value})}
                              />
                            </div>
                            <div className="form-group">
                              <label>Course</label>
                              <select
                                className="profile-input"
                                value={editedProfile.course || ''}
                                onChange={(e) => setEditedProfile({...editedProfile, course: e.target.value})}
                              >
                                <option value="">Select Course</option>
                                <option value="Data Science & AI">Data Science & AI</option>
                                <option value="Cyber Security & Ethical Hacking">Cyber Security & Ethical Hacking</option>
                              </select>
                            </div>
                          </div>
                          <div className="form-group full-width">
                            <label>Address</label>
                            <textarea
                              className="profile-input"
                              value={editedProfile.address || ''}
                              onChange={(e) => setEditedProfile({...editedProfile, address: e.target.value})}
                              rows="3"
                            />
                          </div>
                          <div className="form-group">
                            <label>Status</label>
                            <select
                              className="profile-input"
                              value={editedProfile.status || ''}
                              onChange={(e) => setEditedProfile({...editedProfile, status: e.target.value})}
                            >
                              <option value="active">Active</option>
                              <option value="inactive">Inactive</option>
                              <option value="suspended">Suspended</option>
                            </select>
                          </div>
                          <div className="form-actions">
                            <button type="submit" className="btn-save">💾 Save Changes</button>
                            <button type="button" className="btn-cancel" onClick={handleCancelEdit}>❌ Cancel</button>
                          </div>
                        </form>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Activity Tab */}
              {activeProfileTab === 'activity' && (
                <div className="activity-tab-content">
                  <div className="activity-filters">
                    <div className="filter-row">
                      <div className="filter-group">
                        <label>Action Type</label>
                        <select
                          className="filter-input"
                          value={activityFilter.action}
                          onChange={(e) => setActivityFilter({...activityFilter, action: e.target.value})}
                        >
                          <option value="">All Actions</option>
                          <option value="login">Login</option>
                          <option value="video_view">Video View</option>
                          <option value="assessment_submit">Assessment Submit</option>
                          <option value="page_view">Page View</option>
                        </select>
                      </div>
                      <div className="filter-group">
                        <label>Date Range</label>
                        <select
                          className="filter-input"
                          value={activityFilter.dateRange}
                          onChange={(e) => setActivityFilter({...activityFilter, dateRange: e.target.value})}
                        >
                          <option value="all">All Time</option>
                          <option value="7days">Last 7 Days</option>
                          <option value="30days">Last 30 Days</option>
                          <option value="90days">Last 90 Days</option>
                        </select>
                      </div>
                      <div className="filter-actions">
                        <button className="btn-filter" onClick={handleActivityFilter}>🔍 Apply</button>
                        <button className="btn-clear" onClick={() => {
                          setActivityFilter({ action: '', dateRange: 'all' });
                          if (selectedStudentDetails) {
                            loadStudentActivities(selectedStudentDetails.id || selectedStudentDetails._id, 1, {});
                          }
                        }}>🔄 Clear</button>
                      </div>
                    </div>
                  </div>

                  <div className="activity-list">
                    <div className="activity-summary">
                      <h3>📊 Activity Log</h3>
                      <button className="btn-download-csv" onClick={handleDownloadActivityCSV}>
                        📥 Download CSV
                      </button>
                    </div>

                    {studentActivities.length > 0 ? (
                      <>
                        {studentActivities.map((activity, index) => (
                          <div key={index} className="activity-item">
                            <div className="activity-header">
                              <span className="activity-action">{activity.action}</span>
                              <span className="activity-timestamp">
                                {new Date(activity.timestamp).toLocaleString()}
                              </span>
                            </div>
                            <div className="activity-details">
                              <div className="activity-detail">
                                <label>IP:</label>
                                <span>{activity.ipAddress || 'N/A'}</span>
                              </div>
                              <div className="activity-detail">
                                <label>Location:</label>
                                <span>
                                  {[activity.city, activity.country].filter(Boolean).join(', ') || 'N/A'}
                                </span>
                              </div>
                              {activity.videoTitle && (
                                <div className="activity-detail">
                                  <label>Video:</label>
                                  <span>{activity.videoTitle}</span>
                                </div>
                              )}
                              {activity.assessmentTitle && (
                                <div className="activity-detail">
                                  <label>Assessment:</label>
                                  <span>{activity.assessmentTitle}</span>
                                </div>
                              )}
                              {activity.path && (
                                <div className="activity-detail">
                                  <label>Page:</label>
                                  <span>{activity.path}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}

                        <div className="pagination">
                          <button 
                            className="btn-page" 
                            onClick={() => handleActivityPageChange(activityPagination.page - 1)}
                            disabled={activityPagination.page <= 1}
                          >
                            ← Previous
                          </button>
                          <span className="page-info">
                            Page {activityPagination.page} of {activityPagination.totalPages} 
                            ({activityPagination.total} total)
                          </span>
                          <button 
                            className="btn-page" 
                            onClick={() => handleActivityPageChange(activityPagination.page + 1)}
                            disabled={activityPagination.page >= activityPagination.totalPages}
                          >
                            Next →
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="no-activity-data">
                        <p>📋 No activity data found</p>
                        <small>Try adjusting the filters or check back later</small>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Reports Tab */}
              {activeProfileTab === 'reports' && (
                <div className="reports-tab-content">
                  <div className="reports-header">
                    <h3>📈 Student Reports</h3>
                    <div className="report-actions">
                      <div className="date-range-selector">
                        <label>Report Period</label>
                        <select
                          className="period-select"
                          value={reportPeriod}
                          onChange={(e) => setReportPeriod(e.target.value)}
                        >
                          <option value="7days">Last 7 Days</option>
                          <option value="30days">Last 30 Days</option>
                          <option value="90days">Last 90 Days</option>
                          <option value="custom">Custom Range</option>
                        </select>
                      </div>
                      {reportPeriod === 'custom' && (
                        <div className="custom-date-range">
                          <input
                            type="date"
                            className="date-input"
                            value={customDateRange.start}
                            onChange={(e) => setCustomDateRange({...customDateRange, start: e.target.value})}
                          />
                          <span>to</span>
                          <input
                            type="date"
                            className="date-input"
                            value={customDateRange.end}
                            onChange={(e) => setCustomDateRange({...customDateRange, end: e.target.value})}
                          />
                        </div>
                      )}
                      <button className="btn-generate-report" onClick={handleGenerateReport}>
                        📊 Generate Report
                      </button>
                    </div>
                  </div>

                  {reportData ? (
                    <div className="report-content">
                      <div className="report-summary">
                        <div className="summary-cards">
                          <div className="summary-card">
                            <h4>Total Activities</h4>
                            <p className="summary-value">{reportData.totalActivities}</p>
                          </div>
                          <div className="summary-card">
                            <h4>Video Views</h4>
                            <p className="summary-value">{reportData.summary.videoViews}</p>
                          </div>
                          <div className="summary-card">
                            <h4>Logins</h4>
                            <p className="summary-value">{reportData.summary.logins}</p>
                          </div>
                          <div className="summary-card">
                            <h4>Assessments</h4>
                            <p className="summary-value">{reportData.summary.assessments}</p>
                          </div>
                        </div>
                      </div>
                      <div className="report-actions-bottom">
                        <button className="btn-download-report" onClick={handleDownloadReport}>
                          📥 Download Full Report
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="no-report">
                      <p>📊 No report data available</p>
                      <small>Generate a report to see student activity summary</small>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Toast Notifications - Rendered via portal for proper stacking */}
      {createPortal(<ToastContainer />, document.body)}
    </div>
  );
};

export default AdminDashboard;
