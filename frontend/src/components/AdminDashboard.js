import React, { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { adminAnalyticsService, adminAnalyticsUtils } from '../services/adminAnalyticsService';
import { COLLECTIONS } from '../services/firebaseService';
import { ToastContainer, showToast } from './Toast';
import { getApiBaseUrl } from '../utils/apiBase';
import { YouTubeUtils } from '../utils/youtubeUtils';
import { formatDateForComponent } from '../utils/dateUtils';
import StudentsActivity from './StudentsActivity';
import ActivityTimelineChart from './charts/ActivityTimelineChart';
import { processActivityData, exportToCSV } from '../utils/activityDataProcessor';
import AssessmentStudio from './AssessmentStudio';
import ChangePasswordPanel from './ChangePasswordPanel';
import AccountMenu from './AccountMenu';
import './Dashboard.css';
import './AdminDashboard.css';
import './AdminAnalytics.css';

const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

// Student search bar that filters the main students table
const StudentSearch = memo(({ searchEmail, setSearchEmail, clearSearch, onAddStudent }) => {
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
        <div>
          <h3>🔍 Search Students</h3>
          <p className="student-search-subtitle">Filter the students list by email or name.</p>
        </div>
        {onAddStudent && (
          <button onClick={onAddStudent} className="btn-add">
            Enroll Student
          </button>
        )}
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

// Batch filter component with search and course filter buttons, now supporting teacher filter on course hover
const BATCH_PROGRAM_OPTIONS = [
  { value: 'all', label: 'All programs' },
  { value: 'data science', label: 'Data Science' },
  { value: 'cyber security', label: 'Cyber Security' },
  { value: 'cybersecurity & ai', label: 'Cybersecurity & AI' },
  { value: 'devops & ai', label: 'DevOps & AI' },
  { value: 'devops & cloud', label: 'DevOps & Cloud' }
];

const BatchFilter = memo(({
  batchSearch,
  setBatchSearch,
  batchCourseFilter,
  setBatchCourseFilter,
  batchTeacherFilter,
  setBatchTeacherFilter,
  teacherOptions = [],
  filteredCount,
  totalCount,
  openModal
}) => {
  const handleSearchChange = useCallback((e) => {
    setBatchSearch(e.target.value);
  }, [setBatchSearch]);

  const clearFilters = useCallback(() => {
    setBatchSearch('');
    setBatchCourseFilter('all');
    if (setBatchTeacherFilter) setBatchTeacherFilter('all');
    try {
      localStorage.removeItem('admin_batch_search');
      localStorage.removeItem('admin_batch_course_filter');
      localStorage.removeItem('admin_batch_teacher_filter');
    } catch (error) {
      console.warn('Failed to clear batch filters from localStorage:', error);
    }
  }, [setBatchSearch, setBatchCourseFilter, setBatchTeacherFilter]);

  const hasActiveFilters =
    batchSearch.trim() ||
    batchCourseFilter !== 'all' ||
    (batchTeacherFilter && batchTeacherFilter !== 'all');

  return (
    <div className="batch-filter-section">
      <div className="batch-filter-controls">
        <div className="batch-filter-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div className="batch-search-area">
            <input
              type="search"
              placeholder="Search batches..."
              value={batchSearch}
              onChange={handleSearchChange}
              className="batch-search-input"
            />
            <div className="batch-filter-results">
              Showing <span className="result-count">{filteredCount}</span> of <span className="total-count">{totalCount}</span> batches
            </div>
          </div>
          <button onClick={() => openModal('batch')} className="btn-add batch-filter-add-btn">
            + Add Batch
          </button>
        </div>

        <div className="batch-filter-row" style={{ marginTop: '12px' }}>
          <div className="batch-course-filters" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
            {BATCH_PROGRAM_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`batch-course-btn ${batchCourseFilter === opt.value ? 'active' : ''}`}
                onClick={() => setBatchCourseFilter(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="batch-filter-row" style={{ marginTop: '10px' }}>
          <div className="batch-course-filters" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 650, color: '#5a6d76', marginRight: '4px' }}>Teachers:</span>
            <button
              type="button"
              className={`batch-course-btn ${!batchTeacherFilter || batchTeacherFilter === 'all' ? 'active' : ''}`}
              onClick={() => setBatchTeacherFilter('all')}
            >
              All teachers
            </button>
            {teacherOptions.map((name) => (
              <button
                key={name}
                type="button"
                className={`batch-course-btn ${batchTeacherFilter === name ? 'active' : ''}`}
                onClick={() => setBatchTeacherFilter(name)}
              >
                {name}
              </button>
            ))}
          </div>
        </div>

        {hasActiveFilters && (
          <div className="batch-filter-actions" style={{ marginTop: '10px' }}>
            <button onClick={clearFilters} className="batch-clear-filters" type="button">
              Clear filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

const AdminDashboard = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const apiUrl = getApiBaseUrl();
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

  // Teacher details modal
  const [showTeacherDetailsModal, setShowTeacherDetailsModal] = useState(false);
  const [selectedTeacherDetails, setSelectedTeacherDetails] = useState(null);
  const [activeTeacherTab, setActiveTeacherTab] = useState('profile');
  
  // Activity Chart states
  const [chartData, setChartData] = useState([]);
  const [activitySummary, setActivitySummary] = useState({});
  const [showLogins, setShowLogins] = useState(true);
  const [showVideoViews, setShowVideoViews] = useState(true);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [graphDateRange, setGraphDateRange] = useState({
    start: '',
    end: ''
  });
  
  // Analytics states
  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState(null);
  const [analyticsPeriod, setAnalyticsPeriod] = useState('30days');
  
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
  
  // Batch filtering functionality with localStorage persistence
  const [batchSearch, setBatchSearch] = useState(() => {
    try {
      return localStorage.getItem('admin_batch_search') || '';
    } catch (error) {
      console.warn('Failed to read batch search from localStorage:', error);
      return '';
    }
  });
  
  const [batchCourseFilter, setBatchCourseFilter] = useState(() => {
    try {
      return localStorage.getItem('admin_batch_course_filter') || 'all';
    } catch (error) {
      console.warn('Failed to read batch course filter from localStorage:', error);
      return 'all';
    }
  });

  const [batchTeacherFilter, setBatchTeacherFilter] = useState(() => {
    try {
      return localStorage.getItem('admin_batch_teacher_filter') || 'all';
    } catch (error) {
      console.warn('Failed to read batch teacher filter from localStorage:', error);
      return 'all';
    }
  });
  const [oneToOneTeacherFilter, setOneToOneTeacherFilter] = useState('all');
  const [oneToOneProgramFilter, setOneToOneProgramFilter] = useState('all');

  // Enhanced setter functions with localStorage persistence
  const setBatchSearchWithPersistence = useCallback((value) => {
    setBatchSearch(value);
    try {
      localStorage.setItem('admin_batch_search', value);
    } catch (error) {
      console.warn('Failed to save batch search to localStorage:', error);
    }
  }, []);

  const setBatchCourseFilterWithPersistence = useCallback((value) => {
    setBatchCourseFilter(value);
    try {
      localStorage.setItem('admin_batch_course_filter', value);
    } catch (error) {
      console.warn('Failed to save batch course filter to localStorage:', error);
    }
  }, []);

  const setBatchTeacherFilterWithPersistence = useCallback((value) => {
    setBatchTeacherFilter(value);
    try {
      localStorage.setItem('admin_batch_teacher_filter', value);
    } catch (error) {
      console.warn('Failed to save batch teacher filter to localStorage:', error);
    }
  }, []);
  
  // Password visibility states
  const [showStudentPassword, setShowStudentPassword] = useState(false);
  const [showTeacherPassword, setShowTeacherPassword] = useState(false);
  const [showMentorPassword, setShowMentorPassword] = useState(false);

  // Password update states
  const [passwordUpdateData, setPasswordUpdateData] = useState({
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswordUpdate, setShowPasswordUpdate] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [studentPage, setStudentPage] = useState(1);

  const openStudentDetails = useCallback((student) => {
    setSelectedStudentDetails(student);
    setActiveProfileTab('profile');
    setEditMode(false);
    setEditedProfile({});
    setShowStudentDetailsModal(true);
    setSearchEmail('');
    setStudentPage(1);
  }, []);

  const openTeacherDetails = useCallback((teacherOrRef) => {
    if (!teacherOrRef) return;

    const refId = String(
      teacherOrRef.id || teacherOrRef._id || teacherOrRef.teacherId || ''
    ).trim();
    const refName = String(
      teacherOrRef.name || teacherOrRef.teacherName || ''
    ).trim().toLowerCase();

    const matched =
      (teachers || []).find((t) => String(t.id || t._id) === refId) ||
      (teachers || []).find((t) => (t.name || '').trim().toLowerCase() === refName) ||
      null;

    const teacher = matched || {
      id: refId || undefined,
      name: teacherOrRef.name || teacherOrRef.teacherName || 'Unknown teacher',
      email: teacherOrRef.email || 'N/A',
      phone: teacherOrRef.phone || 'N/A',
      domain: teacherOrRef.domain || 'N/A',
      assignedCourses: teacherOrRef.assignedCourses || [],
      experience: teacherOrRef.experience || 'N/A',
      status: teacherOrRef.status || 'unknown',
      age: teacherOrRef.age,
      address: teacherOrRef.address
    };

    setSelectedTeacherDetails(teacher);
    setActiveTeacherTab('profile');
    setShowTeacherDetailsModal(true);
  }, [teachers]);

  const handleBatchClick = useCallback((batch) => {
    const batchId = batch.id || batch._id;
    console.log('Navigating to batch:', {
      batchName: batch.name,
      batchId: batchId,
      fullBatch: batch
    });
    navigate(`/admin/batch/${batchId}`, { 
      state: { from: 'admin-batches' } 
    });
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
  const [enrollmentPreview, setEnrollmentPreview] = useState('');
  
  // Batch details modal state
  const [showBatchDetailsModal, setShowBatchDetailsModal] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [batchView, setBatchView] = useState(''); // 'videos' or 'students'
  const [studentsPerPage, setStudentsPerPage] = useState(15);

  const clearSearch = useCallback(() => {
    setSearchEmail('');
    setStudentPage(1);
  }, []);

  // Preview next SKY enrollment number while enrolling a student
  useEffect(() => {
    if (!showModal || modalType !== 'student' || editingItem) {
      return undefined;
    }
    const joiningDate = formData.joiningDate || new Date().toISOString().slice(0, 10);
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const token = localStorage.getItem('token');
        const apiUrl = getApiBaseUrl();
        const res = await fetch(
          `${apiUrl}/api/admin/enrollment/preview-next?joiningDate=${encodeURIComponent(joiningDate)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setEnrollmentPreview(data.enrollmentNumber || '');
      } catch (_) {
        /* ignore preview errors */
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [showModal, modalType, editingItem, formData.joiningDate]);

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

  const PROGRAM_OPTIONS = [
    'Data Science & AI',
    'Cyber Security & Ethical Hacking',
    'Cybersecurity & AI',
    'DevOps & AI',
    'DevOps & Cloud'
  ];

  const matchesProgramFilter = useCallback((courseName, filterValue) => {
    if (!filterValue || filterValue === 'all') return true;
    const c = (courseName || '').toLowerCase();
    const val = filterValue.toLowerCase();

    const isCyberAi =
      c.includes('cybersecurity & ai') ||
      c.includes('cyber security & ai') ||
      (((c.includes('cyber') || c.includes('security')) && c.includes('ai')) &&
        !c.includes('ethical') &&
        !c.includes('hacking'));

    if (val === 'cybersecurity & ai') return isCyberAi;
    if (val === 'cyber security') {
      return (
        (c.includes('cyber') || c.includes('security') || c.includes('ethical') || c.includes('hacking')) &&
        !isCyberAi
      );
    }
    if (val === 'data science') return c.includes('data') || c.includes('science');
    if (val === 'devops & ai') return c.includes('devops') && c.includes('ai');
    if (val === 'devops & cloud') return c.includes('devops') && c.includes('cloud');
    return c.includes(val);
  }, []);

  const isOneToOneBatch = useCallback((batch) => {
    if (!batch) return false;
    if (batch.batchType === 'one-to-one') return true;
    const course = (batch.course || '').toLowerCase();
    return course.includes('one-to-one') || course === 'one to one';
  }, []);

  const teacherAssignedBatches = useMemo(() => {
    if (!selectedTeacherDetails) return { regular: [], oneToOne: [] };
    const teacherId = String(selectedTeacherDetails.id || selectedTeacherDetails._id || '');
    const teacherName = (selectedTeacherDetails.name || '').trim().toLowerCase();

    const matchesTeacher = (batch) => {
      const batchTeacherId = String(batch.teacherId || '');
      const batchTeacherName = (batch.teacherName || '').trim().toLowerCase();
      if (teacherId && batchTeacherId && batchTeacherId === teacherId) return true;
      if (teacherName && batchTeacherName && batchTeacherName === teacherName) return true;
      return false;
    };

    const withCounts = (list) =>
      list.map((batch) => {
        const batchId = String(batch.id || batch._id || '');
        const studentCount = (students || []).filter(
          (s) => s.role === 'student' && String(s.batchId || '') === batchId
        ).length;
        return { ...batch, studentCount };
      });

    const regular = withCounts((batches || []).filter((b) => !isOneToOneBatch(b) && matchesTeacher(b)));
    const oneToOne = withCounts([
      ...(batches || []).filter((b) => isOneToOneBatch(b) && matchesTeacher(b)),
      ...(oneToOneBatches || []).filter((b) => matchesTeacher(b))
    ]);

    const seen = new Set();
    const uniqueOneToOne = oneToOne.filter((b) => {
      const id = String(b.id || b._id || '');
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    return { regular, oneToOne: uniqueOneToOne };
  }, [selectedTeacherDetails, batches, oneToOneBatches, students, isOneToOneBatch]);

  // Filter teachers by selected course for batch modal (all teachers for 1:1)
  const getFilteredTeachers = useCallback(() => {
    if (modalType !== 'batch') {
      return teachers;
    }
    if (formData.batchType === 'one-to-one' || !formData.course || formData.course === '__custom__') {
      return teachers;
    }
    return (teachers || []).filter(teacher => {
      if (teacher.assignedCourses && teacher.assignedCourses.length > 0) {
        return teacher.assignedCourses.includes(formData.course);
      }
      return teacher.domain === formData.course;
    });
  }, [modalType, formData.course, formData.batchType, teachers]);

  useEffect(() => {
    loadAllData();
    // Intentionally run once on mount. Including `loadAllData` here can throw
    // at runtime because `loadAllData` is declared later in this file.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dynamic header height detection for dual sticky system
  useEffect(() => {
    const updateAdminHeaderHeight = () => {
      const adminHeader = document.querySelector('.admin-top-header');
      if (adminHeader) {
        const height = adminHeader.offsetHeight;
        document.documentElement.style.setProperty('--admin-header-height', `${height}px`);
      }
    };

    // Initial measurement
    updateAdminHeaderHeight();

    // Update on resize
    const handleResize = () => {
      updateAdminHeaderHeight();
    };

    // Update on scroll (in case header height changes dynamically)
    const handleScroll = () => {
      updateAdminHeaderHeight();
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll);

    // Also update when DOM changes
    const observer = new MutationObserver(() => {
      updateAdminHeaderHeight();
    });

    const adminHeader = document.querySelector('.admin-top-header');
    if (adminHeader) {
      observer.observe(adminHeader, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style']
      });
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll);
      observer.disconnect();
    };
  }, []);

  // Handle navigation state when returning from BatchDetailsPage
  useEffect(() => {
    if (location.state?.activeSection) {
      setActiveSection(location.state.activeSection);
    }
  }, [location.state]);

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
    if (!searchEmail.trim()) return students || [];
    const term = searchEmail.trim().toLowerCase();
    return (students || []).filter(student => {
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

  // Derived filtered data for batches section (regular batches only)
  const filteredBatches = useMemo(() => {
    let filtered = (batches || []).filter(batch => !isOneToOneBatch(batch));
    
    // Apply course filter
    if (batchCourseFilter !== 'all') {
      filtered = filtered.filter(batch =>
        matchesProgramFilter(batch.course || batch.programLabel, batchCourseFilter)
      );
    }

    // Apply teacher filter
    if (batchTeacherFilter && batchTeacherFilter !== 'all') {
      const selected = batchTeacherFilter.trim().toLowerCase();
      filtered = filtered.filter(batch => {
        const teacherName = (batch.teacherName || '').trim().toLowerCase();
        return teacherName === selected || String(batch.teacherId || '') === batchTeacherFilter;
      });
    }
    
    // Apply search filter
    if (batchSearch.trim()) {
      const searchTerm = batchSearch.trim().toLowerCase();
      filtered = filtered.filter(batch => {
        const batchName = (batch.name || '').toLowerCase();
        const course = (batch.course || '').toLowerCase();
        const teacherName = (batch.teacherName || '').toLowerCase();
        const status = (batch.status || '').toLowerCase();
        
        // Get student names and emails for this batch
        const batchStudents = students.filter(student => 
          student.role === 'student' && student.batchId === (batch.id || batch._id)
        );
        const studentNames = batchStudents.map(s => (s.name || '').toLowerCase()).join(' ');
        const studentEmails = batchStudents.map(s => (s.email || '').toLowerCase()).join(' ');
        
        return (
          batchName.includes(searchTerm) ||
          course.includes(searchTerm) ||
          teacherName.includes(searchTerm) ||
          status.includes(searchTerm) ||
          studentNames.includes(searchTerm) ||
          studentEmails.includes(searchTerm)
        );
      });
    }
    
    return filtered;
  }, [batches, batchCourseFilter, batchTeacherFilter, batchSearch, students, isOneToOneBatch, matchesProgramFilter]);

  const oneToOneTeacherOptions = useMemo(() => {
    const names = new Map();
    (batches || []).filter(isOneToOneBatch).forEach((batch) => {
      const name = (batch.teacherName || '').trim();
      if (name) names.set(name.toLowerCase(), name);
    });
    // Only teachers who already have one-to-one batches (avoid empty filter chips)
    return Array.from(names.values()).sort((a, b) => a.localeCompare(b));
  }, [batches, isOneToOneBatch]);

  const regularBatchTeacherOptions = useMemo(() => {
    const names = new Map();
    (batches || []).filter((batch) => !isOneToOneBatch(batch)).forEach((batch) => {
      const name = (batch.teacherName || '').trim();
      if (name) names.set(name.toLowerCase(), name);
    });
    return Array.from(names.values()).sort((a, b) => a.localeCompare(b));
  }, [batches, isOneToOneBatch]);

  const filteredOneToOneBatches = useMemo(() => {
    let filtered = (batches || []).filter(batch => isOneToOneBatch(batch));

    if (oneToOneProgramFilter !== 'all') {
      filtered = filtered.filter(batch =>
        matchesProgramFilter(batch.programLabel || batch.course, oneToOneProgramFilter)
      );
    }

    if (oneToOneTeacherFilter !== 'all') {
      const selected = oneToOneTeacherFilter.trim().toLowerCase();
      filtered = filtered.filter(batch => {
        const teacherName = (batch.teacherName || '').trim().toLowerCase();
        const teacherId = String(batch.teacherId || '');
        return teacherName === selected || teacherId === oneToOneTeacherFilter;
      });
    }

    return filtered;
  }, [batches, isOneToOneBatch, oneToOneTeacherFilter, oneToOneProgramFilter, matchesProgramFilter]);

  const regularBatchTotal = useMemo(
    () => (batches || []).filter(batch => !isOneToOneBatch(batch)).length,
    [batches, isOneToOneBatch]
  );

  // Optimized individual data loading functions
  const loadStudents = useCallback(async (forceRefresh = false) => {
    const cachedData = getCachedData('students');
    if (cachedData && !forceRefresh) {
      setStudents(cachedData);
      return cachedData;
    }

    setDataLoading(prev => ({ ...prev, students: true }));
    const controller = new AbortController();
    let timeoutId = setTimeout(() => controller.abort(), 10000);
    try {
      const token = localStorage.getItem('token');
      const apiUrl = getApiBaseUrl();
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
      const apiUrl = getApiBaseUrl();
      const response = await fetch(`${apiUrl}/api/admin/teachers`, { 
        headers: { 'Authorization': `Bearer ${token}` } 
      });
      
      if (response.ok) {
        const data = await response.json();
        setTeachers(data);
        setCachedData('teachers', data);
        return data;
      }
      console.error('Failed to load teachers:', response.status);
      setTeachers([]);
      return [];
    } catch (error) {
      console.error('Error loading teachers:', error);
      setTeachers([]);
      return [];
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
      const apiUrl = getApiBaseUrl();
      const response = await fetch(`${apiUrl}/api/admin/courses`, { 
        headers: { 'Authorization': `Bearer ${token}` } 
      });
      
      if (response.ok) {
        const data = await response.json();
        setCourses(data);
        setCachedData('courses', data);
        return data;
      }
      console.error('Failed to load courses:', response.status);
      setCourses([]);
      return [];
    } catch (error) {
      console.error('Error loading courses:', error);
      setCourses([]);
      return [];
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
      const apiUrl = getApiBaseUrl();
      
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
      }
      console.error('Failed to load batches:', response.status);
      setBatches([]);
      loadOneToOneBatches(forceRefresh);
      return [];
    } catch (error) {
      console.error('Error loading batches:', error);
      setBatches([]);
      return [];
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
      const apiUrl = getApiBaseUrl();
      
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
      const apiUrl = getApiBaseUrl();
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
      const apiUrl = getApiBaseUrl();
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
      const apiUrl = getApiBaseUrl();
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
      const apiUrl = getApiBaseUrl();
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
      const apiUrl = getApiBaseUrl();
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
      const apiUrl = getApiBaseUrl();
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
      const apiUrl = getApiBaseUrl();
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
      const apiUrl = getApiBaseUrl();
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
      const apiUrl = getApiBaseUrl();
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
      const apiUrl = getApiBaseUrl();
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
    const totalStudents = (students || []).length;
    const activeStudents = (students || []).filter(s => s.status === 'active').length;
    const totalCourses = (courses || []).length;
    const activeJobs = (jobs || []).filter(j => j.status === 'active').length;
    const totalRevenue = (students || []).reduce((sum, s) => sum + (s.tuitionPaid || 0), 0);

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
      } else if (type === 'teacher') {
        // Ensure assignedCourses is properly set when editing a teacher
        const teacherFormData = {
          ...item,
          // Ensure assignedCourses is an array, fallback to domain if needed
          assignedCourses: item.assignedCourses && Array.isArray(item.assignedCourses) 
            ? item.assignedCourses 
            : (item.domain ? [item.domain] : [])
        };
        console.log('🔍 Editing teacher formData:', teacherFormData);
        setFormData(teacherFormData);
      } else {
        const editData = { ...item };
        if (type === 'student') {
          const rawJoin = item.joiningDate || item.createdAt;
          if (rawJoin) {
            const d = new Date(rawJoin);
            if (!Number.isNaN(d.getTime())) {
              editData.joiningDate = d.toISOString().slice(0, 10);
            }
          }
        }
        setFormData(editData);
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
      joiningDate: new Date().toISOString().slice(0, 10),
      age: '',
      domain: '',
      experience: '',
      title: '',
      company: '',
      linkedin: '',
      bio: '',
      skills: []
    });
    setEnrollmentPreview('');
    
    // Reset password update states
    setPasswordUpdateData({
      newPassword: '',
      confirmPassword: ''
    });
    setShowPasswordUpdate(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  };

  const getDefaultFormData = (type) => {
    const defaults = {
      student: {
        name: '',
        email: '',
        password: '',
        course: '',
        batchId: '',
        status: 'active',
        role: 'student',
        phone: '',
        address: '',
        joiningDate: new Date().toISOString().slice(0, 10),
        enrollmentNumber: '',
      },
      teacher: { name: '', email: '', password: '', age: '', domain: '', assignedCourses: [], experience: '', status: 'active', role: 'teacher', phone: '', address: '' },
      course: { title: '', description: '', duration: '', modules: 0, status: 'active', instructor: '', price: '' },
      batch: { name: '', course: '', startDate: '', teacherId: '', teacherName: '', status: 'active', batchType: 'regular', programLabel: '', customProgram: false },
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
            const apiUrl = getApiBaseUrl();
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
              phone: formData.phone || '',
              address: formData.address || '',
              course: formData.course || '',
              batchId: formData.batchId || '',
              status: formData.status || 'active',
              role: 'student',
              joiningDate: formData.joiningDate || new Date().toISOString().slice(0, 10),
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
              const created = await createResponse.json();
              const enNo = created.enrollmentNumber || enrollmentPreview || '';
              showToast(
                enNo
                  ? `Student enrolled successfully. Enrollment no: ${enNo}`
                  : `Student enrolled successfully! Email: ${formData.email}`,
                'success'
              );
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
            status: formData.status || 'active',
            joiningDate: formData.joiningDate || undefined,
          };
          
          // Password cannot be updated during edit for security
          // User should use password reset feature
          
          const token = localStorage.getItem('token');
          const apiUrl = getApiBaseUrl();
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
        if (!formData.name || !formData.email || (!editingItem && !formData.password) || !formData.assignedCourses || formData.assignedCourses.length === 0) {
          showToast('Please fill in all required fields (Name, Email, Password, At least one course)', 'warning');
          return;
        }

        // Special handling for teacher creation/update with password
        if (!editingItem) {
          // Creating new teacher - hash password before storing
          try {
            // Check if email already exists via API
            const token = localStorage.getItem('token');
            const apiUrl = getApiBaseUrl();
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
              assignedCourses: formData.assignedCourses,
              experience: formData.experience || '',
              phone: formData.phone || '',
              address: formData.address || '',
              status: formData.status || 'active',
              role: 'teacher'
            };

            console.log('🔍 Teacher data being sent:', teacherData);
            console.log('🔍 formData.assignedCourses:', formData.assignedCourses);

            const createResponse = await fetch(`${apiUrl}/api/admin/teachers`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify(teacherData)
            });

            if (createResponse.ok) {
              const responseData = await createResponse.json();
              console.log('✅ Frontend: Teacher creation response:', responseData);
              
              // Add new teacher to local state immediately
              if (responseData.teacher) {
                setTeachers(prevTeachers => [...prevTeachers, responseData.teacher]);
                console.log('✅ Frontend: Added new teacher to local state immediately');
              }
              
              showToast('Teacher created successfully!', 'success');
              closeModal();
              // Still refresh to ensure consistency with backend
              await loadTeachers(true);
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
            assignedCourses: formData.assignedCourses,
            experience: formData.experience || '',
            phone: formData.phone || '',
            address: formData.address || '',
            status: formData.status || 'active'
          };

          console.log('🔍 Teacher update data being sent:', updateData);
          console.log('🔍 formData.assignedCourses (update):', formData.assignedCourses);

          // Password cannot be updated during edit for security
          // User should use password reset feature

          const token = localStorage.getItem('token');
          const apiUrl = getApiBaseUrl();
          const updateResponse = await fetch(`${apiUrl}/api/admin/teachers/${editingItem.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(updateData)
          });

          if (updateResponse.ok) {
            const responseData = await updateResponse.json();
            console.log('✅ Frontend: Teacher update response:', responseData);
            console.log('🔍 Frontend: Response structure analysis:', {
              hasMessage: !!responseData.message,
              hasTeacher: !!responseData.teacher,
              teacherId: responseData.teacher?._id,
              teacherAssignedCourses: responseData.teacher?.assignedCourses,
              teacherKeys: responseData.teacher ? Object.keys(responseData.teacher) : 'no teacher object'
            });
            
            // Update local state immediately with the returned teacher data
            if (responseData.teacher) {
              setTeachers(prevTeachers => 
                prevTeachers.map(teacher => 
                  teacher._id === editingItem.id 
                    ? { ...teacher, ...responseData.teacher }
                    : teacher
                )
              );
              console.log('✅ Frontend: Updated local teacher state immediately');
              console.log('🔍 Frontend: Updated teacher data:', {
                id: responseData.teacher._id,
                name: responseData.teacher.name,
                assignedCourses: responseData.teacher.assignedCourses,
                domain: responseData.teacher.domain
              });
            } else {
              console.warn('⚠️ Frontend: No teacher object in response, falling back to cache refresh');
            }
            
            showToast('Teacher updated successfully!', 'success');
            closeModal();
            // Still refresh to ensure consistency with backend
            await loadTeachers(true); 
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
        const resolvedCourse = formData.customProgram
          ? (formData.programLabel || '').trim()
          : (formData.course || '').trim();
        if (!formData.name || !resolvedCourse || !formData.teacherId) {
          showToast('Please fill in all required fields (Batch Name, Program, Teacher)', 'warning');
          return;
        }
        formData.course = resolvedCourse;
        formData.batchType = formData.batchType === 'one-to-one' ? 'one-to-one' : 'regular';
        formData.programLabel = formData.batchType === 'one-to-one'
          ? (formData.programLabel || resolvedCourse)
          : (formData.programLabel || '');
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
          const apiUrl = getApiBaseUrl();
          
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
          const apiUrl = getApiBaseUrl();
          
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
      const apiUrl = getApiBaseUrl();
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

  // Request logging utility for debugging
  const logApiRequest = async (url, options, response) => {
    console.log('=== API Request Debug ===');
    console.log('URL:', url);
    console.log('Method:', options.method);
    console.log('Headers:', options.headers);
    console.log('Request Body:', options.body);
    console.log('Response Status:', response.status);
    console.log('Response Headers:', [...response.headers.entries()]);
    
    try {
      const responseClone = response.clone();
      const responseText = await responseClone.text();
      console.log('Response Body:', responseText);
      
      // Try to parse as JSON to validate
      try {
        JSON.parse(responseText);
        console.log('✅ Response is valid JSON');
      } catch (jsonError) {
        console.log('❌ Response is NOT valid JSON:', jsonError.message);
      }
    } catch (error) {
      console.log('Could not read response body:', error.message);
    }
    console.log('=== End Debug ===');
  };

  const handlePasswordUpdate = async () => {
    try {
      setSaving(true);
      
      // Validate editingItem first
      if (!editingItem) {
        showToast('No user selected. Please select a user to update their password.', 'error');
        return;
      }

      if (!editingItem.id && !editingItem._id) {
        showToast('Invalid user data. Please try selecting the user again.', 'error');
        return;
      }
      
      // Validation
      if (!passwordUpdateData.newPassword || !passwordUpdateData.confirmPassword) {
        showToast('Both password fields are required', 'error');
        return;
      }

      if (passwordUpdateData.newPassword !== passwordUpdateData.confirmPassword) {
        showToast('Passwords do not match', 'error');
        return;
      }

      // Password strength requirements
      if (passwordUpdateData.newPassword.length < 8) {
        showToast('Password must be at least 8 characters long', 'error');
        return;
      }

      if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/.test(passwordUpdateData.newPassword)) {
        showToast('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character', 'error');
        return;
      }

      const token = localStorage.getItem('token');
      const apiUrl = getApiBaseUrl();
      const userId = editingItem.id || editingItem._id;

      // Debug logging for userId and URL construction
      console.log('🔍 Password Update Debug:');
      console.log('editingItem:', editingItem);
      console.log('editingItem type:', typeof editingItem);
      console.log('editingItem keys:', editingItem ? Object.keys(editingItem) : 'N/A');
      console.log('userId:', userId);
      console.log('apiUrl:', apiUrl);
      console.log('passwordUpdateData:', passwordUpdateData);

      if (!userId) {
        console.error('❌ User ID is missing!');
        console.error('editingItem.id:', editingItem?.id);
        console.error('editingItem._id:', editingItem?._id);
        showToast('User ID is missing. Please try selecting the user again.', 'error');
        return;
      }

      if (!token) {
        console.error('❌ Auth token is missing!');
        showToast('Authentication token is missing. Please log in again.', 'error');
        return;
      }

      const requestOptions = {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          newPassword: passwordUpdateData.newPassword,
          confirmPassword: passwordUpdateData.confirmPassword
        })
      };

      const url = `${apiUrl}/api/admin/users/${userId}/password`;
      
      console.log('🌐 Making request to:', url);
      console.log('📦 Request options:', requestOptions);

      if (!url || url.includes('undefined') || url.includes('null')) {
        console.error('❌ Invalid URL constructed:', url);
        showToast('Invalid request URL. Please try again.', 'error');
        return;
      }

      const response = await fetch(url, requestOptions);

      // Log the request for debugging (only in development)
      if (window.location.hostname === 'localhost') {
        await logApiRequest(url, requestOptions, response);
      }

      if (response.ok) {
        const result = await response.json();
        showToast('Password updated successfully! User will need to login with new password.', 'success');
        
        // Clear password update form
        setPasswordUpdateData({ newPassword: '', confirmPassword: '' });
        setShowPasswordUpdate(false);
      } else {
        // Enhanced error handling with proper JSON parsing fallback
        let errorMessage = 'Failed to update password';
        
        // Handle specific HTTP status codes
        if (response.status === 404) {
          errorMessage = 'Password update endpoint not found. The user ID may be invalid or the endpoint may not be available.';
        } else if (response.status === 401) {
          errorMessage = 'You are not authorized to update passwords. Please check your admin permissions.';
        } else if (response.status === 403) {
          errorMessage = 'Access denied. You do not have permission to update this user\'s password.';
        } else if (response.status >= 500) {
          errorMessage = 'Server error occurred. Please try again later.';
        }
        
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch (parseError) {
          console.warn('Failed to parse error response as JSON:', parseError);
          // Try to get text response as fallback
          try {
            const textResponse = await response.text();
            if (response.status === 404) {
              errorMessage = `Endpoint not found: ${url}. ${textResponse}`;
            } else {
              errorMessage = textResponse || errorMessage;
            }
          } catch (textError) {
            console.warn('Failed to get text response:', textError);
            errorMessage = `Server error (${response.status})`;
          }
        }
        showToast(errorMessage, 'error');
      }
    } catch (error) {
      console.error('Error updating password:', error);
      // Enhanced error message for network/connection issues
      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        showToast('Unable to connect to the server. Please check your internet connection.', 'error');
      } else if (error.name === 'AbortError') {
        showToast('Request timed out. Please try again.', 'error');
      } else {
        showToast('Failed to update password: ' + error.message, 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (collection, id) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      try {
        const token = localStorage.getItem('token');
        const apiUrl = getApiBaseUrl();
        
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
        const activities = data.activities || [];
        setStudentActivities(activities);
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

  // Process activity data for graph
  const { chartData: processedChartData, summary: processedActivitySummary } = useMemo(() => {
    return processActivityData(
      studentActivities,
      graphDateRange.start || activityFilter.startDate,
      graphDateRange.end || activityFilter.endDate
    );
  }, [studentActivities, graphDateRange, activityFilter]);

  // Update chart data and summary when processed data changes
  useEffect(() => {
    setChartData(processedChartData);
    setActivitySummary(processedActivitySummary);
  }, [processedChartData, processedActivitySummary]);

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
        export: 'csv'
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

  // Download graph data CSV
  const handleDownloadGraphCSV = () => {
    const { rawFilteredData } = processActivityData(
      studentActivities,
      graphDateRange.start || activityFilter.startDate,
      graphDateRange.end || activityFilter.endDate
    );
    
    const filename = `graph-activity-${selectedStudentDetails?.name?.replace(/\s+/g, '-') || 'student'}-${new Date().toISOString().split('T')[0]}.csv`;
    exportToCSV(rawFilteredData, filename);
    showToast('Graph data CSV downloaded successfully!', 'success');
  };

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

  // Fetch comprehensive analytics data
  const fetchAnalyticsData = useCallback(async () => {
    try {
      setAnalyticsLoading(true);
      setAnalyticsError(null);
      
      const params = { period: analyticsPeriod };
      if (analyticsPeriod === 'custom' && customDateRange.start && customDateRange.end) {
        params.startDate = customDateRange.start;
        params.endDate = customDateRange.end;
      }
      
      const data = await adminAnalyticsService.getAnalytics(params);
      setAnalyticsData(data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      setAnalyticsError(error.message || 'Failed to fetch analytics');
    } finally {
      setAnalyticsLoading(false);
    }
  }, [analyticsPeriod, customDateRange]);

  // Fetch analytics when period changes and analytics section is open
  useEffect(() => {
    if (activeSection === 'analytics') {
      fetchAnalyticsData();
    }
  }, [fetchAnalyticsData, activeSection]);

  const handleDownloadReport = useCallback(async () => {
    try {
      const studentId = selectedStudentDetails?.id || selectedStudentDetails?._id;
      if (!studentId) {
        showToast('No student selected', 'warning');
        return;
      }

      let startDate;
      let endDate;
      const period = reportPeriod || '30days';

      if (period === 'custom') {
        startDate = customDateRange.start;
        endDate = customDateRange.end;
        if (!startDate || !endDate) {
          showToast('Select a custom date range first', 'warning');
          return;
        }
      } else {
        const days = parseInt(String(period).replace(/\D/g, ''), 10) || 30;
        endDate = new Date().toISOString().split('T')[0];
        const start = new Date();
        start.setDate(start.getDate() - days);
        startDate = start.toISOString().split('T')[0];
      }

      const token = localStorage.getItem('token');
      const apiUrl = getApiBaseUrl();
      const params = new URLSearchParams({ startDate, endDate, period });
      const response = await fetch(
        `${apiUrl}/api/admin/students/${studentId}/report.pdf?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        showToast(err.message || 'Failed to download PDF report', 'error');
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sky-states-report-${String(selectedStudentDetails?.name || 'student')
        .replace(/\s+/g, '-')
        .slice(0, 40)}-${startDate}-to-${endDate}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showToast('PDF report downloaded', 'success');
    } catch (error) {
      console.error('Error downloading PDF report:', error);
      showToast('Error downloading PDF report', 'error');
    }
  }, [selectedStudentDetails, reportPeriod, customDateRange]);

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

  const adminNavItems = [
    { id: 'overview', label: 'Overview' },
    { id: 'students', label: 'Students' },
    { id: 'studentsActivity', label: 'Candidate Activity' },
    { id: 'batches', label: 'Batches' },
    { id: 'oneToOne', label: 'One-to-One' },
    { id: 'classroom', label: 'Classroom' },
    { id: 'teachers', label: 'Teachers' },
    { id: 'assessment-studio', label: 'Assessment Studio' },
    { id: 'modules', label: 'Modules' },
    { id: 'projects', label: 'Projects' },
    { id: 'assessments', label: 'Assessments' },
    { id: 'jobs', label: 'Jobs' },
    { id: 'mentors', label: 'Mentors' },
    { id: 'content', label: 'Content' },
    { id: 'account', label: 'My Account' }
  ];

  return (
    <div className="admin-dashboard admin-dashboard-horizontal ss-shell">
      <header className="ss-shell-header">
        <div className="ss-shell-header__row">
          <div className="ss-shell-brand">
            <h1 className="ss-shell-brand__name">Sky States LMS</h1>
            <p className="ss-shell-brand__role">Administrator</p>
          </div>
          <div className="ss-shell-actions">
            <button
              type="button"
              className="ss-shell-btn"
              onClick={() => {
                clearCache();
                showToast('Cache cleared successfully!', 'success');
                refreshData();
              }}
            >
              Clear cache
            </button>
            <button
              type="button"
              className="ss-shell-btn ss-shell-btn--primary"
              onClick={() => refreshData()}
              disabled={loading}
            >
              Refresh
            </button>
            <AccountMenu
              user={user}
              onLogout={onLogout}
              onOpenAccount={() => setActiveSection('account')}
            />
          </div>
        </div>
        <nav className="ss-shell-nav" aria-label="Admin">
          {adminNavItems.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className={`ss-shell-nav__btn ${activeSection === id ? 'is-active' : ''}`}
              onClick={() => setActiveSection(id)}
            >
              {label}
            </button>
          ))}
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
                onAddStudent={() => openModal('student')}
              />
              
              <StatsCards stats={stats} />

              <div className="quick-actions">
                <h3>Quick Actions</h3>
                <div className="actions-grid">
                  <button onClick={() => openModal('student')} className="action-btn">
                    <span className="icon">➕</span>
                    <span>Enroll Student</span>
                  </button>
                  <button onClick={() => openModal('teacher')} className="action-btn">
                    <span className="icon">👨‍🏫</span>
                    <span>Add Teacher</span>
                  </button>
                  <button onClick={() => openModal('batch')} className="action-btn">
                    <span className="icon">+</span>
                    <span>Add Batch</span>
                  </button>
                  {/* <button onClick={() => openModal('job')} className="action-btn">
                    <span className="icon">➕</span>
                    <span>Add Job</span>
                  </button>
                  <button onClick={() => openModal('mentor')} className="action-btn">
                    <span className="icon">➕</span>
                    <span>Add Mentor</span>
                  </button> */}
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

              {/* <div className="recent-activity">
                <h3>Recent Activity</h3>
                <div className="activity-list">
                  <div className="activity-item">
                    <span className="activity-icon">?</span>
                    <div className="activity-content">
                      <p><strong>New student enrolled</strong></p>
                      <span className="activity-time">2 hours ago</span>
                    </div>
                  </div>
                  <div className="activity-item">
                    <span className="activity-icon">?</span>
                    <div className="activity-content">
                      <p><strong>Course updated</strong></p>
                      <span className="activity-time">5 hours ago</span>
                    </div>
                  </div>
                  <div className="activity-item">
                    <span className="activity-icon">?</span>
                    <div className="activity-content">
                      <p><strong>New job posted</strong></p>
                      <span className="activity-time">1 day ago</span>
                    </div>
                  </div>
                </div>
              </div> */}

            </div>
          )}

          {/* Students Section */}
          {activeSection === 'students' && (
            <div className="admin-section">
              {/* <div className="section-header">
                <h2>Manage Students</h2>
              </div> */}

              {/* Student Search Section */}
              <StudentSearch 
                searchEmail={searchEmail}
                setSearchEmail={setSearchEmail}
                clearSearch={clearSearch}
                onAddStudent={() => openModal('student')}
              />

              <div className="data-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Batch</th>
                      <th>Course</th>
                      <th>Last Login</th>
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
                          {student.lastLogin?.timestamp ? 
                            new Date(student.lastLogin.timestamp).toLocaleDateString() : 
                            student.lastLoginTimestamp ? 
                            new Date(student.lastLoginTimestamp).toLocaleDateString() : 
                            <span className="never-login">Never</span>
                          }
                        </td>
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
                      {[5, 10, 15, 25, 50, 100].map(size => (
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
                    <div className="page-numbers">
                      {(() => {
                        const pages = [];
                        const maxVisiblePages = 5;
                        let startPage = Math.max(1, currentStudentPage - Math.floor(maxVisiblePages / 2));
                        let endPage = Math.min(totalStudentPages, startPage + maxVisiblePages - 1);
                        
                        // Adjust if we're near the end
                        if (endPage - startPage + 1 < maxVisiblePages) {
                          startPage = Math.max(1, endPage - maxVisiblePages + 1);
                        }
                        
                        // Add first page and ellipsis if needed
                        if (startPage > 1) {
                          pages.push(
                            <button
                              key={1}
                              className="page-number"
                              onClick={() => setStudentPage(1)}
                            >
                              1
                            </button>
                          );
                          if (startPage > 2) {
                            pages.push(<span key="start-ellipsis" className="page-ellipsis">...</span>);
                          }
                        }
                        
                        // Add visible page range
                        for (let i = startPage; i <= endPage; i++) {
                          pages.push(
                            <button
                              key={i}
                              className={`page-number ${i === currentStudentPage ? 'active' : ''}`}
                              onClick={() => setStudentPage(i)}
                            >
                              {i}
                            </button>
                          );
                        }
                        
                        // Add ellipsis and last page if needed
                        if (endPage < totalStudentPages) {
                          if (endPage < totalStudentPages - 1) {
                            pages.push(<span key="end-ellipsis" className="page-ellipsis">...</span>);
                          }
                          pages.push(
                            <button
                              key={totalStudentPages}
                              className="page-number"
                              onClick={() => setStudentPage(totalStudentPages)}
                            >
                              {totalStudentPages}
                            </button>
                          );
                        }
                        
                        return pages;
                      })()}
                    </div>
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
                        <td>
                          <button
                            type="button"
                            onClick={() => openTeacherDetails(teacher)}
                            className="btn-link"
                            title="View Teacher Details"
                          >
                            {teacher.name}
                          </button>
                        </td>
                        <td>{teacher.email}</td>
                        <td>{teacher.age || 'N/A'}</td>
                        <td>
                        {teacher.assignedCourses && teacher.assignedCourses.length > 0 ? (
                          <div className="course-badges">
                            {teacher.assignedCourses.map((course, index) => (
                              <span key={index} className="course-badge">
                                {course}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span>{teacher.domain || 'N/A'}</span>
                        )}
                      </td>
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
              {/* <div className="section-header">
                <h2>Manage Batches</h2>
              </div> */}

              <BatchFilter
                batchSearch={batchSearch}
                setBatchSearch={setBatchSearchWithPersistence}
                batchCourseFilter={batchCourseFilter}
                setBatchCourseFilter={setBatchCourseFilterWithPersistence}
                batchTeacherFilter={batchTeacherFilter}
                setBatchTeacherFilter={setBatchTeacherFilterWithPersistence}
                teacherOptions={regularBatchTeacherOptions}
                filteredCount={filteredBatches.length}
                totalCount={regularBatchTotal}
                openModal={openModal}
                teachers={teachers}
                batchTeacherFilter={batchTeacherFilter}
                setBatchTeacherFilter={setBatchTeacherFilterWithPersistence}
              />

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
                    {filteredBatches.map(batch => {
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
                          <td>
                            {batch.teacherName || batch.teacherId ? (
                              <button
                                type="button"
                                onClick={() => openTeacherDetails(batch)}
                                className="btn-link"
                                title="View Teacher Details"
                              >
                                {batch.teacherName || 'View teacher'}
                              </button>
                            ) : (
                              'N/A'
                            )}
                          </td>
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
                 {filteredBatches.length === 0 && (
                  <p className="no-data">
                    {batchSearch.trim() || batchCourseFilter !== 'all' || batchTeacherFilter !== 'all'
                      ? 'No batches found matching your filters. Try adjusting your search or filters.' 
                      : 'No batches found. Create your first batch!'}
                  </p>
                )}
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

          {/* One to One Section — unified Batch with batchType one-to-one */}
          {activeSection === 'oneToOne' && (
            <div className="admin-section">
              <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h2 style={{ margin: 0 }}>One-to-One Batches</h2>
                  <p className="section-description" style={{ margin: '4px 0 0', color: '#5a6d76' }}>
                    Private batches sharing the same classroom and trainer flow as regular batches
                  </p>
                </div>
                <button
                  onClick={() => {
                    setModalType('batch');
                    setEditingItem(null);
                    setFormData({
                      ...getDefaultFormData('batch'),
                      batchType: 'one-to-one',
                      customProgram: false
                    });
                    setShowModal(true);
                  }}
                  className="btn-add"
                >
                  + Create One-to-One
                </button>
              </div>

              <div className="batch-filter-section" style={{ marginBottom: '16px' }}>
                <div className="batch-filter-row">
                  <div className="batch-course-filters" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                    <button
                      type="button"
                      className={`batch-course-btn ${oneToOneProgramFilter === 'all' ? 'active' : ''}`}
                      onClick={() => setOneToOneProgramFilter('all')}
                    >
                      All programs
                    </button>
                    {BATCH_PROGRAM_OPTIONS.filter((opt) => opt.value !== 'all').map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        className={`batch-course-btn ${oneToOneProgramFilter === opt.value ? 'active' : ''}`}
                        onClick={() => setOneToOneProgramFilter(opt.value)}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="batch-filter-row" style={{ marginTop: '10px' }}>
                  <div className="batch-course-filters" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 650, color: '#5a6d76', marginRight: '4px' }}>Teachers:</span>
                    <button
                      type="button"
                      className={`batch-course-btn ${oneToOneTeacherFilter === 'all' ? 'active' : ''}`}
                      onClick={() => setOneToOneTeacherFilter('all')}
                    >
                      All teachers
                    </button>
                    {oneToOneTeacherOptions.map((name) => (
                      <button
                        key={name}
                        type="button"
                        className={`batch-course-btn ${oneToOneTeacherFilter === name ? 'active' : ''}`}
                        onClick={() => setOneToOneTeacherFilter(name)}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>
                <p style={{ margin: '10px 0 0', fontSize: '0.85rem', color: '#5a6d76' }}>
                  Showing {filteredOneToOneBatches.length} one-to-one batch{filteredOneToOneBatches.length === 1 ? '' : 'es'}
                </p>
              </div>

              <div className="data-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Batch Name</th>
                      <th>Program</th>
                      <th>Trainer</th>
                      <th>Students</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOneToOneBatches.map(batch => {
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
                          <td>{batch.programLabel || batch.course}</td>
                          <td>
                            {batch.teacherName || batch.teacherId ? (
                              <button
                                type="button"
                                onClick={() => openTeacherDetails(batch)}
                                className="btn-link"
                                title="View Teacher Details"
                              >
                                {batch.teacherName || 'View teacher'}
                              </button>
                            ) : (
                              'N/A'
                            )}
                          </td>
                          <td>{actualStudentCount}</td>
                          <td>
                            <span className={`status-badge ${batch.status}`}>
                              {batch.status}
                            </span>
                          </td>
                          <td>
                            <button onClick={() => openModal('batch', {
                              ...batch,
                              batchType: 'one-to-one',
                              customProgram: !PROGRAM_OPTIONS.includes(batch.course),
                              programLabel: batch.programLabel || batch.course
                            })} className="btn-edit">Edit</button>
                            <button onClick={() => handleDelete('batches', batch.id || batch._id)} className="btn-delete">Delete</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filteredOneToOneBatches.length === 0 && (
                  <p className="no-data">No one-to-one batches match these filters.</p>
                )}
              </div>
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

          {/* Candidate Activity — single professional monitor (replaces Activity + Activity Log) */}
          {(activeSection === 'studentsActivity' || activeSection === 'activity') && (
            <div className="admin-section students-activity-section">
              <StudentsActivity token={typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null} />
            </div>
          )}

          {activeSection === 'account' && (
            <div className="admin-section">
              <h1 className="ss-page-title">My account</h1>
              <p className="ss-page-sub">
                Signed in as <strong>{user?.email}</strong> ({user?.role}).
                Change your password with an email verification code.
              </p>
              <div className="ss-panel" style={{ maxWidth: 520 }}>
                <p><strong>Name:</strong> {user?.name || '—'}</p>
                <p><strong>Email:</strong> {user?.email || '—'}</p>
                <p><strong>Role:</strong> {user?.role || 'admin'}</p>
                <ChangePasswordPanel mode="change" defaultEmail={user?.email || ''} />
              </div>
            </div>
          )}

          {/* Analytics Section — real API data only */}
          {activeSection === 'analytics' && (
            <div className="admin-section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <h2>Analytics & Reports</h2>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <select
                    value={analyticsPeriod}
                    onChange={(e) => setAnalyticsPeriod(e.target.value)}
                    className="form-control"
                    style={{ minWidth: '140px' }}
                  >
                    <option value="7days">Last 7 days</option>
                    <option value="30days">Last 30 days</option>
                    <option value="90days">Last 90 days</option>
                  </select>
                  <button type="button" className="btn-secondary" onClick={fetchAnalyticsData}>
                    Refresh
                  </button>
                </div>
              </div>

              {analyticsLoading && <p>Loading analytics…</p>}
              {analyticsError && <p style={{ color: '#b91c1c' }}>{analyticsError}</p>}

              {!analyticsLoading && !analyticsError && analyticsData && (
                <>
                  <div className="analytics-summary">
                    <div className="summary-card">
                      <div className="summary-content">
                        <h4>Students</h4>
                        <p className="summary-number">{analyticsData.overview?.totalStudents ?? students.length}</p>
                        <span className="summary-change neutral">
                          Active in period: {analyticsData.overview?.activeStudents ?? 0}
                        </span>
                      </div>
                    </div>
                    <div className="summary-card">
                      <div className="summary-content">
                        <h4>Teachers</h4>
                        <p className="summary-number">{analyticsData.overview?.totalTeachers ?? teachers.length}</p>
                        <span className="summary-change neutral">
                          Active in period: {analyticsData.overview?.activeTeachers ?? 0}
                        </span>
                      </div>
                    </div>
                    <div className="summary-card">
                      <div className="summary-content">
                        <h4>Batches</h4>
                        <p className="summary-number">{analyticsData.overview?.totalBatches ?? batches.length}</p>
                        <span className="summary-change neutral">Platform cohorts</span>
                      </div>
                    </div>
                    <div className="summary-card">
                      <div className="summary-content">
                        <h4>Activities</h4>
                        <p className="summary-number">{analyticsData.overview?.totalActivities ?? 0}</p>
                        <span className="summary-change neutral">
                          Engagement: {analyticsData.overview?.studentEngagementRate ?? 0}%
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="analytics-grid">
                    <div className="analytics-card">
                      <h3>Activity breakdown</h3>
                      <div className="progress-list">
                        {(analyticsData.activityBreakdown || []).length === 0 && (
                          <p className="no-data">No activity in this period</p>
                        )}
                        {(analyticsData.activityBreakdown || []).slice(0, 8).map((item) => (
                          <div key={item.action} className="progress-item">
                            <div className="progress-info">
                              <span className="progress-name">{item.action}</span>
                              <span className="progress-value">{item.count}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="analytics-card">
                      <h3>Top courses by video views</h3>
                      <div className="progress-list">
                        {(analyticsData.courseAnalytics || []).length === 0 && (
                          <p className="no-data">No video views in this period</p>
                        )}
                        {(analyticsData.courseAnalytics || []).slice(0, 5).map((course) => (
                          <div key={course.courseName} className="progress-item">
                            <div className="progress-info">
                              <span className="progress-name">{course.courseName}</span>
                              <span className="progress-value">{course.totalViews} views</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {activeSection === 'assessment-studio' && (
            <div className="admin-section">
              <AssessmentStudio user={user} />
            </div>
          )}
        </div>
      </main>

      {/* Modal - Rendered using Portal for proper centering */}
      {showModal && createPortal(
        <div className="modal-overlay">
          <div className="modal" onClick={(e) => e.stopPropagation()} key={`${modalType}-${editingItem ? editingItem.id : 'new'}`}>
            <div className="modal-header">
              <h2>
                {modalType === 'student'
                  ? (editingItem ? 'Edit enrollment' : 'Student enrollment')
                  : `${editingItem ? 'Edit' : 'Add'} ${modalType.charAt(0).toUpperCase() + modalType.slice(1)}`}
              </h2>
              <button className="close-btn" onClick={closeModal}>✕</button>
            </div>

            <div className="modal-content">
              {modalType === 'student' && (
                <div className="sky-enroll-form">
                  <p className="sky-enroll-form__intro">
                    Enroll a Sky States student. Enrollment numbers follow{' '}
                    <code>SKY_MM_YYYY_1101+</code> from the joining month and year.
                  </p>

                  <div className="sky-enroll-grid">
                    <label className="sky-enroll-field sky-enroll-field--full">
                      <span>Full name *</span>
                      <input
                        type="text"
                        placeholder="Student full name"
                        value={formData.name || ''}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        required
                      />
                    </label>

                    <label className="sky-enroll-field">
                      <span>Email *</span>
                      <input
                        type="email"
                        placeholder="student@email.com"
                        value={formData.email || ''}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        required
                        autoComplete="off"
                        readOnly
                        onFocus={(e) => e.target.removeAttribute('readonly')}
                        onBlur={(e) => e.target.setAttribute('readonly', true)}
                      />
                    </label>

                    <label className="sky-enroll-field">
                      <span>Phone</span>
                      <input
                        type="tel"
                        placeholder="Phone number"
                        value={formData.phone || ''}
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                      />
                    </label>

                    {!editingItem && (
                      <label className="sky-enroll-field sky-enroll-field--full">
                        <span>Login password *</span>
                        <div className="password-input-container">
                          <input
                            type={showStudentPassword ? 'text' : 'password'}
                            placeholder="Create password for student"
                            value={formData.password || ''}
                            onChange={(e) => handleInputChange('password', e.target.value)}
                            required
                            autoComplete="off"
                            readOnly
                            onFocus={(e) => e.target.removeAttribute('readonly')}
                            onBlur={(e) => e.target.setAttribute('readonly', true)}
                          />
                          <button
                            type="button"
                            className="password-toggle-btn"
                            onClick={() => setShowStudentPassword(!showStudentPassword)}
                            title={showStudentPassword ? 'Hide password' : 'Show password'}
                          >
                            {showStudentPassword ? 'Hide' : 'Show'}
                          </button>
                        </div>
                      </label>
                    )}

                    <label className="sky-enroll-field">
                      <span>Joining date *</span>
                      <input
                        type="date"
                        value={formData.joiningDate || ''}
                        onChange={(e) => handleInputChange('joiningDate', e.target.value)}
                        required
                      />
                    </label>

                    <label className="sky-enroll-field">
                      <span>Enrollment number</span>
                      <input
                        type="text"
                        className="sky-enroll-readonly"
                        value={
                          editingItem
                            ? (formData.enrollmentNumber || editingItem.enrollmentNumber || '—')
                            : (enrollmentPreview || 'Will assign on save')
                        }
                        readOnly
                      />
                    </label>

                    <label className="sky-enroll-field">
                      <span>Course *</span>
                      <select
                        value={formData.course || ''}
                        onChange={handleCourseChange}
                        required
                      >
                        <option value="">Select course</option>
                        <option value="Data Science & AI">Data Science & AI</option>
                        <option value="Cyber Security & Ethical Hacking">Cyber Security & Ethical Hacking</option>
                        <option value="Cybersecurity & AI">Cybersecurity & AI</option>
                        <option value="DevOps & AI">DevOps & AI</option>
                        <option value="DevOps & Cloud">DevOps & Cloud</option>
                        <option value="One-to-One">One-to-One</option>
                      </select>
                    </label>

                    <label className="sky-enroll-field">
                      <span>Batch</span>
                      <select
                        value={formData.batchId || ''}
                        onChange={(e) => handleInputChange('batchId', e.target.value)}
                      >
                        <option value="">Select batch (optional)</option>
                        {batches.map((batch) => (
                          <option key={batch.id || batch._id} value={batch.id || batch._id}>
                            {batch.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="sky-enroll-field">
                      <span>Status</span>
                      <select
                        value={formData.status || 'active'}
                        onChange={(e) => handleInputChange('status', e.target.value)}
                      >
                        <option value="active">Active</option>
                      </select>
                    </label>

                    <label className="sky-enroll-field sky-enroll-field--full">
                      <span>Address</span>
                      <textarea
                        placeholder="Mailing / contact address"
                        value={formData.address || ''}
                        onChange={(e) => handleInputChange('address', e.target.value)}
                        rows="2"
                      />
                    </label>
                  </div>

                  {editingItem && (editingItem.lastLogin || editingItem.lastLoginIP) && (
                    <div className="login-activity-section">
                      <h4>Login activity</h4>
                      <div className="activity-detail">
                        <strong>Last login:</strong>{' '}
                        {editingItem.lastLogin?.timestamp
                          ? new Date(editingItem.lastLogin.timestamp).toLocaleString()
                          : editingItem.lastLoginTimestamp
                            ? new Date(editingItem.lastLoginTimestamp).toLocaleString()
                            : 'Never'}
                      </div>
                      <div className="activity-detail">
                        <strong>Last IP:</strong>{' '}
                        <span className="ip-address">
                          {editingItem.lastLoginIP || editingItem.lastLogin?.ipAddress || 'N/A'}
                        </span>
                      </div>
                    </div>
                  )}

                  {editingItem && (
                    <div className="password-update-section">
                      <div className="password-update-header">
                        <h4>Update password</h4>
                        <button
                          type="button"
                          className="btn-toggle-password-update"
                          onClick={() => setShowPasswordUpdate(!showPasswordUpdate)}
                        >
                          {showPasswordUpdate ? 'Cancel' : 'Update password'}
                        </button>
                      </div>
                      {showPasswordUpdate && (
                        <div className="password-update-form">
                          <div className="password-input-container">
                            <input
                              type={showNewPassword ? 'text' : 'password'}
                              placeholder="New password"
                              value={passwordUpdateData.newPassword}
                              onChange={(e) =>
                                setPasswordUpdateData({ ...passwordUpdateData, newPassword: e.target.value })
                              }
                              className="password-input"
                            />
                            <button
                              type="button"
                              className="password-toggle-btn"
                              onClick={() => setShowNewPassword(!showNewPassword)}
                              title={showNewPassword ? 'Hide password' : 'Show password'}
                            >
                              {showNewPassword ? 'Hide' : 'Show'}
                            </button>
                          </div>
                          <div className="password-input-container">
                            <input
                              type={showConfirmPassword ? 'text' : 'password'}
                              placeholder="Confirm new password"
                              value={passwordUpdateData.confirmPassword}
                              onChange={(e) =>
                                setPasswordUpdateData({
                                  ...passwordUpdateData,
                                  confirmPassword: e.target.value,
                                })
                              }
                              className="password-input"
                            />
                            <button
                              type="button"
                              className="password-toggle-btn"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              title={showConfirmPassword ? 'Hide password' : 'Show password'}
                            >
                              {showConfirmPassword ? 'Hide' : 'Show'}
                            </button>
                          </div>
                          <div className="password-requirements">
                            <small>Password must contain:</small>
                            <ul>
                              <li>At least 8 characters</li>
                              <li>One uppercase letter</li>
                              <li>One lowercase letter</li>
                              <li>One number</li>
                              <li>One special character (@$!%*?&)</li>
                            </ul>
                          </div>
                          <button
                            type="button"
                            onClick={handlePasswordUpdate}
                            className="btn-update-password"
                            disabled={
                              saving ||
                              !passwordUpdateData.newPassword ||
                              !passwordUpdateData.confirmPassword ||
                              !editingItem ||
                              (!editingItem.id && !editingItem._id)
                            }
                          >
                            {saving ? 'Updating...' : 'Update password'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
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
                    <div className="password-input-container">
                      <input
                        type={showTeacherPassword ? "text" : "password"}
                        placeholder="Create password for teacher *"
                        value={formData.password || ''}
                        onChange={(e) => handleInputChange('password', e.target.value)}
                        required
                        autoComplete="off"
                        readOnly
                        onFocus={(e) => e.target.removeAttribute('readonly')}
                        onBlur={(e) => e.target.setAttribute('readonly', true)}
                      />
                      <button
                        type="button"
                        className="password-toggle-btn"
                        onClick={() => setShowTeacherPassword(!showTeacherPassword)}
                        title={showTeacherPassword ? "Hide password" : "Show password"}
                      >
                        {showTeacherPassword ? "Hide" : "Show"}
                      </button>
                    </div>
                  )}
                  <input
                    type="number"
                    placeholder="Age"
                    value={formData.age || ''}
                    onChange={(e) => handleInputChange('age', parseInt(e.target.value) || '')}
                    min="18"
                    max="80"
                  />
                  <div className="form-group">
                    <label>Course Assignments *</label>
                    <div className="course-checkboxes">
                      {[
                        { value: 'Data Science & AI', label: 'Data Science & AI' },
                        { value: 'Cyber Security & Ethical Hacking', label: 'Cyber Security & Ethical Hacking' },
                        { value: 'Cybersecurity & AI', label: 'Cybersecurity & AI' },
                        { value: 'DevOps & AI', label: 'DevOps & AI' },
                        { value: 'DevOps & Cloud', label: 'DevOps & Cloud' },
                        { value: 'One-to-One', label: 'One-to-One' }
                      ].map(course => (
                        <label key={course.value} className="course-checkbox-label">
                          <input
                            type="checkbox"
                            name="assignedCourses"
                            value={course.value}
                            checked={formData.assignedCourses?.includes(course.value) || false}
                            onChange={(e) => {
                              const courses = formData.assignedCourses || [];
                              if (e.target.checked) {
                                handleInputChange('assignedCourses', [...courses, course.value]);
                              } else {
                                handleInputChange('assignedCourses', courses.filter(c => c !== course.value));
                              }
                            }}
                          />
                          <span className="checkbox-text">{course.label}</span>
                        </label>
                      ))}
                    </div>
                    {formData.assignedCourses?.length === 0 && (
                      <small className="error-text">At least one course must be selected</small>
                    )}
                  </div>
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
                  
                  {/* Password Update Section - Only for existing teachers */}
                  {editingItem && (
                    <div className="password-update-section">
                      <div className="password-update-header">
                        <h4>Update Password</h4>
                        <button 
                          type="button" 
                          className="btn-toggle-password-update"
                          onClick={() => setShowPasswordUpdate(!showPasswordUpdate)}
                        >
                          {showPasswordUpdate ? 'Cancel' : 'Update Password'}
                        </button>
                      </div>
                      
                      {showPasswordUpdate && (
                        <div className="password-update-form">
                          <div className="password-input-container">
                            <input
                              type={showNewPassword ? "text" : "password"}
                              placeholder="New Password"
                              value={passwordUpdateData.newPassword}
                              onChange={(e) => setPasswordUpdateData({...passwordUpdateData, newPassword: e.target.value})}
                              className="password-input"
                            />
                            <button
                              type="button"
                              className="password-toggle-btn"
                              onClick={() => setShowNewPassword(!showNewPassword)}
                              title={showNewPassword ? "Hide password" : "Show password"}
                            >
                              {showNewPassword ? "Hide" : "Show"}
                            </button>
                          </div>
                          
                          <div className="password-input-container">
                            <input
                              type={showConfirmPassword ? "text" : "password"}
                              placeholder="Confirm New Password"
                              value={passwordUpdateData.confirmPassword}
                              onChange={(e) => setPasswordUpdateData({...passwordUpdateData, confirmPassword: e.target.value})}
                              className="password-input"
                            />
                            <button
                              type="button"
                              className="password-toggle-btn"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              title={showConfirmPassword ? "Hide password" : "Show password"}
                            >
                              {showConfirmPassword ? "Hide" : "Show"}
                            </button>
                          </div>
                          
                          <div className="password-requirements">
                            <small>Password must contain:</small>
                            <ul>
                              <li>At least 8 characters</li>
                              <li>One uppercase letter</li>
                              <li>One lowercase letter</li>
                              <li>One number</li>
                              <li>One special character (@$!%*?&)</li>
                            </ul>
                          </div>
                          
                          <button
                            type="button"
                            onClick={handlePasswordUpdate}
                            className="btn-update-password"
                            disabled={saving || !passwordUpdateData.newPassword || !passwordUpdateData.confirmPassword || !editingItem || (!editingItem.id && !editingItem._id)}
                          >
                            {saving ? 'Updating...' : 'Update Password'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
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
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <button
                      type="button"
                      className={`btn-secondary ${formData.batchType !== 'one-to-one' ? 'active' : ''}`}
                      onClick={() => {
                        handleInputChange('batchType', 'regular');
                        handleInputChange('customProgram', false);
                      }}
                      style={{
                        flex: 1,
                        border: formData.batchType !== 'one-to-one' ? '2px solid #147a7a' : '1px solid #d5dee3',
                        background: formData.batchType !== 'one-to-one' ? 'rgba(20,122,122,0.1)' : '#fff',
                        color: '#102a33',
                        padding: '10px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 600
                      }}
                    >
                      Regular batch
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInputChange('batchType', 'one-to-one')}
                      style={{
                        flex: 1,
                        border: formData.batchType === 'one-to-one' ? '2px solid #147a7a' : '1px solid #d5dee3',
                        background: formData.batchType === 'one-to-one' ? 'rgba(20,122,122,0.1)' : '#fff',
                        color: '#102a33',
                        padding: '10px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 600
                      }}
                    >
                      One-to-One
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="Batch Name *"
                    value={formData.name || ''}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    required
                  />
                  <select
                    value={formData.customProgram ? '__custom__' : (formData.course || '')}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '__custom__') {
                        handleInputChange('customProgram', true);
                        handleInputChange('course', '');
                        handleInputChange('programLabel', formData.programLabel || '');
                      } else {
                        handleInputChange('customProgram', false);
                        handleInputChange('course', value);
                        handleInputChange('programLabel', value);
                        handleInputChange('teacherId', '');
                        handleInputChange('teacherName', '');
                      }
                    }}
                    required
                  >
                    <option value="">Select Program *</option>
                    {PROGRAM_OPTIONS.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                    {formData.batchType === 'one-to-one' && (
                      <option value="__custom__">Custom program</option>
                    )}
                  </select>
                  {formData.customProgram && formData.batchType === 'one-to-one' && (
                    <input
                      type="text"
                      placeholder="Custom program label *"
                      value={formData.programLabel || ''}
                      onChange={(e) => {
                        handleInputChange('programLabel', e.target.value);
                        handleInputChange('course', e.target.value);
                      }}
                      required
                    />
                  )}
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
                      {formData.batchType === 'one-to-one' || formData.course
                        ? 'Select Trainer *'
                        : 'Select Program First *'}
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
                    <option value="Cybersecurity & AI">Cybersecurity & AI</option>
                    <option value="DevOps & AI">DevOps & AI</option>
                    <option value="DevOps & Cloud">DevOps & Cloud</option>
                    <option value="One-to-One">One-to-One</option>
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
                    <div className="password-input-container">
                      <input
                        type={showMentorPassword ? "text" : "password"}
                        placeholder="Create password for mentor *"
                        value={formData.password || ''}
                        onChange={(e) => handleInputChange('password', e.target.value)}
                        required
                        autoComplete="off"
                        readOnly
                        onFocus={(e) => e.target.removeAttribute('readonly')}
                        onBlur={(e) => e.target.setAttribute('readonly', true)}
                      />
                      <button
                        type="button"
                        className="password-toggle-btn"
                        onClick={() => setShowMentorPassword(!showMentorPassword)}
                        title={showMentorPassword ? "Hide password" : "Show password"}
                      >
                        {showMentorPassword ? "Hide" : "Show"}
                      </button>
                    </div>
                  )}
                  <select
                    value={formData.domain}
                    onChange={(e) => handleInputChange('domain', e.target.value)}
                    required
                  >
                    <option value="">Select Domain *</option>
                    <option value="Data Science & AI">Data Science & AI</option>
                    <option value="Cyber Security & Ethical Hacking">Cyber Security & Ethical Hacking</option>
                    <option value="Cybersecurity & AI">Cybersecurity & AI</option>
                    <option value="DevOps & AI">DevOps & AI</option>
                    <option value="DevOps & Cloud">DevOps & Cloud</option>
                    <option value="One-to-One">One-to-One</option>
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
                  {/* Password Update Section - Only for existing mentors */}
                  {editingItem && (
                    <div className="password-update-section">
                      <div className="password-update-header">
                        <h4>Update Password</h4>
                        <button 
                          type="button" 
                          className="btn-toggle-password-update"
                          onClick={() => setShowPasswordUpdate(!showPasswordUpdate)}
                        >
                          {showPasswordUpdate ? 'Cancel' : 'Update Password'}
                        </button>
                      </div>
                      
                      {showPasswordUpdate && (
                        <div className="password-update-form">
                          <div className="password-input-container">
                            <input
                              type={showNewPassword ? "text" : "password"}
                              placeholder="New Password"
                              value={passwordUpdateData.newPassword}
                              onChange={(e) => setPasswordUpdateData({...passwordUpdateData, newPassword: e.target.value})}
                              className="password-input"
                            />
                            <button
                              type="button"
                              className="password-toggle-btn"
                              onClick={() => setShowNewPassword(!showNewPassword)}
                              title={showNewPassword ? "Hide password" : "Show password"}
                            >
                              {showNewPassword ? "Hide" : "Show"}
                            </button>
                          </div>
                          
                          <div className="password-input-container">
                            <input
                              type={showConfirmPassword ? "text" : "password"}
                              placeholder="Confirm New Password"
                              value={passwordUpdateData.confirmPassword}
                              onChange={(e) => setPasswordUpdateData({...passwordUpdateData, confirmPassword: e.target.value})}
                              className="password-input"
                            />
                            <button
                              type="button"
                              className="password-toggle-btn"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              title={showConfirmPassword ? "Hide password" : "Show password"}
                            >
                              {showConfirmPassword ? "Hide" : "Show"}
                            </button>
                          </div>
                          
                          <div className="password-requirements">
                            <small>Password must contain:</small>
                            <ul>
                              <li>At least 8 characters</li>
                              <li>One uppercase letter</li>
                              <li>One lowercase letter</li>
                              <li>One number</li>
                              <li>One special character (@$!%*?&)</li>
                            </ul>
                          </div>
                          
                          <button
                            type="button"
                            onClick={handlePasswordUpdate}
                            className="btn-update-password"
                            disabled={saving || !passwordUpdateData.newPassword || !passwordUpdateData.confirmPassword || !editingItem || (!editingItem.id && !editingItem._id)}
                          >
                            {saving ? 'Updating...' : 'Update Password'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
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
                    <option value="Cybersecurity & AI">Cybersecurity & AI</option>
                    <option value="DevOps & AI">DevOps & AI</option>
                    <option value="DevOps & Cloud">DevOps & Cloud</option>
                    <option value="One-to-One">One-to-One</option>
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
                    <option value="Cybersecurity & AI">Cybersecurity & AI</option>
                    <option value="DevOps & AI">DevOps & AI</option>
                    <option value="DevOps & Cloud">DevOps & Cloud</option>
                    <option value="One-to-One">One-to-One</option>
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
                  {selectedBatch?.teacherName || selectedBatch?.teacherId ? (
                    <button
                      type="button"
                      className="btn-link"
                      onClick={() => openTeacherDetails(selectedBatch)}
                      title="View Teacher Details"
                    >
                      {selectedBatch?.teacherName || 'View teacher'}
                    </button>
                  ) : (
                    <span>N/A</span>
                  )}
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
                                <p><strong>Date:</strong> {formatDateForComponent(video.date)}</p>
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

      {/* Student Profile Dossier Modal */}
      {showStudentDetailsModal && createPortal(
        <div className="fullscreen-modal-overlay" onClick={() => setShowStudentDetailsModal(false)}>
          <div className="fullscreen-modal" onClick={(e) => e.stopPropagation()}>
            {(() => {
              const s = selectedStudentDetails || {};
              const batchLabel =
                (batches || []).find((b) => String(b.id || b._id) === String(s.batchId))?.name ||
                (oneToOneBatches || []).find((b) => String(b.id || b._id) === String(s.batchId))?.name ||
                s.batchName ||
                'No batch assigned';
              const lastLoginAt = s.lastLogin?.timestamp
                ? new Date(s.lastLogin.timestamp).toLocaleString()
                : s.lastLoginTimestamp
                  ? new Date(s.lastLoginTimestamp).toLocaleString()
                  : 'Never';
              const lastIp = s.lastLoginIP || s.lastLogin?.ipAddress || '—';
              const lastLocation = [s.lastLogin?.city, s.lastLogin?.country].filter(Boolean).join(', ') || '—';
              const joinedAt = s.createdAt || s.joinedAt || s.enrolledAt;
              return (
                <>
            <div className="fullscreen-modal-header">
              <div className="dossier-header-top">
                <div className="student-header-info">
                  <div className="student-avatar">
                    <span className="avatar-text">
                      {(s.name || 'S').charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="student-basic-info">
                    <p className="dossier-eyebrow">Candidate profile</p>
                    <h2>{s.name || 'Student'}</h2>
                    <p className="student-email">{s.email || '—'}</p>
                    <div className="student-badges">
                      <span className={`badge ${s.status || 'active'}`}>
                        {s.status || 'Active'}
                      </span>
                      <span className="badge">{s.course || 'No course'}</span>
                      <span className="badge">{batchLabel}</span>
                    </div>
                  </div>
                </div>
                <div className="modal-header-actions">
                  {activeProfileTab === 'profile' && !editMode && (
                    <button type="button" className="btn-edit-profile" onClick={handleEditProfile}>
                      Edit profile
                    </button>
                  )}
                  <button
                    type="button"
                    className="modal-close-fullscreen"
                    onClick={() => setShowStudentDetailsModal(false)}
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>
              </div>
              <div className="header-tab-buttons dossier-tabs">
                <button
                  type="button"
                  className={`header-tab-btn ${activeProfileTab === 'profile' ? 'active' : ''}`}
                  onClick={() => setActiveProfileTab('profile')}
                >
                  Profile
                </button>
                <button
                  type="button"
                  className={`header-tab-btn ${activeProfileTab === 'activity' ? 'active' : ''}`}
                  onClick={() => setActiveProfileTab('activity')}
                >
                  Activity
                </button>
              </div>
            </div>

            <div className="fullscreen-modal-content">
              {activeProfileTab === 'profile' && (
                <div className="profile-tab-content">
                  {!editMode ? (
                    <>
                      <div className="dossier-kpis">
                        <div className="dossier-kpi">
                          <strong>{batchLabel}</strong>
                          <span>Batch</span>
                        </div>
                        <div className="dossier-kpi">
                          <strong>{s.course || '—'}</strong>
                          <span>Program</span>
                        </div>
                        <div className="dossier-kpi">
                          <strong>{lastLoginAt}</strong>
                          <span>Last login</span>
                        </div>
                        <div className="dossier-kpi">
                          <strong>{lastIp}</strong>
                          <span>Last IP</span>
                        </div>
                      </div>

                      <div className="profile-dense-grid">
                        <div className="profile-card profile-card-personal">
                          <h3>Personal information</h3>
                          <div className="profile-details compact-details">
                            <div className="detail-item">
                              <label>Full name</label>
                              <span>{s.name || '—'}</span>
                            </div>
                            <div className="detail-item">
                              <label>Email</label>
                              <span className="truncate-value">{s.email || '—'}</span>
                            </div>
                            <div className="detail-item">
                              <label>Phone</label>
                              <span>{s.phone || '—'}</span>
                            </div>
                            <div className="detail-item">
                              <label>Enrollment no.</label>
                              <span>{s.enrollmentNumber || '—'}</span>
                            </div>
                            <div className="detail-item wide-detail">
                              <label>Address</label>
                              <span>{s.address || '—'}</span>
                            </div>
                          </div>
                        </div>

                        <div className="profile-card profile-card-academic">
                          <h3>Academic information</h3>
                          <div className="profile-details compact-details">
                            <div className="detail-item">
                              <label>Program</label>
                              <span>{s.course || '—'}</span>
                            </div>
                            <div className="detail-item">
                              <label>Status</label>
                              <span>
                                <span className={`dossier-status ${s.status || 'inactive'}`}>
                                  {s.status || '—'}
                                </span>
                              </span>
                            </div>
                            <div className="detail-item">
                              <label>Batch</label>
                              <span>{batchLabel}</span>
                            </div>
                            <div className="detail-item">
                              <label>Role</label>
                              <span style={{ textTransform: 'capitalize' }}>{s.role || 'student'}</span>
                            </div>
                            <div className="detail-item">
                              <label>Student ID</label>
                              <span className="truncate-value">{s.id || s._id || '—'}</span>
                            </div>
                            <div className="detail-item">
                              <label>Joined</label>
                              <span>{joinedAt ? new Date(joinedAt).toLocaleDateString() : '—'}</span>
                            </div>
                          </div>
                        </div>

                        <div className="profile-card profile-card-login">
                          <h3>Login & location</h3>
                          {(s.lastLogin || s.lastLoginIP || s.lastLoginTimestamp) ? (
                            <div className="profile-details compact-details">
                              <div className="detail-item">
                                <label>Last login</label>
                                <span>{lastLoginAt}</span>
                              </div>
                              <div className="detail-item">
                                <label>IP address</label>
                                <span className="ip-address">{lastIp}</span>
                              </div>
                              <div className="detail-item">
                                <label>Location</label>
                                <span>{lastLocation}</span>
                              </div>
                              <div className="detail-item">
                                <label>ISP</label>
                                <span>{s.lastLogin?.isp || '—'}</span>
                              </div>
                            </div>
                          ) : (
                            <p className="no-activity">No login activity recorded yet.</p>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="profile-grid">
                      <div className="profile-section">
                        <h3>Edit profile</h3>
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
                                <option value="Cybersecurity & AI">Cybersecurity & AI</option>
                                <option value="DevOps & AI">DevOps & AI</option>
                                <option value="DevOps & Cloud">DevOps & Cloud</option>
                                <option value="One-to-One">One-to-One</option>
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
                            <button type="submit" className="btn-save">Save changes</button>
                            <button type="button" className="btn-cancel" onClick={handleCancelEdit}>Cancel</button>
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

                  {/* Graph Controls */}
                  {/* <div className="graph-controls">
                    <div className="control-row">
                      <div className="control-group">
                        <label>Activity Type:</label>
                        <div className="toggle-group">
                          <label className="toggle-label">
                            <input
                              type="checkbox"
                              checked={showLogins}
                              onChange={(e) => setShowLogins(e.target.checked)}
                            />
                            <span className="toggle-indicator login"></span>
                            Logins
                          </label>
                          <label className="toggle-label">
                            <input
                              type="checkbox"
                              checked={showVideoViews}
                              onChange={(e) => setShowVideoViews(e.target.checked)}
                            />
                            <span className="toggle-indicator video"></span>
                            Video Views
                          </label>
                        </div>
                      </div>
                      <div className="control-group">
                        <label>Date Range:</label>
                        <div className="date-inputs">
                          <input
                            type="date"
                            value={graphDateRange.start || ''}
                            onChange={(e) => setGraphDateRange(prev => ({ ...prev, start: e.target.value }))}
                            className="date-input"
                            placeholder="Start date"
                          />
                          <span>to</span>
                          <input
                            type="date"
                            value={graphDateRange.end || ''}
                            onChange={(e) => setGraphDateRange(prev => ({ ...prev, end: e.target.value }))}
                            className="date-input"
                            placeholder="End date"
                          />
                        </div>
                      </div>
                    </div>
                  </div> */}

                  {/* Graph Download Button */}
                  <div className="graph-download-section">
                    <button className="btn-download-csv" onClick={handleDownloadGraphCSV}>
                      📊 Download Graph CSV
                    </button>
                  </div>

                  {/* Activity Timeline Chart */}
                  <div className="activity-graph-section">
                    {loadingActivity ? (
                      <div className="chart-loading">Loading activity data...</div>
                    ) : (
                      <ActivityTimelineChart
                        data={chartData}
                        showLogins={showLogins}
                        showVideoViews={showVideoViews}
                        summary={activitySummary}
                      />
                    )}
                  </div>

                  <div className="activity-table-container">
                    <div className="activity-summary">
                      <h3>📊 Activity Log</h3>
                      <button className="btn-download-csv" onClick={handleDownloadActivityCSV}>
                        📥 Download CSV
                      </button>
                    </div>

                    {studentActivities.length > 0 ? (
                      <>
                        <div className="activity-table-wrapper">
                          <table className="activity-table">
                            <thead>
                              <tr>
                                <th>Action</th>
                                <th>Timestamp</th>
                                <th>IP Address</th>
                                <th>Location</th>
                                <th>Details</th>
                              </tr>
                            </thead>
                            <tbody>
                              {studentActivities.map((activity, index) => (
                                <tr key={index} className="activity-row">
                                  <td className="activity-action-cell">
                                    <span className={`action-badge ${activity.action}`}>
                                      {activity.action}
                                    </span>
                                  </td>
                                  <td className="activity-timestamp-cell">
                                    {new Date(activity.timestamp).toLocaleString()}
                                  </td>
                                  <td className="activity-ip-cell">
                                    <span className="ip-address">
                                      {activity.ipAddress || 'N/A'}
                                    </span>
                                  </td>
                                  <td className="activity-location-cell">
                                    {[activity.city, activity.country].filter(Boolean).join(', ') || 'N/A'}
                                  </td>
                                  <td className="activity-details-cell">
                                    {activity.videoTitle && (
                                      <span className="detail-item">📹 {activity.videoTitle}</span>
                                    )}
                                    {activity.assessmentTitle && (
                                      <span className="detail-item">📝 {activity.assessmentTitle}</span>
                                    )}
                                    {activity.path && (
                                      <span className="detail-item">📄 {activity.path}</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

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

              {/* Reports Tab - Enhanced Analytics */}
              {activeProfileTab === 'reports' && (
                <div className="reports-tab-content enhanced-analytics">
                  <div className="reports-header">
                    <h3>📊 Platform Analytics</h3>
                    <div className="analytics-controls">
                      <div className="analytics-period-selector">
                        <label>Analytics Period</label>
                        <select
                          className="period-select"
                          value={analyticsPeriod}
                          onChange={(e) => setAnalyticsPeriod(e.target.value)}
                        >
                          <option value="7days">Last 7 Days</option>
                          <option value="30days">Last 30 Days</option>
                          <option value="90days">Last 90 Days</option>
                          <option value="custom">Custom Range</option>
                        </select>
                      </div>
                      {analyticsPeriod === 'custom' && (
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
                      <button className="btn-refresh-analytics" onClick={fetchAnalyticsData} disabled={analyticsLoading}>
                        {analyticsLoading ? '🔄 Loading...' : '🔄 Refresh'}
                      </button>
                    </div>
                  </div>

                  {analyticsLoading ? (
                    <div className="analytics-loading">
                      <div className="spinner"></div>
                      <p>Loading comprehensive analytics...</p>
                    </div>
                  ) : analyticsError ? (
                    <div className="analytics-error">
                      <h4>❌ Error Loading Analytics</h4>
                      <p>{analyticsError}</p>
                      <button onClick={fetchAnalyticsData} className="btn-retry">Try Again</button>
                    </div>
                  ) : analyticsData ? (
                    <div className="analytics-content">
                      {/* Overview Cards */}
                      <div className="analytics-overview">
                        <div className="overview-cards">
                          <div className="overview-card students">
                            <div className="card-icon">👥</div>
                            <div className="card-content">
                              <h4>Total Students</h4>
                              <div className="card-value">{adminAnalyticsUtils.formatLargeNumber(analyticsData.overview.totalStudents)}</div>
                              <div className="card-subtitle">
                                {analyticsData.overview.activeStudents} active ({analyticsData.overview.studentEngagementRate}%)
                              </div>
                              <div className="progress-bar">
                                <div 
                                  className="progress-fill" 
                                  style={{ width: `${analyticsData.overview.studentEngagementRate}%` }}
                                />
                              </div>
                            </div>
                          </div>
                          
                          <div className="overview-card teachers">
                            <div className="card-icon">👨‍🏫</div>
                            <div className="card-content">
                              <h4>Total Teachers</h4>
                              <div className="card-value">{adminAnalyticsUtils.formatLargeNumber(analyticsData.overview.totalTeachers)}</div>
                              <div className="card-subtitle">
                                {analyticsData.overview.activeTeachers} active ({analyticsData.overview.teacherEngagementRate}%)
                              </div>
                              <div className="progress-bar">
                                <div 
                                  className="progress-fill" 
                                  style={{ width: `${analyticsData.overview.teacherEngagementRate}%` }}
                                />
                              </div>
                            </div>
                          </div>
                          
                          <div className="overview-card batches">
                            <div className="card-icon">📚</div>
                            <div className="card-content">
                              <h4>Total Batches</h4>
                              <div className="card-value">{adminAnalyticsUtils.formatLargeNumber(analyticsData.overview.totalBatches)}</div>
                              <div className="card-subtitle">Active learning groups</div>
                            </div>
                          </div>
                          
                          <div className="overview-card activities">
                            <div className="card-icon">📈</div>
                            <div className="card-content">
                              <h4>Total Activities</h4>
                              <div className="card-value">{adminAnalyticsUtils.formatLargeNumber(analyticsData.overview.totalActivities)}</div>
                              <div className="card-subtitle">In selected period</div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Activity Breakdown */}
                      <div className="analytics-section">
                        <h4>📊 Activity Breakdown</h4>
                        <div className="activity-breakdown-grid">
                          {analyticsData.activityBreakdown.map((activity, index) => {
                            const displayInfo = adminAnalyticsUtils.getActivityDisplayInfo(activity.action);
                            return (
                              <div key={index} className="activity-breakdown-card">
                                <div className="activity-icon" style={{ color: displayInfo.color }}>
                                  {displayInfo.icon}
                                </div>
                                <div className="activity-content">
                                  <h5>{displayInfo.label}</h5>
                                  <div className="activity-count">{adminAnalyticsUtils.formatLargeNumber(activity.count)}</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Course Analytics */}
                      <div className="analytics-section">
                        <h4>📚 Course Performance</h4>
                        <div className="course-analytics-table">
                          <table>
                            <thead>
                              <tr>
                                <th>Course Name</th>
                                <th>Total Views</th>
                                <th>Unique Students</th>
                                <th>Avg per Student</th>
                                <th>Performance</th>
                              </tr>
                            </thead>
                            <tbody>
                              {analyticsData.courseAnalytics.map((course, index) => {
                                const avgPerStudent = course.uniqueStudents > 0 ? Math.round(course.totalViews / course.uniqueStudents) : 0;
                                const engagement = adminAnalyticsUtils.getEngagementLevel(avgPerStudent);
                                return (
                                  <tr key={index}>
                                    <td>{course.courseName}</td>
                                    <td>{adminAnalyticsUtils.formatLargeNumber(course.totalViews)}</td>
                                    <td>{course.uniqueStudents}</td>
                                    <td>{avgPerStudent}</td>
                                    <td>
                                      <span className="engagement-badge" style={{ backgroundColor: engagement.color }}>
                                        {engagement.icon} {engagement.level}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Top Students */}
                      <div className="analytics-section">
                        <h4>🏆 Top Performing Students</h4>
                        <div className="top-students-grid">
                          {analyticsData.studentEngagement.slice(0, 8).map((student, index) => (
                            <div key={student.studentId} className="student-performance-card">
                              <div className="student-rank">#{index + 1}</div>
                              <div className="student-info">
                                <h5>{student.name}</h5>
                                <p>{student.email}</p>
                              </div>
                              <div className="student-metrics">
                                <div className="metric">
                                  <span className="metric-label">Activities</span>
                                  <span className="metric-value">{student.totalActivities}</span>
                                </div>
                                <div className="metric">
                                  <span className="metric-label">Videos</span>
                                  <span className="metric-value">{student.videoViews}</span>
                                </div>
                                <div className="metric">
                                  <span className="metric-label">Daily Avg</span>
                                  <span className="metric-value">{student.avgDailyActivities}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Batch Performance */}
                      <div className="analytics-section">
                        <h4>📈 Batch Performance</h4>
                        <div className="batch-performance-grid">
                          {analyticsData.batchPerformance.map((batch, index) => {
                            const engagement = adminAnalyticsUtils.getEngagementLevel(batch.completionRate);
                            return (
                              <div key={index} className="batch-performance-card">
                                <div className="batch-header">
                                  <h5>{batch.batchName}</h5>
                                  <span className="course-tag">{batch.course}</span>
                                </div>
                                <div className="batch-stats">
                                  <div className="stat">
                                    <span className="stat-label">Students</span>
                                    <span className="stat-value">{batch.studentCount}</span>
                                  </div>
                                  <div className="stat">
                                    <span className="stat-label">Completion</span>
                                    <span className="stat-value">{batch.completionRate}%</span>
                                  </div>
                                </div>
                                <div className="progress-bar">
                                  <div 
                                    className="progress-fill" 
                                    style={{ 
                                      width: `${batch.completionRate}%`,
                                      backgroundColor: engagement.color 
                                    }}
                                  />
                                </div>
                                <div className="engagement-indicator">
                                  {engagement.icon} {engagement.level} Engagement
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Analytics Actions */}
                      <div className="analytics-actions">
                        <button className="btn-download-analytics" onClick={() => {
                          const csvContent = [
                            ['Platform Analytics Report'],
                            ['Period:', analyticsPeriod],
                            ['Generated:', new Date().toLocaleString()],
                            [],
                            ['Overview'],
                            ['Total Students:', analyticsData.overview.totalStudents],
                            ['Active Students:', analyticsData.overview.activeStudents],
                            ['Student Engagement Rate:', `${analyticsData.overview.studentEngagementRate}%`],
                            ['Total Teachers:', analyticsData.overview.totalTeachers],
                            ['Active Teachers:', analyticsData.overview.activeTeachers],
                            ['Teacher Engagement Rate:', `${analyticsData.overview.teacherEngagementRate}%`],
                            ['Total Batches:', analyticsData.overview.totalBatches],
                            ['Total Activities:', analyticsData.overview.totalActivities],
                            [],
                            ['Activity Breakdown'],
                            ...analyticsData.activityBreakdown.map(item => [item.action, item.count]),
                            [],
                            ['Course Performance'],
                            ...analyticsData.courseAnalytics.map(course => [
                              course.courseName, course.totalViews, course.uniqueStudents
                            ])
                          ].map(row => row.join(',')).join('\n');

                          const blob = new Blob([csvContent], { type: 'text/csv' });
                          const url = window.URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `platform-analytics-${new Date().toISOString().split('T')[0]}.csv`;
                          a.click();
                          window.URL.revokeObjectURL(url);
                          showToast('Analytics report downloaded successfully!', 'success');
                        }}>
                          📥 Download Full Analytics
                        </button>
                        <button className="btn-refresh-analytics" onClick={fetchAnalyticsData}>
                          🔄 Refresh Data
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="no-analytics">
                      <p>📊 No analytics data available</p>
                      <small>Generate analytics to see platform insights</small>
                    </div>
                  )}
                </div>
              )}
            </div>
                </>
              );
            })()}
          </div>
        </div>,
        document.body
      )}

      {/* Teacher Details Modal */}
      {showTeacherDetailsModal && selectedTeacherDetails && createPortal(
        <div className="fullscreen-modal-overlay" onClick={() => setShowTeacherDetailsModal(false)}>
          <div className="fullscreen-modal teacher-details-modal" onClick={(e) => e.stopPropagation()}>
            <div className="fullscreen-modal-header">
              <div className="dossier-header-top">
                <div className="student-header-info">
                  <div className="student-avatar">
                    <span className="avatar-text">
                      {selectedTeacherDetails?.name?.charAt(0).toUpperCase() || 'T'}
                    </span>
                  </div>
                  <div className="student-basic-info">
                    <p className="dossier-eyebrow">Teacher profile</p>
                    <h2>{selectedTeacherDetails?.name || 'Teacher'}</h2>
                    <p className="student-email">{selectedTeacherDetails?.email || '—'}</p>
                    <div className="student-badges">
                      <span className={`badge ${selectedTeacherDetails?.status || 'active'}`}>
                        {selectedTeacherDetails?.status || 'Active'}
                      </span>
                      <span className="badge">
                        {(selectedTeacherDetails?.assignedCourses && selectedTeacherDetails.assignedCourses[0])
                          || selectedTeacherDetails?.domain
                          || 'No course'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="modal-header-actions">
                  {selectedTeacherDetails?.id || selectedTeacherDetails?._id ? (
                    <button
                      type="button"
                      className="btn-edit-profile"
                      onClick={() => {
                        setShowTeacherDetailsModal(false);
                        openModal('teacher', selectedTeacherDetails);
                      }}
                    >
                      Edit teacher
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="modal-close-fullscreen"
                    onClick={() => setShowTeacherDetailsModal(false)}
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>
              </div>
              <div className="header-tab-buttons dossier-tabs">
                <button
                  type="button"
                  className={`header-tab-btn ${activeTeacherTab === 'profile' ? 'active' : ''}`}
                  onClick={() => setActiveTeacherTab('profile')}
                >
                  Profile
                </button>
                <button
                  type="button"
                  className={`header-tab-btn ${activeTeacherTab === 'batches' ? 'active' : ''}`}
                  onClick={() => setActiveTeacherTab('batches')}
                >
                  Batches ({teacherAssignedBatches.regular.length + teacherAssignedBatches.oneToOne.length})
                </button>
              </div>
            </div>

            <div className="fullscreen-modal-content">
              {activeTeacherTab === 'profile' && (
                <div className="profile-tab-content">
                  <div className="dossier-kpis">
                    <div className="dossier-kpi">
                      <strong>{teacherAssignedBatches.regular.length}</strong>
                      <span>Regular batches</span>
                    </div>
                    <div className="dossier-kpi">
                      <strong>{teacherAssignedBatches.oneToOne.length}</strong>
                      <span>One-to-one</span>
                    </div>
                    <div className="dossier-kpi">
                      <strong>
                        {[...teacherAssignedBatches.regular, ...teacherAssignedBatches.oneToOne]
                          .reduce((sum, b) => sum + (b.studentCount || 0), 0)}
                      </strong>
                      <span>Students</span>
                    </div>
                    <div className="dossier-kpi">
                      <strong>{selectedTeacherDetails?.experience || '—'}</strong>
                      <span>Experience</span>
                    </div>
                  </div>

                  <div className="profile-dense-grid">
                    <div className="profile-card profile-card-personal">
                      <h3>Personal information</h3>
                      <div className="profile-details compact-details">
                        <div className="detail-item">
                          <label>Full name</label>
                          <span>{selectedTeacherDetails?.name || '—'}</span>
                        </div>
                        <div className="detail-item">
                          <label>Email</label>
                          <span className="truncate-value">{selectedTeacherDetails?.email || '—'}</span>
                        </div>
                        <div className="detail-item">
                          <label>Phone</label>
                          <span>{selectedTeacherDetails?.phone || '—'}</span>
                        </div>
                        <div className="detail-item">
                          <label>Age</label>
                          <span>{selectedTeacherDetails?.age || '—'}</span>
                        </div>
                        <div className="detail-item wide-detail">
                          <label>Address</label>
                          <span>{selectedTeacherDetails?.address || '—'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="profile-card">
                      <h3>Teaching profile</h3>
                      <div className="profile-details compact-details">
                        <div className="detail-item">
                          <label>Domain</label>
                          <span>{selectedTeacherDetails?.domain || '—'}</span>
                        </div>
                        <div className="detail-item">
                          <label>Experience</label>
                          <span>{selectedTeacherDetails?.experience || '—'}</span>
                        </div>
                        <div className="detail-item">
                          <label>Status</label>
                          <span>
                            <span className={`dossier-status ${selectedTeacherDetails?.status || 'inactive'}`}>
                              {selectedTeacherDetails?.status || '—'}
                            </span>
                          </span>
                        </div>
                        <div className="detail-item">
                          <label>Teacher ID</label>
                          <span className="truncate-value">
                            {selectedTeacherDetails?.id || selectedTeacherDetails?._id || '—'}
                          </span>
                        </div>
                        <div className="detail-item wide-detail">
                          <label>Assigned courses</label>
                          <span>
                            {(selectedTeacherDetails?.assignedCourses || []).length > 0
                              ? selectedTeacherDetails.assignedCourses.join(', ')
                              : (selectedTeacherDetails?.domain || '—')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTeacherTab === 'batches' && (
                <div className="profile-tab-content teacher-batches-tab">
                  <div className="profile-card" style={{ marginBottom: '16px' }}>
                    <h3>Regular batches</h3>
                    {teacherAssignedBatches.regular.length === 0 ? (
                      <p className="no-data">No regular batches assigned.</p>
                    ) : (
                      <div className="data-table-container">
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Batch</th>
                              <th>Course</th>
                              <th>Students</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {teacherAssignedBatches.regular.map((batch) => (
                              <tr key={batch.id || batch._id}>
                                <td>
                                  <button
                                    type="button"
                                    className="btn-link"
                                    onClick={() => {
                                      setShowTeacherDetailsModal(false);
                                      handleBatchClick(batch);
                                    }}
                                  >
                                    {batch.name}
                                  </button>
                                </td>
                                <td>{batch.course || '—'}</td>
                                <td>{batch.studentCount}</td>
                                <td>
                                  <span className={`dossier-status ${batch.status || 'active'}`}>
                                    {batch.status || '—'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <div className="profile-card">
                    <h3>One-to-one batches</h3>
                    {teacherAssignedBatches.oneToOne.length === 0 ? (
                      <p className="no-data">No one-to-one batches assigned.</p>
                    ) : (
                      <div className="data-table-container">
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Batch</th>
                              <th>Program</th>
                              <th>Students</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {teacherAssignedBatches.oneToOne.map((batch) => (
                              <tr key={batch.id || batch._id}>
                                <td>
                                  <button
                                    type="button"
                                    className="btn-link"
                                    onClick={() => {
                                      setShowTeacherDetailsModal(false);
                                      handleBatchClick(batch);
                                    }}
                                  >
                                    {batch.name}
                                  </button>
                                </td>
                                <td>{batch.programLabel || batch.course || '—'}</td>
                                <td>{batch.studentCount}</td>
                                <td>
                                  <span className={`dossier-status ${batch.status || 'active'}`}>
                                    {batch.status || '—'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
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
