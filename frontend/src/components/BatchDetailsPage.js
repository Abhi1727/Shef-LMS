import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { ToastContainer, showToast } from './Toast';
import { YouTubeUtils } from '../utils/youtubeUtils';
import CustomVideoPlayer from './CustomVideoPlayer';
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

const BatchDetailsPage = () => {
  const navigate = useNavigate();
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
  const [studentFormData, setStudentFormData] = useState({
    name: '',
    email: '',
    batchId: '',
    course: '',
    status: 'active',
    phone: '',
    address: ''
  }); // 'videos' or 'students'

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
      const videosResponse = await fetch(`${apiUrl}/api/admin/classroom`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (videosResponse.ok) {
        const allVideos = await videosResponse.json();
        
        // Filter videos to show only those belonging to this batch (normalize IDs)
        const norm = (v) => (v != null && v !== '' ? String(v).trim() : '');
        const batchIdNorm = norm(batchId) || norm(foundBatch?.id || foundBatch?._id);
        const batchVideos = allVideos.filter(video => {
          if (norm(video.batchId) === batchIdNorm) return true;
          // Legacy: videos without batchId match by course
          if (!norm(video.batchId) && foundBatch) {
            const vidCourse = video.course || video.courseId || '';
            const batchCourse = foundBatch.course || '';
            if (norm(vidCourse) && norm(vidCourse) === norm(batchCourse)) return true;
          }
          return false;
        });
        
        console.log('🔍 BatchDetails Debug - Videos for batch:', {
          batchId,
          batchName: foundBatch?.name,
          totalVideos: allVideos.length,
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
    // Go back to the previous page instead of always forcing /admin
    navigate(-1);
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
    setShowStudentDetailsModal(true);
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

  const handleEditVideo = (video) => {
    // Set the video being edited
    setEditingVideo(video);
    
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

  if (loading) {
    return (
      <div className="batch-details-page">
        <div className="loading">Loading batch details...</div>
      </div>
    );
  }

  if (!selectedBatch) {
    return (
      <div className="batch-details-page">
        <div className="error">Batch not found</div>
      </div>
    );
  }

  const selectedBatchId = selectedBatch?.id || selectedBatch?._id;
  const normId = (v) => (v != null && v !== '' ? String(v).trim() : '');
  const selectedBatchIdNorm = normId(selectedBatchId);

  // Filter videos for this batch and sort by newest first
  const batchVideos = classroomVideos
    .filter(video => {
      if (!selectedBatchIdNorm) return false;
      if (normId(video.batchId) === selectedBatchIdNorm) return true;
      // Legacy: videos without batchId fall back to course match
      if (!normId(video.batchId)) {
        return normId(video.courseId || video.course) === normId(selectedBatch?.course);
      }
      return false;
    })
    .sort((a, b) => {
      // Sort by date (newest first)
      const dateA = new Date(a.date || a.createdAt || 0);
      const dateB = new Date(b.date || b.createdAt || 0);
      return dateB - dateA;
    });

  // Filter students by batchId for consistency with Dashboard
  const batchStudents = students.filter(student => normId(student.batchId) === selectedBatchIdNorm);

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
    <div className="batch-details-page">
      
      {/* Header */}
      <div className="batch-header">
        <button onClick={handleBackToAdmin} className="btn-back">
          ← Back to Admin
        </button>
        <div className="batch-info">
          <h1>{selectedBatch.name}</h1>
          <div className="batch-meta">
            <span className="course-badge">{selectedBatch.course}</span>
            <span className={`status-badge ${selectedBatch.status}`}>
              {selectedBatch.status}
            </span>
            <span className="teacher-info">Teacher: {selectedBatch.teacherName || 'N/A'}</span>
          </div>
        </div>

          <div className="batch-timing-panel">
          <div className="batch-timing-text">
            <span className="label">Batch Timing (IST):</span>
            <span className="value">
              {selectedBatch.schedule && (selectedBatch.schedule.days || selectedBatch.schedule.time)
                ? `${selectedBatch.schedule.days || ''} ${selectedBatch.schedule.time || ''}`.trim()
                : 'No timing set yet'}
            </span>
          </div>
          {isAdmin && (
            <button
              className="btn-add-timing"
              onClick={() => {
                const parsedRange = parseIstRangeToTimeInputs(scheduleForm.time);
                setTimeRange(parsedRange);
                setShowScheduleModal(true);
              }}
            >
              ⏰ {selectedBatch.schedule ? 'Edit Timing (IST)' : 'Add Timing (IST)'}
            </button>
          )}
        </div>
      </div>

      {/* Horizontal Menu - After Header */}
      <div className="horizontal-menu">
        <h3>Batch Options</h3>
        <div className="menu-items-horizontal">
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
                              <span className="value">{new Date(video.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
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
                  <small>Click "Add Video to Batch" to upload a new lecture for this batch.</small>
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
                        <th>Batch</th>
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
                          <td>{student.batchId || 'N/A'}</td>
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
              }}
            >
              ×
            </button>
          </div>

          <div className="modal-content">
            <p className="modal-subtitle">Paste a YouTube video URL to add it for this batch only.</p>

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
            
            <div className="notes-section">
              <label className="notes-label">
                <input
                  type="checkbox"
                  checked={videoFormData.notesAvailable}
                  onChange={(e) => setVideoFormData({ ...videoFormData, notesAvailable: e.target.checked, notesFile: e.target.checked ? null : null })}
                />
                Notes Available
              </label>
              
              {videoFormData.notesAvailable && (
                <div className="notes-file-input">
                  <label className="file-input-label">
                    Select Notes File:
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.txt,.ppt,.pptx"
                      onChange={(e) => setVideoFormData({ ...videoFormData, notesFile: e.target.files[0] })}
                      className="file-input"
                    />
                  </label>
                  {videoFormData.notesFile && (
                    <div className="selected-file">
                      Selected: {videoFormData.notesFile.name}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="modal-actions">
            <button
              className="btn-cancel"
              onClick={() => {
                setShowAddVideoModal(false);
                setVideoFormData({ title: '', youtubeVideoUrl: '', description: '', date: '', time: '', notesAvailable: false, notesFile: null });
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
                  const isAlreadyInBatch = student.batchId === selectedBatchId;
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
      <div className="modal-overlay" onClick={() => setShowStudentDetailsModal(false)}>
        <div className="modal student-details-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>👤 Student Details</h3>
            <button className="modal-close" onClick={() => setShowStudentDetailsModal(false)}>×</button>
          </div>
          
          <div className="modal-content student-details-content">
            <div className="student-details-grid">
              <div className="detail-section">
                <h4>📝 Personal Information</h4>
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

              <div className="detail-section">
                <h4>🎓 Academic Information</h4>
                <div className="detail-item">
                  <label>Batch Name:</label>
                  <span>{selectedBatch?.name || 'N/A'}</span>
                </div>
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
              </div>
            </div>
            
            <div className="modal-actions">
              <button
                className="btn-primary"
                onClick={() => setShowStudentDetailsModal(false)}
              >
                Close
              </button>
            </div>
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
