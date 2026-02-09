import React, { useState, useRef, useEffect } from 'react';
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
      // Wait for API to be ready
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
  
  const videoRef = useRef(null);
  const youtubeContainerRef = useRef(null);
  const containerRef = useRef(null);
  const controlsTimeoutRef = useRef(null);

  // Determine video source and initialize player
  useEffect(() => {
    if (video.videoSource === 'youtube-url' && video.youtubeEmbedUrl) {
      setYoutubeVideoUrl(video.youtubeEmbedUrl);
      initializeYouTubePlayer(video.youtubeEmbedUrl);
    } else if (video.videoSource === 'youtube' && video.youtubeEmbedUrl) {
      setYoutubeVideoUrl(video.youtubeEmbedUrl);
      initializeYouTubePlayer(video.youtubeEmbedUrl);
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
      initializeYouTubePlayer(video.videoUrl);
    } else {
      setError('Unsupported video source or missing video information');
      setIsLoading(false);
    }
  }, [video]);

  // Initialize YouTube player
  const initializeYouTubePlayer = async (embedUrl) => {
    try {
      await loadYouTubeAPI();
      
      // Extract video ID from embed URL
      const videoId = embedUrl.match(/\/embed\/([^?]+)/)?.[1];
      if (!videoId) {
        throw new Error('Invalid YouTube video ID');
      }

      // Wait for container to be available
      if (!youtubeContainerRef.current) {
        setTimeout(() => initializeYouTubePlayer(embedUrl), 100);
        return;
      }

      // Create YouTube player
      const player = new window.YT.Player(youtubeContainerRef.current, {
        videoId: videoId,
        playerVars: {
          autoplay: 0,
          controls: 0, // Hide YouTube controls
          disablekb: 1, // Disable keyboard controls
          enablejsapi: 1,
          iv_load_policy: 3, // Hide annotations
          modestbranding: 1, // Hide YouTube logo
          rel: 0, // Hide related videos
          showinfo: 0,
          start: Math.floor(resumePosition) // Start from resume position
        },
        events: {
          onReady: (event) => {
            console.log('📺 YouTube player ready');
            setYoutubePlayer(event.target);
            setPlayerReady(true);
            setIsLoading(false);
            
            // Set initial volume
            event.target.setVolume(volume * 100);
            
            // Get video duration immediately
            const videoDuration = event.target.getDuration();
            setDuration(videoDuration);
            console.log('📺 Video duration:', videoDuration);
            
            // Set initial position if resume position is provided
            if (resumePosition > 0 && resumePosition < videoDuration) {
              event.target.seekTo(resumePosition);
              console.log('📺 Resumed from position:', resumePosition);
            }
          },
          onStateChange: (event) => {
            // Update playing state based on YouTube player states
            if (event.data === window.YT.PlayerState.PLAYING) {
              setIsPlaying(true);
              if (!hasStartedPlaying) {
                setHasStartedPlaying(true);
                console.log('📺 Video started playing');
              }
            } else if (event.data === window.YT.PlayerState.PAUSED) {
              setIsPlaying(false);
            } else if (event.data === window.YT.PlayerState.ENDED) {
              setIsPlaying(false);
              if (onProgressUpdate) {
                onProgressUpdate(video.id, 100, duration);
              }
            } else if (event.data === window.YT.PlayerState.BUFFERING) {
              // Keep playing state during buffering
              setIsPlaying(true);
            } else if (event.data === window.YT.PlayerState.CUED) {
              // Video is cued but not playing
              setIsPlaying(false);
            }
          },
          onTimeUpdate: (event) => {
            const currentVideoTime = event.target.getCurrentTime();
            setCurrentTime(currentVideoTime);
            
            // Update progress periodically
            if (onProgressUpdate && hasStartedPlaying && currentVideoTime > 0) {
              const progress = (currentVideoTime / duration) * 100;
              // Update progress every 5 seconds or 5% progress
              if (Math.floor(currentVideoTime) % 5 === 0 || Math.floor(progress) % 5 === 0) {
                onProgressUpdate(video.id, progress, currentVideoTime);
              }
            }
          }
        }
      });
    } catch (error) {
      console.error('Error initializing YouTube player:', error);
      setError('Failed to load video player');
      setIsLoading(false);
    }
  };

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

  // Time tracking for both YouTube and Firebase videos
  useEffect(() => {
    let interval;

    // Always track time when player is ready, regardless of playing state
    if ((youtubePlayer && playerReady) || videoRef.current) {
      interval = setInterval(() => {
        if (youtubePlayer && playerReady) {
          // YouTube video time tracking
          const currentTime = youtubePlayer.getCurrentTime();
          const videoDuration = youtubePlayer.getDuration();
          setCurrentTime(currentTime);
          setDuration(videoDuration);
        } else if (videoRef.current) {
          // Firebase video time tracking
          setCurrentTime(videoRef.current.currentTime);
          setDuration(videoRef.current.duration);
        }
      }, 100); // Update every 100ms for smooth progress bar
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [youtubePlayer, playerReady, firebaseVideoUrl]);

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
    if (youtubePlayer && playerReady) {
      // YouTube player controls
      if (isPlaying) {
        youtubePlayer.pauseVideo();
      } else {
        youtubePlayer.playVideo();
      }
    } else if (videoRef.current) {
      // Firebase video controls
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
    }
  };

  const handleSeek = (e) => {
    const seekTime = parseFloat(e.target.value);
    setCurrentTime(seekTime);
    
    if (youtubePlayer && playerReady) {
      // YouTube player seek
      youtubePlayer.seekTo(seekTime, true);
    } else if (videoRef.current) {
      // Firebase video seek
      videoRef.current.currentTime = seekTime;
    }
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    
    if (youtubePlayer && playerReady) {
      // YouTube player volume (0-100)
      youtubePlayer.setVolume(newVolume * 100);
    } else if (videoRef.current) {
      // Firebase video volume (0-1)
      videoRef.current.volume = newVolume;
    }
  };

  const handleSpeedChange = (e) => {
    const newSpeed = parseFloat(e.target.value);
    setPlaybackSpeed(newSpeed);
    
    if (youtubePlayer && playerReady) {
      // YouTube player playback speed
      youtubePlayer.setPlaybackRate(newSpeed);
    } else if (videoRef.current) {
      // Firebase video playback speed
      videoRef.current.playbackRate = newSpeed;
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
            <span>📅 Class Date: {new Date(video.date || video.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
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
          <div 
            ref={youtubeContainerRef}
            className="youtube-video-player"
            style={{
              width: '100%',
              height: '100%',
              backgroundColor: '#000'
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
                onChange={handleSpeedChange}
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
