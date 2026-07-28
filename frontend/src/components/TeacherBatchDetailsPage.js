import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { YouTubeUtils } from '../utils/youtubeUtils';
import { formatDateForComponent } from '../utils/dateUtils';
import { getApiBaseUrl } from '../utils/apiBase';
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
  const [error, setError] = useState('');
  const [activeView, setActiveView] = useState('videos');
  const [videoSearch, setVideoSearch] = useState('');
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [editingVideo, setEditingVideo] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ title: '', description: '', duration: '', youtubeUrl: '' });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editNotesFile, setEditNotesFile] = useState(null);
  const [uploadingNotes, setUploadingNotes] = useState(false);
  const [notesFile, setNotesFile] = useState(null);
  const [notesTargetVideoId, setNotesTargetVideoId] = useState(null);
  const [showAddVideoModal, setShowAddVideoModal] = useState(false);
  const [addingVideo, setAddingVideo] = useState(false);
  const [addVideoForm, setAddVideoForm] = useState({
    title: '',
    youtubeUrl: '',
    description: '',
    duration: ''
  });

  const authHeaders = () => {
    const token = localStorage.getItem('token');
    return { Authorization: `Bearer ${token}` };
  };

  const loadBatchData = useCallback(async () => {
    if (!batchId) {
      setError('Missing batch id.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    const apiUrl = getApiBaseUrl();

    try {
      let batchData = null;

      const batchResponse = await fetch(`${apiUrl}/api/teacher/batches/${batchId}`, {
        headers: authHeaders()
      });

      if (batchResponse.ok) {
        const data = await batchResponse.json();
        batchData = data.batch || data;
      } else {
        const fallback = await fetch(`${apiUrl}/api/batches/${batchId}`, {
          headers: authHeaders()
        });
        if (fallback.ok) {
          const data = await fallback.json();
          batchData = data.batch || data;
        }
      }

      if (!batchData || !(batchData.id || batchData._id || batchData.name)) {
        setSelectedBatch(null);
        setError('This batch could not be opened. It may have been reassigned or removed.');
        setLoading(false);
        return;
      }

      // Normalize id for downstream use
      batchData = {
        ...batchData,
        id: String(batchData.id || batchData._id)
      };

      let studentsData = [];
      const studentsResponse = await fetch(`${apiUrl}/api/batches/${batchId}/students`, {
        headers: authHeaders()
      });
      if (studentsResponse.ok) {
        const data = await studentsResponse.json();
        studentsData = (data.students || []).map((s) => ({
          ...s,
          id: String(s.id || s._id)
        }));
      } else if (Array.isArray(batchData.studentsList)) {
        studentsData = batchData.studentsList;
      } else if (Array.isArray(batchData.students)) {
        studentsData = batchData.students;
      }

      let videosData = [];
      const videosResponse = await fetch(`${apiUrl}/api/teacher/classroom/${batchId}`, {
        headers: authHeaders()
      });
      if (videosResponse.ok) {
        const data = await videosResponse.json();
        videosData = (data.lectures || data.videos || []).map((v) => ({
          ...v,
          id: String(v.id || v._id)
        }));
      }

      setSelectedBatch(batchData);
      setStudents(studentsData);
      setClassroomVideos(videosData);
    } catch (err) {
      console.error('Error loading batch data:', err);
      setError('Could not load batch details. Please try again.');
      setSelectedBatch(null);
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    loadBatchData();
  }, [loadBatchData]);

  const handleBackToTeacher = () => {
    const from = location.state?.from;
    if (from === 'teacher-batches') {
      navigate('/teacher', { state: { activeSection: 'courses' } });
    } else {
      navigate('/teacher');
    }
  };

  const detectVideoSource = (video) => {
    if (video?.videoSource) return video.videoSource;
    if (video?.youtubeVideoUrl || video?.youtubeVideoId) return 'youtube-url';
    return 'unknown';
  };

  const transformVideoData = (video) => {
    const videoSource = detectVideoSource(video);
    if (videoSource === 'youtube-url') {
      const youtubeId =
        video.youtubeVideoId ||
        YouTubeUtils.extractVideoId(video.youtubeVideoUrl || video.videoUrl || '');
      return {
        ...video,
        videoSource: 'youtube-url',
        youtubeVideoId: youtubeId,
        youtubeVideoUrl:
          video.youtubeVideoUrl ||
          (youtubeId ? `https://www.youtube.com/watch?v=${youtubeId}` : ''),
        youtubeEmbedUrl:
          video.youtubeEmbedUrl ||
          (youtubeId ? `https://www.youtube.com/embed/${youtubeId}` : '')
      };
    }
    return { ...video, videoSource };
  };

  const handleVideoClick = (video) => {
    setSelectedVideo(transformVideoData(video));
    setShowVideoModal(true);
  };

  const handleEditVideo = (video) => {
    setEditingVideo(video);
    setEditForm({
      title: video.title || '',
      description: video.description || '',
      duration: video.duration || '',
      youtubeUrl: video.youtubeVideoUrl || video.youtubeUrl || ''
    });
    setEditNotesFile(null);
    setShowEditModal(true);
  };

  const handleAddYoutubeVideo = async () => {
    if (!addVideoForm.title.trim() || !addVideoForm.youtubeUrl.trim()) {
      window.alert('Title and YouTube URL are required');
      return;
    }
    setAddingVideo(true);
    try {
      const apiUrl = getApiBaseUrl();
      const response = await fetch(`${apiUrl}/api/teacher/classroom/youtube-url`, {
        method: 'POST',
        headers: {
          ...authHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: addVideoForm.title.trim(),
          youtubeUrl: addVideoForm.youtubeUrl.trim(),
          description: addVideoForm.description.trim(),
          duration: addVideoForm.duration.trim(),
          batchId,
          courseId: batchId
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        window.alert(data.message || 'Failed to add lecture');
        return;
      }
      setShowAddVideoModal(false);
      setAddVideoForm({ title: '', youtubeUrl: '', description: '', duration: '' });
      await loadBatchData();
    } catch (err) {
      console.error(err);
      window.alert('Failed to add lecture. Please try again.');
    } finally {
      setAddingVideo(false);
    }
  };

  const handleSaveVideoEdit = async () => {
    if (!editingVideo) return;
    if (!editForm.title.trim()) {
      window.alert('Title is required');
      return;
    }
    setSavingEdit(true);
    try {
      const apiUrl = getApiBaseUrl();
      const payload = {
        title: editForm.title.trim(),
        description: editForm.description.trim(),
        duration: editForm.duration.trim()
      };
      if (editForm.youtubeUrl.trim()) {
        payload.youtubeUrl = editForm.youtubeUrl.trim();
      }

      const response = await fetch(`${apiUrl}/api/teacher/videos/${editingVideo.id}`, {
        method: 'PUT',
        headers: {
          ...authHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        window.alert(data.message || 'Failed to update lecture');
        return;
      }

      let notesPatch = {};
      if (editNotesFile) {
        const formData = new FormData();
        formData.append('notesFile', editNotesFile);
        const notesRes = await fetch(`${apiUrl}/api/teacher/videos/${editingVideo.id}/notes`, {
          method: 'POST',
          headers: authHeaders(),
          body: formData
        });
        const notesData = await notesRes.json().catch(() => ({}));
        if (!notesRes.ok) {
          window.alert(notesData.message || 'Lecture saved, but notes upload failed');
        } else {
          notesPatch = {
            notesAvailable: true,
            notesFileName: notesData.notes?.fileName,
            notesFilePath: notesData.notes?.filePath
          };
        }
      }

      const updated = { ...(data.video || {}), ...notesPatch };
      setClassroomVideos((videos) =>
        videos.map((video) =>
          video.id === editingVideo.id ? { ...video, ...updated } : video
        )
      );
      setShowEditModal(false);
      setEditingVideo(null);
      setEditNotesFile(null);
    } catch (err) {
      console.error(err);
      window.alert('Failed to update lecture. Please try again.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleUploadNotes = async (videoId) => {
    if (!notesFile || !videoId) {
      window.alert('Please select a file to upload');
      return;
    }
    setUploadingNotes(true);
    try {
      const apiUrl = getApiBaseUrl();
      const formData = new FormData();
      formData.append('notesFile', notesFile);
      const response = await fetch(`${apiUrl}/api/teacher/videos/${videoId}/notes`, {
        method: 'POST',
        headers: authHeaders(),
        body: formData
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        window.alert(result.message || 'Failed to upload notes');
        return;
      }
      setClassroomVideos((videos) =>
        videos.map((video) =>
          video.id === videoId
            ? {
                ...video,
                notesAvailable: true,
                notesFileName: result.notes?.fileName,
                notesFilePath: result.notes?.filePath
              }
            : video
        )
      );
      setNotesFile(null);
      setNotesTargetVideoId(null);
    } catch (err) {
      console.error(err);
      window.alert('Failed to upload notes. Please try again.');
    } finally {
      setUploadingNotes(false);
    }
  };

  const handleUploadBatchNotes = async () => {
    if (!notesFile) {
      window.alert('Please select a file to upload');
      return;
    }
    setUploadingNotes(true);
    try {
      const apiUrl = getApiBaseUrl();
      const formData = new FormData();
      formData.append('notesFile', notesFile);
      const response = await fetch(`${apiUrl}/api/teacher/batches/${batchId}/notes`, {
        method: 'POST',
        headers: authHeaders(),
        body: formData
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        window.alert(result.message || 'Failed to upload batch notes');
        return;
      }
      setSelectedBatch((prev) => ({
        ...prev,
        notesFile: result.notesFile
      }));
      setNotesFile(null);
    } catch (err) {
      console.error(err);
      window.alert('Failed to upload batch notes. Please try again.');
    } finally {
      setUploadingNotes(false);
    }
  };

  const filteredVideos = classroomVideos.filter((video) => {
    const q = videoSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      (video.title || '').toLowerCase().includes(q) ||
      (video.description || '').toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="sky-batch-page sky-batch-loading">
        <div className="sky-loading-card">
          <div className="sky-spinner" />
          <p>Loading batch…</p>
        </div>
      </div>
    );
  }

  if (!selectedBatch) {
    return (
      <div className="sky-batch-page sky-batch-loading">
        <div className="sky-loading-card">
          <h2>Batch unavailable</h2>
          <p className="sky-muted">{error || 'Batch not found.'}</p>
          <button type="button" className="sky-btn sky-btn-primary" onClick={handleBackToTeacher}>
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  const isOneToOne =
    selectedBatch.batchType === 'one-to-one' ||
    (selectedBatch.course || '').toLowerCase().includes('one-to-one') ||
    (selectedBatch.course || '').toLowerCase().includes('one to one');

  return (
    <div className="teacher-batch-details-page sky-batch-page">
      <div className="sky-batch-header">
        <div className="sky-batch-header-main">
          <button type="button" onClick={handleBackToTeacher} className="sky-batch-back">
            ← Back
          </button>
          <div className="sky-batch-title-block">
            <h1 className="sky-batch-title">{selectedBatch.name}</h1>
            <div className="sky-batch-meta">
              <span className="sky-badge sky-badge-program">
                {selectedBatch.programLabel || selectedBatch.course || 'Program'}
              </span>
              {isOneToOne && <span className="sky-badge sky-badge-type">One-to-One</span>}
              <span className={`sky-badge sky-badge-status ${selectedBatch.status || 'active'}`}>
                {selectedBatch.status || 'active'}
              </span>
              <span className="sky-batch-trainer">
                Trainer: <strong>{selectedBatch.teacherName || 'You'}</strong>
              </span>
            </div>
          </div>
        </div>
        <div className="sky-batch-header-actions">
          {selectedBatch.schedule && (selectedBatch.schedule.days || selectedBatch.schedule.time) && (
            <div className="sky-batch-timing-chip">
              {(selectedBatch.schedule.days || '')}
              {selectedBatch.schedule.days && selectedBatch.schedule.time ? ' · ' : ''}
              {selectedBatch.schedule.time || ''}
              {selectedBatch.schedule.time ? ' IST' : ''}
            </div>
          )}
          <button
            type="button"
            className="sky-btn sky-btn-primary sky-add-lecture-header-btn"
            onClick={() => {
              setActiveView('videos');
              setShowAddVideoModal(true);
            }}
          >
            Add lecture
          </button>
        </div>
      </div>

      <div className="sky-batch-tabs">
        <button
          type="button"
          className={`sky-tab ${activeView === 'videos' ? 'active' : ''}`}
          onClick={() => setActiveView('videos')}
        >
          Videos ({classroomVideos.length})
        </button>
        <button
          type="button"
          className={`sky-tab ${activeView === 'students' ? 'active' : ''}`}
          onClick={() => setActiveView('students')}
        >
          Students ({students.length})
        </button>
        <button
          type="button"
          className={`sky-tab ${activeView === 'timing' ? 'active' : ''}`}
          onClick={() => setActiveView('timing')}
        >
          Timing
        </button>
      </div>

      <div className="batch-content">
        <div className="main-content">
          {activeView === 'timing' && (
            <div className="sky-timing-panel">
              <div className="sky-timing-card">
                <h2>Class schedule</h2>
                <p className="sky-muted">
                  Schedule is set by admin in IST. Learners see converted US time zones automatically.
                </p>
                {selectedBatch.schedule && (selectedBatch.schedule.days || selectedBatch.schedule.time) ? (
                  <div className="sky-timing-values">
                    <div>
                      <span className="sky-muted">Days</span>
                      <strong>{selectedBatch.schedule.days || '—'}</strong>
                    </div>
                    <div>
                      <span className="sky-muted">Time (IST)</span>
                      <strong>{selectedBatch.schedule.time || '—'}</strong>
                    </div>
                  </div>
                ) : (
                  <p className="sky-muted">No schedule set yet.</p>
                )}
              </div>
            </div>
          )}

          {activeView === 'videos' && (
            <div className="videos-view sky-lectures">
              <div className="videos-header sky-lectures-header">
                <div>
                  <h2>Lectures</h2>
                  <p className="sky-muted sky-lectures-sub">
                    {filteredVideos.length} lecture{filteredVideos.length === 1 ? '' : 's'} in this batch
                  </p>
                </div>
                <div className="sky-lectures-controls">
                  <input
                    type="search"
                    placeholder="Search lectures…"
                    value={videoSearch}
                    onChange={(e) => setVideoSearch(e.target.value)}
                    className="video-search"
                  />
                </div>
              </div>

              <div className="sky-batch-notes-bar">
                <div className="sky-batch-notes-copy">
                  <strong>Batch notes</strong>
                  {selectedBatch.notesFile ? (
                    <span className="sky-muted">{selectedBatch.notesFile.fileName}</span>
                  ) : (
                    <span className="sky-muted">Optional PDF/DOC shared with learners</span>
                  )}
                </div>
                <div className="sky-batch-notes-actions">
                  {selectedBatch.notesFile ? (
                    <button
                      type="button"
                      className="sky-btn sky-btn-secondary"
                      onClick={() =>
                        window.open(
                          selectedBatch.notesFile.filePath ||
                            `/uploads/teacher-notes/${selectedBatch.notesFile.fileName}`,
                          '_blank'
                        )
                      }
                    >
                      Download
                    </button>
                  ) : (
                    <>
                      <input
                        type="file"
                        id="batch-notes-file"
                        accept=".pdf,.doc,.docx"
                        onChange={(e) => setNotesFile(e.target.files?.[0] || null)}
                        style={{ display: 'none' }}
                      />
                      <button
                        type="button"
                        className="sky-btn sky-btn-secondary"
                        disabled={uploadingNotes}
                        onClick={() => document.getElementById('batch-notes-file')?.click()}
                      >
                        {notesFile && !notesTargetVideoId ? notesFile.name : 'Choose file'}
                      </button>
                      {notesFile && !notesTargetVideoId && (
                        <button
                          type="button"
                          className="sky-btn sky-btn-primary"
                          disabled={uploadingNotes}
                          onClick={handleUploadBatchNotes}
                        >
                          {uploadingNotes ? 'Uploading…' : 'Upload'}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="video-grid sky-lecture-grid">
                {filteredVideos.map((video) => {
                  const videoSource = detectVideoSource(video);
                  const ytId =
                    video.youtubeVideoId ||
                    YouTubeUtils.extractVideoId(video.youtubeVideoUrl || video.videoUrl || '');
                  const thumbnailUrl =
                    (videoSource === 'youtube-url' || videoSource === 'youtube') && ytId
                      ? YouTubeUtils.getThumbnailUrl(ytId, 'high')
                      : null;
                  const videoDate = formatDateForComponent(
                    video.classDate || video.date || video.createdAt
                  );

                  return (
                    <article key={video.id} className="video-card sky-lecture-card">
                      <button
                        type="button"
                        className="sky-lecture-thumb"
                        onClick={() => handleVideoClick(video)}
                        aria-label={`Play ${video.title || 'lecture'}`}
                      >
                        {thumbnailUrl ? (
                          <img src={thumbnailUrl} alt="" loading="lazy" />
                        ) : (
                          <div className="video-placeholder sky-lecture-placeholder">Lecture</div>
                        )}
                        <span className="sky-lecture-play" aria-hidden="true">▶</span>
                      </button>
                      <div className="video-right sky-lecture-body">
                        <div className="video-info">
                          <h3 className="video-title sky-lecture-title" title={video.title || 'Untitled lecture'}>
                            {video.title || 'Untitled lecture'}
                          </h3>
                          <div className="video-meta sky-lecture-meta">
                            <span className="instructor">
                              {video.instructor || selectedBatch.teacherName || 'Trainer'}
                            </span>
                            {videoDate ? <span className="date">{videoDate}</span> : null}
                          </div>
                          {video.notesAvailable ? (
                            <div className="notes-indicator">Notes available</div>
                          ) : null}
                        </div>
                        <div className="video-actions sky-lecture-actions">
                          <button
                            type="button"
                            className="sky-btn sky-btn-primary"
                            onClick={() => handleVideoClick(video)}
                          >
                            View
                          </button>
                          <button
                            type="button"
                            className="sky-btn sky-btn-ghost"
                            onClick={() => handleEditVideo(video)}
                          >
                            Edit
                          </button>
                          <input
                            type="file"
                            id={`notes-file-${video.id}`}
                            accept=".pdf,.doc,.docx"
                            style={{ display: 'none' }}
                            onChange={(e) => {
                              setNotesFile(e.target.files?.[0] || null);
                              setNotesTargetVideoId(video.id);
                            }}
                          />
                          <button
                            type="button"
                            className="sky-btn sky-btn-ghost"
                            disabled={uploadingNotes}
                            onClick={() =>
                              document.getElementById(`notes-file-${video.id}`)?.click()
                            }
                          >
                            Notes
                          </button>
                          {notesFile && notesTargetVideoId === video.id ? (
                            <button
                              type="button"
                              className="sky-btn sky-btn-primary"
                              disabled={uploadingNotes}
                              onClick={() => handleUploadNotes(video.id)}
                            >
                              {uploadingNotes ? 'Uploading…' : 'Confirm'}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              {filteredVideos.length === 0 && (
                <div className="empty-state sky-lectures-empty">
                  <p>
                    {videoSearch
                      ? 'No lectures match your search.'
                      : 'No lectures yet. Add a YouTube lecture to get started.'}
                  </p>
                  {!videoSearch && (
                    <button
                      type="button"
                      className="sky-btn sky-btn-primary"
                      onClick={() => setShowAddVideoModal(true)}
                    >
                      Add lecture
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {activeView === 'students' && (
            <div className="students-view">
              <div className="students-header">
                <h2>Learners in {selectedBatch.name}</h2>
                <p className="section-subtitle">
                  Contact details stay private and are not shown to trainers.
                </p>
              </div>
              <div className="teacher-students-table-wrap">
                <table className="teacher-students-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Program</th>
                      <th>Enrollment</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student) => (
                      <tr key={student.id || student._id}>
                        <td>
                          <div className="teacher-student-name">
                            <span className="teacher-student-avatar">
                              {(student.name || '?').charAt(0).toUpperCase()}
                            </span>
                            {student.name || '—'}
                          </div>
                        </td>
                        <td>{student.course || selectedBatch.course || '—'}</td>
                        <td>{student.enrollmentNumber || '—'}</td>
                        <td>
                          <span className={`status-badge ${student.status || 'active'}`}>
                            {student.status || 'active'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {students.length === 0 && (
                <div className="empty-state">
                  <p>No learners assigned to this batch yet.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showAddVideoModal && (
        <div className="modal-overlay" onClick={() => setShowAddVideoModal(false)}>
          <div className="modal sky-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add YouTube lecture</h3>
              <button type="button" className="close-button" onClick={() => setShowAddVideoModal(false)}>
                ×
              </button>
            </div>
            <div className="edit-form" style={{ padding: '16px 20px' }}>
              <div className="form-group">
                <label>Title *</label>
                <input
                  type="text"
                  value={addVideoForm.title}
                  onChange={(e) => setAddVideoForm({ ...addVideoForm, title: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>YouTube URL *</label>
                <input
                  type="url"
                  value={addVideoForm.youtubeUrl}
                  onChange={(e) => setAddVideoForm({ ...addVideoForm, youtubeUrl: e.target.value })}
                  placeholder="https://www.youtube.com/watch?v=..."
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  rows="3"
                  value={addVideoForm.description}
                  onChange={(e) => setAddVideoForm({ ...addVideoForm, description: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Duration</label>
                <input
                  type="text"
                  value={addVideoForm.duration}
                  onChange={(e) => setAddVideoForm({ ...addVideoForm, duration: e.target.value })}
                  placeholder="e.g. 45 mins"
                />
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="sky-btn sky-btn-secondary" onClick={() => setShowAddVideoModal(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="sky-btn sky-btn-primary"
                disabled={addingVideo}
                onClick={handleAddYoutubeVideo}
              >
                {addingVideo ? 'Adding…' : 'Add lecture'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && editingVideo && (
        <div className="modal-overlay" onClick={() => !savingEdit && setShowEditModal(false)}>
          <div className="modal edit-modal sky-edit-lecture-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="sky-modal-eyebrow">Lecture details</p>
                <h3>Edit lecture</h3>
              </div>
              <button
                type="button"
                className="close-button"
                disabled={savingEdit}
                onClick={() => setShowEditModal(false)}
              >
                ×
              </button>
            </div>
            <div className="edit-form">
              <div className="form-group">
                <label htmlFor="video-title">Title *</label>
                <input
                  id="video-title"
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  placeholder="Lecture title"
                  maxLength={200}
                />
              </div>
              <div className="form-group">
                <label htmlFor="video-youtube">YouTube URL</label>
                <input
                  id="video-youtube"
                  type="url"
                  value={editForm.youtubeUrl}
                  onChange={(e) => setEditForm({ ...editForm, youtubeUrl: e.target.value })}
                  placeholder="https://www.youtube.com/watch?v=… or https://youtu.be/…"
                />
                <small>Change this to replace the lecture video content for students.</small>
              </div>
              <div className="form-group">
                <label htmlFor="video-duration">Duration</label>
                <input
                  id="video-duration"
                  type="text"
                  value={editForm.duration}
                  onChange={(e) => setEditForm({ ...editForm, duration: e.target.value })}
                  placeholder="e.g. 45 min"
                  maxLength={50}
                />
              </div>
              <div className="form-group">
                <label htmlFor="video-description">Description / content notes</label>
                <textarea
                  id="video-description"
                  rows="4"
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  placeholder="What this lecture covers…"
                  maxLength={1000}
                />
              </div>
              <div className="form-group">
                <label htmlFor="video-notes-edit">Replace notes file (optional)</label>
                <input
                  id="video-notes-edit"
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => setEditNotesFile(e.target.files?.[0] || null)}
                />
                <small>
                  {editNotesFile
                    ? `Selected: ${editNotesFile.name}`
                    : editingVideo.notesAvailable
                      ? `Current notes: ${editingVideo.notesFileName || 'attached'}`
                      : 'No notes attached yet'}
                </small>
              </div>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="sky-btn sky-btn-secondary"
                disabled={savingEdit}
                onClick={() => setShowEditModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="sky-btn sky-btn-primary"
                disabled={savingEdit}
                onClick={handleSaveVideoEdit}
              >
                {savingEdit ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showVideoModal && selectedVideo && createPortal(
        <CustomVideoPlayer
          video={selectedVideo}
          onClose={() => {
            setShowVideoModal(false);
            setSelectedVideo(null);
          }}
        />,
        document.body
      )}
    </div>
  );
};

export default TeacherBatchDetailsPage;
