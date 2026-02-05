import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { ToastContainer, showToast } from './Toast';
import './BatchDetailsPage.css';

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
  const [studentFormData, setStudentFormData] = useState({
    name: '',
    email: '',
    batchId: '',
    course: '',
    status: 'active',
    phone: '',
    address: ''
  }); // 'videos' or 'students'

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
    navigate('/admin');
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

  const handleDeleteStudent = async (student) => {
    if (window.confirm(`Are you sure you want to delete ${student.name}? This action cannot be undone.`)) {
      try {
        const token = localStorage.getItem('token');
        const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';

        const response = await fetch(`${apiUrl}/api/admin/users/${student.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          showToast('Student deleted successfully!', 'success');
          
          // Remove student from local state
          setStudents(prev => prev.filter(s => s.id !== student.id));
        } else {
          showToast('Failed to delete student', 'error');
        }
      } catch (error) {
        console.error('Error deleting student:', error);
        showToast('Error deleting student', 'error');
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

  // Filter students for this batch
  const batchStudents = students.filter(student => {
    const selectedBatchId = selectedBatch?.id || selectedBatch?._id;
    return student.batchId === selectedBatchId || 
           student.batchId === selectedBatchId ||
           (selectedBatch?.course && student.course === selectedBatch.course);
  });

  return (
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
              <h2>📹 Videos in {selectedBatch.name}</h2>
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
                  <small>Videos may be assigned to this batch by course or directly by batch ID</small>
                </div>
              )}
            </div>
          )}

          {activeView === 'students' && (
            <div className="students-view">
              <h2>👥 Students in {selectedBatch.name}</h2>
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
                              title="Delete Student"
                            >
                              🗑️ Delete
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
  );
};

export default BatchDetailsPage;
