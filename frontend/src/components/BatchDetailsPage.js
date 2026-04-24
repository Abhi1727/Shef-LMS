import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { ToastContainer, showToast } from './Toast';
import { YouTubeUtils } from '../utils/youtubeUtils';
import { formatDateForComponent } from '../utils/dateUtils';
import CustomVideoPlayer from './CustomVideoPlayer';
import ActivityTimelineChart from './charts/ActivityTimelineChart';
import { processActivityData, exportToCSV } from '../utils/activityDataProcessor';
import './BatchDetailsPage.css';

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function parseIstRangeToTimeInputs(range) {
  const defaultRange = { start: '', end: '' };
  if (!range || typeof range !== 'string') return defaultRange;

  const parts = range.split('-');
  if (parts.length !== 2) return defaultRange;

  const parsePart = (part) => {
    const match = part.trim().match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!match) return '';
    let [, hourStr, minuteStr, ampm] = match;
    let hour = parseInt(hourStr, 10);
    const upper = ampm.toUpperCase();
    if (upper === 'PM' && hour !== 12) hour += 12;
    if (upper === 'AM' && hour === 12) hour = 0;
    const hourPadded = String(hour).padStart(2, '0');
    return `${hourPadded}:${minuteStr}`;
  };

  return {
    start: parsePart(parts[0]),
    end: parsePart(parts[1])
  };
}

function formatTimeRangeToIstString(start, end) {
  if (!start || !end) return '';

  const to12Hour = (time) => {
    const [hourStr, minuteStr] = time.split(':');
    let hour = parseInt(hourStr, 10);
    let period = 'AM';
    if (hour >= 12) {
      period = 'PM';
      if (hour > 12) hour -= 12;
    } else if (hour === 0) {
      hour = 12;
    }
    return `${hour}:${minuteStr} ${period}`;
  };

  const startStr = to12Hour(start);
  const endStr = to12Hour(end);
  return `${startStr} - ${endStr}`;
}

function formatLastLogin(student) {
  // Check for last login data in multiple possible locations
  const lastLoginTimestamp = student?.lastLogin?.timestamp || student?.lastLoginTimestamp;
  
  if (!lastLoginTimestamp) {
    return 'Never logged in';
  }
  
  const lastLoginDate = new Date(lastLoginTimestamp);
  const now = new Date();
  const diffMs = now - lastLoginDate;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  // Format based on how recent the login was
  if (diffDays === 0) {
    // Today
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours === 0) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      if (diffMinutes === 0) {
        return 'Just now';
      }
      return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
    }
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
  } else {
    // For older logins, show the actual date
    return lastLoginDate.toLocaleDateString();
  }
}

// Enhanced file utility functions
const getFileIcon = (fileName) => {
  const extension = fileName?.split('.').pop()?.toLowerCase();
  const iconMap = {
    'pdf': '📄',
    'doc': '📝',
    'docx': '📝',
    'txt': '📃',
    'ppt': '📊',
    'pptx': '📊',
    'xls': '📈',
    'xlsx': '📈',
    'csv': '📋',
    'ipynb': '🧪',
    'zip': '🗜️',
    'jpg': '🖼️',
    'jpeg': '🖼️',
    'png': '🖼️',
    'gif': '🖼️'
  };
  return iconMap[extension] || '📎';
};

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const validateFile = (file) => {
  const maxSize = 10 * 1024 * 1024; // 10MB
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'application/zip',
    'image/jpeg',
    'image/png',
    'image/gif'
  ];
  
  // Check file size
  if (file.size > maxSize) {
    return 'File size exceeds 10MB limit';
  }
  
  // Check file type
  if (!allowedTypes.includes(file.type) && !file.name.endsWith('.ipynb')) {
    return 'File type not supported';
  }
  
  return null; // No error
};

const BatchDetailsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { batchId } = useParams();
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [classroomVideos, setClassroomVideos] = useState([]);
  const [students, setStudents] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState('videos');
  const [editingStudent, setEditingStudent] = useState(null);
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [showStudentDetailsModal, setShowStudentDetailsModal] = useState(false);
  const [selectedStudentDetails, setSelectedStudentDetails] = useState(null);
  
  // Enhanced student profile modal state
  const [activeProfileTab, setActiveProfileTab] = useState('profile');
  const [editMode, setEditMode] = useState(false);
  const [editedProfile, setEditedProfile] = useState({});
  const [studentActivities, setStudentActivities] = useState([]);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [activityFilter, setActivityFilter] = useState({
    action: '',
    startDate: '',
    endDate: ''
  });
  const [activityPagination, setActivityPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 0
  });
  const [activityTotal, setActivityTotal] = useState(0);
  const [reportPeriod, setReportPeriod] = useState('30');
  const [customDateRange, setCustomDateRange] = useState({
    start: '',
    end: ''
  });
  const [reportData, setReportData] = useState(null);
  const [showAddStudentsModal, setShowAddStudentsModal] = useState(false);
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [showAddVideoModal, setShowAddVideoModal] = useState(false);
  const [editingVideo, setEditingVideo] = useState(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({ days: '', time: '' });
  const [timeRange, setTimeRange] = useState({ start: '', end: '' });
  const [isAdmin, setIsAdmin] = useState(false);
  const [addStudentsSearch, setAddStudentsSearch] = useState('');
  const [courses, setCourses] = useState([]);
  const [allBatches, setAllBatches] = useState([]);
  const [availableBatches, setAvailableBatches] = useState([]);
  const [newStudentForm, setNewStudentForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    address: '',
    course: '',
    batchId: '',
    status: 'active'
  });
  const [videoFormData, setVideoFormData] = useState({
    title: '',
    youtubeVideoUrl: '',
    description: '',
    date: '',
    time: '',
    notesAvailable: false,
    notesFile: null
  });

  // Enhanced notes upload state
  const [isDragOver, setIsDragOver] = useState(false);
  const [fileValidationError, setFileValidationError] = useState('');
  const [uploadedFileInfo, setUploadedFileInfo] = useState(null);
  const [studentFormData, setStudentFormData] = useState({
    name: '',
    email: '',
    batchId: '',
    course: '',
    status: 'active',
    phone: '',
    address: ''
  }); // 'videos' or 'students'
  
  // Email-related state
  const [emailForm, setEmailForm] = useState({
    subject: '',
    message: '',
    selectedStudents: []
  });
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSearchTerm, setEmailSearchTerm] = useState('');
  const [emailQuickFilter, setEmailQuickFilter] = useState('all');
  const [showCharCounter, setShowCharCounter] = useState(false);

  // Activity graph state
  const [showLogins, setShowLogins] = useState(true);
  const [showVideoViews, setShowVideoViews] = useState(true);
  const [graphDateRange, setGraphDateRange] = useState({
    start: '',
    end: ''
  });

  // Helper function for normalizing IDs (moved here to be available for useMemo)
  const normId = (v) => (v != null && v !== '' ? String(v).trim() : '');
  const selectedBatchIdNorm = normId(selectedBatch?.id || selectedBatch?._id || batchId);

  // Filter students for email section (moved here to avoid conditional hook usage)
  const filteredEmailStudents = useMemo(() => {
    try {
      // Return empty array if batchStudents is not yet available
      if (!students || !Array.isArray(students) || !selectedBatch) return [];
      
      let filtered = students.filter(student => {
        try {
          return student && normId(student.batchId) === selectedBatchIdNorm;
        } catch (e) {
          console.warn('Error filtering student:', e, student);
          return false;
        }
      });
      
      // Apply search filter
      if (emailSearchTerm && emailSearchTerm.trim()) {
        const term = emailSearchTerm.toLowerCase();
        filtered = filtered.filter(student => {
          try {
            return student && 
              (student.name && student.name.toLowerCase().includes(term)) ||
              (student.email && student.email.toLowerCase().includes(term));
          } catch (e) {
            console.warn('Error searching student:', e, student);
            return false;
          }
        });
      }
      
      // Apply quick filter
      if (emailQuickFilter === 'active') {
        filtered = filtered.filter(student => student && student.status === 'active');
      } else if (emailQuickFilter === 'inactive') {
        filtered = filtered.filter(student => student && student.status === 'inactive');
      }
      
      return filtered;
    } catch (e) {
      console.error('Error in filteredEmailStudents:', e);
      return [];
    }
  }, [students, selectedBatchIdNorm, emailSearchTerm, emailQuickFilter]);

  // Process activity data for graph
  const { chartData, summary: activitySummary } = useMemo(() => {
    return processActivityData(
      studentActivities,
      graphDateRange.start || activityFilter.startDate,
      graphDateRange.end || activityFilter.endDate
    );
  }, [studentActivities, graphDateRange, activityFilter]);

  // Filter students by batchId for consistency with Dashboard
  const batchStudents = students.filter(student => normId(student.batchId) === selectedBatchIdNorm);

  // Lock body scroll when any modal is open (prevents double scrollbar)
  useEffect(() => {
    const anyModalOpen = showAddStudentModal || showAddStudentsModal || showStudentModal ||
      showStudentDetailsModal || showScheduleModal || showAddVideoModal;
    if (anyModalOpen) {
      document.body.classList.add('modal-open');
      document.body.style.overflow = 'hidden';
    } else {
      document.body.classList.remove('modal-open');
      document.body.style.overflow = '';
    }
    return () => {
      document.body.classList.remove('modal-open');
      document.body.style.overflow = '';
    };
  }, [showAddStudentModal, showAddStudentsModal, showStudentModal, showStudentDetailsModal, showScheduleModal, showAddVideoModal]);

  // Determine if current user is an admin (from JWT)
  useEffect(() => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const payload = JSON.parse(atob(token.split('.')[1]));
      const userFromToken = payload?.user;
      // For now admin == super admin; only admins should see timing controls
      if (userFromToken?.role === 'admin') {
        setIsAdmin(true);
      }
    } catch (e) {
      console.error('Error decoding admin token in BatchDetailsPage:', e);
    }
  }, []);

  // Load courses and batches data for add student form
  const loadCoursesAndBatches = async () => {
    try {
      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';

      // Load courses
      const coursesResponse = await fetch(`${apiUrl}/api/admin/courses`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (coursesResponse.ok) {
        const coursesData = await coursesResponse.json();
        setCourses(coursesData);
      }

      // Load all batches
      const batchesResponse = await fetch(`${apiUrl}/api/admin/batches`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (batchesResponse.ok) {
        const batchesData = await batchesResponse.json();
        setAllBatches(batchesData.batches || []);
      }
    } catch (error) {
      console.error('Error loading courses and batches:', error);
    }
  };

  // Filter batches based on selected course
  const filterBatchesByCourse = (courseName) => {
    if (!courseName) {
      setAvailableBatches([]);
      return;
    }
    
    const filtered = allBatches.filter(batch => batch.course === courseName);
    setAvailableBatches(filtered);
    
    // Reset batch selection when course changes
    setNewStudentForm(prev => ({ ...prev, batchId: '' }));
  };

  // Handle course change in add student form
  const handleCourseChange = (courseName) => {
    setNewStudentForm(prev => ({ ...prev, course: courseName, batchId: '' }));
    filterBatchesByCourse(courseName);
  };

  // Load batch data
  const loadBatchData = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
    const apiUrl = window.location.hostname === 'localhost'
      ? 'http://localhost:5000'
      : '';
      let foundBatch = null;

      // Load batch details
      const batchesResponse = await fetch(`${apiUrl}/api/admin/batches`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (batchesResponse.ok) {
        const response = await batchesResponse.json();
        const batches = response.batches || []; // Extract batches array from response
        console.log('URL Batch ID:', batchId);
        console.log('Available Batches:', batches);
        
        const batch = batches.find(b => {
          console.log('Checking batch:', {
            batchName: b.name,
            batchId: b.id || b._id,
            urlId: batchId,
            matches: b.id === batchId || b._id === batchId
          });
          return b.id === batchId || b._id === batchId;
        });
        
        if (batch) {
          foundBatch = batch;
          setSelectedBatch(batch);
          
          if (batch.schedule) {
            const days = batch.schedule.days || '';
            const time = batch.schedule.time || '';
            setScheduleForm({ days, time });
            const parsedRange = parseIstRangeToTimeInputs(time);
            setTimeRange(parsedRange);
          }
          
          console.log('Found batch:', batch);
          
          // Load students
          const studentsResponse = await fetch(`${apiUrl}/api/admin/users`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          if (studentsResponse.ok) {
            const allUsers = await studentsResponse.json();
            const studentUsers = allUsers.filter(user => user.role === 'student');
            // Store ALL students for the "Add Existing Students" modal
            setAllStudents(studentUsers);

            // Filter students by batchId for display (normalize IDs - handles ObjectId/string)
            const norm = (v) => (v != null && v !== '' ? String(v).trim() : '');
            const batchIdNorm = norm(batchId) || norm(foundBatch?.id || foundBatch?._id);
            const batchStudents = studentUsers.filter(student => norm(student.batchId) === batchIdNorm);
            console.log('🔍 BatchDetails Debug - Students for batch:', {
              batchId,
              totalStudents: studentUsers.length,
              batchStudents: batchStudents.length,
              batchStudentsArray: foundBatch?.students?.length || 0,
              sampleStudentData: batchStudents.slice(0, 2).map(s => ({
                id: s.id,
                name: s.name,
                phone: s.phone,
                address: s.address,
                hasPhone: !!s.phone,
                hasAddress: !!s.address
              })),
              unassignedStudents: studentUsers.filter(s => !s.batchId).length,
              cyberSecurityStudents: studentUsers.filter(s => 
                s.course && (s.course.toLowerCase().includes('cyber') || s.course.toLowerCase().includes('security'))
              ).length
            });

            setStudents(batchStudents);
          }
        } else {
          console.error('Batch not found. Available IDs:', batches.map(b => ({ name: b.name, id: b.id || b._id })));
          showToast('Batch not found', 'error');
          navigate('/admin');
          return;
        }
      }

      // Load classroom videos
      const batchIdForApi = foundBatch?.id || foundBatch?._id || batchId;
      const videosResponse = await fetch(`${apiUrl}/api/admin/classroom?batchId=${batchIdForApi}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (videosResponse.ok) {
        const batchVideos = await videosResponse.json();
        
        console.log('🔍 BatchDetails Debug - Videos for batch:', {
          batchId,
          batchName: foundBatch?.name,
          batchIdForApi,
          filteredVideos: batchVideos.length,
          sampleVideos: batchVideos.slice(0, 3).map(v => ({
            title: v.title,
            batchId: v.batchId,
            courseId: v.courseId
          }))
        });
        
        setClassroomVideos(batchVideos);
      }
    } catch (error) {
      console.error('Error loading batch data:', error);
      showToast('Error loading batch data', 'error');
    } finally {
      setLoading(false);
    }
  }, [batchId, navigate]);

  useEffect(() => {
    loadBatchData();
    loadCoursesAndBatches();
  }, [loadBatchData]);

  // Update new student form when batch changes
  useEffect(() => {
    if (selectedBatch) {
      setNewStudentForm(prev => ({
        ...prev,
        course: selectedBatch.course || '',
        batchId: selectedBatch.id || selectedBatch._id || ''
      }));
      // Filter batches for the current batch's course
      filterBatchesByCourse(selectedBatch.course);
    }
  }, [selectedBatch]);

  const handleBackToAdmin = () => {
    // Check if we have navigation state indicating where we came from
    const from = location.state?.from;
    
    if (from === 'admin-batches') {
      // Navigate back to admin dashboard batches section
      navigate('/admin', { state: { activeSection: 'batches' } });
    } else if (from === 'teacher-batches') {
      // Navigate back to teacher dashboard batches section
      navigate('/teacher', { state: { activeSection: 'batches' } });
    } else {
      // Fallback to admin dashboard or use browser history
      const userRole = localStorage.getItem('user') ? 
        JSON.parse(localStorage.getItem('user')).role : 'admin';
      
      if (userRole === 'teacher') {
        navigate('/teacher');
      } else {
        navigate('/admin');
      }
    }
  };

  const handleSaveSchedule = async () => {
    if (!selectedBatch) return;

    if (!scheduleForm.days.trim()) {
      showToast('Please select at least one day for this batch', 'warning');
      return;
    }

    if (!timeRange.start || !timeRange.end) {
      showToast('Please select both start and end time in IST', 'warning');
      return;
    }

    const timeString = formatTimeRangeToIstString(timeRange.start, timeRange.end);

    try {
      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost'
        ? 'http://localhost:5000'
        : '';
      const batchIdForApi = selectedBatch?.id || selectedBatch?._id;

      const body = {
        days: scheduleForm.days,
        time: timeString,
        timezone: 'IST'
      };

      const response = await fetch(`${apiUrl}/api/admin/batches/${batchIdForApi}/schedule`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      const data = await response.json();

      if (response.ok) {
        showToast('Batch timing updated successfully!', 'success');
        setSelectedBatch(prev => {
          if (!prev) return prev;
          const newSchedule = data.schedule || { days: body.days, time: body.time, timezone: body.timezone };
          return { ...prev, schedule: newSchedule };
        });
        setScheduleForm({ days: body.days, time: body.time });
        setShowScheduleModal(false);
      } else {
        showToast(data.message || 'Failed to update batch timing', 'error');
      }
    } catch (error) {
      console.error('Error updating batch timing:', error);
      showToast('Error updating batch timing', 'error');
    }
  };

  const handleEditStudent = (student) => {
    setEditingStudent(student);
    setStudentFormData({
      name: student.name,
      email: student.email,
      batchId: student.batchId || '',
      course: student.course || '',
      status: student.status || 'active',
      phone: student.phone || '',
      address: student.address || ''
    });
    setShowStudentModal(true);
  };

  const handleViewChange = (view) => {
    setActiveView(view);
  };

  const handleViewStudentDetails = (student) => {
    setSelectedStudentDetails(student);
    setEditedProfile({
      name: student.name,
      email: student.email,
      phone: student.phone,
      address: student.address,
      status: student.status
    });
    setActiveProfileTab('profile');
    setEditMode(false);
    setShowStudentDetailsModal(true);
    
    // Load initial activity data
    loadStudentActivity(student.id);
  };

  // Load student activity data
  const loadStudentActivity = async (studentId, page = 1, filters = {}) => {
    setLoadingActivity(true);
    try {
      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
      
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: activityPagination.limit.toString(),
        ...filters
      });
      
      const response = await fetch(`${apiUrl}/api/admin/activity/${studentId}?${queryParams}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setStudentActivities(data.activities || []);
        setActivityPagination(data.pagination || {
          page: 1,
          limit: 50,
          total: 0,
          pages: 0
        });
        setActivityTotal(data.pagination?.total || 0);
      } else {
        console.error('Failed to load student activity');
        setStudentActivities([]);
      }
    } catch (error) {
      console.error('Error loading student activity:', error);
      setStudentActivities([]);
    } finally {
      setLoadingActivity(false);
    }
  };

  // Handle activity filtering
  const handleFilterActivity = () => {
    loadStudentActivity(selectedStudentDetails.id, 1, activityFilter);
  };

  // Clear activity filters
  const handleClearActivityFilter = () => {
    const clearedFilter = { action: '', startDate: '', endDate: '' };
    setActivityFilter(clearedFilter);
    loadStudentActivity(selectedStudentDetails.id, 1, clearedFilter);
  };

  // Handle activity pagination
  const handleActivityPageChange = (newPage) => {
    loadStudentActivity(selectedStudentDetails.id, newPage, activityFilter);
  };

  // Handle profile editing
  const handleSaveProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';

      const response = await fetch(`${apiUrl}/api/admin/users/${selectedStudentDetails.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(editedProfile)
      });

      if (response.ok) {
        showToast('Student profile updated successfully!', 'success');
        
        // Update local state
        setSelectedStudentDetails(prev => ({ ...prev, ...editedProfile }));
        setStudents(prev => prev.map(student => 
          student.id === selectedStudentDetails.id 
            ? { ...student, ...editedProfile }
            : student
        ));
        
        setEditMode(false);
      } else {
        showToast('Failed to update student profile', 'error');
      }
    } catch (error) {
      console.error('Error updating student profile:', error);
      showToast('Error updating student profile', 'error');
    }
  };

  const handleCancelEdit = () => {
    setEditedProfile({
      name: selectedStudentDetails.name,
      email: selectedStudentDetails.email,
      phone: selectedStudentDetails.phone,
      address: selectedStudentDetails.address,
      status: selectedStudentDetails.status
    });
    setEditMode(false);
  };

  // Download activity CSV
  const handleDownloadActivityCSV = async () => {
    try {
      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
      
      const queryParams = new URLSearchParams({
        export: 'csv',
        ...activityFilter
      });
      
      const response = await fetch(`${apiUrl}/api/admin/activity/${selectedStudentDetails.id}?${queryParams}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `activity-${selectedStudentDetails.name.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        showToast('Activity data downloaded successfully!', 'success');
      } else {
        showToast('Failed to download activity data', 'error');
      }
    } catch (error) {
      console.error('Error downloading activity data:', error);
      showToast('Error downloading activity data', 'error');
    }
  };

  // Download graph data CSV
  const handleDownloadGraphCSV = () => {
    const { rawFilteredData } = processActivityData(
      studentActivities,
      graphDateRange.start || activityFilter.startDate,
      graphDateRange.end || activityFilter.endDate
    );
    
    const filename = `graph-activity-${selectedStudentDetails?.name?.replace(/\s+/g, '-') || 'student'}-${new Date().toISOString().split('T')[0]}.csv`;
    exportToCSV(rawFilteredData, filename);
    showToast('Graph data downloaded successfully!', 'success');
  };

  // Generate report
  const handleGenerateReport = async () => {
    try {
      let startDate, endDate;
      
      if (reportPeriod === 'custom') {
        startDate = customDateRange.start;
        endDate = customDateRange.end;
      } else {
        const days = parseInt(reportPeriod);
        endDate = new Date().toISOString().split('T')[0];
        const start = new Date();
        start.setDate(start.getDate() - days);
        startDate = start.toISOString().split('T')[0];
      }

      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
      
      const response = await fetch(`${apiUrl}/api/admin/activity/${selectedStudentDetails.id}?startDate=${startDate}&endDate=${endDate}&limit=1000`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        const activities = data.activities || [];
        
        // Generate report summary
        const summary = {
          totalActivities: activities.length,
          videoViews: activities.filter(a => a.action === 'video_view').length,
          assessments: activities.filter(a => a.action === 'assessment_submit').length,
          loginDays: new Set(activities.filter(a => a.action === 'login').map(a => a.timestamp?.split('T')[0])).size
        };
        
        setReportData(summary);
        showToast('Report generated successfully!', 'success');
      } else {
        showToast('Failed to generate report', 'error');
      }
    } catch (error) {
      console.error('Error generating report:', error);
      showToast('Error generating report', 'error');
    }
  };

  // Download full report
  const handleDownloadReport = async () => {
    try {
      let startDate, endDate;
      
      if (reportPeriod === 'custom') {
        startDate = customDateRange.start;
        endDate = customDateRange.end;
      } else {
        const days = parseInt(reportPeriod);
        endDate = new Date().toISOString().split('T')[0];
        const start = new Date();
        start.setDate(start.getDate() - days);
        startDate = start.toISOString().split('T')[0];
      }

      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
      
      const response = await fetch(`${apiUrl}/api/admin/activity/${selectedStudentDetails.id}?startDate=${startDate}&endDate=${endDate}&export=csv`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `report-${selectedStudentDetails.name.replace(/\s+/g, '-')}-${startDate}-to-${endDate}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        showToast('Report downloaded successfully!', 'success');
      } else {
        showToast('Failed to download report', 'error');
      }
    } catch (error) {
      console.error('Error downloading report:', error);
      showToast('Error downloading report', 'error');
    }
  };

  const handleAddNewStudent = async () => {
    try {
      const token = localStorage.getItem('token');
    const apiUrl = window.location.hostname === 'localhost'
      ? 'http://localhost:5000'
      : '';

      // Validate required fields
      if (!newStudentForm.name || !newStudentForm.email || !newStudentForm.password || !newStudentForm.course) {
        showToast('Please fill in all required fields (Name, Email, Password, Course)', 'warning');
        return;
      }

      const studentData = {
        name: newStudentForm.name,
        email: newStudentForm.email,
        password: newStudentForm.password,
        phone: newStudentForm.phone,
        address: newStudentForm.address,
        course: newStudentForm.course,
        batchId: newStudentForm.batchId,
        status: newStudentForm.status,
        role: 'student'
      };

      const response = await fetch(`${apiUrl}/api/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(studentData)
      });

      const data = await response.json();

      if (response.ok) {
        showToast('Student added successfully!', 'success');
        
        // Add the new student to local state
        const newStudent = { id: data.id, ...studentData };
        setStudents(prev => [...prev, newStudent]);
        
        // Reset form and close modal
        setNewStudentForm({
          name: '',
          email: '',
          password: '',
          phone: '',
          address: '',
          course: '',
          batchId: '',
          status: 'active'
        });
        setAvailableBatches([]);
        setShowAddStudentModal(false);
      } else {
        showToast(data.message || 'Failed to add student', 'error');
      }
    } catch (error) {
      console.error('Error adding student:', error);
      showToast('Error adding student', 'error');
    }
  };

  const toggleStudentSelection = (studentId) => {
    setSelectedStudentIds(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const handleSaveStudent = async () => {
    try {
      const token = localStorage.getItem('token');
    const apiUrl = window.location.hostname === 'localhost'
      ? 'http://localhost:5000'
      : '';

      const updateData = {
        name: studentFormData.name,
        email: studentFormData.email,
        batchId: studentFormData.batchId,
        course: studentFormData.course,
        status: studentFormData.status,
        phone: studentFormData.phone,
        address: studentFormData.address
      };

      const response = await fetch(`${apiUrl}/api/admin/users/${editingStudent.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updateData)
      });

      if (response.ok) {
        showToast('Student updated successfully!', 'success');
        
        // Update student in local state
        setStudents(prev => prev.map(student => 
          student.id === editingStudent.id 
            ? { ...student, ...updateData }
            : student
        ));
        
        // Close modal
        setShowStudentModal(false);
        setEditingStudent(null);
      } else {
        showToast('Failed to update student', 'error');
      }
    } catch (error) {
      console.error('Error updating student:', error);
      showToast('Error updating student', 'error');
    }
  };

  const handleAddStudentsToBatch = async () => {
    if (selectedStudentIds.length === 0) {
      showToast('Please select at least one student', 'warning');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost'
        ? 'http://localhost:5000'
        : '';
      const batchIdForApi = selectedBatch?.id || selectedBatch?._id;

      const response = await fetch(`${apiUrl}/api/batches/${batchIdForApi}/students`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ studentIds: selectedStudentIds })
      });

      if (response.ok) {
        showToast('Students added to batch successfully!', 'success');

        // Update local students state to reflect new batch assignment
        setStudents(prev =>
          prev.map(student =>
            selectedStudentIds.includes(student.id)
              ? { ...student, batchId: batchIdForApi }
              : student
          )
        );

        // Update selectedBatch to add students to batch's students array
        setSelectedBatch(prev => ({
          ...prev,
          students: [...new Set([...prev.students, ...selectedStudentIds])]
        }));

        // Refresh batch data to ensure consistency
        await refreshBatchData();

        setShowAddStudentsModal(false);
        setSelectedStudentIds([]);
      } else {
        showToast('Failed to add students to batch', 'error');
      }
    } catch (error) {
      console.error('Error adding students to batch:', error);
      showToast('Error adding students to batch', 'error');
    }
  };

  const handleAddVideoToBatch = async () => {
    try {
      const { title, youtubeVideoUrl, description, date, notesAvailable, notesFile } = videoFormData;
      if (!title || !youtubeVideoUrl || !date) {
        showToast('Please fill in all required fields (Title, YouTube URL, Class Date)', 'warning');
        return;
      }

      if (notesAvailable && !notesFile) {
        showToast('Please select a notes file or uncheck "Notes Available"', 'warning');
        return;
      }

      const videoId = YouTubeUtils.extractVideoId(youtubeVideoUrl);
      if (!videoId) {
        showToast('Invalid YouTube URL. Please use a valid YouTube video URL.', 'error');
        return;
      }

      // Prevent duplicate: same YouTube video already in this batch (client-side check)
      if (!editingVideo && selectedBatch) {
        const selId = (selectedBatch?.id || selectedBatch?._id || '').toString().trim();
        const alreadyInBatch = classroomVideos.some(
          v => (v.batchId || '').toString().trim() === selId &&
               (v.youtubeVideoId || '') === videoId
        );
        if (alreadyInBatch) {
          showToast('This video is already in this batch. Each video can only be added once.', 'warning');
          return;
        }
      }

      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost'
        ? 'http://localhost:5000'
        : '';
      const batchIdForApi = selectedBatch?.id || selectedBatch?._id;

      // Create FormData for file upload
      const formData = new FormData();
      formData.append('title', title);
      formData.append('instructor', 'Admin');
      formData.append('description', description || '');
      formData.append('courseId', selectedBatch?.course);
      formData.append('batchId', batchIdForApi);
      formData.append('type', 'Lecture');
      formData.append('videoSource', 'youtube-url');
      formData.append('youtubeVideoId', videoId);
      formData.append('youtubeVideoUrl', youtubeVideoUrl);
      formData.append('youtubeEmbedUrl', YouTubeUtils.getEmbedUrl(videoId));
      formData.append('date', date);
      formData.append('time', videoFormData.time || '');
      formData.append('notesAvailable', notesAvailable);
      
      if (notesAvailable && notesFile) {
        formData.append('notesFile', notesFile);
      }

      let response;
      
      if (editingVideo) {
        // Update existing video
        response = await fetch(`${apiUrl}/api/admin/classroom/${editingVideo.id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });
      } else {
        // Create new video
        response = await fetch(`${apiUrl}/api/admin/classroom/youtube-url`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });
      }

      const data = await response.json();

      if (response.ok) {
        const successMessage = editingVideo ? 'Video updated successfully!' : 'YouTube video added successfully!';
        showToast(successMessage, 'success');

        if (editingVideo) {
          // Update existing video in the list
          setClassroomVideos(prev => prev.map(v => 
            v.id === editingVideo.id ? { ...data.lecture, id: editingVideo.id } : v
          ));
        } else {
          // Add new video to the list
          setClassroomVideos(prev => [{ id: data.lecture.id, ...data.lecture }, ...prev]);
        }

        setShowAddVideoModal(false);
        setEditingVideo(null);
        setVideoFormData({ title: '', youtubeVideoUrl: '', description: '', date: '', time: '', notesAvailable: false, notesFile: null });
        setUploadedFileInfo(null);
        setFileValidationError('');
        setIsDragOver(false);
      } else {
        showToast('Error: ' + (data.message || 'Failed to save YouTube video'), 'error');
      }
    } catch (error) {
      console.error('Error saving classroom video:', error);
      showToast('Failed to save YouTube video. Please try again.', 'error');
    }
  };

  const handleDownloadNotes = async (video) => {
    try {
      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
      
      // Try different possible endpoints for notes download
      let response;
      const endpoints = [
        `${apiUrl}/api/classroom/${video.id}/notes`,
        `${apiUrl}/api/admin/classroom/${video.id}/notes`,
        `${apiUrl}/api/classroom/notes/${video.id}`,
        `${apiUrl}/api/admin/classroom/notes/${video.id}`
      ];
      
      for (const endpoint of endpoints) {
        try {
          response = await fetch(endpoint, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (response.ok) {
            break; // Found working endpoint
          }
        } catch (e) {
          continue; // Try next endpoint
        }
      }

      if (response && response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        // Try to get filename from response headers or use default
        const contentDisposition = response.headers.get('content-disposition');
        let filename = `notes-${video.title}.pdf`;
        
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename="(.+)"/);
          if (filenameMatch) {
            filename = filenameMatch[1];
          }
        }
        
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        showToast('Notes downloaded successfully!', 'success');
      } else {
        // If no endpoint works, try to get notes from video object directly
        if (video.notesFileUrl || video.notesUrl) {
          const notesUrl = video.notesFileUrl || video.notesUrl;
          const notesResponse = await fetch(`${apiUrl}${notesUrl}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (notesResponse.ok) {
            const blob = await notesResponse.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `notes-${video.title}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            showToast('Notes downloaded successfully!', 'success');
            return;
          }
        }
        
        showToast('Failed to download notes. The notes file may not be available yet.', 'error');
      }
    } catch (error) {
      console.error('Error downloading notes:', error);
      showToast('Error downloading notes. Please try again later.', 'error');
    }
  };

  // Enhanced file handling functions
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelection(files[0]);
    }
  };

  const handleFileSelect = (e) => {
    const files = e.target.files;
    if (files.length > 0) {
      handleFileSelection(files[0]);
    }
  };

  const handleFileSelection = (file) => {
    // Clear previous error
    setFileValidationError('');
    
    // Validate file
    const validationError = validateFile(file);
    if (validationError) {
      setFileValidationError(validationError);
      return;
    }
    
    // Update state with selected file
    setVideoFormData(prev => ({ ...prev, notesFile: file }));
    setUploadedFileInfo({
      name: file.name,
      size: file.size,
      type: file.type
    });
  };

  const removeUploadedFile = () => {
    setVideoFormData(prev => ({ ...prev, notesFile: null }));
    setUploadedFileInfo(null);
    setFileValidationError('');
    // Reset file input
    const fileInput = document.getElementById('notesFileInput');
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const handleEditVideo = (video) => {
    // Set the video being edited
    setEditingVideo(video);
    
    // Reset file upload state
    setUploadedFileInfo(null);
    setFileValidationError('');
    setIsDragOver(false);
    
    // Populate the video form with existing video data for editing
    setVideoFormData({
      title: video.title || '',
      youtubeVideoUrl: video.youtubeVideoUrl || '',
      description: video.description || '',
      date: video.date || new Date().toISOString().split('T')[0],
      time: video.time || '',
      notesAvailable: video.notesAvailable || false,
      notesFile: null
    });
    
    // Open the add video modal with populated data
    setShowAddVideoModal(true);
  };

  const handleDeleteVideo = async (video) => {
    const selectedBatchId = selectedBatch?.id || selectedBatch?._id;
    if (!selectedBatchId) {
      showToast('Batch information not available', 'error');
      return;
    }

    if (window.confirm(`Remove "${video.title}" from this batch? This will not delete the video, only unassign it from this batch.`)) {
      try {
        const token = localStorage.getItem('token');
        const apiUrl = window.location.hostname === 'localhost'
          ? 'http://localhost:5000'
          : '';

        // Remove video from batch (disassociate, not delete)
        const response = await fetch(`${apiUrl}/api/batches/${selectedBatchId}/videos/${video.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          showToast('Video removed from batch successfully!', 'success');
          // Remove the video from the local state
          setClassroomVideos(prev => prev.filter(v => v.id !== video.id));
        } else {
          const errorData = await response.json();
          showToast('Error: ' + (errorData.message || 'Failed to remove video from batch'), 'error');
        }
      } catch (error) {
        console.error('Error removing video from batch:', error);
        showToast('Failed to remove video from batch. Please try again.', 'error');
      }
    }
  };

  // Refresh batch data to ensure consistency
  const refreshBatchData = async () => {
    try {
      const token = localStorage.getItem('token');
    const apiUrl = window.location.hostname === 'localhost'
      ? 'http://localhost:5000'
      : '';
      
      const response = await fetch(`${apiUrl}/api/batches`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        const batches = data.batches || [];
        const batch = batches.find(b => b.id === batchId || b._id === batchId);
        
        if (batch) {
          setSelectedBatch(batch);
        }
      }
    } catch (error) {
      console.error('Error refreshing batch data:', error);
    }
  };

  const handleDeleteStudent = async (student) => {
    const selectedBatchId = selectedBatch?.id || selectedBatch?._id;
    if (!selectedBatchId) {
      showToast('Batch information not available', 'error');
      return;
    }

    if (window.confirm(`Remove ${student.name} from this batch? This will not delete the student, only unassign them from this batch.`)) {
      try {
        const token = localStorage.getItem('token');
        const apiUrl = window.location.hostname === 'localhost'
          ? 'http://localhost:5000'
          : '';

        const response = await fetch(`${apiUrl}/api/batches/${selectedBatchId}/students/${student.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          showToast('Student removed from batch successfully!', 'success');
          
          // Update local state: clear batchId so they disappear from this batch view
          setStudents(prev => prev.map(s => 
            s.id === student.id ? { ...s, batchId: null } : s
          ));
          
          // Update selectedBatch to remove student from batch's students array
          setSelectedBatch(prev => ({
            ...prev,
            students: prev.students.filter(id => id !== student.id)
          }));
          
          // Refresh batch data to ensure consistency
          await refreshBatchData();
        } else {
          showToast('Failed to remove student from batch', 'error');
        }
      } catch (error) {
        console.error('Error removing student from batch:', error);
        showToast('Error removing student from batch', 'error');
      }
    }
  };

  // Quick select functions
  const handleQuickSelect = (filter) => {
    setEmailQuickFilter(filter);
  };

  const handleSelectAllFiltered = () => {
    const filteredEmails = filteredEmailStudents.map(student => student.email);
    setEmailForm(prev => ({
      ...prev,
      selectedStudents: filteredEmails
    }));
  };

  const handleSelectNone = () => {
    setEmailForm(prev => ({
      ...prev,
      selectedStudents: []
    }));
  };

  const handleSelectActive = () => {
    const activeEmails = batchStudents
      .filter(student => student.status === 'active')
      .map(student => student.email);
    setEmailForm(prev => ({
      ...prev,
      selectedStudents: activeEmails
    }));
  };

  const handleSendEmail = async () => {
    if (!emailForm.subject.trim() || !emailForm.message.trim() || emailForm.selectedStudents.length === 0) {
      showToast('Please fill in all required fields and select at least one student', 'warning');
      return;
    }

    setIsSendingEmail(true);
    
    try {
      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
      const batchIdForApi = selectedBatch?.id || selectedBatch?._id;

      const response = await fetch(`${apiUrl}/api/admin/send-batch-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          batchId: batchIdForApi,
          subject: emailForm.subject,
          message: emailForm.message,
          studentEmails: emailForm.selectedStudents
        })
      });

      const data = await response.json();

      if (response.ok) {
        showToast(`Email sent successfully to ${emailForm.selectedStudents.length} student(s)!`, 'success');
        
        // Reset form and go back to videos view
        setEmailForm({ subject: '', message: '', selectedStudents: [] });
        setActiveView('videos');
      } else {
        showToast(data.message || 'Failed to send email', 'error');
      }
    } catch (error) {
      console.error('Error sending email:', error);
      showToast('Error sending email. Please try again.', 'error');
    } finally {
      setIsSendingEmail(false);
    }
  };

  if (loading) {
    return (
      <div className="teacher-batch-details-page">
        <div className="loading">Loading batch details...</div>
      </div>
    );
  }

  if (!selectedBatch) {
    return (
      <div className="teacher-batch-details-page">
        <div className="error">Batch not found</div>
      </div>
    );
  }

  // Filter videos for this batch (explicit batchId match only - no course fallback)
  const batchVideos = classroomVideos
    .filter(video => {
      if (!selectedBatchIdNorm) return false;
      return normId(video.batchId) === selectedBatchIdNorm;
    })
    .sort((a, b) => {
      // Sort by date (newest first)
      const dateA = new Date(a.date || a.createdAt || 0);
      const dateB = new Date(b.date || b.createdAt || 0);
      return dateB - dateA;
    });

  
  const hasValidBatch = (student) => {
    if (!student.batchId) return false;
    const val = String(student.batchId).trim();
    if (!val || val === 'null' || val === 'undefined') return false;
    return true;
  };

  // Students list for "Add Existing Students" modal: only show students with no batch yet
  const searchTerm = addStudentsSearch.trim().toLowerCase();
  const studentsForAddModal = allStudents.filter(student => {
    // Debug logging
    console.log('Filtering student:', {
      name: student.name,
      course: student.course,
      batchId: student.batchId,
      batchCourse: selectedBatch?.course,
      courseMatch: selectedBatch?.course && student.course === selectedBatch.course,
      hasNoBatch: !student.batchId
    });

    // Only show students whose course matches this batch's course (case-insensitive and flexible matching)
    if (selectedBatch?.course) {
      const batchCourseLower = selectedBatch.course.toLowerCase();
      const studentCourseLower = (student.course || '').toLowerCase();
      
      // Handle different course name variations
      const isCyberSecurityCourse = batchCourseLower.includes('cyber') || batchCourseLower.includes('security') || batchCourseLower.includes('cs&eh');
      const studentIsCyberSecurityCourse = studentCourseLower.includes('cyber') || studentCourseLower.includes('security') || studentCourseLower.includes('cs&eh');
      
      const isDataScienceCourse = batchCourseLower.includes('data') || batchCourseLower.includes('science') || batchCourseLower.includes('ai');
      const studentIsDataScienceCourse = studentCourseLower.includes('data') || studentCourseLower.includes('science') || studentCourseLower.includes('ai');
      
      if (!((isCyberSecurityCourse && studentIsCyberSecurityCourse) || 
            (isDataScienceCourse && studentIsDataScienceCourse) ||
            batchCourseLower === studentCourseLower)) {
        return false;
      }
    }

    // Only show students who don't have a batch assigned (batchId is null, undefined, or empty)
    if (student.batchId) {
      return false;
    }

    // Only show students who are not assigned to any batch yet
    if (hasValidBatch(student)) {
      return false;
    }

    if (!searchTerm) return true;
    const name = (student.name || '').toLowerCase();
    const email = (student.email || '').toLowerCase();
    return name.includes(searchTerm) || email.includes(searchTerm);
  });

  console.log('Final filtered students for add modal:', studentsForAddModal.length);

  return (
    <>
    <div className="teacher-batch-details-page">
      
      {/* Compact Header - Optimized Space Utilization */}
      <div className="batch-header compact">
        <div className="compact-header-left">
          <button onClick={handleBackToAdmin} className="btn-back btn-back-compact">
            ← Back
          </button>
          <div className="batch-info-compact">
            <h1 className="batch-title-compact">{selectedBatch.name}</h1>
            <div className="batch-meta-compact">
              <span className="course-badge course-badge-compact">{selectedBatch.course}</span>
              <span className={`status-badge status-badge-compact ${selectedBatch.status}`}>
                {selectedBatch.status}
              </span>
              <span className="teacher-info-compact">Teacher: {selectedBatch.teacherName || 'N/A'}</span>
            </div>
          </div>
        </div>
        
        <div className="compact-header-center">
          {selectedBatch.schedule && (selectedBatch.schedule.days || selectedBatch.schedule.time) && (
            <div className="timing-display-compact">
              <span className="timing-icon">⏰</span>
              <span className="timing-text">
                {`${selectedBatch.schedule.days || ''} ${selectedBatch.schedule.time || ''}`.trim()}
              </span>
            </div>
          )}
        </div>
        
        <div className="compact-header-right">
          <div className="quick-stats-compact">
            <div className="stat-item-compact">
              <span className="stat-icon">📹</span>
              <span className="stat-value">{batchVideos.length}</span>
            </div>
            <div className="stat-item-compact">
              <span className="stat-icon">👥</span>
              <span className="stat-value">{batchStudents.length}</span>
            </div>
          </div>
          
          <div className="header-menu-buttons">
            <button 
              className={`menu-item-horizontal ${activeView === 'videos' ? 'active' : ''}`}
              onClick={() => handleViewChange('videos')}
            >
              📹 Videos ({batchVideos.length})
            </button>
            <button 
              className={`menu-item-horizontal ${activeView === 'students' ? 'active' : ''}`}
              onClick={() => handleViewChange('students')}
            >
              👥 Students ({batchStudents.length})
            </button>
            {isAdmin && (
              <button 
                className={`menu-item-horizontal ${activeView === 'email' ? 'active' : ''}`}
                onClick={() => handleViewChange('email')}
              >
                📧 Send Email
              </button>
            )}
          </div>
          
          {isAdmin && (
            <button
              className="btn-edit-timing-compact"
              onClick={() => {
                const parsedRange = parseIstRangeToTimeInputs(scheduleForm.time);
                setTimeRange(parsedRange);
                setShowScheduleModal(true);
              }}
              title={selectedBatch.schedule ? 'Edit Timing' : 'Add Timing'}
            >
              ⏰
            </button>
          )}
        </div>
      </div>

      
      <div className="batch-content">
        {/* Main Content */}
        <div className="main-content">
          {activeView === 'videos' && (
            <div className="videos-view">
              <div className="videos-header">
                <h2>📹 Videos in {selectedBatch.name}</h2>
                <button
                  className="btn-add"
                  onClick={() => setShowAddVideoModal(true)}
                >
                  ➕ Add Video to Batch
                </button>
              </div>
              {batchVideos.length > 0 ? (
                <div className="video-grid">
                  {batchVideos.map((video) => (
                    <div 
                      key={video.id} 
                      className="video-card"
                      onClick={() => setSelectedVideo(video)}
                    >
                      <div className="video-thumbnail" style={{ position: 'relative', overflow: 'hidden' }}>
                        {video.videoSource === 'youtube-url' ? (
                          <img 
                            src={`https://img.youtube.com/vi/${video.youtubeVideoId}/mqdefault.jpg`}
                            alt={video.title}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover'
                            }}
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        
                        <div style={{
                          display: video.videoSource === 'youtube-url' ? 'none' : 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          height: '100%',
                          fontSize: '24px'
                        }}>
                          {video.videoSource === 'youtube-url' ? '📺' : 
                           video.zoomUrl ? '🎥' : '📁'}
                        </div>
                        
                        {video.duration && (
                          <div style={{
                            position: 'absolute',
                            bottom: '4px',
                            right: '4px',
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            color: 'white',
                            padding: '1px 4px',
                            borderRadius: '2px',
                            fontSize: '10px',
                            fontWeight: 'bold'
                          }}>
                            {video.duration}
                          </div>
                        )}
                      </div>
                      <div className="video-right">
                        <div className="video-info">
                          <div className="video-title">{video.title}</div>
                          <div className="video-meta">
                            <span className="meta-item">
                              <span className="label">👨‍🏫 Teacher:</span>
                              <span className="value">{selectedBatch.teacherName || video.instructor}</span>
                            </span>
                            <span className="meta-item">
                              <span className="label">📅 Class Date:</span>
                              <span className="value">{formatDateForComponent(video.date)}</span>
                            </span>
                          </div>
                        </div>
                        <div className="video-actions">
                          {video.notesAvailable && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation(); // Prevent video play
                                handleDownloadNotes(video);
                              }}
                              className="btn-notes"
                              title="Download Notes"
                            >
                              📄 Notes
                            </button>
                          )}
                          {isAdmin && (
                            <>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation(); // Prevent video play
                                  handleEditVideo(video);
                                }}
                                className="btn-edit"
                                title="Edit Video"
                              >
                                ✏️ Edit
                              </button>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation(); // Prevent video play
                                  if (window.confirm(`Remove "${video.title}" from this batch? This will not delete the video, only unassign it from this batch.`)) {
                                  handleDeleteVideo(video);
                                  }
                                }}
                                className="btn-delete"
                                title="Remove Video from Batch"
                              >
                                🗑️ Remove
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-data">
                  <p>📹 No videos found for this batch</p>
                  <small>Only videos explicitly assigned to this batch are shown (same as students see). Click "Add Video to Batch" to add lectures.</small>
                </div>
              )}
            </div>
          )}

          {activeView === 'students' && (
            <div className="students-view">
              <div className="students-header">
                <h2>👥 Students in {selectedBatch.name}</h2>
                <div className="students-actions">
                  <button
                    className="btn-add"
                    onClick={() => setShowAddStudentModal(true)}
                  >
                    ➕ Add Student
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => setShowAddStudentsModal(true)}
                  >
                    👥 Add Existing Students
                  </button>
                </div>
              </div>

              {batchStudents.length > 0 ? (
                <div className="students-table-container">
                  <table className="students-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Last Login</th>
                        <th>Course</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batchStudents.map(student => (
                        <tr 
                          key={student.id}
                          className="student-row"
                        >
                          <td>
                            <button 
                              onClick={() => handleViewStudentDetails(student)}
                              className="btn-link"
                              title="View Student Details"
                            >
                              {student.name}
                            </button>
                          </td>
                          <td>{student.email}</td>
                          <td>{formatLastLogin(student)}</td>
                          <td>{student.course}</td>
                          <td>
                            <span className={`status-badge ${student.status}`}>
                              {student.status}
                            </span>
                          </td>
                          <td>
                            <button 
                              onClick={() => handleEditStudent(student)}
                              className="btn-edit"
                              title="Edit Student"
                            >
                              ✏️ Edit
                            </button>
                            <button 
                              onClick={() => {
                                if (window.confirm(`Remove ${student.name} from this batch? This will not delete the student, only unassign them from this batch.`)) {
                                  // Handle student deletion
                                  handleDeleteStudent(student);
                                }
                              }}
                              className="btn-delete"
                              title="Remove from Batch"
                            >
                              🗑️ Remove
                            </button>
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
                </div>
              )}
            </div>
          )}

          {activeView === 'email' && (
            <div className="email-view">
              <div className="email-header">
                <div className="email-header-icon">✉️</div>
                <div>
                  <h2>Send Email to Batch</h2>
                  <p className="email-header-subtitle">{selectedBatch?.name}</p>
                </div>
              </div>
              
              <div className="email-modal">
                <div className="email-content">
                  {/* Sender Email Display */}
                  <div className="email-sender-card">
                    <div className="email-sender-label">
                      <span className="email-sender-icon">📤</span>
                      <span>From</span>
                    </div>
                    <div className="email-sender-value">support@skystates.us</div>
                    <small className="email-sender-note">Batch notifications will be sent from this address</small>
                  </div>

                  {/* Student Selection */}
                  <div className="email-students-section">
                    <div className="email-students-header">
                      <label className="email-section-label">
                        <span className="email-section-icon">👥</span>
                        Select Students
                      </label>
                      <div className="email-student-search">
                        <input
                          type="text"
                          placeholder="Search students..."
                          value={emailSearchTerm}
                          onChange={(e) => setEmailSearchTerm(e.target.value)}
                          className="email-student-search-input"
                        />
                      </div>
                    </div>
                    
                    {/* Quick Filters */}
                    <div className="email-quick-filters">
                      <button
                        type="button"
                        className={`email-quick-filter ${emailQuickFilter === 'all' ? 'active' : ''}`}
                        onClick={() => handleQuickSelect('all')}
                      >
                        All ({batchStudents.length})
                      </button>
                      <button
                        type="button"
                        className={`email-quick-filter ${emailQuickFilter === 'active' ? 'active' : ''}`}
                        onClick={() => handleQuickSelect('active')}
                      >
                        Active ({batchStudents.filter(s => s.status === 'active').length})
                      </button>
                      <button
                        type="button"
                        className={`email-quick-filter ${emailQuickFilter === 'inactive' ? 'active' : ''}`}
                        onClick={() => handleQuickSelect('inactive')}
                      >
                        Inactive ({batchStudents.filter(s => s.status === 'inactive').length})
                      </button>
                      <button
                        type="button"
                        className="email-quick-filter"
                        onClick={handleSelectAllFiltered}
                      >
                        Select All Filtered
                      </button>
                      <button
                        type="button"
                        className="email-quick-filter"
                        onClick={handleSelectNone}
                      >
                        Clear Selection
                      </button>
                      <button
                        type="button"
                        className="email-quick-filter"
                        onClick={handleSelectActive}
                      >
                        Select Active Only
                      </button>
                    </div>
                    
                    <div className="email-students-header">
                      <label className="email-select-all" htmlFor="select-all-students">
                        <input
                          type="checkbox"
                          id="select-all-students"
                          checked={emailForm.selectedStudents.length === filteredEmailStudents.length && filteredEmailStudents.length > 0}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEmailForm(prev => ({
                                ...prev,
                                selectedStudents: filteredEmailStudents.map(student => student.email)
                              }));
                            } else {
                              setEmailForm(prev => ({
                                ...prev,
                                selectedStudents: []
                              }));
                            }
                          }}
                        />
                        <span>Select All ({filteredEmailStudents.length} of {batchStudents.length})</span>
                      </label>
                    </div>
                    
                    <div className="email-students-list">
                      {filteredEmailStudents.length > 0 ? (
                        filteredEmailStudents.map(student => (
                          <label key={student.id} htmlFor={`student-${student.id}`} className="email-student-item">
                            <input
                              type="checkbox"
                              id={`student-${student.id}`}
                              checked={emailForm.selectedStudents.includes(student.email)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setEmailForm(prev => ({
                                    ...prev,
                                    selectedStudents: [...prev.selectedStudents, student.email]
                                  }));
                                } else {
                                  setEmailForm(prev => ({
                                    ...prev,
                                    selectedStudents: prev.selectedStudents.filter(email => email !== student.email)
                                  }));
                                }
                              }}
                            />
                            <div className="email-student-info">
                              <span className="student-name">{student.name}</span>
                              <span className="student-email">{student.email}</span>
                            </div>
                          </label>
                        ))
                      ) : (
                        <div className="no-students-message">
                          <p>
                            {emailSearchTerm || emailQuickFilter !== 'all' 
                              ? 'No students match the current filters.' 
                              : 'No students in this batch to email.'}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Email Composition */}
                  <div className="email-composition">
                    <label className="email-section-label">
                      <span className="email-section-icon">✏️</span>
                      Compose Message
                    </label>
                    <div className="email-form">
                      <div className="email-field-group">
                        <label className="email-field-label">Subject <span className="required">*</span></label>
                        <input
                          type="text"
                          placeholder="Enter email subject"
                          value={emailForm.subject}
                          onChange={(e) => setEmailForm(prev => ({ ...prev, subject: e.target.value }))}
                          className="email-subject-input"
                          required
                        />
                      </div>
                      <div className="email-field-group">
                        <label className="email-field-label">
                          Message <span className="required">*</span>
                          <span 
                            style={{ marginLeft: '8px', fontSize: '0.8rem', color: '#6c757d', cursor: 'pointer' }}
                            onClick={() => setShowCharCounter(!showCharCounter)}
                          >
                            {showCharCounter ? 'Hide' : 'Show'} counter
                          </span>
                        </label>
                        <textarea
                          placeholder="Write your message to the selected students..."
                          value={emailForm.message}
                          onChange={(e) => setEmailForm(prev => ({ ...prev, message: e.target.value }))}
                          className="email-message-input"
                          rows="6"
                          required
                          maxLength="5000"
                        />
                        {showCharCounter && (
                          <div className="email-char-counter">
                            {emailForm.message.length}/5000 characters
                          </div>
                        )}
                      </div>
                      
                      <div className="email-actions">
                        <div className="email-selection-info">
                          {emailForm.selectedStudents.length > 0 && (
                            <span>
                              {emailForm.selectedStudents.length} of {batchStudents.length} students selected
                            </span>
                          )}
                        </div>
                        <div className="email-action-buttons">
                          <button
                            type="button"
                            className="btn-email-cancel"
                            onClick={() => {
                              setEmailForm({ subject: '', message: '', selectedStudents: [] });
                              setEmailSearchTerm('');
                              setEmailQuickFilter('all');
                              setActiveView('videos');
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            className="btn-send-email"
                            onClick={handleSendEmail}
                            disabled={isSendingEmail || !emailForm.subject.trim() || !emailForm.message.trim() || emailForm.selectedStudents.length === 0}
                          >
                            {isSendingEmail ? (
                              <span className="btn-send-loading">⏳ Sending...</span>
                            ) : (
                              <span>Send to {emailForm.selectedStudents.length} student{emailForm.selectedStudents.length !== 1 ? 's' : ''}</span>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Student Edit Modal */}
      {showStudentModal && createPortal(
        <div className="modal-overlay" onClick={() => setShowStudentModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Student</h3>
              <button className="modal-close" onClick={() => setShowStudentModal(false)}>×</button>
            </div>
            
            <div className="modal-content">
              <input
                type="text"
                placeholder="Student Name *"
                value={studentFormData.name}
                onChange={(e) => setStudentFormData({...studentFormData, name: e.target.value})}
                required
              />
              <input
                type="email"
                placeholder="Email Address *"
                value={studentFormData.email}
                onChange={(e) => setStudentFormData({...studentFormData, email: e.target.value})}
                required
              />
              <select
                value={studentFormData.batchId || ''}
                onChange={(e) => setStudentFormData({...studentFormData, batchId: e.target.value})}
              >
                <option value="">Select Batch</option>
                <option value={selectedBatch?.id || selectedBatch?._id}>
                  {selectedBatch?.name}
                </option>
              </select>
              <input
                type="text"
                placeholder="Course"
                value={studentFormData.course}
                onChange={(e) => setStudentFormData({...studentFormData, course: e.target.value})}
              />
              <select
                value={studentFormData.status || 'active'}
                onChange={(e) => setStudentFormData({...studentFormData, status: e.target.value})}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="on-leave">On Leave</option>
              </select>
              <input
                type="tel"
                placeholder="Phone Number"
                value={studentFormData.phone}
                onChange={(e) => setStudentFormData({...studentFormData, phone: e.target.value})}
              />
              <textarea
                placeholder="Address"
                value={studentFormData.address}
                onChange={(e) => setStudentFormData({...studentFormData, address: e.target.value})}
                rows="3"
              />
            </div>
            
            <div className="modal-actions">
              <button onClick={() => setShowStudentModal(false)} className="btn-cancel">
                Cancel
              </button>
              <button onClick={handleSaveStudent} className="btn-save">
                Save Changes
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>

    {/* Video Player Modal */}
    {selectedVideo && (
      <CustomVideoPlayer
        video={selectedVideo}
        onClose={() => setSelectedVideo(null)}
      />
    )}

    {showAddVideoModal && createPortal(
      <div className="modal-overlay" onClick={() => {
        setShowAddVideoModal(false);
        setEditingVideo(null);
        setVideoFormData({ title: '', youtubeVideoUrl: '', description: '', date: '', time: '', notesAvailable: false, notesFile: null });
        setUploadedFileInfo(null);
        setFileValidationError('');
        setIsDragOver(false);
      }}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>{editingVideo ? 'Edit Video' : 'Add Video'} to {selectedBatch.name}</h3>
            <button
              className="modal-close"
              onClick={() => {
                setShowAddVideoModal(false);
                setEditingVideo(null);
                setVideoFormData({ title: '', youtubeVideoUrl: '', description: '', date: '', time: '', notesAvailable: false, notesFile: null });
                setUploadedFileInfo(null);
                setFileValidationError('');
                setIsDragOver(false);
              }}
            >
              ×
            </button>
          </div>

          <div className="modal-content">
            <p className="modal-subtitle">Paste a YouTube video URL to add it for this batch only. Each video can only be added once per batch.</p>

            <input
              type="text"
              placeholder="Video Title *"
              value={videoFormData.title}
              onChange={(e) => setVideoFormData({ ...videoFormData, title: e.target.value })}
              required
            />
            <input
              type="text"
              placeholder="YouTube Video URL *"
              value={videoFormData.youtubeVideoUrl}
              onChange={(e) => setVideoFormData({ ...videoFormData, youtubeVideoUrl: e.target.value })}
              required
            />
            <input
              type="date"
              placeholder="Class Date *"
              value={videoFormData.date}
              onChange={(e) => setVideoFormData({ ...videoFormData, date: e.target.value })}
              required
              style={{ marginBottom: '15px' }}
            />
            <input
              type="text"
              placeholder="Class Time (e.g., 7:00 PM)"
              value={videoFormData.time || ''}
              onChange={(e) => setVideoFormData({ ...videoFormData, time: e.target.value })}
              style={{ marginBottom: '15px' }}
              title="Optional: Use batch timing or enter custom time"
            />
            <small style={{color: '#888', fontSize: '12px', display: 'block', marginBottom: '15px'}}>
              * Required fields. Class time will be displayed with the video.
            </small>
            <textarea
              placeholder="Description (optional)"
              rows="3"
              value={videoFormData.description}
              onChange={(e) => setVideoFormData({ ...videoFormData, description: e.target.value })}
            />
            
            <div className="enhanced-notes-section">
              <div className="notes-header">
                <label className="enhanced-notes-label">
                  <input
                    type="checkbox"
                    checked={videoFormData.notesAvailable}
                    onChange={(e) => setVideoFormData({ ...videoFormData, notesAvailable: e.target.checked, notesFile: e.target.checked ? null : null })}
                    className="notes-checkbox"
                  />
                  <span className="checkbox-custom"></span>
                  <span className="notes-label-text">📄 Upload Notes for Students</span>
                </label>
              </div>
              
              {videoFormData.notesAvailable && (
                <div className="notes-upload-area">
                  <div 
                    className={`drag-drop-zone ${isDragOver ? 'drag-over' : ''} ${uploadedFileInfo ? 'has-file' : ''}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleFileDrop}
                    onClick={() => document.getElementById('notesFileInput').click()}
                  >
                    <div className="upload-content">
                      {uploadedFileInfo ? (
                        <div className="file-preview">
                          <div className="file-icon">{getFileIcon(uploadedFileInfo.name)}</div>
                          <div className="file-details">
                            <div className="file-name">{uploadedFileInfo.name}</div>
                            <div className="file-size">{formatFileSize(uploadedFileInfo.size)}</div>
                          </div>
                          <button 
                            className="remove-file-btn" 
                            onClick={(e) => {
                              e.stopPropagation();
                              removeUploadedFile();
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div className="upload-prompt">
                          <div className="upload-icon">📁</div>
                          <div className="upload-text">
                            <p className="primary-text">Drag & drop your notes file here</p>
                            <p className="secondary-text">or click to browse</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <input
                    id="notesFileInput"
                    type="file"
                    accept=".pdf,.doc,.docx,.txt,.ppt,.pptx,.xls,.xlsx,.csv,.ipynb,.zip,.jpg,.jpeg,.png,.gif"
                    onChange={handleFileSelect}
                    className="hidden-file-input"
                  />
                  
                  {fileValidationError && (
                    <div className="file-validation-error">
                      ⚠️ {fileValidationError}
                    </div>
                  )}
                  
                  <div className="supported-formats">
                    <span className="formats-label">Supported formats:</span>
                    <div className="format-badges">
                      <span className="format-badge">PDF</span>
                      <span className="format-badge">DOC</span>
                      <span className="format-badge">PPT</span>
                      <span className="format-badge">XLS</span>
                      <span className="format-badge">CSV</span>
                      <span className="format-badge">IPYNB</span>
                      <span className="format-badge">ZIP</span>
                      <span className="format-badge">IMG</span>
                    </div>
                  </div>
                  
                  <div className="upload-guidelines">
                    <p>📝 Maximum file size: 10MB</p>
                    <p>🔒 Files are securely stored and shared only with enrolled students</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="modal-actions">
                        <button
                          type="button"
                          className="btn-email-cancel"
                          onClick={() => {
                setShowAddVideoModal(false);
                setVideoFormData({ title: '', youtubeVideoUrl: '', description: '', date: '', time: '', notesAvailable: false, notesFile: null });
                setUploadedFileInfo(null);
                setFileValidationError('');
                setIsDragOver(false);
              }}
            >
              Cancel
            </button>
            <button
              className="btn-save"
              onClick={handleAddVideoToBatch}
            >
              Save Video
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}

    {showScheduleModal && createPortal(
      <div className="modal-overlay" onClick={() => setShowScheduleModal(false)}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>Set Batch Timing (IST)</h3>
            <button
              className="modal-close"
              onClick={() => setShowScheduleModal(false)}
            >
              ×
            </button>
          </div>

          <div className="modal-content">
            <p className="modal-subtitle">
              Define when this batch meets (IST). Students will see this converted automatically into their display time zones.
            </p>

            <div className="schedule-days-section">
              <label className="field-label">Days of the week</label>
              <div className="day-selector">
                {DAYS_OF_WEEK.map((day) => {
                  const currentDays = scheduleForm.days
                    ? scheduleForm.days.split(',').map(d => d.trim()).filter(Boolean)
                    : [];
                  const isSelected = currentDays.includes(day);

                  return (
                    <button
                      key={day}
                      type="button"
                      className={`day-pill ${isSelected ? 'selected' : ''}`}
                      onClick={() => {
                        const updated = isSelected
                          ? currentDays.filter(d => d !== day)
                          : [...currentDays, day];
                        setScheduleForm({
                          ...scheduleForm,
                          days: updated.join(', ')
                        });
                      }}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="schedule-time-section">
              <label className="field-label">Batch time (IST)</label>
              <div className="time-range-inputs">
                <div className="time-input-group">
                  <span className="time-label">Start</span>
                  <input
                    type="time"
                    value={timeRange.start}
                    onChange={(e) => setTimeRange(prev => ({ ...prev, start: e.target.value }))}
                  />
                </div>
                <div className="time-input-group">
                  <span className="time-label">End</span>
                  <input
                    type="time"
                    value={timeRange.end}
                    onChange={(e) => setTimeRange(prev => ({ ...prev, end: e.target.value }))}
                  />
                </div>
              </div>
              <p className="time-hint">Times are saved in IST and converted for students automatically.</p>
            </div>
          </div>

          <div className="modal-actions">
            <button
              className="btn-cancel"
              onClick={() => setShowScheduleModal(false)}
            >
              Cancel
            </button>
            <button
              className="btn-save"
              onClick={handleSaveSchedule}
            >
              Save Timing
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}

    {showAddStudentsModal && createPortal(
      <div className="modal-overlay" onClick={() => {
        setShowAddStudentsModal(false);
        setSelectedStudentIds([]);
      }}>
        <div className="modal add-students-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>Add Students to {selectedBatch.name}</h3>
            <button
              className="modal-close"
              onClick={() => {
                setShowAddStudentsModal(false);
                setSelectedStudentIds([]);
              }}
            >
              ×
            </button>
          </div>

          <div className="modal-content">
            <p className="modal-subtitle">Select one or more students to assign to this batch.</p>

            <input
              type="text"
              className="student-search-input"
              placeholder="Search by name or email..."
              value={addStudentsSearch}
              onChange={(e) => setAddStudentsSearch(e.target.value)}
            />

            <div className="students-table-container add-students-table-container">
              <table className="students-table add-students-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Current Batch</th>
                  <th>Course</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {studentsForAddModal.map(student => {
                  const isAlreadyInBatch = normId(student.batchId) === selectedBatchIdNorm;
                  return (
                    <tr key={student.id} className={isAlreadyInBatch ? 'already-in-batch-row' : ''}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedStudentIds.includes(student.id)}
                          onChange={() => toggleStudentSelection(student.id)}
                          disabled={isAlreadyInBatch}
                        />
                      </td>
                      <td>{student.name}</td>
                      <td>{student.email}</td>
                      <td>{student.batchId || 'None'}</td>
                      <td>{student.course || 'N/A'}</td>
                      <td>
                        {isAlreadyInBatch ? (
                          <span className="status-badge already-added">Already added</span>
                        ) : (
                          <span className="status-badge">Available</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              </table>
            </div>
          </div>

          <div className="modal-actions">
            <button
              className="btn-secondary"
              onClick={() => {
                setShowAddStudentsModal(false);
                setSelectedStudentIds([]);
              }}
            >
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={handleAddStudentsToBatch}
            >
              Save
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}

    {showStudentDetailsModal && createPortal(
      <div className="fullscreen-modal-overlay" onClick={() => setShowStudentDetailsModal(false)}>
        <div className="fullscreen-modal student-profile-modal" onClick={(e) => e.stopPropagation()}>
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
                <p className="student-email">{selectedStudentDetails?.email || 'email@example.com'}</p>
                <div className="student-badges">
                  <span className="badge badge-primary">{selectedStudentDetails?.course || 'No Course'}</span>
                  <span className={`status-badge ${selectedStudentDetails?.status || 'inactive'}`}>
                    {selectedStudentDetails?.status || 'Unknown'}
                  </span>
                </div>
              </div>
            </div>
            <div className="modal-header-actions">
              <button 
                className="btn-edit-profile"
                onClick={() => setEditMode(!editMode)}
              >
                {editMode ? '👁️ View Mode' : '✏️ Edit Profile'}
              </button>
              <button className="modal-close-fullscreen" onClick={() => setShowStudentDetailsModal(false)}>×</button>
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

          {/* Tab Content */}
          <div className="fullscreen-modal-content">
            {/* Profile Tab */}
            {activeProfileTab === 'profile' && (
              <div className="profile-tab-content">
                <div className="profile-grid">
                  <div className="profile-section">
                    <h3>📝 Personal Information</h3>
                    {editMode ? (
                      <div className="edit-profile-form">
                        <div className="form-row">
                          <div className="form-group">
                            <label>Full Name</label>
                            <input
                              type="text"
                              value={editedProfile.name || ''}
                              onChange={(e) => setEditedProfile(prev => ({ ...prev, name: e.target.value }))}
                              className="profile-input"
                            />
                          </div>
                          <div className="form-group">
                            <label>Email Address</label>
                            <input
                              type="email"
                              value={editedProfile.email || ''}
                              onChange={(e) => setEditedProfile(prev => ({ ...prev, email: e.target.value }))}
                              className="profile-input"
                            />
                          </div>
                        </div>
                        <div className="form-row">
                          <div className="form-group">
                            <label>Phone Number</label>
                            <input
                              type="tel"
                              value={editedProfile.phone || ''}
                              onChange={(e) => setEditedProfile(prev => ({ ...prev, phone: e.target.value }))}
                              className="profile-input"
                            />
                          </div>
                          <div className="form-group">
                            <label>Status</label>
                            <select
                              value={editedProfile.status || 'active'}
                              onChange={(e) => setEditedProfile(prev => ({ ...prev, status: e.target.value }))}
                              className="profile-input"
                            >
                              <option value="active">Active</option>
                              <option value="inactive">Inactive</option>
                              <option value="on-leave">On Leave</option>
                            </select>
                          </div>
                        </div>
                        <div className="form-group full-width">
                          <label>Address</label>
                          <textarea
                            value={editedProfile.address || ''}
                            onChange={(e) => setEditedProfile(prev => ({ ...prev, address: e.target.value }))}
                            className="profile-input"
                            rows="3"
                          />
                        </div>
                        <div className="form-actions">
                          <button className="btn-save" onClick={handleSaveProfile}>
                            💾 Save Changes
                          </button>
                          <button className="btn-cancel" onClick={handleCancelEdit}>
                            ❌ Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
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
                    )}
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
                        <span>
                          <span className={`status-badge ${(selectedStudentDetails?.status || 'active').toLowerCase()}`}>
                            {selectedStudentDetails?.status || 'Active'}
                          </span>
                        </span>
                      </div>
                      <div className="detail-item">
                        <label>Batch Name:</label>
                        <span>{selectedBatch?.name || 'N/A'}</span>
                      </div>
                      <div className="detail-item">
                        <label>Student ID:</label>
                        <span>{selectedStudentDetails?.id || 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="profile-section">
                    <h3>📍 Login Activity</h3>
                    {(selectedStudentDetails?.lastLogin || selectedStudentDetails?.lastLoginIP) ? (
                      <div className="profile-details">
                        <div className="detail-item">
                          <label>Last Login:</label>
                          <span>{selectedStudentDetails?.lastLogin?.timestamp ? new Date(selectedStudentDetails.lastLogin.timestamp).toLocaleString() : selectedStudentDetails?.lastLoginTimestamp ? new Date(selectedStudentDetails.lastLoginTimestamp).toLocaleString() : 'Never'}</span>
                        </div>
                        <div className="detail-item">
                          <label>Last IP:</label>
                          <span className="ip-address">{selectedStudentDetails?.lastLoginIP || selectedStudentDetails?.lastLogin?.ipAddress || 'N/A'}</span>
                        </div>
                        <div className="detail-item">
                          <label>Location:</label>
                          <span>{[selectedStudentDetails?.lastLogin?.city, selectedStudentDetails?.lastLogin?.country].filter(Boolean).join(', ') || 'N/A'}</span>
                        </div>
                      </div>
                    ) : (
                      <p className="no-activity">No login activity recorded yet.</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Activity Tab */}
            {activeProfileTab === 'activity' && (
              <div className="activity-tab-content">
                {/* Graph Controls */}
                <div className="graph-controls">
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
                    <div className="control-actions">
                      <button 
                        className="btn-download-csv"
                        onClick={handleDownloadGraphCSV}
                      >
                        📥 Download CSV
                      </button>
                    </div>
                  </div>
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

                {/* Detailed Activity List */}
                <div className="detailed-activity-section">
                  <div className="section-header">
                    <h4>📋 Detailed Activity Log</h4>
                    <div className="legacy-filters">
                      <select
                        value={activityFilter.action || ''}
                        onChange={(e) => setActivityFilter(prev => ({ ...prev, action: e.target.value }))}
                        className="filter-input"
                      >
                        <option value="">All Actions</option>
                        <option value="login">Login</option>
                        <option value="video_view">Video View</option>
                        <option value="assessment_submit">Assessment Submit</option>
                        <option value="page_view">Page View</option>
                      </select>
                      <button className="btn-filter" onClick={handleFilterActivity}>
                        🔍 Apply Filters
                      </button>
                      <button className="btn-clear" onClick={handleClearActivityFilter}>
                        🔄 Clear
                      </button>
                    </div>
                  </div>
                  
                  {studentActivities.length > 0 ? (
                    <>
                      <div className="activity-list compact">
                        {studentActivities.slice(0, 10).map((activity, index) => (
                          <div key={activity.id || index} className="activity-item compact">
                            <div className="activity-header">
                              <span className="activity-action">{activity.action}</span>
                              <span className="activity-timestamp">
                                {activity.timestamp ? new Date(activity.timestamp).toLocaleString() : 'N/A'}
                              </span>
                            </div>
                            <div className="activity-details">
                              {activity.videoTitle && (
                                <div className="activity-detail">
                                  <label>Video:</label>
                                  <span>{activity.videoTitle}</span>
                                </div>
                              )}
                              {activity.assessmentTitle && (
                                <div className="activity-detail">
                                  <label>Assessment:</label>
                                  <span>{activity.assessmentTitle} (Score: {activity.score})</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      {studentActivities.length > 10 && (
                        <div className="show-more">
                          <small>Showing first 10 activities of {activityTotal}. Use filters above for more specific results.</small>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="no-activity-data">
                      <p>📊 No activity data found for this student.</p>
                      <small>Try adjusting the filters or date range.</small>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Reports Tab */}
            {activeProfileTab === 'reports' && (
              <div className="reports-tab-content">
                <div className="reports-header">
                  <h3>📈 Student Activity Reports</h3>
                  <div className="report-actions">
                    <div className="date-range-selector">
                      <label>Report Period:</label>
                      <select
                        value={reportPeriod}
                        onChange={(e) => setReportPeriod(e.target.value)}
                        className="period-select"
                      >
                        <option value="7">Last 7 Days</option>
                        <option value="30">Last 30 Days</option>
                        <option value="90">Last 90 Days</option>
                        <option value="custom">Custom Range</option>
                      </select>
                    </div>
                    {reportPeriod === 'custom' && (
                      <div className="custom-date-range">
                        <input
                          type="date"
                          value={customDateRange.start || ''}
                          onChange={(e) => setCustomDateRange(prev => ({ ...prev, start: e.target.value }))}
                          className="date-input"
                        />
                        <span>to</span>
                        <input
                          type="date"
                          value={customDateRange.end || ''}
                          onChange={(e) => setCustomDateRange(prev => ({ ...prev, end: e.target.value }))}
                          className="date-input"
                        />
                      </div>
                    )}
                    <button 
                      className="btn-generate-report"
                      onClick={handleGenerateReport}
                    >
                      📊 Generate Report
                    </button>
                  </div>
                </div>

                <div className="report-content">
                  {reportData ? (
                    <div className="report-summary">
                      <div className="summary-cards">
                        <div className="summary-card">
                          <h4>Total Activities</h4>
                          <span className="summary-value">{reportData.totalActivities || 0}</span>
                        </div>
                        <div className="summary-card">
                          <h4>Video Views</h4>
                          <span className="summary-value">{reportData.videoViews || 0}</span>
                        </div>
                        <div className="summary-card">
                          <h4>Assessments</h4>
                          <span className="summary-value">{reportData.assessments || 0}</span>
                        </div>
                        <div className="summary-card">
                          <h4>Login Days</h4>
                          <span className="summary-value">{reportData.loginDays || 0}</span>
                        </div>
                      </div>
                      <div className="report-actions-bottom">
                        <button 
                          className="btn-download-report"
                          onClick={handleDownloadReport}
                        >
                          📥 Download Full Report (CSV)
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="no-report">
                      <p>📊 Select a time period and generate a report to see student activity summary.</p>
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

    {/* Add Student Modal */}
    {showAddStudentModal && createPortal(
      <div className="modal-overlay" onClick={() => setShowAddStudentModal(false)}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>Add New Student</h2>
            <button className="modal-close" onClick={() => setShowAddStudentModal(false)}>×</button>
          </div>
          
          <div className="modal-content">
            <input
              type="text"
              placeholder="Student full name *"
              value={newStudentForm.name}
              onChange={(e) => setNewStudentForm({...newStudentForm, name: e.target.value})}
              required
            />
            <input
              type="email"
              placeholder="Enter student email address *"
              value={newStudentForm.email}
              onChange={(e) => setNewStudentForm({...newStudentForm, email: e.target.value})}
              required
              autoComplete="off"
              readOnly
              onFocus={(e) => e.target.removeAttribute('readonly')}
              onBlur={(e) => e.target.setAttribute('readonly', true)}
            />
            <input
              type="password"
              placeholder="Create password for student *"
              value={newStudentForm.password}
              onChange={(e) => setNewStudentForm({...newStudentForm, password: e.target.value})}
              required
              autoComplete="off"
              readOnly
              onFocus={(e) => e.target.removeAttribute('readonly')}
              onBlur={(e) => e.target.setAttribute('readonly', true)}
            />
            <input
              type="tel"
              placeholder="Phone Number"
              value={newStudentForm.phone}
              onChange={(e) => setNewStudentForm({...newStudentForm, phone: e.target.value})}
            />
            <textarea
              placeholder="Address"
              value={newStudentForm.address}
              onChange={(e) => setNewStudentForm({...newStudentForm, address: e.target.value})}
              rows="2"
            />
            <select
              value={newStudentForm.course}
              onChange={(e) => handleCourseChange(e.target.value)}
              required
            >
              <option value="">Select Course *</option>
              {courses.map(course => (
                <option key={course.id || course.title} value={course.title || course}>
                  {course.title || course}
                </option>
              ))}
            </select>
            <select
              value={newStudentForm.batchId}
              onChange={(e) => setNewStudentForm({...newStudentForm, batchId: e.target.value})}
              required
              disabled={!newStudentForm.course}
            >
              <option value="">
                {newStudentForm.course ? 'Select Batch *' : 'Select Course First'}
              </option>
              {availableBatches.map(batch => (
                <option key={batch.id || batch._id} value={batch.id || batch._id}>
                  {batch.name}
                </option>
              ))}
            </select>
            <select
              value={newStudentForm.status}
              onChange={(e) => setNewStudentForm({...newStudentForm, status: e.target.value})}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="on-leave">On Leave</option>
            </select>
          </div>

          <div className="modal-actions">
            <button
              className="btn-secondary"
              onClick={() => setShowAddStudentModal(false)}
            >
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={handleAddNewStudent}
            >
              Add Student
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}

    {/* Toast Notifications - Rendered via portal for proper stacking */}
    {createPortal(<ToastContainer />, document.body)}
    </>
  );
};

export default BatchDetailsPage;
