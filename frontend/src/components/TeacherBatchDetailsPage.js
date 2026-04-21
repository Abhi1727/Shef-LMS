import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { YouTubeUtils } from '../utils/youtubeUtils';
import { formatDateForComponent, formatDateTimeDisplay } from '../utils/dateUtils';
import CustomVideoPlayer from './CustomVideoPlayer';
import './BatchDetailsPage.css';

const TeacherBatchDetailsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { batchId } = useParams();
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [classroomVideos, setClassroomVideos] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState('videos');
  const [showStudentDetailsModal, setShowStudentDetailsModal] = useState(false);
  const [selectedStudentDetails, setSelectedStudentDetails] = useState(null);
  
  // Enhanced student profile modal state
  const [activeProfileTab, setActiveProfileTab] = useState('profile');
  const [studentActivities, setStudentActivities] = useState([]);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [videoSearch, setVideoSearch] = useState('');
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [editingVideo, setEditingVideo] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ title: '', description: '' });
  const [uploadingNotes, setUploadingNotes] = useState(false);
  const [notesFile, setNotesFile] = useState(null);
  const [isHeaderExpanded, setIsHeaderExpanded] = useState(false);

  const loadBatchData = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost'
        ? 'http://localhost:5000'
        : '';

      let batchData = null;
      let studentsData = [];
      let videosData = [];

      // Get batch details using teacher endpoint first
      const batchResponse = await fetch(`${apiUrl}/api/teacher/batches/${batchId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (batchResponse.ok) {
        const data = await batchResponse.json();
        batchData = data.batch || data;
        console.log('Found batch via teacher endpoint:', batchData);
      } else {
        // Fallback to admin endpoint for batch details
        console.log('Teacher endpoint failed, using admin endpoint fallback...');
        const adminBatchResponse = await fetch(`${apiUrl}/api/batches/${batchId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (adminBatchResponse.ok) {
          const adminData = await adminBatchResponse.json();
          batchData = adminData.batch || adminData;
          console.log('Found batch via admin endpoint:', batchData);
        } else {
          console.error('Batch not found or access denied via both endpoints');
          alert('Batch not found or you do not have permission to view it.');
          navigate('/teacher');
          return;
        }
      }

      // Get students using the improved /api/batches/:id/students endpoint
      const studentsResponse = await fetch(`${apiUrl}/api/batches/${batchId}/students`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (studentsResponse.ok) {
        const data = await studentsResponse.json();
        studentsData = data.students || [];
        console.log('Batch students:', studentsData.length);
      } else {
        console.error('Failed to fetch students');
        studentsData = [];
      }

      // Get videos using teacher classroom endpoint
      const videosResponse = await fetch(`${apiUrl}/api/teacher/classroom/${batchId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (videosResponse.ok) {
        const data = await videosResponse.json();
        videosData = data.lectures || [];
        console.log('Teacher batch videos:', videosData.length);
      } else {
        // Fallback to admin endpoint for videos
        const adminVideosResponse = await fetch(`${apiUrl}/api/admin/classroom?batchId=${batchId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (adminVideosResponse.ok) {
          const videos = await adminVideosResponse.json();
          videosData = videos || [];
          console.log('Admin batch videos:', videosData.length);
        }
      }

      // Set the data
      setSelectedBatch(batchData);
      setStudents(studentsData);
      setClassroomVideos(videosData);

    } catch (error) {
      console.error('Error loading batch data:', error);
      alert('Error loading batch data. Please try again.');
      navigate('/teacher');
    } finally {
      setLoading(false);
    }
  }, [batchId, navigate]);

  useEffect(() => {
    loadBatchData();
  }, [loadBatchData]);

  const handleBackToTeacher = () => {
    // Check if we have navigation state indicating where we came from
    const from = location.state?.from;
    
    if (from === 'teacher-batches') {
      // Navigate back to teacher dashboard batches section
      navigate('/teacher', { state: { activeSection: 'batches' } });
    } else {
      // Fallback to teacher dashboard
      navigate('/teacher');
    }
  };

  const handleViewChange = (view) => {
    setActiveView(view);
  };

  const handleViewStudentDetails = (student) => {
    setSelectedStudentDetails(student);
    setActiveProfileTab('profile');
    setShowStudentDetailsModal(true);
    
    // Load initial activity data
    loadStudentActivity(student._id || student.id);
  };

  // Load student activity data
  const loadStudentActivity = async (studentId) => {
    setLoadingActivity(true);
    try {
      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
      
      const response = await fetch(`${apiUrl}/api/admin/activity/${studentId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setStudentActivities(data.activities || []);
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

  // Video source detection utility
  const detectVideoSource = (video) => {
    if (video.videoSource) {
      return video.videoSource;
    }
    
    // Auto-detect based on URL patterns
    if (video.youtubeVideoUrl) {
      if (video.youtubeVideoUrl.includes('youtu.be/')) {
        return 'youtube-url';
      } else if (video.youtubeVideoUrl.includes('youtube.com/watch')) {
        return 'youtube';
      }
    }
    
    // Default to firebase for non-YouTube videos
    return 'firebase';
  };

  // Transform video data for CustomVideoPlayer compatibility
  const transformVideoData = (video) => {
    const videoSource = detectVideoSource(video);
    
    // For youtu.be URLs, transform to match CustomVideoPlayer expectations
    if (videoSource === 'youtube-url' && video.youtubeVideoUrl) {
      const videoId = YouTubeUtils.extractVideoId(video.youtubeVideoUrl);
      const embedUrl = YouTubeUtils.getEmbedUrl(videoId);
      
      return {
        ...video,
        videoSource: 'youtube-url',
        youtubeEmbedUrl: embedUrl,
        videoUrl: video.youtubeVideoUrl // Keep original URL as fallback
      };
    }
    
    // For other video types, return as-is
    return video;
  };

  // Video handlers
  const handleVideoClick = (video) => {
    const transformedVideo = transformVideoData(video);
    console.log('🎬 Video clicked:', {
      original: video,
      transformed: transformedVideo,
      detectedSource: detectVideoSource(video)
    });
    setSelectedVideo(transformedVideo);
    setShowVideoModal(true);
  };

  const handleEditVideo = (video) => {
    setEditingVideo(video);
    setEditForm({ 
      title: video.title || '', 
      description: video.description || '' 
    });
    setShowEditModal(true);
  };

  const handleSaveVideoEdit = async () => {
    if (!editingVideo) return;
    
    try {
      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
      
      // Try teacher-specific endpoint first
      let response = await fetch(`${apiUrl}/api/teacher/videos/${editingVideo.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(editForm)
      });

      // Fallback to admin endpoint if teacher endpoint fails
      if (!response.ok) {
        console.log('Teacher video edit endpoint failed, trying admin endpoint...');
        response = await fetch(`${apiUrl}/api/videos/${editingVideo.id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(editForm)
        });
      }

      if (response.ok) {
        // Update the video in the local state
        setClassroomVideos(videos => videos.map(video => 
          video.id === editingVideo.id 
            ? { ...video, ...editForm }
            : video
        ));
        
        // Update selected video if it's currently being viewed
        if (selectedVideo && selectedVideo.id === editingVideo.id) {
          setSelectedVideo({ ...selectedVideo, ...editForm });
        }
        
        setShowEditModal(false);
        setEditingVideo(null);
        alert('Video updated successfully!');
      } else {
        const errorData = await response.json();
        alert('Failed to update video: ' + (errorData.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error updating video:', error);
      alert('Failed to update video. Please try again.');
    }
  };

  const handleUploadNotes = async (videoId) => {
    if (!notesFile) {
      alert('Please select a file to upload');
      return;
    }

    setUploadingNotes(true);
    try {
      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
      
      const formData = new FormData();
      formData.append('notesFile', notesFile);

      // Try teacher-specific endpoint first
      let response = await fetch(`${apiUrl}/api/teacher/videos/${videoId}/notes`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      // Fallback to admin endpoint if teacher endpoint fails
      if (!response.ok) {
        console.log('Teacher notes upload endpoint failed, trying admin endpoint...');
        response = await fetch(`${apiUrl}/api/videos/${videoId}/notes`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });
      }

      if (response.ok) {
        const result = await response.json();
        // Update the video in local state
        setClassroomVideos(videos => videos.map(video => 
          video.id === videoId 
            ? { 
                ...video, 
                notesAvailable: true, 
                notesFileName: result.notes.fileName,
                notesFilePath: result.notes.filePath
              }
            : video
        ));
        
        alert('Notes uploaded successfully!');
        setNotesFile(null);
        // Reset file input
        const fileInput = document.getElementById(`notes-file-${videoId}`);
        if (fileInput) fileInput.value = '';
      } else {
        const errorData = await response.json();
        alert('Failed to upload notes: ' + (errorData.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error uploading notes:', error);
      alert('Failed to upload notes. Please try again.');
    } finally {
      setUploadingNotes(false);
    }
  };

  const handleUploadBatchNotes = async () => {
    if (!notesFile) {
      alert('Please select a file to upload');
      return;
    }

    setUploadingNotes(true);
    try {
      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
      
      const formData = new FormData();
      formData.append('notesFile', notesFile);

      // Try teacher-specific endpoint first
      let response = await fetch(`${apiUrl}/api/teacher/batches/${batchId}/notes`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      // Fallback to admin endpoint if teacher endpoint fails
      if (!response.ok) {
        console.log('Teacher batch notes upload endpoint failed, trying admin endpoint...');
        response = await fetch(`${apiUrl}/api/batches/${batchId}/notes`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });
      }

      if (response.ok) {
        const result = await response.json();
        // Update batch in local state
        setSelectedBatch(prev => ({
          ...prev,
          notesFile: result.notesFile
        }));
        
        alert('Batch notes uploaded successfully!');
        setNotesFile(null);
        // Reset file input
        const fileInput = document.getElementById('batch-notes-file');
        if (fileInput) fileInput.value = '';
      } else {
        const errorData = await response.json();
        alert('Failed to upload batch notes: ' + (errorData.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error uploading batch notes:', error);
      alert('Failed to upload batch notes. Please try again.');
    } finally {
      setUploadingNotes(false);
    }
  };

  const getYouTubeEmbedUrl = (url) => {
    if (!url) return '';
    const videoId = url.includes('youtube.com/watch?v=') 
      ? url.split('v=')[1]?.split('&')[0]
      : url.includes('youtu.be/') 
      ? url.split('youtu.be/')[1]?.split('?')[0]
      : '';
    return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
  };

  // Filter videos based on search
  const filteredVideos = classroomVideos.filter(video =>
    video.title?.toLowerCase().includes(videoSearch.toLowerCase()) ||
    video.description?.toLowerCase().includes(videoSearch.toLowerCase()) ||
    video.instructor?.toLowerCase().includes(videoSearch.toLowerCase())
  );

  if (loading) return <div className="loading">Loading batch details...</div>;
  if (!selectedBatch) return <div className="error">Batch not found</div>;

  return (
    <div className="batch-details-page">
      <div className={`batch-header compact ${isHeaderExpanded ? 'expanded' : ''}`}>
        <div className="compact-header-left">
          <button onClick={handleBackToTeacher} className="btn-back btn-back-compact">
            ← Back
          </button>
          <div className="batch-info-compact">
            <h1 className="batch-title-compact">{selectedBatch.name}</h1>
            <div className="batch-meta-compact">
              <span className="course-badge course-badge-compact">{selectedBatch.course}</span>
              <span className={`status-badge status-badge-compact ${selectedBatch.status}`}>{selectedBatch.status}</span>
            </div>
          </div>
        </div>
        
        <div className="compact-header-right">
          <div className="batch-stats-compact">
            <div className="stat-item-compact">
              <span className="stat-icon">📹</span>
              <span className="stat-value">{classroomVideos.length}</span>
            </div>
            <div className="stat-item-compact">
              <span className="stat-icon">👥</span>
              <span className="stat-value">{students.length}</span>
            </div>
          </div>
          
          <button 
            onClick={() => setIsHeaderExpanded(!isHeaderExpanded)}
            className="header-toggle-btn"
            aria-label={isHeaderExpanded ? 'Collapse header' : 'Expand header'}
          >
            <span className={`toggle-icon ${isHeaderExpanded ? 'expanded' : ''}`}>
              {isHeaderExpanded ? '▲' : '▼'}
            </span>
          </button>
        </div>
        
        {isHeaderExpanded && (
          <div className="expanded-header-content">
            <div className="expanded-header-row">
              <div className="expanded-info-section">
                <h3 className="expanded-section-title">Batch Information</h3>
                <div className="expanded-info-grid">
                  <div className="info-item">
                    <span className="info-label">Status:</span>
                    <span className={`status-badge ${selectedBatch.status}`}>{selectedBatch.status}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Course:</span>
                    <span className="course-badge">{selectedBatch.course}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Teacher:</span>
                    <span className="teacher-info">You</span>
                  </div>
                  {selectedBatch.startTime && (
                    <div className="info-item">
                      <span className="info-label">Start Time:</span>
                      <span className="info-value">{selectedBatch.startTime}</span>
                    </div>
                  )}
                  {selectedBatch.endTime && (
                    <div className="info-item">
                      <span className="info-label">End Time:</span>
                      <span className="info-value">{selectedBatch.endTime}</span>
                    </div>
                  )}
                  {selectedBatch.days && (
                    <div className="info-item">
                      <span className="info-label">Days:</span>
                      <span className="info-value">{selectedBatch.days}</span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="expanded-stats-section">
                <h3 className="expanded-section-title">Quick Stats</h3>
                <div className="expanded-stats-grid">
                  <div className="stat-card">
                    <div className="stat-icon-large">📹</div>
                    <div className="stat-details">
                      <div className="stat-number">{classroomVideos.length}</div>
                      <div className="stat-label">Videos</div>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon-large">👥</div>
                    <div className="stat-details">
                      <div className="stat-number">{students.length}</div>
                      <div className="stat-label">Students</div>
                    </div>
                  </div>
                  {selectedBatch.notesFile && (
                    <div className="stat-card">
                      <div className="stat-icon-large">📋</div>
                      <div className="stat-details">
                        <div className="stat-number">1</div>
                        <div className="stat-label">Notes</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="horizontal-menu">
        <div className="menu-items-horizontal">
          <button 
            className={`menu-item-horizontal ${activeView === 'videos' ? 'active' : ''}`}
            onClick={() => handleViewChange('videos')}
          >
            📹 Videos ({classroomVideos.length})
          </button>
          <button 
            className={`menu-item-horizontal ${activeView === 'students' ? 'active' : ''}`}
            onClick={() => handleViewChange('students')}
          >
            👥 Students ({students.length})
          </button>
        </div>
      </div>

      <div className="batch-content">
        <div className="main-content">
          {activeView === 'videos' && (
            <div className="videos-view">
              <div className="videos-header">
                <h2>📹 Videos in {selectedBatch.name}</h2>
                <div className="video-controls">
                  <input
                    type="text"
                    placeholder="Search videos..."
                    value={videoSearch}
                    onChange={(e) => setVideoSearch(e.target.value)}
                    className="video-search"
                  />
                </div>
              </div>

              {/* Batch Notes Section */}
              <div className="batch-notes-section">
                <h3>📋 Batch Notes</h3>
                {selectedBatch.notesFile ? (
                  <div className="existing-notes">
                    <p>Notes available: {selectedBatch.notesFile.fileName}</p>
                    <button 
                      onClick={() => window.open(`/uploads/teacher-notes/${selectedBatch.notesFile.fileName}`, '_blank')}
                      className="download-btn"
                    >
                      Download Notes
                    </button>
                  </div>
                ) : (
                  <div className="upload-notes">
                    <input
                      type="file"
                      id="batch-notes-file"
                      accept=".pdf,.doc,.docx"
                      onChange={(e) => setNotesFile(e.target.files[0])}
                      style={{ display: 'none' }}
                    />
                    <button 
                      onClick={() => document.getElementById('batch-notes-file').click()}
                      className="upload-btn"
                      disabled={uploadingNotes}
                    >
                      {uploadingNotes ? 'Uploading...' : '📁 Upload Batch Notes'}
                    </button>
                    {notesFile && (
                      <div className="file-info">
                        <span>Selected: {notesFile.name}</span>
                        <button onClick={handleUploadBatchNotes} disabled={uploadingNotes}>
                          {uploadingNotes ? 'Uploading...' : 'Upload'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="video-grid">
                {filteredVideos.map(video => {
                  const videoSource = detectVideoSource(video);
                  const thumbnailUrl = videoSource === 'youtube-url' || videoSource === 'youtube'
                    ? YouTubeUtils.getThumbnailUrl(YouTubeUtils.extractVideoId(video.youtubeVideoUrl || video.videoUrl))
                    : null;
                  
                  return (
                    <div key={video.id} className="video-card">
                      <div className="video-thumbnail" onClick={() => handleVideoClick(video)}>
                        {thumbnailUrl ? (
                          <img 
                            src={thumbnailUrl}
                            alt={video.title}
                            onError={(e) => e.target.src = '/placeholder-video.png'}
                          />
                        ) : (
                          <div className="video-placeholder">📺</div>
                        )}
                      </div>
                      <div className="video-right">
                        <div className="video-info">
                          <div className="video-title">{video.title}</div>
                          <div className="video-meta">
                            <span className="instructor">{video.instructor || 'Instructor'}</span>
                            <span className="date">
                              {formatDateForComponent(video.date)}
                            </span>
                          </div>
                          {video.description && (
                            <div className="video-description">
                              {video.description.length > 100 
                                ? video.description.substring(0, 100) + '...' 
                                : video.description}
                            </div>
                          )}
                          {video.notesAvailable && (
                            <div className="notes-indicator">📋 Notes Available</div>
                          )}
                        </div>
                        <div className="video-actions">
                          <button onClick={() => handleVideoClick(video)} className="view-btn">
                            ▶️ View
                          </button>
                          <button onClick={() => handleEditVideo(video)} className="edit-btn">
                            ✏️ Edit
                          </button>
                          <div className="notes-upload-section">
                            <input
                              type="file"
                              id={`notes-file-${video.id}`}
                              accept=".pdf,.doc,.docx"
                              onChange={(e) => setNotesFile(e.target.files[0])}
                              style={{ display: 'none' }}
                            />
                            <button 
                              onClick={() => document.getElementById(`notes-file-${video.id}`).click()}
                              className="notes-btn"
                              disabled={uploadingNotes}
                            >
                              📋 Upload Notes
                            </button>
                            {notesFile && (
                              <button 
                                onClick={() => handleUploadNotes(video.id)} 
                                disabled={uploadingNotes}
                                className="confirm-upload-btn"
                              >
                                {uploadingNotes ? 'Uploading...' : 'Confirm'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {filteredVideos.length === 0 && (
                <div className="empty-state">
                  <p>{videoSearch ? 'No videos found matching your search.' : 'No videos available for this batch.'}</p>
                </div>
              )}
            </div>
          )}

          {activeView === 'students' && (
            <div className="students-view">
              <div className="students-header">
                <h2>👥 Students in {selectedBatch.name}</h2>
              </div>

              <div className="students-grid">
                {students.map(student => (
                  <div key={student._id} className="student-card">
                    <div className="student-info">
                      <h4>{student.name}</h4>
                    </div>
                  </div>
                ))}
              </div>

              {students.length === 0 && (
                <div className="empty-state">
                  <p>No students in this batch yet.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Enhanced Student Details Modal */}
      {showStudentDetailsModal && selectedStudentDetails && (
        <div className="modal-overlay">
          <div className="modal student-details-modal">
            <div className="modal-header">
              <h3>Student Profile</h3>
              <button onClick={() => setShowStudentDetailsModal(false)} className="close-button">×</button>
            </div>
            
            <div className="student-profile-content">
              <div className="profile-section">
                <h4>Personal Information</h4>
                <div className="profile-info">
                  <p><strong>Name:</strong> {selectedStudentDetails.name}</p>
                  <p><strong>Email:</strong> {selectedStudentDetails.email}</p>
                  {selectedStudentDetails.phone && <p><strong>Phone:</strong> {selectedStudentDetails.phone}</p>}
                  {selectedStudentDetails.address && <p><strong>Address:</strong> {selectedStudentDetails.address}</p>}
                  <p><strong>Status:</strong> <span className={`status ${selectedStudentDetails.status || 'active'}`}>{selectedStudentDetails.status || 'active'}</span></p>
                  {selectedStudentDetails.joinedAt && <p><strong>Joined:</strong> {formatDateForComponent(selectedStudentDetails.joinedAt)}</p>}
                </div>
              </div>

              <div className="profile-section">
                <h4>Recent Activity</h4>
                {loadingActivity ? (
                  <div className="loading">Loading activity...</div>
                ) : studentActivities.length > 0 ? (
                  <div className="activity-list">
                    {studentActivities.slice(0, 10).map((activity, index) => (
                      <div key={index} className="activity-item">
                        <p className="activity-action">{activity.action}</p>
                        <p className="activity-timestamp">
                          {formatDateTimeDisplay(activity.timestamp)}
                        </p>
                        {activity.details && <p className="activity-details">{activity.details}</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="no-activity">No recent activity found.</p>
                )}
              </div>
            </div>
            
            <div className="modal-actions">
              <button onClick={() => setShowStudentDetailsModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Video Edit Modal */}
      {showEditModal && editingVideo && (
        <div className="modal-overlay">
          <div className="modal edit-modal">
            <div className="modal-header">
              <h3>Edit Video</h3>
              <button onClick={() => setShowEditModal(false)} className="close-button">×</button>
            </div>
            
            <div className="edit-form">
              <div className="form-group">
                <label htmlFor="video-title">Video Title</label>
                <input
                  id="video-title"
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  placeholder="Enter video title"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="video-description">Description</label>
                <textarea
                  id="video-description"
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  placeholder="Enter video description"
                  rows="4"
                />
              </div>
            </div>
            
            <div className="modal-actions">
              <button 
                onClick={() => setShowEditModal(false)} 
                className="cancel-btn"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveVideoEdit} 
                className="save-btn"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video Player Modal */}
      {showVideoModal && selectedVideo && (
        <div className="modal-overlay">
          <div className="modal video-modal">
            <div className="modal-header">
              <h3>{selectedVideo.title}</h3>
              <button onClick={() => setShowVideoModal(false)} className="close-button">×</button>
            </div>
            
            <CustomVideoPlayer
              video={selectedVideo}
              onClose={() => setShowVideoModal(false)}
            />
            
            <div className="modal-actions">
              <button onClick={() => setShowVideoModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherBatchDetailsPage;
