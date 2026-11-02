import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { ToastContainer, showToast } from './Toast';
import axios from 'axios';
import AssessmentStudio from './AssessmentStudio';
import ChangePasswordPanel from './ChangePasswordPanel';
import AccountMenu from './AccountMenu';
import SkyLoadingScreen from './SkyLoadingScreen';
import DirectChatPanel from './DirectChatPanel';
import ResponsiveShellNav from './ResponsiveShellNav';
import { TimeZoneCalculator } from './TimeZoneTools';
import TeacherAvailabilityPanel from './TeacherAvailabilityPanel';
import { formatDateForComponent } from '../utils/dateUtils';
import { liveJoinUrl } from '../utils/liveJoinUrl';
import { openLiveClassSession } from '../utils/openLiveClassSession';
import './Dashboard.css';
import './MeetLiveClasses.css';
import { getApiBaseUrl } from '../utils/apiBase';

const TEACHER_NAV_ITEMS = [
  { id: 'courses', label: 'My batches' },
  { id: 'messages', label: 'Messages' },
  { id: 'assessment-studio', label: 'Assessments' }
];

const LEGACY_TEACHER_SECTIONS = new Set([
  'overview',
  'attendance',
  'students',
  'availability',
  'lectures',
  'meet',
  'batches'
]);

const TeacherDashboard = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeSection, setActiveSection] = useState('courses');
  const [isAvailable, setIsAvailable] = useState(false);
  const [inClass, setInClass] = useState(false);
  const [liveClassTitle, setLiveClassTitle] = useState('');
  const [availabilitySaving, setAvailabilitySaving] = useState(false);
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
  const [studentCourseFilter, setStudentCourseFilter] = useState('all');
  const [studentBatchFilter, setStudentBatchFilter] = useState('all');
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
    const sec = location.state?.activeSection;
    if (!sec) return;
    if (sec === 'account') {
      setActiveSection('account');
      return;
    }
    if (LEGACY_TEACHER_SECTIONS.has(sec)) {
      setActiveSection('courses');
      return;
    }
    if (TEACHER_NAV_ITEMS.some((item) => item.id === sec)) {
      setActiveSection(sec);
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

  const isOneToOneBatch = (batch) => {
    if (!batch) return false;
    if (batch.batchType === 'one-to-one') return true;
    const course = (batch.course || '').toLowerCase();
    return course.includes('one-to-one') || course === 'one to one';
  };

  const isProjectBatch = (batch) => Boolean(batch && batch.batchType === 'project');

  // Filter batches based on search and filters
  const filteredTeacherStudents = React.useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    return teacherStudents.filter((s) => {
      if (studentCourseFilter !== 'all') {
        const course = String(s.course || '').toLowerCase();
        if (course !== String(studentCourseFilter).toLowerCase()) return false;
      }
      if (studentBatchFilter !== 'all') {
        const bid = String(s.batchId || '');
        const bname = String(s.batchName || '').toLowerCase();
        if (bid !== String(studentBatchFilter) && bname !== String(studentBatchFilter).toLowerCase()) {
          return false;
        }
      }
      if (!q) return true;
      return [s.name, s.enrollmentNumber]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [teacherStudents, studentSearch, studentCourseFilter, studentBatchFilter]);

  const studentCourseOptions = React.useMemo(() => {
    const set = new Set();
    teacherStudents.forEach((s) => {
      if (s.course) set.add(String(s.course));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [teacherStudents]);

  const studentBatchOptions = React.useMemo(() => {
    const map = new Map();
    teacherStudents.forEach((s) => {
      const id = String(s.batchId || s.batchName || '');
      if (!id) return;
      if (!map.has(id)) {
        map.set(id, s.batchName || s.batchId || id);
      }
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [teacherStudents]);

  // Filter batches based on search and filters
  const filteredBatches = React.useMemo(() => {
    let filtered = batches;

    // Apply search filter
    if (batchSearch.trim()) {
      filtered = filtered.filter(batch => 
        batch.name?.toLowerCase().includes(batchSearch.toLowerCase()) ||
        batch.course?.toLowerCase().includes(batchSearch.toLowerCase()) ||
        (batch.programLabel || '').toLowerCase().includes(batchSearch.toLowerCase())
      );
    }
    
    // Apply course / type filter (use batchType for 1:1 and project)
    if (courseFilter !== 'all') {
      filtered = filtered.filter(batch => {
        if (courseFilter === 'one-to-one') {
          return isOneToOneBatch(batch);
        }
        if (courseFilter === 'project') {
          return isProjectBatch(batch);
        }

        // Program chips: exclude private class types so they only show under their own chips
        if (isOneToOneBatch(batch) || isProjectBatch(batch)) {
          return false;
        }

        const course = (batch.course || batch.programLabel || '').toLowerCase();
        if (courseFilter === 'data-science') {
          return course.includes('data science') || course.includes('ds&ai');
        }
        if (courseFilter === 'cyber-security') {
          return course.includes('cyber') || course.includes('security') || course.includes('cs&eh');
        }
        if (courseFilter === 'devops-ai') {
          return course.includes('devops') && course.includes('ai');
        }
        if (courseFilter === 'devops-cloud') {
          return course.includes('devops') && course.includes('cloud');
        }
        if (courseFilter === 'agentic-ai') {
          return course.includes('agentic');
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

  const formatBatchSchedule = (batch) => {
    const s = batch?.schedule;
    if (!s) return '—';
    const days = Array.isArray(s.days) ? s.days.join(', ') : s.days || '';
    const time = s.time || '';
    return [days, time].filter(Boolean).join(' · ') || '—';
  };

  const formatBatchCandidates = (batch) => {
    const list = batch?.studentsList || batch?.students || [];
    if (!list.length) return 'No candidates';
    return list.map((s) => s.name || 'Student').filter(Boolean).join(', ');
  };

  const [startingBatchId, setStartingBatchId] = useState('');

  const handleStartClassForBatch = async (batch) => {
    const batchId = batch?.id || batch?._id;
    if (!batchId) return;
    try {
      setStartingBatchId(String(batchId));
      const token = localStorage.getItem('token');
      const apiUrl = getApiBaseUrl();
      const title = `${batch.name || 'Class'} · ${new Date().toLocaleDateString('en-GB')}`;
      const res = await fetch(`${apiUrl}/api/meetings`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title,
          batchId: String(batchId),
          startNow: true,
          duration: '60',
          timezone: 'Asia/Kolkata'
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to start class');
      const meeting = data.meeting || data;
      const link = liveJoinUrl(meeting, { host: true }) ||
        liveJoinUrl(data.meetLink || data.startUrl, { host: true });
      const provider = meeting.conferenceProvider || 'meet';
      if (provider === 'zoom' && meeting.id) {
        openLiveClassSession({
          meetingId: meeting.id,
          joinUrl: link,
          embedded: Boolean(data.embedded && data.sdk),
          conferenceProvider: 'zoom',
          host: true,
          joinPayload: data.embedded && data.sdk ? data : null,
          preferWorkspace: true
        });
      } else if (link) {
        window.open(link, '_blank', 'noopener,noreferrer');
      }
      showToast(
        data.reusedRunningSession || data.jointSessions?.length
          ? data.message
          : provider === 'zoom'
            ? 'Class started — opening Zoom Workspace…'
            : 'Class scheduled and started. Students can join from LMS.',
        'success'
      );
      setActiveSection('live');
    } catch (err) {
      showToast(err.message || 'Failed to start class', 'error');
    } finally {
      setStartingBatchId('');
    }
  };

  const getApiUrl = () => getApiBaseUrl();

  const loadAvailability = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${getApiUrl()}/api/teacher/availability`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setIsAvailable(Boolean(data.isAvailable));
        setInClass(Boolean(data.inClass));
        setLiveClassTitle(data.liveClass?.title || '');
      }
    } catch (err) {
      console.warn('Failed to load availability', err);
    }
  };

  const toggleAvailability = async () => {
    if (availabilitySaving || inClass) return;
    setAvailabilitySaving(true);
    const next = !isAvailable;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${getApiUrl()}/api/teacher/availability`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isAvailable: next })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.message || 'Could not update availability', 'error');
        return;
      }
      setIsAvailable(Boolean(data.isAvailable));
      setInClass(Boolean(data.inClass));
      setLiveClassTitle(data.liveClass?.title || '');
      showToast(
        data.inClass
          ? `In class${data.liveClass?.title ? `: ${data.liveClass.title}` : ''}`
          : data.isAvailable
            ? 'Marked available for admins'
            : 'Marked unavailable for admins',
        'success'
      );
    } catch (err) {
      showToast('Could not update availability', 'error');
    } finally {
      setAvailabilitySaving(false);
    }
  };

  useEffect(() => {
    loadAvailability();
    // No polling — availability toggle is optional; load once per dashboard visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    return formatDateForComponent(dateString);
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
      <SkyLoadingScreen
        message="Loading teacher dashboard"
        subtext={loadingState || 'Preparing your Sky States workspace'}
      />
    );
  }

  return (
    <div className="dashboard ss-shell teacher-dashboard">
      <header className="ss-shell-header">
        <div className="ss-shell-header__row">
          <div className="ss-shell-brand">
            <h1 className="ss-shell-brand__name">Sky States LMS</h1>
            <p className="ss-shell-brand__role">Teacher</p>
          </div>
          <div className="ss-shell-actions">
            <label
              className={`ss-toggle ${inClass ? 'is-class' : isAvailable ? 'is-on' : ''}`}
              title={
                inClass
                  ? `In class now${liveClassTitle ? ` · ${liveClassTitle}` : ''}. Admins see this automatically while Meet is live.`
                  : 'Live status for admins. Turn on when you are free. Students do not see this.'
              }
            >
              <input
                type="checkbox"
                checked={inClass || isAvailable}
                disabled={availabilitySaving || inClass}
                onChange={toggleAvailability}
              />
              <span className="ss-toggle__track" aria-hidden="true" />
              <span className="ss-toggle__label">
                {availabilitySaving
                  ? 'Saving…'
                  : inClass
                    ? 'In class'
                    : isAvailable
                      ? 'Available'
                      : 'Unavailable'}
              </span>
            </label>
            <AccountMenu
              user={user}
              onLogout={onLogout}
              onOpenAccount={() => setActiveSection('account')}
            />
          </div>
        </div>
        <ResponsiveShellNav
          items={TEACHER_NAV_ITEMS}
          activeId={TEACHER_NAV_ITEMS.some((item) => item.id === activeSection) ? activeSection : ''}
          onSelect={(id) => setActiveSection(id)}
          ariaLabel="Teacher"
        />
      </header>

      <div className="ss-shell-main">
        {activeSection === 'courses' && (
          <div className="dashboard-section teacher-batches-pro">
            <div className="teacher-home-bar ss-panel">
              <div className="teacher-home-bar__main">
                <h1 className="ss-page-title">Welcome back, {user?.name?.split(' ')[0] || 'Trainer'}</h1>
                <p className="ss-page-sub" style={{ margin: 0 }}>
                  Open a batch to run Zoom, manage classroom lectures, students, attendance, and
                  materials — everything lives in one workspace per batch.
                </p>
              </div>
              <div className="teacher-home-bar__chips" aria-label="Summary">
                <span className="teacher-home-chip">{batches.length} batches</span>
                <span className="teacher-home-chip">
                  {batches.reduce((n, b) => n + (b.students?.length || b.studentCount || 0), 0)}{' '}
                  students
                </span>
                <span className={`teacher-home-chip${inClass ? ' is-live' : ''}`}>
                  {inClass
                    ? `Live now${liveClassTitle ? ` · ${liveClassTitle}` : ''}`
                    : isAvailable
                      ? 'Available (admins)'
                      : 'Away'}
                </span>
              </div>
            </div>

            <div className="teacher-batches-pro__head">
              <div>
                <h2 className="teacher-batches-pro__title">Your batches</h2>
                <p className="ss-page-sub">
                  Showing {filteredBatches.length} of {batches.length} batch{batches.length === 1 ? '' : 'es'}
                </p>
              </div>
              {(batchSearch || courseFilter !== 'all' || statusFilter !== 'all') && (
                <button type="button" className="ss-shell-btn" onClick={clearFilters}>
                  Clear filters
                </button>
              )}
            </div>

            <div className="ss-panel teacher-batches-pro__filters">
              <div className="teacher-batches-pro__search">
                <input
                  type="search"
                  placeholder="Search batches by name or course..."
                  value={batchSearch}
                  onChange={(e) => setBatchSearch(e.target.value)}
                  className="teacher-batches-pro__search-input"
                />
              </div>

              <div className="teacher-batches-pro__filter-row">
                <span className="teacher-batches-pro__filter-label">Program</span>
                <div className="teacher-batches-pro__chips">
                  {[
                    { id: 'all', label: 'All' },
                    { id: 'data-science', label: 'Data Science' },
                    { id: 'cyber-security', label: 'Cyber Security' },
                    { id: 'devops-ai', label: 'DevOps & AI' },
                    { id: 'devops-cloud', label: 'DevOps & Cloud' },
                    { id: 'agentic-ai', label: 'Agentic AI' },
                    { id: 'one-to-one', label: 'One-to-One' },
                    { id: 'project', label: 'Project Class' }
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      className={`teacher-batches-pro__chip ${courseFilter === opt.id ? 'is-active' : ''}`}
                      onClick={() => setCourseFilter(opt.id)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="teacher-batches-pro__filter-row">
                <span className="teacher-batches-pro__filter-label">Status</span>
                <div className="teacher-batches-pro__chips">
                  {[
                    { id: 'all', label: 'All' },
                    { id: 'active', label: 'Active' },
                    { id: 'completed', label: 'Completed' }
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      className={`teacher-batches-pro__chip ${statusFilter === opt.id ? 'is-active' : ''}`}
                      onClick={() => setStatusFilter(opt.id)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="ss-panel teacher-batches-pro__table-wrap">
              {filteredBatches.length > 0 ? (
                <div className="teacher-batches-pro__table-scroll">
                  <table className="teacher-batches-pro__table">
                    <thead>
                      <tr>
                        <th>
                          {courseFilter === 'one-to-one' || courseFilter === 'project'
                            ? 'Candidates'
                            : 'Batch'}
                        </th>
                        <th>Program</th>
                        <th>Schedule</th>
                        <th>Type</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredBatches.map((batch) => {
                        const typeLabel = isProjectBatch(batch)
                          ? 'Project Class'
                          : isOneToOneBatch(batch)
                            ? 'One-to-One'
                            : 'Regular';
                        const status = (batch.status || 'active').toLowerCase();
                        const special = isProjectBatch(batch) || isOneToOneBatch(batch);
                        return (
                          <tr key={batch.id || batch._id}>
                            <td>
                              {special ? (
                                <div>
                                  <button
                                    type="button"
                                    className="teacher-batches-pro__link"
                                    onClick={() => handleViewBatchDetail(batch)}
                                  >
                                    {formatBatchCandidates(batch)}
                                  </button>
                                  <div className="ss-page-sub" style={{ marginTop: 2 }}>
                                    {batch.name}
                                  </div>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  className="teacher-batches-pro__link"
                                  onClick={() => handleViewBatchDetail(batch)}
                                >
                                  {batch.name}
                                </button>
                              )}
                            </td>
                            <td>{batch.programLabel || batch.course || '—'}</td>
                            <td>{formatBatchSchedule(batch)}</td>
                            <td>
                              <span className={`teacher-batches-pro__type teacher-batches-pro__type--${isProjectBatch(batch) ? 'project' : isOneToOneBatch(batch) ? 'oto' : 'regular'}`}>
                                {typeLabel}
                              </span>
                            </td>
                            <td>
                              <span className={`teacher-batches-pro__status teacher-batches-pro__status--${status}`}>
                                {status.charAt(0).toUpperCase() + status.slice(1)}
                              </span>
                            </td>
                            <td>
                              <div className="ss-cta-row" style={{ flexWrap: 'wrap', gap: '0.35rem' }}>
                                <button
                                  type="button"
                                  className="ss-shell-btn ss-shell-btn--primary"
                                  disabled={startingBatchId === String(batch.id || batch._id)}
                                  onClick={() => handleStartClassForBatch(batch)}
                                >
                                  {startingBatchId === String(batch.id || batch._id)
                                    ? 'Starting…'
                                    : 'Start class'}
                                </button>
                                <button
                                  type="button"
                                  className="ss-shell-btn"
                                  onClick={() => handleViewBatchDetail(batch)}
                                >
                                  Open batch
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="teacher-batches-pro__empty">
                  <h3>No batches found</h3>
                  <p>
                    {batchSearch || courseFilter !== 'all' || statusFilter !== 'all'
                      ? 'Try adjusting your search or filters.'
                      : 'No batches are assigned to you yet.'}
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
            <details className="tz-calc-wrap">
              <summary>Time zone calculator: check a student's local time</summary>
              <TimeZoneCalculator defaultFromZone="Asia/Kolkata" />
            </details>
          </div>
        )}

        {activeSection === 'assessment-studio' && (
          <div className="dashboard-section">
            <AssessmentStudio user={user} />
          </div>
        )}

        {activeSection === 'messages' && (
          <div className="dashboard-section">
            <h1 className="ss-page-title">Messages</h1>
            <p className="ss-page-sub">
              Chat with students assigned to your batches. Conversations are grouped by batch.
            </p>
            <DirectChatPanel
              role="teacher"
              currentUserId={String(user?.id || user?._id || '')}
              groupByBatch
            />
          </div>
        )}

        {activeSection === 'account' && (
          <div className="dashboard-section">
            <h1 className="ss-page-title">My account</h1>
            <p className="ss-page-sub">
              Signed in as {user?.email}. Availability in the header is for admins only.
            </p>
            <div className="ss-panel" style={{ maxWidth: 520, marginBottom: '1.25rem' }}>
              <p><strong>Name:</strong> {user?.name || '—'}</p>
              <p><strong>Email:</strong> {user?.email || '—'}</p>
              <p><strong>Role:</strong> {user?.role || 'teacher'}</p>
              <ChangePasswordPanel mode="change" defaultEmail={user?.email || ''} />
            </div>
            <div className="ss-panel">
              <h2 style={{ margin: '0 0 0.35rem', fontSize: '1.05rem' }}>Weekly availability</h2>
              <p className="ss-page-sub" style={{ marginTop: 0 }}>
                Set when you are generally free. Students do not see this — only admins.
              </p>
              <TeacherAvailabilityPanel />
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