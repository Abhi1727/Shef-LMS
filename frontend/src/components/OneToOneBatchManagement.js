import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { oneToOneBatchService } from '../services/oneToOneBatchService';
import { showToast } from './Toast';
import './BatchDetailsPage.css';

// Helper function to extract YouTube video ID from different URL formats
const getYouTubeVideoId = (url) => {
  if (!url) return null;
  
  // Handle youtube.com/watch?v= format
  if (url.includes('youtube.com/watch?v=')) {
    return url.split('v=')[1]?.split('&')[0];
  }
  
  // Handle youtu.be format
  if (url.includes('youtu.be/')) {
    return url.split('youtu.be/')[1]?.split('?')[0];
  }
  
  // Handle youtube.com/embed/ format
  if (url.includes('youtube.com/embed/')) {
    return url.split('youtube.com/embed/')[1]?.split('?')[0];
  }
  
  return null;
};

const OneToOneBatchManagement = () => {
  const { batchId } = useParams();
  const navigate = useNavigate();
  
  console.log('🔄 OneToOneBatchManagement component loaded - UPDATED WITH TWO BUTTONS');
  
  const [batch, setBatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Student selection state
  const [studentMode, setStudentMode] = useState('existing'); // 'existing' or 'new'
  const [students, setStudents] = useState([]);
  const [searchStudent, setSearchStudent] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [studentsLoading, setStudentsLoading] = useState(false);
  
  // New student form state
  const [newStudent, setNewStudent] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    address: '',
    course: '',
    batchId: '',
    status: 'active'
  });
  const [newStudentLoading, setNewStudentLoading] = useState(false);
  
  // Courses and batches for new student form
  const [courses, setCourses] = useState([]);
  const [allBatches, setAllBatches] = useState([]);
  const [availableBatches, setAvailableBatches] = useState([]);
  
  // Video management state
  const [videos, setVideos] = useState([]);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoTitle, setVideoTitle] = useState('');
  const [videoDescription, setVideoDescription] = useState('');
  const [classDate, setClassDate] = useState('');
  const [classTime, setClassTime] = useState('');
  const [videoLoading, setVideoLoading] = useState(false);
  const [showAddVideo, setShowAddVideo] = useState(false);
  const [showStudentAssignment, setShowStudentAssignment] = useState(false);

  // View management state (like BatchDetailsPage)
  const [activeView, setActiveView] = useState('videos'); // 'videos' or 'students'
  
  // Video editing state
  const [editingVideo, setEditingVideo] = useState(null);
  const [editingVideoIndex, setEditingVideoIndex] = useState(null);

  // Student details modal state
  const [showStudentDetailsModal, setShowStudentDetailsModal] = useState(false);
  const [selectedStudentDetails, setSelectedStudentDetails] = useState(null);
  
  // Student editing state
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [studentFormData, setStudentFormData] = useState({
    name: '',
    email: '',
    batchId: '',
    course: '',
    status: 'active',
    phone: '',
    address: ''
  });
  
  // Load assigned student details
  const loadAssignedStudentDetails = async () => {
    if (batch?.studentId) {
      try {
        const token = localStorage.getItem('token');
        const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
        
        const response = await fetch(`${apiUrl}/api/admin/users/${batch.studentId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
          const studentData = await response.json();
          setBatch(prev => ({
            ...prev,
            studentDetails: studentData
          }));
        }
      } catch (error) {
        console.error('Error loading student details:', error);
      }
    }
  };

  useEffect(() => {
    loadBatchDetails();
    loadUnassignedStudents();
    loadCoursesAndBatches();
  }, [batchId]);

  useEffect(() => {
    if (batch?.studentId && !batch.studentDetails) {
      loadAssignedStudentDetails();
    }
  }, [batch]);

  // Force modal to take full width
  useEffect(() => {
    if (showStudentAssignment) {
      // Force modal width via DOM manipulation
      const modalElements = document.querySelectorAll('.add-students-modal');
      modalElements.forEach(modal => {
        modal.style.setProperty('max-width', 'calc(100vw - 40px)', 'important');
        modal.style.setProperty('width', 'calc(100vw - 40px)', 'important');
        modal.style.setProperty('margin', '0', 'important');
        modal.style.setProperty('position', 'relative', 'important');
        modal.style.setProperty('transform', 'none', 'important');
        modal.style.setProperty('left', 'auto', 'important');
      });
    }
  }, [showStudentAssignment]);

  // Load students when student assignment modal opens
  useEffect(() => {
    if (showStudentAssignment) {
      setSelectedStudentIds([]);
      loadUnassignedStudents();
    }
  }, [showStudentAssignment]);

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
    setNewStudent(prev => ({ ...prev, batchId: '' }));
  };

  // Handle course change in add student form
  const handleCourseChange = (courseName) => {
    setNewStudent(prev => ({ ...prev, course: courseName, batchId: '' }));
    filterBatchesByCourse(courseName);
  };

  // Update new student form when batch changes
  useEffect(() => {
    if (batch) {
      setNewStudent(prev => ({
        ...prev,
        course: batch.courseTitle || '',
        batchId: batch.id || batch._id || ''
      }));
      // Filter batches for the current batch's course
      if (batch.courseTitle) {
        filterBatchesByCourse(batch.courseTitle);
      }
    }
  }, [batch]);

  const loadBatchDetails = async () => {
    setLoading(true);
    try {
      const response = await oneToOneBatchService.getBatchById(batchId);
      if (response.success) {
        setBatch(response.batch);
        setVideos(response.batch.videos || []);
      } else {
        setError('Failed to load batch details');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadUnassignedStudents = async () => {
    setStudentsLoading(true);
    try {
      console.log('Loading unassigned students for batch:', batchId);
      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
      
      if (!token) {
        showToast('Please login to load students', 'error');
        return;
      }
      
      const studentsResponse = await fetch(`${apiUrl}/api/admin/users`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (studentsResponse.ok) {
        const allUsers = await studentsResponse.json();
        const allStudents = allUsers.filter(user => user.role === 'student');
        console.log('All students loaded:', allStudents.length);
        
        // Filter students for this batch - same logic as BatchDetailsPage
        const filteredStudents = allStudents.filter(student => {
          // Use either course or courseTitle - whichever is available
          const batchCourseName = batch?.courseTitle || batch?.course;
          
          // Only show students whose course matches this batch's course
          if (batchCourseName) {
            const batchCourseLower = batchCourseName.toLowerCase();
            const studentCourseLower = (student.course || '').toLowerCase();
            
            // Skip students with no course or "N/A" course
            if (!student.course || 
                student.course === 'undefined' || 
                student.course === undefined ||
                student.course.toLowerCase() === 'n/a' || 
                student.course.trim() === '') {
              return false;
            }
            
            // Handle different course name variations - more strict matching
            const isCyberSecurityCourse = batchCourseLower.includes('cyber') || batchCourseLower.includes('security') || batchCourseLower.includes('cs&eh');
            const studentIsCyberSecurityCourse = studentCourseLower.includes('cyber') || studentCourseLower.includes('security') || studentCourseLower.includes('cs&eh');
            
            const isDataScienceCourse = batchCourseLower.includes('data') || batchCourseLower.includes('science') || batchCourseLower.includes('ai');
            const studentIsDataScienceCourse = studentCourseLower.includes('data') || studentCourseLower.includes('science') || studentCourseLower.includes('ai');
            
            // More strict course matching - must match the same category
            const courseMatch = ((isCyberSecurityCourse && studentIsCyberSecurityCourse) || 
                               (isDataScienceCourse && studentIsDataScienceCourse) ||
                               batchCourseLower === studentCourseLower);
            
            if (!courseMatch) {
              return false;
            }
          }
          
          // Only show unassigned students (no batchId or null/undefined/empty batchId)
          const hasBatch = student.batchId && String(student.batchId).trim() !== '' && 
                          String(student.batchId).trim() !== 'null' && 
                          String(student.batchId).trim() !== 'undefined';
          
          if (hasBatch) {
            return false;
          }
          
          return true;
        });
        
        console.log('Filtered students for batch:', filteredStudents.length);
        setStudents(filteredStudents);
      } else {
        console.error('Failed to load students:', studentsResponse.status);
        showToast('Error loading students', 'error');
      }
    } catch (error) {
      console.error('Error loading students:', error);
      showToast('Error loading students', 'error');
    } finally {
      setStudentsLoading(false);
    }
  };

  const toggleStudentSelection = (studentId) => {
    setSelectedStudentIds(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const handleAssignStudent = async () => {
    if (selectedStudentIds.length === 0) {
      showToast('Please select at least one student', 'warning');
      return;
    }
    
    setAssignmentLoading(true);
    try {
      // For one-to-one batches, we only assign the first selected student
      const firstStudentId = selectedStudentIds[0];
      const selectedStudent = students.find(s => s.id === firstStudentId);
      
      if (!selectedStudent) {
        showToast('Selected student not found', 'error');
        return;
      }

      const response = await oneToOneBatchService.updateStudent(batchId, {
        studentId: selectedStudent.id,
        studentName: selectedStudent.name,
        studentEmail: selectedStudent.email
      });
      
      if (response.success) {
        showToast('Student assigned successfully', 'success');
        setBatch(prev => ({
          ...prev,
          studentId: selectedStudent.id,
          studentName: selectedStudent.name,
          studentEmail: selectedStudent.email
        }));
        setSelectedStudentIds([]);
        setSearchStudent('');
        loadUnassignedStudents(); // Refresh the unassigned students list
        setShowStudentAssignment(false); // Close modal
      } else {
        showToast('Failed to assign student', 'error');
      }
    } catch (error) {
      showToast('Error assigning student', 'error');
    } finally {
      setAssignmentLoading(false);
    }
  };

  const handleCreateAndAssignStudent = async (e) => {
    e.preventDefault();
    
    if (!newStudent.name || !newStudent.email || !newStudent.password || !newStudent.course) {
      showToast('Name, email, password, and course are required', 'error');
      return;
    }
    
    setNewStudentLoading(true);
    try {
      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
      
      // First create the student
      const createResponse = await fetch(`${apiUrl}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newStudent.name,
          email: newStudent.email,
          password: newStudent.password,
          phone: newStudent.phone,
          address: newStudent.address,
          course: newStudent.course,
          batchId: newStudent.batchId,
          status: newStudent.status,
          role: 'student'
        })
      });
      
      if (createResponse.ok) {
        const studentData = await createResponse.json();
        
        // Then assign the student to the batch
        const assignResponse = await oneToOneBatchService.updateStudent(batchId, {
          studentId: studentData.user.id,
          studentName: studentData.user.name,
          studentEmail: studentData.user.email
        });
        
        if (assignResponse.success) {
          showToast('New student created and assigned successfully', 'success');
          setBatch(prev => ({
            ...prev,
            studentId: studentData.user.id,
            studentName: studentData.user.name,
            studentEmail: studentData.user.email
          }));
          
          // Reset form
          setNewStudent({
            name: '',
            email: '',
            password: '',
            phone: '',
            address: '',
            course: batch.courseTitle || '',
            batchId: batch.id || batch._id || '',
            status: 'active'
          });
          setStudentMode('existing');
        } else {
          showToast('Student created but failed to assign to batch', 'error');
        }
      } else {
        const errorData = await createResponse.json();
        showToast(errorData.message || 'Failed to create student', 'error');
      }
    } catch (error) {
      showToast('Error creating student', 'error');
    } finally {
      setNewStudentLoading(false);
    }
  };

  const handleAddVideo = async (e) => {
    e.preventDefault();
    
    if (!videoTitle.trim() || !videoUrl.trim() || !classDate.trim()) {
      showToast('Please fill in all required fields (Title, YouTube URL, Class Date)', 'warning');
      return;
    }

    // Validate YouTube URL
    const videoId = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/);
    if (!videoId) {
      showToast('Invalid YouTube URL. Please use a valid YouTube video URL.', 'error');
      return;
    }
    
    setVideoLoading(true);
    try {
      const videoData = {
        url: videoUrl.trim(),
        title: videoTitle.trim() || 'Untitled Video',
        description: videoDescription.trim(),
        classDate: classDate.trim(),
        classTime: classTime.trim(),
        addedAt: new Date().toISOString()
      };
      
      const response = await oneToOneBatchService.addVideo(batchId, videoData);
      
      if (response.success) {
        showToast('Video added successfully', 'success');
        setVideos(prev => [...prev, videoData]);
        setVideoUrl('');
        setVideoTitle('');
        setVideoDescription('');
        setClassDate('');
        setClassTime('');
        setShowAddVideo(false);
      } else {
        showToast('Failed to add video', 'error');
      }
    } catch (error) {
      showToast('Error adding video', 'error');
    }
  };

  const handleViewChange = (view) => {
    setActiveView(view);
  };

  const handleEditVideo = (video, index) => {
    console.log('Editing video:', video);
    console.log('Video index:', index);
    console.log('Video ID:', video.id);
    console.log('Video _id:', video._id);
    setEditingVideo(video);
    setEditingVideoIndex(index);
    setVideoTitle(video.title);
    setVideoUrl(video.url);
    setVideoDescription(video.description || '');
    setClassDate(video.classDate || '');
    setClassTime(video.classTime || '');
    setShowAddVideo(true);
  };

  const handleDeleteBatch = async () => {
    if (!window.confirm(`Are you sure you want to delete the batch "${batch.name}"? This action cannot be undone and will remove all batch data including videos and student assignments.`)) {
      return;
    }
    
    try {
      const response = await oneToOneBatchService.deleteBatch(batchId);
      
      if (response.success) {
        showToast('Batch deleted successfully', 'success');
        navigate('/admin'); // Navigate back to admin dashboard
      } else {
        showToast('Failed to delete batch', 'error');
      }
    } catch (error) {
      showToast('Error deleting batch', 'error');
    }
  };

  const handleRemoveStudent = async () => {
    if (!batch.studentId) return;
    
    if (!window.confirm(`Remove "${batch.studentName}" from this batch? The student will remain in the system but will no longer be assigned to this batch.`)) {
      return;
    }
    
    try {
      const response = await oneToOneBatchService.removeStudent(batchId);
      
      if (response.success) {
        showToast('Student removed from batch successfully', 'success');
        setBatch(prev => ({
          ...prev,
          studentId: null,
          studentName: null,
          studentEmail: null
        }));
        loadUnassignedStudents(); // Refresh the unassigned students list
      } else {
        showToast('Failed to remove student', 'error');
      }
    } catch (error) {
      showToast('Error removing student', 'error');
    }
  };

  const handleDeleteVideo = async (video, index) => {
    try {
      console.log('Deleting video:', video);
      console.log('Video index:', index);
      
      // Use the correct ID field - try both id and _id
      const videoIdentifier = video._id || video.id;
      
      let response;
      if (videoIdentifier) {
        // Delete by video ID if available
        response = await oneToOneBatchService.deleteVideo(batchId, videoIdentifier);
      } else {
        // Delete by index if no ID
        response = await oneToOneBatchService.removeVideo(batchId, index);
      }
      
      if (response.success) {
        showToast('Video removed successfully', 'success');
        // Remove video from local state
        setVideos(prev => prev.filter((_, i) => i !== index));
      } else {
        showToast('Failed to remove video: ' + (response.message || 'Unknown error'), 'error');
      }
    } catch (error) {
      console.error('Delete video error:', error);
      showToast('Error removing video: ' + error.message, 'error');
    }
  };

  const handleViewStudentDetails = (student) => {
    // If we have student details from batch, use them
    if (batch.studentDetails) {
      setSelectedStudentDetails(batch.studentDetails);
    } else {
      // Create student object from batch data
      setSelectedStudentDetails({
        id: batch.studentId,
        name: batch.studentName,
        email: batch.studentEmail,
        course: batch.courseTitle,
        batchId: batch.id || batch._id,
        status: 'active',
        phone: '',
        address: ''
      });
    }
    setShowStudentDetailsModal(true);
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

  const handleSaveStudent = async () => {
    try {
      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';

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
        
        // Update batch student data if it's the assigned student
        if (batch.studentId === editingStudent.id) {
          setBatch(prev => ({
            ...prev,
            studentName: updateData.name,
            studentEmail: updateData.email,
            studentDetails: { ...prev.studentDetails, ...updateData }
          }));
        }
        
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

  const handleUpdateVideo = async (e) => {
    e.preventDefault();
    console.log('handleUpdateVideo called!');
    console.log('editingVideo:', editingVideo);
    console.log('batchId:', batchId);
    
    if (!videoTitle.trim() || !videoUrl.trim() || !classDate.trim()) {
      showToast('Please fill in all required fields (Title, YouTube URL, Class Date)', 'warning');
      return;
    }

    // Validate YouTube URL
    const videoId = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/);
    if (!videoId) {
      showToast('Invalid YouTube URL. Please use a valid YouTube video URL.', 'error');
      return;
    }
    
    try {
      console.log('Starting video update...');
      setVideoLoading(true);
      const videoData = {
        title: videoTitle.trim(),
        url: videoUrl.trim(),
        description: videoDescription.trim(),
        classDate: classDate.trim(),
        classTime: classTime.trim(),
      };
      
      // Use the correct ID field - try both id and _id
      const videoIdentifier = editingVideo._id || editingVideo.id;
      console.log('Using video ID:', videoIdentifier);
      console.log('Updating video:', videoIdentifier, videoData);
      
      const response = await oneToOneBatchService.updateVideo(batchId, videoIdentifier, videoData);
      console.log('Update response:', response);
    
      if (response.success) {
        showToast('Video updated successfully', 'success');
        // Update the video in the local state using the index for precision
        if (editingVideoIndex !== null) {
          setVideos(prev => {
            const newVideos = [...prev];
            newVideos[editingVideoIndex] = { ...newVideos[editingVideoIndex], ...videoData };
            return newVideos;
          });
        }
        // Reset form
        setVideoUrl('');
        setVideoTitle('');
        setVideoDescription('');
        setClassDate('');
        setClassTime('');
        setEditingVideo(null);
        setEditingVideoIndex(null);
        setShowAddVideo(false);
      } else {
        showToast('Failed to update video: ' + (response.message || 'Unknown error'), 'error');
      }
    } catch (error) {
      console.error('Update video error:', error);
      showToast('Error updating video: ' + error.message, 'error');
    } finally {
      setVideoLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="batch-management-loading">
        <div className="loader"></div>
        <p>Loading batch details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="batch-management-error">
        <h3>Error loading batch</h3>
        <p>{error}</p>
        <button onClick={() => navigate('/admin')} className="back-btn">
          ← Back to Admin
        </button>
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="batch-management-error">
        <h3>Batch not found</h3>
        <button onClick={() => navigate('/admin')} className="back-btn">
          ← Back to Admin
        </button>
      </div>
    );
  }

  return (
    <div className="batch-details-page">
      {/* Header */}
      <div className="batch-header">
        <button onClick={() => navigate('/admin')} className="btn-back">
          ← Back to Admin
        </button>
        <div className="batch-info">
          <h1>{batch.name}</h1>
          <div className="batch-meta">
            <span className="course-badge">{batch.courseTitle}</span>
            <span className={`status-badge ${batch.status}`}>
              {batch.status}
            </span>
            <span className="teacher-info">Teacher: {batch.teacherName || 'N/A'}</span>
            <button 
              className="btn-delete-batch"
              onClick={handleDeleteBatch}
              title="Delete Batch"
            >
              🗑️ Delete Batch
            </button>
          </div>
        </div>

        <div className="batch-timing-panel">
          <div className="batch-timing-text">
            <span className="label">Batch Timing (IST):</span>
            <span className="value">
              {batch.schedule && (batch.schedule.days || batch.schedule.time)
                ? `${batch.schedule.days || ''} ${batch.schedule.time || ''}`.trim()
                : 'No timing set yet'}
            </span>
          </div>
          <button
            className="btn-add-timing"
            onClick={() => {
              // Add timing functionality here if needed
            }}
          >
            ⏰ {batch.schedule ? 'Edit Timing (IST)' : 'Add Timing (IST)'}
          </button>
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
            📹 Videos ({videos.length})
          </button>
          <button 
            className={`menu-item-horizontal ${activeView === 'students' ? 'active' : ''}`}
            onClick={() => handleViewChange('students')}
          >
            👥 Student ({batch.studentId ? '1' : '0'})
          </button>
        </div>
      </div>

      <div className="batch-content">
        {/* Main Content */}
        <div className="main-content">
          {activeView === 'videos' && (
            <div className="videos-view">
              <div className="videos-header">
                <h2>📹 Videos in {batch.name}</h2>
                <button
                  className="btn-add"
                  onClick={() => setShowAddVideo(true)}
                >
                  ➕ Add Video to Batch
                </button>
              </div>
              {videos.length > 0 ? (
                <div className="video-grid">
                  {[...videos].sort((a, b) => {
                    // Sort by class date (newest first) for one-to-one videos
                    const dateA = a.classDate ? new Date(a.classDate.split('-').reverse().join('-')) : new Date(a.addedAt || 0);
                    const dateB = b.classDate ? new Date(b.classDate.split('-').reverse().join('-')) : new Date(b.addedAt || 0);
                    return dateB - dateA; // Newest class date first
                  }).map((video, index) => (
                    <div 
                      key={index} 
                      className="video-card"
                    >
                      <div className="video-thumbnail" style={{ position: 'relative', overflow: 'hidden' }}>
                        {/* Debug: Log video URL */}
                        {console.log('🔍 Video URL Debug:', { 
                          url: video.url, 
                          includesYouTube: video.url?.includes('youtube.com'),
                          includesYouTubeWatch: video.url?.includes('youtube.com/watch?v='),
                          includesYoutuBe: video.url?.includes('youtu.be'),
                          videoId: getYouTubeVideoId(video.url)
                        })}
                        
                        {video.url && (video.url.includes('youtube.com/watch?v=') || video.url.includes('youtu.be')) ? (
                          <img 
                            src={`https://img.youtube.com/vi/${getYouTubeVideoId(video.url)}/mqdefault.jpg`}
                            alt={video.title}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover'
                            }}
                            onError={(e) => {
                              console.log('🔍 Thumbnail error:', e);
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                            onLoad={() => {
                              console.log('🔍 Thumbnail loaded successfully');
                            }}
                          />
                        ) : null}
                        
                        <div style={{
                          display: video.url && (video.url.includes('youtube.com/watch?v=') || video.url.includes('youtu.be')) ? 'none' : 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          height: '100%',
                          fontSize: '24px'
                        }}>
                          {video.url && (video.url.includes('youtube.com/watch?v=') || video.url.includes('youtu.be')) ? '📺' : '📹'}
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
                              <span className="value">{batch.teacherName || video.instructor || 'N/A'}</span>
                            </span>
                            <span className="meta-item">
                              <span className="label">📅 Class Date:</span>
                              <span className="value">{video.classDate ? video.classDate : new Date(video.addedAt || video.date || video.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                            </span>
                          </div>
                          {video.description && (
                            <div className="video-description">{video.description}</div>
                          )}
                        </div>
                        <div className="video-actions">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation(); // Prevent video play
                              handleEditVideo(video, index);
                            }}
                            className="btn-edit"
                            title="Edit Video"
                          >
                            ✏️ Edit
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation(); // Prevent video play
                              if (window.confirm(`Remove "${video.title}" from this batch?`)) {
                                handleDeleteVideo(video, index);
                              }
                            }}
                            className="btn-delete"
                            title="Remove Video from Batch"
                          >
                            🗑️ Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-data">
                  <p>📹 No videos found for this batch</p>
                  <small>Click "Add Video to Batch" to add lectures.</small>
                </div>
              )}
            </div>
          )}
          
          {activeView === 'students' && (
            <div className="students-view">
              <div className="students-header">
                <h2>👥 Students in {batch.name}</h2>
                {!batch.studentId && (
                  <div className="student-buttons">
                    {/* Commented out: Add New Student button */}
                    {/* <button
                      className="btn-primary"
                      onClick={() => {
                        setStudentMode('new');
                        setShowStudentAssignment(true);
                      }}
                    >
                      ➕ Add Student
                    </button> */}
                    <button
                      className="btn-secondary"
                      onClick={() => {
                        setStudentMode('existing');
                        setShowStudentAssignment(true);
                      }}
                    >
                      👥 Add Existing Student
                    </button>
                  </div>
                )}
              </div>
              
              {batch.studentId ? (
                <div className="student-card">
                  <div className="student-info">
                    <div 
                      className="student-name clickable-student"
                      onClick={() => handleViewStudentDetails(batch.studentDetails || {
                        id: batch.studentId,
                        name: batch.studentName,
                        email: batch.studentEmail,
                        course: batch.courseTitle,
                        batchId: batch.id || batch._id,
                        status: 'active',
                        phone: batch.studentDetails?.phone || '',
                        address: batch.studentDetails?.address || ''
                      })}
                    >
                      {batch.studentName}
                    </div>
                    <div className="student-email">{batch.studentEmail}</div>
                    <div className="student-course">📚 {batch.courseTitle}</div>
                  </div>
                  <div className="student-actions">
                    <button 
                      className="btn-edit"
                      onClick={() => handleEditStudent(batch.studentDetails || {
                        id: batch.studentId,
                        name: batch.studentName,
                        email: batch.studentEmail,
                        course: batch.courseTitle,
                        batchId: batch.id || batch._id,
                        status: 'active',
                        phone: batch.studentDetails?.phone || '',
                        address: batch.studentDetails?.address || ''
                      })}
                      title="Edit Student"
                    >
                      ✏️ Edit
                    </button>
                    <button 
                      className="btn-delete"
                      onClick={handleRemoveStudent}
                      title="Remove Student from Batch"
                    >
                      🗑️ Remove
                    </button>
                  </div>
                </div>
              ) : (
                <div className="no-data">
                  <p>👥 No student assigned to this batch</p>
                  <small>Click "Add Student" to assign a student to this batch.</small>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add Video Modal */}
      {showAddVideo && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{editingVideo ? 'Edit Video' : 'Add Video'}</h3>
              <button onClick={() => {
                setShowAddVideo(false);
                setEditingVideo(null);
                setEditingVideoIndex(null);
                // Reset form
                setVideoUrl('');
                setVideoTitle('');
                setVideoDescription('');
                setClassDate('');
                setClassTime('');
              }} className="close-btn">×</button>
            </div>
            <form onSubmit={editingVideo ? handleUpdateVideo : handleAddVideo} className="video-form">
              <p className="modal-subtitle">Paste a YouTube video URL to add it for this batch only. Each video can only be added once per batch.</p>

              <input
                type="text"
                placeholder="Video Title *"
                value={videoTitle}
                onChange={(e) => setVideoTitle(e.target.value)}
                required
              />
              <input
                type="text"
                placeholder="YouTube Video URL *"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                required
              />
              <input
                type="date"
                placeholder="Class Date *"
                value={classDate}
                onChange={(e) => setClassDate(e.target.value)}
                required
                style={{ marginBottom: '15px' }}
              />
              <input
                type="text"
                placeholder="Class Time (e.g., 7:00 PM)"
                value={classTime || ''}
                onChange={(e) => setClassTime(e.target.value)}
                style={{ marginBottom: '15px' }}
                title="Optional: Use batch timing or enter custom time"
              />
              <small style={{color: '#888', fontSize: '12px', display: 'block', marginBottom: '15px'}}>
                * Required fields. Class time will be displayed with the video.
              </small>
              <textarea
                placeholder="Description (optional)"
                rows="3"
                value={videoDescription}
                onChange={(e) => setVideoDescription(e.target.value)}
              />
              <div className="form-actions">
                <button type="button" onClick={() => setShowAddVideo(false)} className="cancel-btn">
                  Cancel
                </button>
                <button type="submit" disabled={videoLoading} className="submit-btn">
                  {videoLoading ? (editingVideo ? 'Updating...' : 'Adding...') : (editingVideo ? 'Update Video' : 'Add Video')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Student Assignment Modal */}
      {showStudentAssignment && (
        <div className="modal-overlay" onClick={() => {
          setShowStudentAssignment(false);
          setSelectedStudentIds([]);
        }}>
          <div className="modal add-students-modal" style={{
          maxWidth: 'calc(100vw - 40px) !important',
          width: 'calc(100vw - 40px) !important',
          margin: '0 !important',
          position: 'relative !important',
          transform: 'none !important',
          left: 'auto !important'
        }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Students to {batch.name}</h3>
              <button
                className="modal-close"
                onClick={() => {
                  setShowStudentAssignment(false);
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
                value={searchStudent}
                onChange={(e) => setSearchStudent(e.target.value)}
              />

              <div className="students-table-container add-students-table-container">
                {studentsLoading ? (
                  <div className="loading-state">
                    <div className="loader"></div>
                    <p>Loading students...</p>
                  </div>
                ) : students.length > 0 ? (
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
                      {students
                        .filter(student => 
                          student.name.toLowerCase().includes(searchStudent.toLowerCase()) ||
                          student.email.toLowerCase().includes(searchStudent.toLowerCase())
                        )
                        .map(student => {
                          const isAlreadyInBatch = student.batchId === (batch.id || batch._id);
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
                ) : (
                  <div className="no-students-found">
                    <div className="no-students-icon">👥</div>
                    <h4>No unassigned students found</h4>
                    <p>
                      {batch?.courseTitle 
                        ? `Make sure students are enrolled in "${batch.courseTitle}" and not already assigned to other batches.`
                        : 'Students must match the batch course and be unassigned.'
                      }
                    </p>
                    <small>Try refreshing the student list or check if students need to be created first.</small>
                    <button 
                      type="button" 
                      onClick={loadUnassignedStudents}
                      className="retry-btn"
                      disabled={studentsLoading}
                    >
                      {studentsLoading ? 'Loading...' : 'Retry Loading Students'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-actions">
              <button
                className="btn-secondary"
                onClick={() => {
                  setShowStudentAssignment(false);
                  setSelectedStudentIds([]);
                }}
                disabled={assignmentLoading}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleAssignStudent}
                disabled={selectedStudentIds.length === 0 || assignmentLoading}
              >
                {assignmentLoading ? 'Assigning...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    
      {/* Student Details Modal */}
      {showStudentDetailsModal && selectedStudentDetails && (
        <div className="modal-overlay" onClick={() => setShowStudentDetailsModal(false)}>
          <div className="modal student-details-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Student Details</h3>
              <button className="modal-close" onClick={() => setShowStudentDetailsModal(false)}>
                ×
              </button>
            </div>
            <div className="student-details-content">
              <div className="student-details-grid">
                <div className="detail-section">
                  <h4>Personal Information</h4>
                  <div className="detail-item">
                    <label>Name:</label>
                    <span>{selectedStudentDetails.name}</span>
                  </div>
                  <div className="detail-item">
                    <label>Email:</label>
                    <span>{selectedStudentDetails.email}</span>
                  </div>
                  <div className="detail-item">
                    <label>Phone:</label>
                    <span>{selectedStudentDetails.phone || 'Not provided'}</span>
                  </div>
                  <div className="detail-item">
                    <label>Address:</label>
                    <span>{selectedStudentDetails.address || 'Not provided'}</span>
                  </div>
                </div>
                <div className="detail-section">
                  <h4>Academic Information</h4>
                  <div className="detail-item">
                    <label>Course:</label>
                    <span>{selectedStudentDetails.course}</span>
                  </div>
                  <div className="detail-item">
                    <label>Batch:</label>
                    <span>{batch.name}</span>
                  </div>
                  <div className="detail-item">
                    <label>Status:</label>
                    <span className={`status-badge ${selectedStudentDetails.status}`}>
                      {selectedStudentDetails.status}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button
                className="btn-secondary"
                onClick={() => setShowStudentDetailsModal(false)}
              >
                Close
              </button>
              <button
                className="btn-primary"
                onClick={() => {
                  setShowStudentDetailsModal(false);
                  handleEditStudent(selectedStudentDetails);
                }}
              >
                Edit Student
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Student Modal */}
      {showStudentModal && editingStudent && (
        <div className="modal-overlay" onClick={() => setShowStudentModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Student</h3>
              <button className="modal-close" onClick={() => setShowStudentModal(false)}>
                ×
              </button>
            </div>
            <div className="modal-content">
              <form onSubmit={(e) => {
                e.preventDefault();
                handleSaveStudent();
              }}>
                <div className="form-row">
                  <div className="form-group">
                    <label>Name *</label>
                    <input
                      type="text"
                      value={studentFormData.name}
                      onChange={(e) => setStudentFormData(prev => ({ ...prev, name: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Email *</label>
                    <input
                      type="email"
                      value={studentFormData.email}
                      onChange={(e) => setStudentFormData(prev => ({ ...prev, email: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Phone</label>
                    <input
                      type="tel"
                      value={studentFormData.phone}
                      onChange={(e) => setStudentFormData(prev => ({ ...prev, phone: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label>Status</label>
                    <select
                      value={studentFormData.status}
                      onChange={(e) => setStudentFormData(prev => ({ ...prev, status: e.target.value }))}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>Address</label>
                  <textarea
                    rows="3"
                    value={studentFormData.address}
                    onChange={(e) => setStudentFormData(prev => ({ ...prev, address: e.target.value }))}
                  />
                </div>
                <div className="modal-actions">
                  <button type="button" className="btn-cancel" onClick={() => setShowStudentModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-save">
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OneToOneBatchManagement;
