import React, { useState, useRef, useEffect } from 'react';
import './CustomVideoPlayer.css';

const CustomVideoPlayer = ({ video, onClose }) => {
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
  
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const controlsTimeoutRef = useRef(null);

  // Determine video source and set appropriate URL
  useEffect(() => {
    if (video.videoSource === 'youtube-url' && video.youtubeEmbedUrl) {
      setYoutubeVideoUrl(video.youtubeEmbedUrl);
      setIsLoading(false);
      console.log('📺 Manual YouTube video URL loaded:', video.youtubeEmbedUrl);
    } else if (video.videoSource === 'youtube' && video.youtubeEmbedUrl) {
      setYoutubeVideoUrl(video.youtubeEmbedUrl);
      setIsLoading(false);
      console.log('📺 YouTube video URL loaded:', video.youtubeEmbedUrl);
    } else if (video.videoSource === 'firebase' && video.id) {
      const fetchFirebaseUrl = async () => {
        try {
          const token = localStorage.getItem('token');
          const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/classroom/play/${video.id}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            setFirebaseVideoUrl(data.signedUrl);
            console.log('🔥 Firebase Storage URL loaded:', data.signedUrl.substring(0, 100) + '...');
          } else {
            throw new Error('Failed to fetch video URL');
          }
        } catch (error) {
          console.error('❌ Error fetching Firebase video URL:', error);
          setError('Failed to load video. Access denied or video not found.');
          setIsLoading(false);
        }
      };
      
      fetchFirebaseUrl();
    } else if (video.videoUrl && video.videoUrl.includes('youtube.com/embed')) {
      // Handle legacy YouTube embed URLs
      setYoutubeVideoUrl(video.videoUrl);
      setIsLoading(false);
      console.log('📺 Legacy YouTube video URL loaded:', video.videoUrl);
    } else {
      setError('Unsupported video source or missing video information');
      setIsLoading(false);
    }
  }, [video]);

  // Auto-hide controls after 3 seconds
  useEffect(() => {
    const resetControlsTimeout = () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      controlsTimeoutRef.current = setTimeout(() => {
        if (isPlaying) {
          setShowControls(false);
        }
      }, 3000);
    };

    if (isPlaying) {
      resetControlsTimeout();
    }

    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [isPlaying]);

  // Show controls on mouse movement
  const handleMouseMove = () => {
    setShowControls(true);
    if (isPlaying) {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  };

  // Video event handlers
  const handleLoadedData = () => {
    setIsLoading(false);
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handlePlay = () => {
    setIsPlaying(true);
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleError = () => {
    setIsLoading(false);
    setError('Failed to load video. The video might be private or not accessible.');
  };

  // Control functions
  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
    }
  };

  const handleSeek = (e) => {
    if (videoRef.current) {
      videoRef.current.currentTime = e.target.value;
      setCurrentTime(e.target.value);
    }
  };

  const handleVolumeChange = (e) => {
    if (videoRef.current) {
      videoRef.current.volume = e.target.value;
      setVolume(e.target.value);
    }
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
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      {/* Header */}
      <div className="video-header">
        <button className="close-btn" onClick={onClose}>
          ✕
        </button>
        <div className="video-title">
          <h3>{video.title}</h3>
          <div className="video-meta">
            <span>📅 {new Date(video.date || video.createdAt).toLocaleDateString()}</span>
            <span>⏱️ {video.duration}</span>
            <span>👨‍🏫 {video.instructor}</span>
            {video.videoSource === 'firebase' && <span>🔥 Firebase Storage</span>}
            {video.videoSource === 'youtube' && <span>📺 YouTube Private</span>}
            {video.videoSource === 'youtube-url' && <span>📺 YouTube Manual</span>}
            {!video.videoSource && video.videoUrl?.includes('youtube.com') && <span>📺 YouTube</span>}
          </div>
        </div>
      </div>

      {/* Video Container */}
      <div className="video-container">
        {isLoading && (
          <div className="loading-overlay">
            <div className="loading-spinner"></div>
            <p>Loading video...</p>
          </div>
        )}
        
        {error && (
          <div className="error-overlay">
            <div className="error-icon">⚠️</div>
            <p>{error}</p>
          </div>
        )}

        {/* Firebase Storage Video Player */}
        {firebaseVideoUrl && (
          <video
            ref={videoRef}
            className="firebase-video-player"
            controls
            playsInline
            preload="metadata"
            onLoadedData={handleLoadedData}
            onTimeUpdate={handleTimeUpdate}
            onPlay={handlePlay}
            onPause={handlePause}
            onEnded={handleEnded}
            onError={handleError}
            key={firebaseVideoUrl}
          >
            <source src={firebaseVideoUrl} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        )}

        {/* YouTube Video Player */}
        {youtubeVideoUrl && (
          <iframe
            className="youtube-video-player"
            src={youtubeVideoUrl}
            title={video.title}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            onLoad={() => {
              setIsLoading(false);
              console.log('📺 YouTube iframe loaded successfully');
            }}
            onError={() => {
              setError('Failed to load YouTube video');
              setIsLoading(false);
            }}
          />
        )}

        {/* Custom Controls */}
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
              
              <select
                value={playbackSpeed}
                onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                className="speed-control"
              >
                <option value="0.5">0.5x</option>
                <option value="0.75">0.75x</option>
                <option value="1">1x</option>
                <option value="1.25">1.25x</option>
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
  );
};

export default CustomVideoPlayer;
