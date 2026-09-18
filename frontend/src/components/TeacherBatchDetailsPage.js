import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { YouTubeUtils } from '../utils/youtubeUtils';
import { formatDateForComponent } from '../utils/dateUtils';
import { getApiBaseUrl } from '../utils/apiBase';
import { downloadAuthenticatedFile } from '../utils/downloadFile';
import CustomVideoPlayer from './CustomVideoPlayer';
import SkyLoadingScreen from './SkyLoadingScreen';
import MeetLiveClassesPanel from './MeetLiveClassesPanel';
import TeacherMaterialsPanel from './TeacherMaterialsPanel';
import DirectChatPanel from './DirectChatPanel';
import './BatchDetailsPage.css';
import './MeetLiveClasses.css';

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
  const classroomSectionRef = useRef(null);
  const [attendanceSummary, setAttendanceSummary] = useState(null);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [nextSession, setNextSession] = useState(null);
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
  const [studentNameFilter, setStudentNameFilter] = useState('');
  const [showAddVideoModal, setShowAddVideoModal] = useState(false);
  const [addingVideo, setAddingVideo] = useState(false);
  const [addVideoForm, setAddVideoForm] = useState({
    title: '',
    youtubeUrl: '',
    description: '',
    duration: ''
  });
  const [chatPeerId, setChatPeerId] = useState('');
  const [currentUserId, setCurrentUserId] = useState('');

  useEffect(() => {
    try {
      const raw = localStorage.getItem('user');
      if (raw) {
        const parsed = JSON.parse(raw);
        setCurrentUserId(String(parsed.id || parsed._id || ''));
      }
    } catch {
      setCurrentUserId('');
    }
  }, []);

  const scrollToChat = useCallback((peerId = '') => {
    if (peerId) setChatPeerId(String(peerId));
    document.getElementById('batch-messages')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

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

      try {
        const meetRes = await fetch(
          `${apiUrl}/api/meetings?batchId=${encodeURIComponent(batchId)}`,
          { headers: authHeaders() }
        );
        if (meetRes.ok) {
          const meetData = await meetRes.json();
          const upcoming = (meetData.meetings || [])
            .filter((m) => m.status !== 'cancelled' && m.status !== 'completed')
            .sort(
              (a, b) =>
                new Date(a.scheduledStart || 0) - new Date(b.scheduledStart || 0)
            );
          setNextSession(upcoming[0] || null);
        }
      } catch (_) {
        setNextSession(null);
      }
    } catch (err) {
      console.error('Error loading batch data:', err);
      setError('Could not load batch details. Please try again.');
      setSelectedBatch(null);
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  const loadAttendanceSummary = useCallback(async () => {
    if (!batchId) return;
    setAttendanceLoading(true);
    try {
      const res = await fetch(
        `${getApiBaseUrl()}/api/meetings/attendance-summary?batchId=${encodeURIComponent(batchId)}`,
        { headers: authHeaders() }
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok) setAttendanceSummary(data);
      else setAttendanceSummary(null);
    } catch (_) {
      setAttendanceSummary(null);
    } finally {
      setAttendanceLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    loadBatchData();
  }, [loadBatchData]);

  // Attendance analytics: load only when trainer clicks Refresh (cuts Firestore reads).

  useEffect(() => {
    if (location.state?.openAddLecture && selectedBatch) {
      setShowAddVideoModal(true);
      classroomSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [location.state, selectedBatch]);

  const scrollToClassroom = () => {
    classroomSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const attendanceByStudent = useMemo(() => {
    const map = {};
    (attendanceSummary?.students || []).forEach((s) => {
      map[String(s.studentId)] = s;
    });
    return map;
  }, [attendanceSummary]);

  const handleBackToTeacher = () => {
    const from = location.state?.from;
    if (from === 'teacher-batches') {
      navigate('/teacher', { state: { activeSection: 'courses' } });
    } else {
      navigate('/teacher');
    }
  };

  // Prefer YouTube when present so Classroom plays in-LMS after Drive→YouTube migration.
  const detectVideoSource = (video) => YouTubeUtils.preferSource(video);

  const transformVideoData = (video) => {
    const videoSource = detectVideoSource(video);
    if (videoSource === 'youtube-url') {
      const youtubeId =
        YouTubeUtils.extractVideoId(video.youtubeVideoId) ||
        YouTubeUtils.extractVideoId(video.youtubeEmbedUrl) ||
        YouTubeUtils.extractVideoId(video.youtubeVideoUrl || video.videoUrl || '');
      return {
        ...video,
        videoSource: 'youtube-url',
        youtubeVideoId: youtubeId,
        youtubeVideoUrl:
          video.youtubeVideoUrl ||
          (youtubeId ? `https://www.youtube.com/watch?v=${youtubeId}` : ''),
        youtubeEmbedUrl: youtubeId ? YouTubeUtils.getEmbedUrl(youtubeId) : video.youtubeEmbedUrl || ''
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

  const handleToggleStudentVisibility = async (video) => {
    const nextVisible = video.studentVisible === false;
    try {
      const apiUrl = getApiBaseUrl();
      const response = await fetch(
        `${apiUrl}/api/teacher/classroom/${video.id}/visibility`,
        {
          method: 'PATCH',
          headers: {
            ...authHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ studentVisible: nextVisible })
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        window.alert(data.message || 'Failed to update visibility');
        return;
      }
      setClassroomVideos((videos) =>
        videos.map((v) =>
          v.id === video.id ? { ...v, studentVisible: nextVisible } : v
        )
      );
    } catch (err) {
      console.error(err);
      window.alert('Failed to update visibility. Please try again.');
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

  const updateLessonPath = async (videoId, patch) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${getApiBaseUrl()}/api/teacher/classroom/${videoId}/path`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(patch)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to update path');
      setClassroomVideos((videos) =>
        videos.map((v) =>
          v.id === videoId
            ? {
                ...v,
                order: data.lecture?.order ?? v.order,
                unlockRule: data.lecture?.unlockRule ?? v.unlockRule,
                linkedAssessmentId: data.lecture?.linkedAssessmentId ?? v.linkedAssessmentId
              }
            : v
        )
      );
    } catch (err) {
      setError(err.message || 'Failed to update lesson path');
    }
  };
  if (loading) {
    return (
      <SkyLoadingScreen
        message="Loading batch"
        subtext="Fetching lectures and learners"
        compact
      />
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
  const isProject = selectedBatch.batchType === 'project';

  return (
    <div
      className={`teacher-batch-details-page sky-batch-page${
        isOneToOne ? ' sky-batch-page--one-to-one' : ''
      }${isProject ? ' sky-batch-page--project' : ''}`}
    >
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
              {isProject && <span className="sky-badge sky-badge-type">Project Class</span>}
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
              scrollToClassroom();
              setShowAddVideoModal(true);
            }}
          >
            Add lecture
          </button>
        </div>
      </div>

      <div className="batch-content sky-batch-single">
        <div className="main-content">
          <section className="sky-batch-section sky-batch-section--live">
            <MeetLiveClassesPanel
              batchId={selectedBatch.id}
              batchLabel={selectedBatch.name}
              batchSchedule={selectedBatch.schedule}
              studioLayout
              compact
              title={`Live Classes · ${selectedBatch.name}`}
            />
          </section>

          <div className="sky-batch-manage-grid">
          <section
            ref={classroomSectionRef}
            id="classroom"
            className="sky-batch-section sky-batch-section--classroom"
          >
            <div className="sky-batch-section__head">
              <div>
                <h2>Classroom</h2>
                <p className="sky-muted">
                  {filteredVideos.length} lecture{filteredVideos.length === 1 ? '' : 's'} · recordings & notes
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
                <button
                  type="button"
                  className="sky-btn sky-btn-primary"
                  onClick={() => setShowAddVideoModal(true)}
                >
                  Add lecture
                </button>
              </div>
            </div>

            <div className="sky-batch-section__toolbar sky-batch-section__toolbar--classroom">
                <div className="sky-batch-notes-inline">
                  <strong>Batch notes</strong>
                  {selectedBatch.notesFile ? (
                    <>
                      <span className="sky-muted sky-batch-notes-inline__name" title={selectedBatch.notesFile.fileName}>
                        {selectedBatch.notesFile.fileName}
                      </span>
                      <button
                        type="button"
                        className="sky-btn sky-btn-secondary sky-btn--sm"
                        onClick={async () => {
                          try {
                            await downloadAuthenticatedFile(
                              `/api/teacher/batches/${selectedBatch.id}/notes/download`,
                              { filename: selectedBatch.notesFile.fileName }
                            );
                          } catch (err) {
                            window.alert(err.message || 'Failed to download batch notes');
                          }
                        }}
                      >
                        Download
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="sky-muted">Optional PDF/DOC for learners</span>
                      <input
                        type="file"
                        id="batch-notes-file"
                        accept=".pdf,.doc,.docx,.zip"
                        onChange={(e) => setNotesFile(e.target.files?.[0] || null)}
                        style={{ display: 'none' }}
                      />
                      <button
                        type="button"
                        className="sky-btn sky-btn-secondary sky-btn--sm"
                        disabled={uploadingNotes}
                        onClick={() => document.getElementById('batch-notes-file')?.click()}
                      >
                        {notesFile && !notesTargetVideoId ? 'Change file' : 'Choose file'}
                      </button>
                      {notesFile && !notesTargetVideoId && (
                        <button
                          type="button"
                          className="sky-btn sky-btn-primary sky-btn--sm"
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

            <div
              className="sky-batch-section__scroll sky-batch-section__scroll--classroom"
              aria-label="Classroom lectures"
            >
              <div className="video-grid sky-lecture-grid">
                {filteredVideos.map((video) => {
                  const videoSource = detectVideoSource(video);
                  const ytId =
                    YouTubeUtils.extractVideoId(video.youtubeVideoId) ||
                    YouTubeUtils.extractVideoId(video.youtubeEmbedUrl) ||
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
                          <div className="video-placeholder sky-lecture-placeholder">
                            {videoSource === 'drive' ? 'Drive' : 'Lecture'}
                          </div>
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
                            {video.duration ? <span className="duration">{video.duration}</span> : null}
                          </div>
                          {video.notesAvailable ? (
                            <div className="notes-indicator">Notes available</div>
                          ) : null}
                          {video.linkedAssessmentId ? (
                            <div className="notes-indicator">Quiz linked</div>
                          ) : null}
                          <div
                            className="notes-indicator"
                            style={{ color: video.studentVisible === false ? '#b45309' : '#0f766e' }}
                          >
                            {video.studentVisible === false ? 'Hidden from students' : 'Visible to students'}
                          </div>
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
                            onClick={() => handleToggleStudentVisibility(video)}
                          >
                            {video.studentVisible === false ? 'Show to students' : 'Hide from students'}
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
                            accept=".pdf,.doc,.docx,.zip"
                            className="sky-lecture-notes-input"
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
          </section>

          <section id="students" className="sky-batch-section sky-batch-section--students">
            <div className="sky-batch-section__head">
              <div>
                <h2>Students</h2>
                <p className="section-subtitle">
                  {students.length} learner{students.length === 1 ? '' : 's'}
                  {attendanceSummary ? (
                    <>
                      {' · '}
                      {attendanceSummary.sessionsTotal} sessions · Avg join{' '}
                      {attendanceSummary.batchJoinRateAvg}% ·{' '}
                      {attendanceSummary.belowThresholdCount} below {attendanceSummary.threshold}%
                    </>
                  ) : (
                    ' · contact details stay private'
                  )}
                </p>
              </div>
              <button
                type="button"
                className="sky-btn sky-btn-ghost sky-btn--sm"
                onClick={loadAttendanceSummary}
                disabled={attendanceLoading}
              >
                {attendanceLoading ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>

            <div className="sky-batch-section__toolbar sky-batch-section__toolbar--students">
                <input
                  type="search"
                  className="form-input-modern"
                  placeholder="Filter by name or enrollment…"
                  value={studentNameFilter}
                  onChange={(e) => setStudentNameFilter(e.target.value)}
                  aria-label="Filter students by name"
                />
                <span className="stat-item">
                  <span className="stat-number">
                    {
                      students.filter((s) => {
                        const q = studentNameFilter.trim().toLowerCase();
                        if (!q) return true;
                        return [s.name, s.enrollmentNumber, s.course]
                          .filter(Boolean)
                          .some((v) => String(v).toLowerCase().includes(q));
                      }).length
                    }
                  </span>
                  <span className="stat-label">shown</span>
                </span>
              </div>
            <div
              className="sky-batch-section__scroll sky-batch-section__scroll--students"
              aria-label="Students and attendance"
            >
              <div className="teacher-students-table-wrap">
                <table className="teacher-students-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Program</th>
                      <th>Enrollment</th>
                      <th>Join %</th>
                      <th>Status</th>
                      <th>Certificate</th>
                      <th>Chat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students
                      .filter((s) => {
                        const q = studentNameFilter.trim().toLowerCase();
                        if (!q) return true;
                        return [s.name, s.enrollmentNumber, s.course]
                          .filter(Boolean)
                          .some((v) => String(v).toLowerCase().includes(q));
                      })
                      .map((student) => {
                        const att = attendanceByStudent[String(student.id || student._id)];
                        return (
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
                          {att ? (
                            <span
                              className={`live-stat ${
                                att.belowThreshold ? 'live-stat--absent' : 'live-stat--present'
                              }`}
                            >
                              {att.joinRate}%
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>
                          <span className={`status-badge ${student.status || 'active'}`}>
                            {student.status || 'active'}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="sky-btn sky-btn-ghost"
                            onClick={async () => {
                              try {
                                const token = localStorage.getItem('token');
                                const res = await fetch(`${getApiBaseUrl()}/api/certificates/issue`, {
                                  method: 'POST',
                                  headers: {
                                    Authorization: `Bearer ${token}`,
                                    'Content-Type': 'application/json'
                                  },
                                  body: JSON.stringify({
                                    studentId: student.id || student._id,
                                    batchId
                                  })
                                });
                                const data = await res.json().catch(() => ({}));
                                if (!res.ok) throw new Error(data.message || 'Issue failed');
                                alert(data.message || 'Certificate issued');
                              } catch (err) {
                                setError(err.message || 'Issue failed');
                              }
                            }}
                          >
                            Issue
                          </button>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="sky-btn sky-btn-secondary sky-btn--sm"
                            onClick={() => scrollToChat(student.id || student._id)}
                          >
                            Message
                          </button>
                        </td>
                      </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
              {students.length === 0 && (
                <div className="empty-state">
                  <p>No learners assigned to this batch yet.</p>
                </div>
              )}
            </div>
          </section>
          </div>

          <div className="sky-batch-comm-grid">
          <section id="materials" className="sky-batch-section sky-batch-section--materials">
            <div className="sky-batch-section__head">
              <div>
                <h2>Materials</h2>
                <p className="sky-muted">Files and resources shared with this batch</p>
              </div>
            </div>
            <div
              className="sky-batch-section__scroll sky-batch-section__scroll--materials"
              aria-label="Batch materials"
            >
              <TeacherMaterialsPanel batchId={selectedBatch.id} batchName={selectedBatch.name} compact />
            </div>
          </section>

          <section id="batch-messages" className="sky-batch-section sky-batch-section--chat">
            <div className="sky-batch-section__head">
              <div>
                <h2>Messages</h2>
                <p className="sky-muted">
                  Chat with learners in this batch — conversations are grouped here by batch
                </p>
              </div>
            </div>
            <div className="sky-batch-section__scroll sky-batch-section__scroll--chat">
              {currentUserId ? (
                <DirectChatPanel
                  role="teacher"
                  currentUserId={currentUserId}
                  batchId={selectedBatch.id}
                  batchName={selectedBatch.name}
                  initialPeerId={chatPeerId}
                  embedded
                />
              ) : (
                <p className="sky-muted">Sign in to use batch chat.</p>
              )}
            </div>
          </section>
          </div>
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
