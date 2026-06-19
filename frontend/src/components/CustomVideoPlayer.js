import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { ToastContainer, showToast } from './Toast';
import './CustomVideoPlayer.css';

// YouTube IFrame API loader
let youtubeAPIReady = false;
let youtubeAPILoading = false;

const loadYouTubeAPI = () => {
  return new Promise((resolve) => {
    if (youtubeAPIReady) {
      resolve();
      return;
    }

    if (!youtubeAPILoading) {
      youtubeAPILoading = true;
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

      window.onYouTubeIframeAPIReady = () => {
        youtubeAPIReady = true;
        resolve();
      };
    } else {
      const checkReady = () => {
        if (youtubeAPIReady) {
          resolve();
        } else {
          setTimeout(checkReady, 100);
        }
      };
      checkReady();
    }
  });
};

const CustomVideoPlayer = ({ video, onClose, resumePosition = 0, onProgressUpdate }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [firebaseVideoUrl, setFirebaseVideoUrl] = useState(null);
  const [youtubeVideoUrl, setYoutubeVideoUrl] = useState(null);
  const [youtubePlayer, setYoutubePlayer] = useState(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [hasStartedPlaying, setHasStartedPlaying] = useState(false);

  // Sidebar interaction states
  const [showSidebar, setShowSidebar] = useState(true);
  const [sidebarTab, setSidebarTab] = useState('notes'); // 'qa', 'notes', 'bookmarks'
  const [qaThreads, setQaThreads] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [notes, setNotes] = useState([]);
  const [newNoteText, setNewNoteText] = useState('');
  const [bookmarks, setBookmarks] = useState([]);
  const [bookmarkTopic, setBookmarkTopic] = useState('');
  const [bookmarkNotes, setBookmarkNotes] = useState('');

  const videoRef = useRef(null);
  const youtubeContainerRef = useRef(null);
  const containerRef = useRef(null);
  const controlsTimeoutRef = useRef(null);
  const videoViewLoggedRef = useRef(false);

  const detectVideoSource = (video) => {
    if (video.videoSource) return video.videoSource;
    if (video.youtubeVideoUrl) {
      if (video.youtubeVideoUrl.includes('youtu.be/')) return 'youtube-url';
      if (video.youtubeVideoUrl.includes('youtube.com/watch')) return 'youtube';
    }
    if (video.videoUrl) {
      if (video.videoUrl.includes('youtu.be/')) return 'youtube-url';
      if (video.videoUrl.includes('youtube.com/watch')) return 'youtube';
      if (video.videoUrl.includes('youtube.com/embed')) return 'youtube';
    }
    return 'firebase';
  };

  const convertToEmbedUrl = (url) => {
    if (!url) return null;
    const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/;
    const match = url.match(regex);
    const videoId = match ? match[1] : null;
    return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
  };

  // Fetch Q&A, Notes, and Bookmarks on load
  useEffect(() => {
    if (video.id) {
      fetchQaThreads();
      fetchNotes();
      fetchBookmarks();
    }
  }, [video]);

  const fetchQaThreads = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`/api/classroom-interaction/qa/${video.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setQaThreads(res.data);
    } catch (err) {
      console.error('Failed to load QA threads', err);
    }
  };

  const fetchNotes = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`/api/classroom-interaction/notes/${video.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotes(res.data);
    } catch (err) {
      console.error('Failed to load notes', err);
    }
  };

  const fetchBookmarks = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/classroom-interaction/bookmarks', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBookmarks(res.data);
    } catch (err) {
      console.error('Failed to load bookmarks', err);
    }
  };

  const handlePostMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    try {
      const token = localStorage.getItem('token');
      const activeThread = qaThreads[0]; // Simple single thread per student/lesson
      await axios.post('/api/classroom-interaction/qa', {
        classroomId: video.id,
        text: newMessage,
        threadId: activeThread ? activeThread._id : null
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNewMessage('');
      fetchQaThreads();
      showToast('Message sent to teacher!', 'success');
    } catch (err) {
      showToast('Failed to post query', 'error');
    }
  };

  const handleSaveNote = async () => {
    if (!newNoteText.trim()) return;
    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/classroom-interaction/notes', {
        classroomId: video.id,
        noteText: newNoteText,
        videoTimestamp: Math.round(currentTime)
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNewNoteText('');
      fetchNotes();
      showToast('Private note saved!', 'success');
    } catch (err) {
      showToast('Failed to save note', 'error');
    }
  };

  const handleDeleteNote = async (noteId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/api/classroom-interaction/notes/${noteId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchNotes();
      showToast('Note deleted', 'success');
    } catch (err) {
      showToast('Failed to delete note', 'error');
    }
  };

  const handleSaveBookmark = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/classroom-interaction/bookmarks', {
        classroomId: video.id,
        topicName: bookmarkTopic,
        notes: bookmarkNotes
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBookmarkTopic('');
      setBookmarkNotes('');
      fetchBookmarks();
      showToast('Lecture bookmarked!', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to add bookmark', 'error');
    }
  };

  const handleRemoveBookmark = async (bookmarkId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/api/classroom-interaction/bookmarks/${bookmarkId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchBookmarks();
      showToast('Bookmark removed', 'success');
    } catch (err) {
      showToast('Failed to remove bookmark', 'error');
    }
  };

  const seekToTime = (seconds) => {
    if (youtubePlayer && playerReady) {
      youtubePlayer.seekTo(seconds, true);
    } else if (videoRef.current) {
      videoRef.current.currentTime = seconds;
    }
    setCurrentTime(seconds);
  };

  // Video Initializer
  useEffect(() => {
    const videoSource = detectVideoSource(video);
    if (videoSource === 'youtube-url') {
      const embedUrl = video.youtubeEmbedUrl || convertToEmbedUrl(video.youtubeVideoUrl || video.videoUrl);
      if (embedUrl) {
        setYoutubeVideoUrl(embedUrl);
        initializeYouTubePlayer(embedUrl);
      } else {
        setError('Invalid YouTube URL format');
        setIsLoading(false);
      }
    } else if (videoSource === 'youtube' && video.youtubeEmbedUrl) {
      setYoutubeVideoUrl(video.youtubeEmbedUrl);
      initializeYouTubePlayer(video.youtubeEmbedUrl);
    } else if (videoSource === 'firebase' && video.id) {
      const fetchFirebaseUrl = async () => {
        try {
          const token = localStorage.getItem('token');
          const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/classroom/play/${video.id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (response.ok) {
            const data = await response.json();
            setFirebaseVideoUrl(data.signedUrl);
          } else {
            throw new Error('Failed to fetch video URL');
          }
        } catch (error) {
          setError('Failed to load video. Access denied or video not found.');
          setIsLoading(false);
        }
      };
      fetchFirebaseUrl();
    } else if (video.videoUrl && video.videoUrl.includes('youtube.com/embed')) {
      setYoutubeVideoUrl(video.videoUrl);
      initializeYouTubePlayer(video.videoUrl);
    } else {
      setError('Unsupported video source');
      setIsLoading(false);
    }
  }, [video]);

  // Log video view
  useEffect(() => {
    if (hasStartedPlaying && video?.id && !videoViewLoggedRef.current) {
      videoViewLoggedRef.current = true;
      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
      fetch(`${apiUrl}/api/activity/video-view`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ videoId: video.id })
      }).catch(() => { });
    }
  }, [hasStartedPlaying, video?.id]);

  const initializeYouTubePlayer = async (embedUrl) => {
    try {
      await loadYouTubeAPI();
      const videoId = embedUrl.match(/\/embed\/([^?]+)/)?.[1];
      if (!videoId) throw new Error('Invalid YouTube video ID');

      if (!youtubeContainerRef.current) {
        setTimeout(() => initializeYouTubePlayer(embedUrl), 100);
        return;
      }

      new window.YT.Player(youtubeContainerRef.current, {
        videoId: videoId,
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          enablejsapi: 1,
          iv_load_policy: 3,
          modestbranding: 1,
          rel: 0,
          showinfo: 0,
          start: Math.floor(resumePosition)
        },
        events: {
          onReady: (event) => {
            setYoutubePlayer(event.target);
            setPlayerReady(true);
            setIsLoading(false);
            event.target.setVolume(volume * 100);
            const videoDuration = event.target.getDuration();
            setDuration(videoDuration);
            if (resumePosition > 0 && resumePosition < videoDuration) {
              event.target.seekTo(resumePosition);
            }
          },
          onStateChange: (event) => {
            if (event.data === window.YT.PlayerState.PLAYING) {
              setIsPlaying(true);
              if (!hasStartedPlaying) setHasStartedPlaying(true);
            } else if (event.data === window.YT.PlayerState.PAUSED) {
              setIsPlaying(false);
            } else if (event.data === window.YT.PlayerState.ENDED) {
              setIsPlaying(false);
              if (onProgressUpdate) onProgressUpdate(video.id, 100, duration);
            }
          }
        }
      });
    } catch (error) {
      setError('Failed to load video player');
      setIsLoading(false);
    }
  };

  // Time progress interval
  useEffect(() => {
    let interval;
    if ((youtubePlayer && playerReady) || videoRef.current) {
      interval = setInterval(() => {
        if (youtubePlayer && playerReady) {
          const ct = youtubePlayer.getCurrentTime();
          const dur = youtubePlayer.getDuration();
          setCurrentTime(ct);
          setDuration(dur);
        } else if (videoRef.current) {
          setCurrentTime(videoRef.current.currentTime);
          setDuration(videoRef.current.duration);
        }
      }, 100);
    }
    return () => clearInterval(interval);
  }, [youtubePlayer, playerReady, firebaseVideoUrl]);

  const handlePlay = () => { setIsPlaying(true); setHasStartedPlaying(true); };
  const handlePause = () => { setIsPlaying(false); };
  const handleEnded = () => { setIsPlaying(false); setCurrentTime(0); };
  const handleError = () => { setIsLoading(false); setError('Error serving video.'); };

  const togglePlay = () => {
    if (youtubePlayer && playerReady) {
      if (isPlaying) youtubePlayer.pauseVideo();
      else youtubePlayer.playVideo();
    } else if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play();
    }
  };

  const handleSeek = (e) => {
    const seekTime = parseFloat(e.target.value);
    seekToTime(seekTime);
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (youtubePlayer && playerReady) youtubePlayer.setVolume(newVolume * 100);
    else if (videoRef.current) videoRef.current.volume = newVolume;
  };

  const handleSpeedChange = (e) => {
    const newSpeed = parseFloat(e.target.value);
    setPlaybackSpeed(newSpeed);
    if (youtubePlayer && playerReady) youtubePlayer.setPlaybackRate(newSpeed);
    else if (videoRef.current) videoRef.current.playbackRate = newSpeed;
  };

  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      ref={containerRef}
      className="custom-video-player"
      style={{ display: 'flex', flexDirection: 'row', width: '100vw', height: '100vh', background: '#0f172a' }}
      onMouseMove={() => setShowControls(true)}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      <ToastContainer />

      {/* Left Column: Video Container */}
      <div style={{ flex: showSidebar ? 3 : 1, display: 'flex', flexDirection: 'column', position: 'relative', height: '100%', overflow: 'hidden' }}>
        <div className="video-header">
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="video-container" style={{ height: 'calc(100% - 80px)' }}>
          {isLoading && (
            <div className="loading-overlay">
              <div className="loading-spinner"></div>
              <p>Loading lecture...</p>
            </div>
          )}

          {error && (
            <div className="error-overlay">
              <p>{error}</p>
            </div>
          )}

          {firebaseVideoUrl && (
            <video
              ref={videoRef}
              className="firebase-video-player"
              controls
              playsInline
              preload="metadata"
              onLoadedData={() => { setIsLoading(false); if (videoRef.current) setDuration(videoRef.current.duration); }}
              onPlay={handlePlay}
              onPause={handlePause}
              onEnded={handleEnded}
              onError={handleError}
              key={firebaseVideoUrl}
            >
              <source src={firebaseVideoUrl} type="video/mp4" />
            </video>
          )}

          {youtubeVideoUrl && (
            <div
              ref={youtubeContainerRef}
              className="youtube-video-player"
              style={{ width: '100%', height: '100%', backgroundColor: '#000' }}
            />
          )}

          <div className={`video-controls ${showControls ? 'visible' : 'hidden'}`}>
            <div className="controls-row">
              <button className="control-btn" onClick={togglePlay}>
                {isPlaying ? '⏸️' : '▶️'}
              </button>

              <div className="time-container">
                <span className="current-time">{formatTime(currentTime)}</span>
                <input
                  type="range"
                  className="seek-bar"
                  min="0"
                  max={duration || 0}
                  value={currentTime}
                  onChange={handleSeek}
                />
                <span className="total-time">{formatTime(duration)}</span>
              </div>

              <div className="right-controls">
                <button
                  className="control-btn"
                  onClick={() => setShowSidebar(!showSidebar)}
                  title="Toggle Workspace Sidebar"
                >
                  {showSidebar ? '📖 Close Notes' : '📖 Open Notes & QA'}
                </button>

                <div className="volume-control">
                  <span>🔊</span>
                  <input
                    type="range"
                    className="volume-slider"
                    min="0"
                    max="1"
                    step="0.1"
                    value={volume}
                    onChange={handleVolumeChange}
                  />
                </div>

                <select value={playbackSpeed} onChange={handleSpeedChange} className="speed-control">
                  <option value="0.5">0.5x</option>
                  <option value="1">1x</option>
                  <option value="1.5">1.5x</option>
                  <option value="2">2x</option>
                </select>

                <button className="control-btn" onClick={handleFullscreen}>
                  {isFullscreen ? '🗗' : '🗖'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Interaction Workspace */}
      {showSidebar && (
        <div style={{ flex: 1, minWidth: '320px', background: '#1e293b', borderLeft: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', height: '100%', color: 'white', fontFamily: 'sans-serif' }}>
          {/* Tabs Bar */}
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.1)', background: '#0f172a' }}>
            <button
              onClick={() => setSidebarTab('notes')}
              style={{ flex: 1, padding: '16px', background: sidebarTab === 'notes' ? '#1e293b' : 'none', border: 'none', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}
            >
              ✏️ Notes
            </button>
            <button
              onClick={() => setSidebarTab('qa')}
              style={{ flex: 1, padding: '16px', background: sidebarTab === 'qa' ? '#1e293b' : 'none', border: 'none', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}
            >
              💬 Q&A
            </button>
            <button
              onClick={() => setSidebarTab('bookmarks')}
              style={{ flex: 1, padding: '16px', background: sidebarTab === 'bookmarks' ? '#1e293b' : 'none', border: 'none', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}
            >
              🔖 Bookmarks
            </button>
          </div>

          {/* Tab Content Panel */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column' }}>

            {/* NOTES TAB */}
            {sidebarTab === 'notes' && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <h4 style={{ margin: '0 0 12px 0' }}>Private Lesson Notes</h4>
                <div style={{ marginBottom: '16px' }}>
                  <textarea
                    rows="3"
                    placeholder="Type note content... automatically timestamped."
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    style={{ width: '100%', padding: '10px', background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '8px', resize: 'none' }}
                  />
                  <button
                    onClick={handleSaveNote}
                    style={{ width: '100%', marginTop: '8px', padding: '10px', background: '#4f46e5', border: 'none', borderRadius: '8px', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    Save Note at {formatTime(currentTime)}
                  </button>
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {notes.map(note => (
                    <div key={note._id} style={{ background: '#0f172a', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span
                          onClick={() => seekToTime(note.videoTimestamp)}
                          style={{ color: '#818cf8', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'underline' }}
                        >
                          ⏱️ {formatTime(note.videoTimestamp)}
                        </span>
                        <button
                          onClick={() => handleDeleteNote(note._id)}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.85rem' }}
                        >
                          Delete
                        </button>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.9rem', color: '#cbd5e1', lineHeight: '1.4' }}>{note.noteText}</p>
                    </div>
                  ))}
                  {notes.length === 0 && <p style={{ color: '#94a3b8', fontSize: '0.85rem', textAlign: 'center', marginTop: '20px' }}>No notes taken for this lesson yet.</p>}
                </div>
              </div>
            )}

            {/* QA TAB */}
            {sidebarTab === 'qa' && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <h4 style={{ margin: '0 0 4px 0' }}>Private Q&A Thread</h4>
                <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0 0 16px 0' }}>Your questions are sent directly to the instructor. Student-to-student chat is disabled.</p>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px', maxHeight: 'calc(100vh - 340px)', overflowY: 'auto' }}>
                  {qaThreads[0]?.messages.map((msg, i) => {
                    const isSelf = msg.senderId === localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')).id : false;
                    return (
                      <div key={i} style={{ alignSelf: msg.role === 'student' ? 'flex-end' : 'flex-start', background: msg.role === 'student' ? '#4f46e5' : '#334155', padding: '10px 14px', borderRadius: '12px', maxWidth: '85%' }}>
                        <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', marginBottom: '4px', fontWeight: 'bold' }}>{msg.senderName} ({msg.role.toUpperCase()})</div>
                        <div style={{ fontSize: '0.9rem', lineHeight: '1.4' }}>{msg.text}</div>
                      </div>
                    );
                  })}
                  {(!qaThreads.length || !qaThreads[0]?.messages.length) && (
                    <p style={{ color: '#94a3b8', fontSize: '0.85rem', textAlign: 'center', marginTop: '20px' }}>Have questions about this lecture? Type below to ask your teacher.</p>
                  )}
                </div>

                <form onSubmit={handlePostMessage} style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Ask a question..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    style={{ flex: 1, padding: '10px', background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '8px' }}
                  />
                  <button type="submit" style={{ padding: '10px 16px', background: '#4f46e5', border: 'none', borderRadius: '8px', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>
                    Send
                  </button>
                </form>
              </div>
            )}

            {/* BOOKMARKS TAB */}
            {sidebarTab === 'bookmarks' && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <h4 style={{ margin: '0 0 12px 0' }}>Bookmark / Revision Queue</h4>

                <div style={{ background: '#0f172a', padding: '16px', borderRadius: '8px', marginBottom: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ marginBottom: '10px' }}>
                    <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Topic Name</label>
                    <input
                      type="text"
                      placeholder="e.g. JWT Interceptors"
                      value={bookmarkTopic}
                      onChange={(e) => setBookmarkTopic(e.target.value)}
                      style={{ width: '100%', padding: '8px', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '6px' }}
                    />
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Revision Notes</label>
                    <textarea
                      rows="2"
                      placeholder="Add quick revision points..."
                      value={bookmarkNotes}
                      onChange={(e) => setBookmarkNotes(e.target.value)}
                      style={{ width: '100%', padding: '8px', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '6px', resize: 'none' }}
                    />
                  </div>
                  <button
                    onClick={handleSaveBookmark}
                    style={{ width: '100%', padding: '10px', background: '#10b981', border: 'none', borderRadius: '6px', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    Add to Revision Queue
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {bookmarks.filter(b => b.classroomId?._id === video.id || b.classroomId === video.id).map(bookmark => (
                    <div key={bookmark._id} style={{ background: '#0f172a', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <strong style={{ color: '#10b981' }}>📌 {bookmark.topicName || 'Bookmarked Session'}</strong>
                        <button
                          onClick={() => handleRemoveBookmark(bookmark._id)}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.8rem' }}
                        >
                          Remove
                        </button>
                      </div>
                      {bookmark.notes && <p style={{ margin: 0, fontSize: '0.85rem', color: '#cbd5e1' }}>{bookmark.notes}</p>}
                    </div>
                  ))}
                  {bookmarks.length === 0 && <p style={{ color: '#94a3b8', fontSize: '0.85rem', textAlign: 'center', marginTop: '20px' }}>Not bookmarked yet.</p>}
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
};

export default CustomVideoPlayer;
