import React, { useState, useEffect } from 'react';
import './BatchDetail.css';
import { useNavigate, useParams } from 'react-router-dom';

const BatchDetail = () => {
  const { batchId } = useParams();
  const navigate = useNavigate();
  const [batch, setBatch] = useState(null);
  const [students, setStudents] = useState([]);
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('students');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [showRecordingModal, setShowRecordingModal] = useState(false);
  const [selectedRecording, setSelectedRecording] = useState(null);
  const [recordingUrl, setRecordingUrl] = useState('');
  const [recordingPassword, setRecordingPassword] = useState('');
  const [showAddStudentForm, setShowAddStudentForm] = useState(false);
  const [newStudent, setNewStudent] = useState({ name: '', email: '' });
  const [classroomVideos, setClassroomVideos] = useState([]);
  const [selectedStudentDetails, setSelectedStudentDetails] = useState(null);
  const [showStudentDetailsModal, setShowStudentDetailsModal] = useState(false);
  const [studentActivities, setStudentActivities] = useState([]);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [videoSearch, setVideoSearch] = useState('');
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [showVideoModal, setShowVideoModal] = useState(false);

  useEffect(() => {
    console.log('BatchDetail component mounted with batchId:', batchId);
    
    // Test if batches API works
    const testBatchesAPI = async () => {
      try {
        const token = localStorage.getItem('token');
        const apiUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : '';
        
        // Test a simple endpoint first
        console.log('Testing backend connectivity...');
        const testResponse = await fetch(`${apiUrl}/api/batches`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        console.log('Test response status:', testResponse.status);
        
        if (testResponse.ok) {
          const data = await testResponse.json();
          console.log('All batches in database:', data);
          const batchIds = data.batches?.map(b => ({ id: b.id, name: b.name, teacherId: b.teacherId }));
          console.log('Batch IDs available:', batchIds);
          console.log('Looking for batch ID:', batchId);
          console.log('Batch exists:', batchIds.some(b => b.id === batchId));
        } else {
          console.log('Batches API failed:', testResponse.status);
          const errorText = await testResponse.text();
          console.log('Error response:', errorText);
        }
      } catch (err) {
        console.error('Error testing batches API:', err);
      }
    };
    
    testBatchesAPI();
    fetchBatchDetails();
  }, [batchId]);

  const fetchBatchDetails = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : '';
      
      console.log('Fetching batch details for:', batchId);
      console.log('Batch ID format check:', batchId, 'Length:', batchId?.length, 'Is valid ObjectId:', /^[0-9a-fA-F]{24}$/.test(batchId));
      console.log('API URL:', `${apiUrl}/api/batches/${batchId}`);
      console.log('Token exists:', !!token);
      
      // Fetch batch details
      const batchResponse = await fetch(`${apiUrl}/api/batches/${batchId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      console.log('Batch response status:', batchResponse.status);
      
      if (!batchResponse.ok) {
        const errorText = await batchResponse.text();
        console.log('Error response:', errorText);
        throw new Error(`Failed to fetch batch details: ${batchResponse.status}`);
      }
      
      const batchData = await batchResponse.json();
      console.log('Batch data received:', batchData);
      setBatch(batchData.batch || batchData);

      // Fetch students
      const studentsResponse = await fetch(`${apiUrl}/api/batches/${batchId}/students`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      console.log('Students response status:', studentsResponse.status);
      
      if (studentsResponse.ok) {
        const studentsData = await studentsResponse.json();
        console.log('Students data received:', studentsData);
        setStudents(studentsData.students || []);
      }

      // Fetch recordings
      const recordingsResponse = await fetch(`${apiUrl}/api/batches/${batchId}/recordings`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      console.log('Recordings response status:', recordingsResponse.status);
      
      if (recordingsResponse.ok) {
        const recordingsData = await recordingsResponse.json();
        console.log('Recordings data received:', recordingsData);
        setRecordings(recordingsData.recordings || []);
      }

      // Fetch classroom videos
      const videosResponse = await fetch(`${apiUrl}/api/classroom`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (videosResponse.ok) {
        const allVideos = await videosResponse.json();
        
        // Filter videos by batchId and course for relevant content
        const norm = (v) => (v != null && v !== '' ? String(v).trim() : '');
        const batchIdNorm = norm(batchId);
        const batchVideos = allVideos.filter(video => {
          const videoBatchId = norm(video.batchId);
          const videoCourse = video.courseId || video.course;
          const batchCourse = batchData.batch?.course || batchData.course;
          
          return videoBatchId === batchIdNorm || 
                 (videoCourse && batchCourse && videoCourse.toLowerCase() === batchCourse.toLowerCase());
        });
        
        console.log('Classroom videos for batch:', batchVideos.length);
        setClassroomVideos(batchVideos);
      }

    } catch (err) {
      console.error('Error in fetchBatchDetails:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddStudent = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : '';
      const response = await fetch(`${apiUrl}/api/batches/${batchId}/students`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newStudent)
      });

      if (response.ok) {
        const addedStudentData = await response.json();
        const addedStudent = addedStudentData.student || addedStudentData;
        setStudents([...students, addedStudent]);
        setNewStudent({ name: '', email: '' });
        setShowAddStudentForm(false);
      }
    } catch (err) {
      console.error('Failed to add student:', err);
    }
  };

  const handleRemoveStudent = async (studentId) => {
    if (!window.confirm('Are you sure you want to remove this student from the batch?')) return;
    
    try {
      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : '';
      const response = await fetch(`${apiUrl}/api/batches/${batchId}/students/${studentId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        setStudents(students.filter(student => student._id !== studentId && student.id !== studentId));
      }
    } catch (err) {
      console.error('Failed to remove student:', err);
    }
  };

  const handleAddRecording = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : '';
      const response = await fetch(`${apiUrl}/api/batches/${batchId}/recordings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          url: recordingUrl,
          password: recordingPassword,
          topic: selectedRecording?.topic || 'New Recording'
        })
      });

      if (response.ok) {
        const addedRecordingData = await response.json();
        const addedRecording = addedRecordingData.recording || addedRecordingData;
        setRecordings([...recordings, addedRecording]);
        setRecordingUrl('');
        setRecordingPassword('');
        setSelectedRecording(null);
        setShowRecordingModal(false);
      }
    } catch (err) {
      console.error('Failed to add recording:', err);
    }
  };

  const handleDeleteRecording = async (recordingId) => {
    if (!window.confirm('Are you sure you want to delete this recording?')) return;
    
    try {
      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : '';
      const response = await fetch(`${apiUrl}/api/batches/${batchId}/recordings/${recordingId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        setRecordings(recordings.filter(recording => recording._id !== recordingId));
      }
    } catch (err) {
      console.error('Failed to delete recording:', err);
    }
  };

  const openRecordingModal = (recording = null) => {
    setSelectedRecording(recording);
    setRecordingUrl(recording?.url || '');
    setRecordingPassword(recording?.password || '');
    setShowRecordingModal(true);
  };

  // Enhanced student details handler
  const handleViewStudentDetails = (student) => {
    setSelectedStudentDetails(student);
    setShowStudentDetailsModal(true);
    loadStudentActivity(student._id || student.id);
  };

  // Load student activity
  const loadStudentActivity = async (studentId) => {
    setLoadingActivity(true);
    try {
      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : '';
      
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

  // Video handlers
  const handleVideoClick = (video) => {
    setSelectedVideo(video);
    setShowVideoModal(true);
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
  if (error) return <div className="error">Error: {error}</div>;
  if (!batch) return <div className="error">Batch not found</div>;

  return (
    <div className="batch-detail">
      <div className="batch-header">
        <button onClick={() => navigate(-1)} className="back-button">
          ← Back to Batches
        </button>
        <h1>{batch.name}</h1>
        <div className="batch-meta">
          <span className="course">{batch.course}</span>
          <span className={`status ${batch.status}`}>{batch.status}</span>
          <span className="student-count">{students.length} Students</span>
        </div>
      </div>

      <div className="batch-tabs">
        <button 
          className={`tab ${activeTab === 'students' ? 'active' : ''}`}
          onClick={() => setActiveTab('students')}
        >
          Students ({students.length})
        </button>
        <button 
          className={`tab ${activeTab === 'videos' ? 'active' : ''}`}
          onClick={() => setActiveTab('videos')}
        >
          Videos ({classroomVideos.length})
        </button>
        <button 
          className={`tab ${activeTab === 'recordings' ? 'active' : ''}`}
          onClick={() => setActiveTab('recordings')}
        >
          Recordings ({recordings.length})
        </button>
      </div>

      <div className="batch-content">
        {activeTab === 'students' && (
          <div className="students-section">
            <div className="section-header">
              <h3>Students</h3>
              <button 
                className="add-button"
                onClick={() => setShowAddStudentForm(!showAddStudentForm)}
              >
                + Add Student
              </button>
            </div>

            {showAddStudentForm && (
              <form onSubmit={handleAddStudent} className="add-student-form">
                <input
                  type="text"
                  placeholder="Student Name"
                  value={newStudent.name}
                  onChange={(e) => setNewStudent({...newStudent, name: e.target.value})}
                  required
                />
                <input
                  type="email"
                  placeholder="Student Email"
                  value={newStudent.email}
                  onChange={(e) => setNewStudent({...newStudent, email: e.target.value})}
                  required
                />
                <button type="submit">Add Student</button>
                <button type="button" onClick={() => setShowAddStudentForm(false)}>Cancel</button>
              </form>
            )}

            <div className="students-grid">
              {students.map(student => (
                <div key={student._id} className="student-card">
                  <div className="student-info">
                    <h4>{student.name}</h4>
                    <p>{student.email}</p>
                    {student.phone && <p className="phone">📱 {student.phone}</p>}
                    {student.address && <p className="address">📍 {student.address}</p>}
                    <span className={`status ${student.status || 'active'}`}>
                      {student.status || 'active'}
                    </span>
                  </div>
                  <div className="student-actions">
                    <button onClick={() => handleViewStudentDetails(student)}>
                      View Profile
                    </button>
                    <button 
                      className="remove-button"
                      onClick={() => handleRemoveStudent(student._id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {students.length === 0 && (
              <div className="empty-state">
                <p>No students in this batch yet.</p>
                <button onClick={() => setShowAddStudentForm(true)}>
                  Add First Student
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'videos' && (
          <div className="videos-section">
            <div className="section-header">
              <h3>Course Videos</h3>
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

            <div className="videos-grid">
              {filteredVideos.map(video => (
                <div key={video._id} className="video-card" onClick={() => handleVideoClick(video)}>
                  <div className="video-thumbnail">
                    {video.youtubeVideoUrl ? (
                      <img 
                        src={`https://img.youtube.com/vi/${video.youtubeVideoId || video.youtubeVideoUrl.split('v=')[1]?.split('&')[0]}/mqdefault.jpg`}
                        alt={video.title}
                        onError={(e) => e.target.src = '/placeholder-video.png'}
                      />
                    ) : (
                      <div className="video-placeholder">📹</div>
                    )}
                    <div className="video-play-button">▶</div>
                  </div>
                  <div className="video-info">
                    <h4>{video.title}</h4>
                    <p className="video-instructor">{video.instructor || 'Instructor'}</p>
                    <p className="video-date">
                      {video.date ? new Date(video.date).toLocaleDateString() : 'No date'}
                    </p>
                    <p className="video-description">
                      {video.description ? video.description.substring(0, 100) + '...' : 'No description'}
                    </p>
                    {video.notesAvailable && (
                      <span className="notes-indicator">📋 Notes Available</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {filteredVideos.length === 0 && (
              <div className="empty-state">
                <p>{videoSearch ? 'No videos found matching your search.' : 'No course videos available for this batch.'}</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'recordings' && (
          <div className="recordings-section">
            <div className="section-header">
              <h3>Class Recordings</h3>
              <button 
                className="add-button"
                onClick={() => openRecordingModal()}
              >
                + Add Recording
              </button>
            </div>

            <div className="recordings-grid">
              {recordings.map(recording => (
                <div key={recording._id} className="recording-card">
                  <div className="recording-info">
                    <h4>{recording.topic}</h4>
                    <p>{new Date(recording.date).toLocaleDateString()}</p>
                    <a href={recording.url} target="_blank" rel="noopener noreferrer">
                      View Recording
                    </a>
                  </div>
                  <div className="recording-actions">
                    <button onClick={() => openRecordingModal(recording)}>
                      Edit
                    </button>
                    <button 
                      className="delete-button"
                      onClick={() => handleDeleteRecording(recording._id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {recordings.length === 0 && (
              <div className="empty-state">
                <p>No recordings available for this batch.</p>
                <button onClick={() => openRecordingModal()}>
                  Add First Recording
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Student Details Modal */}
      {showStudentModal && selectedStudent && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Student Details</h3>
            <div className="student-details">
              <p><strong>Name:</strong> {selectedStudent.name}</p>
              <p><strong>Email:</strong> {selectedStudent.email}</p>
              <p><strong>Joined:</strong> {new Date(selectedStudent.joinedAt).toLocaleDateString()}</p>
            </div>
            <button onClick={() => setShowStudentModal(false)}>Close</button>
          </div>
        </div>
      )}

      {/* Recording Modal */}
      {showRecordingModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>{selectedRecording ? 'Edit Recording' : 'Add Recording'}</h3>
            <form onSubmit={handleAddRecording}>
              <input
                type="text"
                placeholder="Recording Topic"
                value={selectedRecording?.topic || ''}
                onChange={(e) => setSelectedRecording({...selectedRecording, topic: e.target.value})}
                required
              />
              <input
                type="url"
                placeholder="Recording URL"
                value={recordingUrl}
                onChange={(e) => setRecordingUrl(e.target.value)}
                required
              />
              <input
                type="text"
                placeholder="Password (if required)"
                value={recordingPassword}
                onChange={(e) => setRecordingPassword(e.target.value)}
              />
              <div className="modal-actions">
                <button type="submit">
                  {selectedRecording ? 'Update' : 'Add'} Recording
                </button>
                <button type="button" onClick={() => setShowRecordingModal(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                  {selectedStudentDetails.joinedAt && <p><strong>Joined:</strong> {new Date(selectedStudentDetails.joinedAt).toLocaleDateString()}</p>}
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
                          {new Date(activity.timestamp).toLocaleString()}
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

      {/* Video Player Modal */}
      {showVideoModal && selectedVideo && (
        <div className="modal-overlay">
          <div className="modal video-modal">
            <div className="modal-header">
              <h3>{selectedVideo.title}</h3>
              <button onClick={() => setShowVideoModal(false)} className="close-button">×</button>
            </div>
            
            <div className="video-content">
              <div className="video-player-container">
                {selectedVideo.youtubeVideoUrl ? (
                  <iframe
                    src={getYouTubeEmbedUrl(selectedVideo.youtubeVideoUrl)}
                    title={selectedVideo.title}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="video-player"
                  />
                ) : (
                  <div className="video-placeholder-large">
                    <p>Video player not available</p>
                    <a href={selectedVideo.videoUrl} target="_blank" rel="noopener noreferrer">
                      Open Video Link
                    </a>
                  </div>
                )}
              </div>
              
              <div className="video-metadata">
                <p><strong>Instructor:</strong> {selectedVideo.instructor || 'Not specified'}</p>
                <p><strong>Date:</strong> {selectedVideo.date ? new Date(selectedVideo.date).toLocaleDateString() : 'Not specified'}</p>
                {selectedVideo.description && (
                  <p><strong>Description:</strong> {selectedVideo.description}</p>
                )}
                {selectedVideo.notesAvailable && (
                  <div className="notes-section">
                    <p><strong>📋 Notes Available</strong></p>
                    {selectedVideo.notesFile && (
                      <a href={selectedVideo.notesFile} target="_blank" rel="noopener noreferrer" className="download-notes">
                        Download Notes
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            <div className="modal-actions">
              <button onClick={() => setShowVideoModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BatchDetail;
