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
import MeetLiveClassesPanel from './MeetLiveClassesPanel';
import TeacherAttendanceHub from './TeacherAttendanceHub';
import TeacherAvailabilityPanel from './TeacherAvailabilityPanel';
import { formatDateForComponent } from '../utils/dateUtils';
import './Dashboard.css';
import './MeetLiveClasses.css';
import { getApiBaseUrl } from '../utils/apiBase';

const TeacherDashboard = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeSection, setActiveSection] = useState('overview');
  const [isAvailable, setIsAvailable] = useState(false);
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
      }
    } catch (err) {
      console.warn('Failed to load availability', err);
    }
  };

  const toggleAvailability = async () => {
    if (availabilitySaving) return;
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
      showToast(
        data.isAvailable ? 'Marked available for admins' : 'Marked unavailable for admins',
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
    <div className="dashboard ss-shell">
      <header className="ss-shell-header">
        <div className="ss-shell-header__row">
          <div className="ss-shell-brand">
            <h1 className="ss-shell-brand__name">Sky States LMS</h1>
            <p className="ss-shell-brand__role">Teacher</p>
          </div>
          <div className="ss-shell-actions">
            <label
              className={`ss-toggle ${isAvailable ? 'is-on' : ''}`}
              title="Visible to admins only — students do not see this"
            >
              <input
                type="checkbox"
                checked={isAvailable}
                disabled={availabilitySaving}
                onChange={toggleAvailability}
              />
              <span className="ss-toggle__track" aria-hidden="true" />
              <span className="ss-toggle__label">
                {availabilitySaving ? 'Saving…' : isAvailable ? 'Available' : 'Unavailable'}
              </span>
            </label>
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
            className={`ss-shell-nav__btn ${activeSection === 'attendance' ? 'is-active' : ''}`}
            onClick={() => setActiveSection('attendance')}
          >
            Attendance
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
            className={`ss-shell-nav__btn ${activeSection === 'availability' ? 'is-active' : ''}`}
            onClick={() => setActiveSection('availability')}
          >
            Availability
          </button>
          <button
            type="button"
            className={`ss-shell-nav__btn ${activeSection === 'messages' ? 'is-active' : ''}`}
            onClick={() => setActiveSection('messages')}
          >
            Messages
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
            className={`ss-shell-nav__btn ${activeSection === 'meet' ? 'is-active' : ''}`}
            onClick={() => setActiveSection('meet')}
          >
            Live class
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
            <p className="ss-page-sub">
              Run cohort sessions, track attendance, and keep materials current. Your availability
              toggle is for <strong>admins only</strong> — currently{' '}
              <strong>{isAvailable ? 'Available' : 'Unavailable'}</strong>.
            </p>

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
                <div className="ss-stat__label">Lectures</div>
              </div>
              <div className="ss-stat">
                <div className="ss-stat__value">{isAvailable ? 'On' : 'Off'}</div>
                <div className="ss-stat__label">Admin availability</div>
              </div>
            </div>

            <div className="ss-panel">
              <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.05rem' }}>Quick actions</h2>
              <div className="ss-cta-row">
                <button type="button" className="ss-shell-btn ss-shell-btn--primary" onClick={() => setActiveSection('courses')}>
                  Open batches
                </button>
                <button type="button" className="ss-shell-btn" onClick={() => setActiveSection('attendance')}>
                  Attendance
                </button>
                <button type="button" className="ss-shell-btn" onClick={() => setActiveSection('meet')}>
                  Live class
                </button>
                <button type="button" className="ss-shell-btn" onClick={() => setActiveSection('availability')}>
                  Weekly windows
                </button>
              </div>
            </div>

            {batches.length === 0 ? (
              <div className="ss-panel" style={{ marginTop: '1rem' }}>
                <h2 style={{ margin: '0 0 0.35rem', fontSize: '1.05rem' }}>Getting started</h2>
                <p className="ss-page-sub" style={{ margin: 0 }}>
                  No batches assigned yet. Once an admin adds you to a cohort, they will appear under
                  Batches — then you can schedule Meet sessions and upload Classroom materials.
                </p>
              </div>
            ) : (
              <div className="ss-panel" style={{ marginTop: '1rem' }}>
                <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.05rem' }}>Your batches</h2>
                <ul style={{ margin: 0, paddingLeft: '1.1rem', lineHeight: 1.6 }}>
                  {batches.slice(0, 6).map((b) => (
                    <li key={String(b.id || b._id)}>
                      <strong>{b.name || 'Batch'}</strong>
                      {b.course ? ` · ${b.course}` : ''}
                      {b.schedule?.days
                        ? ` · ${b.schedule.days}${b.schedule?.time ? ` @ ${b.schedule.time}` : ''}`
                        : ''}
                    </li>
                  ))}
                </ul>
                {batches.length > 6 && (
                  <button
                    type="button"
                    className="ss-shell-btn"
                    style={{ marginTop: '0.75rem' }}
                    onClick={() => setActiveSection('courses')}
                  >
                    View all {batches.length}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {activeSection === 'attendance' && (
          <div className="dashboard-section">
            <TeacherAttendanceHub />
          </div>
        )}

        {activeSection === 'availability' && (
          <div className="dashboard-section">
            <TeacherAvailabilityPanel />
          </div>
        )}

        {activeSection === 'meet' && (
          <div className="dashboard-section">
            <div className="ss-panel">
              <MeetLiveClassesPanel
                batches={batches.map((b) => ({
                  id: String(b.id || b._id),
                  name: `${b.name || 'Batch'}${b.course ? ` · ${b.course}` : ''}`
                }))}
                title="Live class studio"
              />
            </div>
          </div>
        )}


        {activeSection === 'courses' && (
          <div className="dashboard-section teacher-batches-pro">
            <div className="teacher-batches-pro__head">
              <div>
                <h1 className="ss-page-title">My batches</h1>
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
                        <th>Batch</th>
                        <th>Program</th>
                        <th>Type</th>
                        <th>Students</th>
                        <th>Started</th>
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
                        return (
                          <tr key={batch.id || batch._id}>
                            <td>
                              <button
                                type="button"
                                className="teacher-batches-pro__link"
                                onClick={() => handleViewBatchDetail(batch)}
                              >
                                {batch.name}
                              </button>
                            </td>
                            <td>{batch.programLabel || batch.course || '—'}</td>
                            <td>
                              <span className={`teacher-batches-pro__type teacher-batches-pro__type--${isProjectBatch(batch) ? 'project' : isOneToOneBatch(batch) ? 'oto' : 'regular'}`}>
                                {typeLabel}
                              </span>
                            </td>
                            <td>{batch.studentCount || batch.students?.length || 0}</td>
                            <td>{batch.startDate ? formatDate(batch.startDate) : '—'}</td>
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
                                  onClick={() => handleViewBatchDetail(batch)}
                                >
                                  Workspace
                                </button>
                                <button
                                  type="button"
                                  className="ss-shell-btn"
                                  onClick={() =>
                                    navigate(`/teacher/batch/${batch.id || batch._id}`, {
                                      state: { from: 'teacher-batches', activeView: 'meet' }
                                    })
                                  }
                                >
                                  Sessions
                                </button>
                                <button
                                  type="button"
                                  className="ss-shell-btn"
                                  onClick={() =>
                                    navigate(`/teacher/batch/${batch.id || batch._id}`, {
                                      state: { from: 'teacher-batches', activeView: 'attendance' }
                                    })
                                  }
                                >
                                  Attendance
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
                placeholder="Search by name or enrollment…"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                aria-label="Filter students by name"
              />
              <select
                className="form-input-modern"
                value={studentCourseFilter}
                onChange={(e) => setStudentCourseFilter(e.target.value)}
                aria-label="Filter by course"
              >
                <option value="all">All courses</option>
                {studentCourseOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                className="form-input-modern"
                value={studentBatchFilter}
                onChange={(e) => setStudentBatchFilter(e.target.value)}
                aria-label="Filter by batch"
              >
                <option value="all">All batches</option>
                {studentBatchOptions.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              {(studentSearch || studentCourseFilter !== 'all' || studentBatchFilter !== 'all') && (
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => {
                    setStudentSearch('');
                    setStudentCourseFilter('all');
                    setStudentBatchFilter('all');
                  }}
                >
                  Clear
                </button>
              )}
              <span className="stat-item">
                <span className="stat-number">{filteredTeacherStudents.length}</span>
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
                    {filteredTeacherStudents.map((student) => (
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
                {teacherStudents.length > 0 && filteredTeacherStudents.length === 0 && (
                  <p className="no-data">No students match these filters.</p>
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

        {activeSection === 'messages' && (
          <div className="dashboard-section">
            <h1 className="ss-page-title">Messages</h1>
            <p className="ss-page-sub">
              Chat with students assigned to your batches. Availability in the header is for admins only — students do not see it.
            </p>
            <DirectChatPanel role="teacher" currentUserId={String(user?.id || user?._id || '')} />
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