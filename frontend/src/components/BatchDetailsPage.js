import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { ToastContainer, showToast } from './Toast';
import { YouTubeUtils } from '../utils/youtubeUtils';
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
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState('videos');
  const [editingStudent, setEditingStudent] = useState(null);
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [showAddStudentsModal, setShowAddStudentsModal] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [showAddVideoModal, setShowAddVideoModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({ days: '', time: '' });
  const [timeRange, setTimeRange] = useState({ start: '', end: '' });
  const [isAdmin, setIsAdmin] = useState(false);
  const [addStudentsSearch, setAddStudentsSearch] = useState('');
  const [videoFormData, setVideoFormData] = useState({
    title: '',
    youtubeVideoUrl: '',
    description: ''
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

  // Load batch data
  const loadBatchData = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';

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
          setSelectedBatch(batch);
          if (batch.schedule) {
            const days = batch.schedule.days || '';
            const time = batch.schedule.time || '';
            setScheduleForm({ days, time });
            const parsedRange = parseIstRangeToTimeInputs(time);
            setTimeRange(parsedRange);
          }
          console.log('Found batch:', batch);
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
        const videos = await videosResponse.json();
        setClassroomVideos(videos);
      }

      // Load students
      const studentsResponse = await fetch(`${apiUrl}/api/admin/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (studentsResponse.ok) {
        const allUsers = await studentsResponse.json();
        const studentUsers = allUsers.filter(user => user.role === 'student');
        setStudents(studentUsers);
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
  }, [loadBatchData]);

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
      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
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
      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
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
      const { title, youtubeVideoUrl, description } = videoFormData;
      if (!title || !youtubeVideoUrl) {
        showToast('Please fill in all required fields (Title, YouTube URL)', 'warning');
        return;
      }

      const videoId = YouTubeUtils.extractVideoId(youtubeVideoUrl);
      if (!videoId) {
        showToast('Invalid YouTube URL. Please use a valid YouTube video URL.', 'error');
        return;
      }

      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
      const batchIdForApi = selectedBatch?.id || selectedBatch?._id;

      const lectureData = {
        title,
        instructor: 'Admin',
        description: description || '',
        courseId: selectedBatch?.course,
        batchId: batchIdForApi,
        type: 'Lecture',
        videoSource: 'youtube-url',
        youtubeVideoId: videoId,
        youtubeVideoUrl,
        youtubeEmbedUrl: YouTubeUtils.getEmbedUrl(videoId)
      };

      const response = await fetch(`${apiUrl}/api/admin/classroom/youtube-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(lectureData)
      });

      const data = await response.json();

      if (response.ok) {
        showToast('YouTube video added successfully!', 'success');

        // Optimistically update classroom videos list for this page
        setClassroomVideos(prev => [{ id: data.lecture.id, ...data.lecture }, ...prev]);

        setShowAddVideoModal(false);
        setVideoFormData({ title: '', youtubeVideoUrl: '', description: '' });
      } else {
        showToast('Error: ' + (data.message || 'Failed to save YouTube video'), 'error');
      }
    } catch (error) {
      console.error('Error saving classroom video:', error);
      showToast('Failed to save YouTube video. Please try again.', 'error');
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
        const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';

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

  // Filter videos for this batch and sort by newest first
  const batchVideos = classroomVideos
    .filter(video => {
      return video.batchId === selectedBatch?.id || 
             video.batchId === selectedBatch?._id ||
             video.courseId === selectedBatch?.course;
    })
    .sort((a, b) => {
      // Sort by date (newest first)
      const dateA = new Date(a.date || a.createdAt || 0);
      const dateB = new Date(b.date || b.createdAt || 0);
      return dateB - dateA;
    });

  // Filter students strictly by batch assignment
  const selectedBatchId = selectedBatch?.id || selectedBatch?._id;
  const batchStudents = students.filter(student => student.batchId === selectedBatchId);

  // Students list for "Add Students" modal with search by name/email
  const searchTerm = addStudentsSearch.trim().toLowerCase();
  const studentsForAddModal = students.filter(student => {
    // Only show students whose course matches this batch's course
    if (selectedBatch?.course && student.course !== selectedBatch.course) {
      return false;
    }

    if (!searchTerm) return true;
    const name = (student.name || '').toLowerCase();
    const email = (student.email || '').toLowerCase();
    return name.includes(searchTerm) || email.includes(searchTerm);
  });

  return (
    <>
    <div className="batch-details-page">
      <ToastContainer />
      
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

      <div className="batch-content">
        {/* Side Menu */}
        <div className="side-menu">
          <h3>Batch Options</h3>
          <div className="menu-items">
            <button 
              className={`menu-item ${activeView === 'videos' ? 'active' : ''}`}
              onClick={() => handleViewChange('videos')}
            >
              📹 Videos ({batchVideos.length})
            </button>
            <button 
              className={`menu-item ${activeView === 'students' ? 'active' : ''}`}
              onClick={() => handleViewChange('students')}
            >
              👥 Students ({batchStudents.length})
            </button>
          </div>
        </div>

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
                      onClick={() => window.open(video.videoUrl || video.youtubeVideoUrl || `https://drive.google.com/file/d/${video.driveId}/view`, '_blank')}
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
                      <div className="video-info">
                        <div className="video-title">{video.title}</div>
                        
                        <div className="video-meta">
                          <span className="meta-item">
                            <span className="label">👨‍🏫 Teacher:</span>
                            <span className="value">{selectedBatch.teacherName || video.instructor}</span>
                          </span>
                          <span className="meta-item">
                            <span className="label">📅 Date:</span>
                            <span className="value">{new Date(video.date).toLocaleDateString()}</span>
                          </span>
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
                <button
                  className="btn-add"
                  onClick={() => setShowAddStudentsModal(true)}
                >
                  ➕ Add Students to Batch
                </button>
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
                        <tr key={student.id}>
                          <td>{student.name}</td>
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
                              onClick={() => handleDeleteStudent(student)}
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

    {showAddVideoModal && createPortal(
      <div className="modal-overlay" onClick={() => {
        setShowAddVideoModal(false);
        setVideoFormData({ title: '', youtubeVideoUrl: '', description: '' });
      }}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>Add Video to {selectedBatch.name}</h3>
            <button
              className="modal-close"
              onClick={() => {
                setShowAddVideoModal(false);
                setVideoFormData({ title: '', youtubeVideoUrl: '', description: '' });
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
            <textarea
              placeholder="Description (optional)"
              rows="3"
              value={videoFormData.description}
              onChange={(e) => setVideoFormData({ ...videoFormData, description: e.target.value })}
            />
          </div>

          <div className="modal-actions">
            <button
              className="btn-cancel"
              onClick={() => {
                setShowAddVideoModal(false);
                setVideoFormData({ title: '', youtubeVideoUrl: '', description: '' });
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
    </>
  );
};

export default BatchDetailsPage;
