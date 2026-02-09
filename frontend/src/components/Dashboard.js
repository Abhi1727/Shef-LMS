import React, { useState, useEffect, useCallback } from 'react';
import { firebaseService, COLLECTIONS } from '../services/firebaseService';
import CustomVideoPlayer from './CustomVideoPlayer';
import StudentProfile from './StudentProfile';
import { YouTubeUtils } from '../utils/youtubeUtils';
import './Dashboard.css';

// Background Image Slider Component
const BackgroundImageSlider = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  
  const slides = [
    {
      url: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=1920&h=1080&fit=crop',
      title: 'Data Science & AI',
      subtitle: 'Master the future of technology',
      cta: 'Start Learning'
    },
    {
      url: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=1920&h=1080&fit=crop',
      title: 'Cyber Security',
      subtitle: 'Protect digital worlds',
      cta: 'Explore Courses'
    },
    {
      url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1920&h=1080&fit=crop',
      title: 'Web Development',
      subtitle: 'Build amazing applications',
      cta: 'Create Projects'
    },
    {
      url: 'https://images.unsplash.com/photo-1551434678-e076c223a692?w=1920&h=1080&fit=crop',
      title: 'Mobile Development',
      subtitle: 'Apps for billions',
      cta: 'Develop Apps'
    }
  ];
  
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    
    return () => clearInterval(timer);
  }, [slides.length]);
  
  const goToSlide = (index) => {
    setCurrentSlide(index);
  };
  
  const goToPrevious = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };
  
  const goToNext = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };
  
  return (
    <div className="background-slider">
      <div className="slider-container">
        {slides.map((slide, index) => (
          <div
            key={index}
            className={`slide ${index === currentSlide ? 'active' : ''}`}
            style={{ backgroundImage: `url(${slide.url})` }}
          />
        ))}
        
        {/* Overlay Content */}
        <div className="slider-overlay">
          <div className="slider-content">
            <div className="slider-text">
              <h1 className="slider-title">{slides[currentSlide].title}</h1>
              <p className="slider-subtitle">{slides[currentSlide].subtitle}</p>
              <button className="slider-cta">{slides[currentSlide].cta}</button>
            </div>
          </div>
        </div>
        
        {/* Navigation Arrows */}
        <button className="slider-arrow prev" onClick={goToPrevious}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </button>
        <button className="slider-arrow next" onClick={goToNext}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </button>
        
        {/* Dots Indicator */}
        <div className="slider-dots">
          {slides.map((_, index) => (
            <button
              key={index}
              className={`dot ${index === currentSlide ? 'active' : ''}`}
              onClick={() => goToSlide(index)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

// Typing Animation Component
const TypingAnimation = ({ texts, speed = 100, pauseDuration = 2000 }) => {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  
  useEffect(() => {
    const currentText = texts[currentTextIndex];
    
    const timeout = setTimeout(() => {
      if (!isDeleting) {
        // Typing
        if (currentIndex < currentText.length) {
          setDisplayedText(prev => prev + currentText[currentIndex]);
          setCurrentIndex(prev => prev + 1);
        } else {
          // Pause before deleting
          setTimeout(() => setIsDeleting(true), pauseDuration);
        }
      } else {
        // Deleting
        if (currentIndex > 0) {
          setDisplayedText(prev => prev.slice(0, -1));
          setCurrentIndex(prev => prev - 1);
        } else {
          // Move to next text
          setIsDeleting(false);
          setCurrentTextIndex((prev) => (prev + 1) % texts.length);
        }
      }
    }, isDeleting ? speed / 2 : speed);
    
    return () => clearTimeout(timeout);
  }, [currentIndex, currentTextIndex, isDeleting, speed, pauseDuration, texts]);
  
  return (
    <span className="typing-text">
      {displayedText}
      <span className="typing-cursor">|</span>
    </span>
  );
};

const Dashboard = ({ user, onLogout }) => {
  const [stats, setStats] = useState(null);
  const [courses, setCourses] = useState([]);
  const [activities, setActivities] = useState([]);
  const [projects, setProjects] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [mentors, setMentors] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [liveClasses, setLiveClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedModule, setSelectedModule] = useState(1);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showHelpMenu, setShowHelpMenu] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  
  // Course content state
  const [courseContent, setCourseContent] = useState(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [expandedModules, setExpandedModules] = useState({});
  
  // Progress tracking state
  const [viewedFiles, setViewedFiles] = useState([]);
  const [progressPercent, setProgressPercent] = useState(0);
  
  // Video watching history state
  const [videoWatchHistory, setVideoWatchHistory] = useState([]);
  const [batchInfo, setBatchInfo] = useState(null);
  
  // Classroom videos from Firebase
  const [classroomVideos, setClassroomVideos] = useState([]);
  
  // Batches and enhanced video information
  const [batches, setBatches] = useState([]);
  const [videoThumbnails, setVideoThumbnails] = useState({});
  const [videoDurations, setVideoDurations] = useState({});

  // Toggle module expansion
  const toggleModule = (moduleId) => {
    setExpandedModules(prev => ({
      ...prev,
      [moduleId]: !prev[moduleId]

    }));
  };

  // Dark mode toggle
  const toggleDarkMode = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    localStorage.setItem('darkMode', newDarkMode);
  };

  // Load dark mode preference on mount
  useEffect(() => {
    const savedDarkMode = localStorage.getItem('darkMode') === 'true';
    setDarkMode(savedDarkMode);
  }, []);

  // Apply dark mode class to body
  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [darkMode]);

  // Determine the course slug from user's enrolled course
  const getCourseSlug = useCallback(() => {
    const courseName = user?.currentCourse || '';
    const lowerCourse = courseName.toLowerCase();
    
    if (lowerCourse.includes('data science') || lowerCourse.includes('ai') || lowerCourse.includes('machine learning')) {
      return 'data-science';
    }
    if (lowerCourse.includes('cyber') || lowerCourse.includes('security') || lowerCourse.includes('ethical') || lowerCourse.includes('hacking')) {
      return 'cyber-security';
    }
    if (lowerCourse.includes('web') || lowerCourse.includes('development')) {
      return 'web-development';
    }
    if (lowerCourse.includes('mobile') || lowerCourse.includes('android') || lowerCourse.includes('ios')) {
      return 'mobile-development';
    }
    
    // Default fallback
    return 'data-science';
  }, [user?.currentCourse]);

  // Load user's progress from Firebase and initialize if new
  const loadUserProgress = useCallback(async () => {
    // Firebase-based progress tracking has been removed.
    // Keep local state only so UI continues to work.
    setViewedFiles([]);
    setVideoWatchHistory([]);
  }, []);

  // Save progress (no-op now that Firebase is removed)
  const saveUserProgress = async (newViewedFiles) => {
    setViewedFiles(newViewedFiles);
  };

  // Save video watching history (local only)
  const saveVideoWatchHistory = async (newVideoWatchHistory) => {
    setVideoWatchHistory(newVideoWatchHistory);
  };

  // Update video progress tracking (local only)
  const updateVideoProgress = async (videoId, progress, position) => {
    setVideoWatchHistory(prevHistory => {
      const videoHistory = prevHistory || [];
      const updatedHistory = videoHistory.map(record => {
        if (record.videoId === videoId) {
          return {
            ...record,
            watchProgress: Math.max(record.watchProgress, progress),
            lastWatchedPosition: position,
            lastWatchedAt: new Date().toISOString(),
            isCompleted: progress >= 95
          };
        }
        return record;
      });
      return updatedHistory;
    });
  };

  // Get video resume position
  const getVideoResumePosition = (videoId) => {
    const videoRecord = videoWatchHistory.find(record => record.videoId === videoId);
    return videoRecord ? videoRecord.lastWatchedPosition : 0;
  };

  // Get video progress percentage
  const getVideoProgress = (videoId) => {
    const videoRecord = videoWatchHistory.find(record => record.videoId === videoId);
    return videoRecord ? videoRecord.watchProgress : 0;
  };

  // Calculate progress percentage
  const calculateProgress = useCallback(() => {
    if (!courseContent || !courseContent.totalFiles) return 0;
    const totalFiles = courseContent.totalFiles;
    const viewed = viewedFiles.length;
    return Math.round((viewed / totalFiles) * 100);
  }, [courseContent, viewedFiles]);

  // Update progress when viewedFiles or courseContent changes
  useEffect(() => {
    const newProgress = calculateProgress();
    setProgressPercent(newProgress);
  }, [calculateProgress]);

  // Load classroom videos from Firebase
  const loadClassroomVideos = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
      
      // Debug: Log the token and user info
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          console.log('🔍 Frontend Debug - User from token:', payload.user);
        } catch (e) {
          console.error('🔍 Frontend Debug - Error parsing token:', e);
        }
      }
      
      console.log('🔍 Frontend Debug - Making request to:', `${apiUrl}/api/dashboard/classroom`);
      
      const response = await fetch(`${apiUrl}/api/dashboard/classroom`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('🔍 Frontend Debug - Response status:', response.status);
      
      if (response.ok) {
        const videos = await response.json();
        console.log('🔍 Frontend Debug - Videos received:', videos.length);
        console.log('🔍 Frontend Debug - Sample video:', videos[0]);

        // Additional sorting on frontend to ensure latest videos are first
        const sortedVideos = videos.sort((a, b) => {
          const dateA = new Date(a.createdAt || a.date || 0);
          const dateB = new Date(b.createdAt || b.date || 0);
          return dateB - dateA; // Newest first
        });

        // Hide support/utility Zoom rooms from students (e.g. personal meeting rooms)
        const filteredVideos = sortedVideos.filter(v => {
          const title = (v.title || '').toLowerCase();
          return !title.includes("support's personal meeting room") &&
                 !title.includes('support\'s personal meeting room');
        });

        console.log('🔍 Frontend Debug - First 3 videos after sorting/filtering:', filteredVideos.slice(0, 3).map(v => ({
          title: v.title,
          createdAt: v.createdAt,
          date: v.date
        })));

        setClassroomVideos(filteredVideos);
      } else {
        const errorData = await response.json();
        console.error('🔍 Frontend Debug - Error response:', errorData);
        setClassroomVideos([]);
      }
    } catch (error) {
      console.error('Error loading classroom videos:', error);
      setClassroomVideos([]);
    }
  }, []);

  // Load batches to get teacher information
  const loadBatches = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
      
      const response = await fetch(`${apiUrl}/api/batches`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const batchesData = data.batches || data; // Handle both response formats
        setBatches(batchesData);
        console.log('🔍 Dashboard Debug - Batches loaded:', batchesData);
      }
    } catch (error) {
      console.error('Error loading batches:', error);
    }
  }, []);

  // Load student's batch info (for displaying batch details and timings in Classroom section)
  const loadBatchInfo = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
      const response = await fetch(`${apiUrl}/api/student/batch-info`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        return;
      }

      const data = await response.json();

      // /api/student/batch-info returns the batch object directly
      // If student is not assigned to any batch, it returns only a message
      if (data && data.id) {
        setBatchInfo(data);
      } else {
        setBatchInfo(null);
      }
    } catch (error) {
      console.error('Error loading batch info:', error);
    }
  }, []);

  // Get teacher name from batch ID
  const getTeacherName = useCallback((batchId) => {
    console.log('🔍 Dashboard Debug - Getting teacher for batchId:', batchId);
    console.log('🔍 Dashboard Debug - Available batches:', batches);
    
    if (!batchId || !batches.length) {
      console.log('🔍 Dashboard Debug - No batchId or batches loaded');
      return 'Not assigned';
    }
    
    const batch = batches.find(b => b.id === batchId);
    console.log('🔍 Dashboard Debug - Found batch:', batch);
    
    const teacherName = batch?.teacherName || 'Not assigned';
    console.log('🔍 Dashboard Debug - Teacher name:', teacherName);
    
    return teacherName;
  }, [batches]);

  // Load video thumbnails and durations
  const loadVideoEnhancements = useCallback(async (videos) => {
    const thumbnails = {};
    const durations = {};
    
    for (const video of videos) {
      if (video.videoSource === 'youtube-url' && video.youtubeVideoId) {
        // Get thumbnail
        thumbnails[video.id] = YouTubeUtils.getThumbnailUrl(video.youtubeVideoId, 'mqdefault');
        
        // For now, use a placeholder duration since we don't have YouTube API key
        // In the future, you can implement YouTube API call to get actual duration
        durations[video.id] = video.duration || 'Duration not available';
      }
    }
    
    setVideoThumbnails(thumbnails);
    setVideoDurations(durations);
  }, []);

  // Load classroom videos on mount and when course changes
  useEffect(() => {
    if (user?.currentCourse) {
      loadClassroomVideos();
      loadBatches();
      loadBatchInfo();
    }
  }, [user?.currentCourse, loadClassroomVideos, loadBatches, loadBatchInfo]);

  // Load video enhancements when videos are loaded
  useEffect(() => {
    if (classroomVideos.length > 0) {
      loadVideoEnhancements(classroomVideos);
    }
  }, [classroomVideos, loadVideoEnhancements]);

  // Load user progress on mount and when user changes
  useEffect(() => {
    if (user?.id) {
      loadUserProgress();
      // Video watch history is now tracked only in local state
      setVideoWatchHistory([]);
    }
  }, [user?.id, loadUserProgress]);

  // Load course content from API
  const loadCourseContent = useCallback(async () => {
    const slug = getCourseSlug();
    setContentLoading(true);
    try {
      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000/api' : '/api';
      const response = await fetch(`${apiUrl}/content/${slug}`);
      const data = await response.json();
      if (data.success) {
        setCourseContent(data);
        if (data.modules && data.modules.length > 0) {
          setSelectedModule(data.modules[0].id);
        }
      }
    } catch (error) {
      console.error('Error loading course content:', error);
    }
    setContentLoading(false);
  }, [getCourseSlug]);

  // Load course content on mount and when course changes
  useEffect(() => {
    if (user?.currentCourse) {
      loadCourseContent();
    }
  }, [user?.currentCourse, loadCourseContent]);

  // Enhanced logout function to clear all cached data
  const handleLogout = () => {
    // Clear all authentication data
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.clear();
    
    // Force complete page reload to clear any cached state
    window.location.href = '/login';
  };

  // Handle file click - open in Colab for notebooks, otherwise download/view
  const handleFileClick = (file) => {
    // Mark file as viewed for progress tracking
    const fileKey = file.path || file.name;
    if (!viewedFiles.includes(fileKey)) {
      const newViewedFiles = [...viewedFiles, fileKey];
      setViewedFiles(newViewedFiles);
      saveUserProgress(newViewedFiles);
    }
    
    if (file.canOpenInColab) {
      // Open notebook in Google Colab
      const fileUrl = `https://learnwithus.sbs${file.path}`;
      const colabUrl = `https://colab.research.google.com/drive/`;
      // Since we're serving from our own server, we'll open a viewer or download
      // For now, open directly which will trigger download, or use nbviewer
      window.open(fileUrl, '_blank');
    } else if (file.extension === '.pdf') {
      // Open PDF in new tab
      window.open(`https://learnwithus.sbs${file.path}`, '_blank');
    } else if (file.extension === '.sql') {
      // Download SQL file
      window.open(`https://learnwithus.sbs${file.path}`, '_blank');
    } else {
      // Default: download the file
      window.open(`https://learnwithus.sbs${file.path}`, '_blank');
    }
  };

  // Check if user is Data Science or Cybersecurity
  const isDataScience = () => {
    const courseName = user?.currentCourse || '';
    return courseName.toLowerCase().includes('data science') || courseName.toLowerCase().includes('ai');
  };

  // Use classroom videos from Firebase (already filtered by course)
  const classroomSessions = classroomVideos.map((video, index) => ({
    id: video.id || `video-${index}`,
    date: video.date || new Date().toISOString().split('T')[0],
    title: video.title || 'Untitled Class',
    type: video.type || 'Live Class',
    instructor: video.instructor || 'Instructor',
    instructorInitial: (video.instructor || 'I').charAt(0).toUpperCase(),
    instructorColor: video.instructorColor || '#E91E63',
    duration: video.duration || 'N/A',
    driveId: video.driveId || '',
    zoomUrl: video.zoomUrl || '',
    zoomPasscode: video.zoomPasscode || '',
    videoSource: video.videoSource || 'drive', // 'drive' or 'zoom'
    hasAccess: video.hasAccess !== false, // Default to true unless explicitly false
    accessDeniedReason: video.accessDeniedReason || null
  }));

  // Handle video access validation
  const handleVideoAccess = async (session) => {
    console.log('🔍 Frontend Debug - handleVideoAccess called with:', {
      title: session.title,
      hasAccess: session.hasAccess,
      accessDeniedReason: session.accessDeniedReason
    });
    
    // Check if user has access
    if (!session.hasAccess) {
      console.log('🔍 Frontend Debug - Access denied, showing alert');
      alert(session.accessDeniedReason || 'You do not have access to this video.');
      return;
    }

    // Record video watching history with progress
    const watchRecord = {
      videoId: session.id,
      videoTitle: session.title,
      watchedAt: new Date().toISOString(),
      videoSource: session.videoSource,
      date: session.date,
      watchProgress: 0, // Progress percentage (0-100)
      lastWatchedPosition: 0, // Last position in seconds
      totalDuration: session.duration || 0,
      isCompleted: false
    };

    // Update video watch history
    const existingHistory = videoWatchHistory.filter(record => record.videoId !== session.id);
    const newHistory = [watchRecord, ...existingHistory];
    setVideoWatchHistory(newHistory);
    saveVideoWatchHistory(newHistory);

    // For Zoom videos, validate access via API
    if (session.videoSource === 'zoom') {
      try {
        const token = localStorage.getItem('token');
        const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
        
        console.log('🔍 Frontend Debug - Making access validation request to:', `${apiUrl}/api/dashboard/classroom/${session.id}/access`);
        
        const response = await fetch(`${apiUrl}/api/dashboard/classroom/${session.id}/access`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        console.log('🔍 Frontend Debug - Access validation response status:', response.status);

        if (response.ok) {
          const data = await response.json();
          console.log('🔍 Frontend Debug - Access validation response data:', data);
          
          if (data.hasAccess) {
            // Create enhanced Zoom URL with automatic passcode
            const enhancedZoomUrl = createEnhancedZoomUrl(data.video.zoomUrl, data.video.zoomPasscode);
            
            // Update session with validated video data
            const updatedSession = {
              ...session,
              zoomUrl: enhancedZoomUrl,
              zoomPasscode: data.video.zoomPasscode
            };
            setSelectedVideo(updatedSession);
          } else {
            console.log('🔍 Frontend Debug - Access denied from API:', data.message);
            alert(data.message || 'Access denied');
          }
        } else {
          const errorData = await response.json();
          console.error('🔍 Frontend Debug - Access validation error:', errorData);
          alert(errorData.message || 'Failed to validate access');
        }
      } catch (error) {
        console.error('🔍 Frontend Debug - Error validating video access:', error);
        alert('Failed to validate video access. Please try again.');
      }
    } else {
      // For Drive videos, direct access
      setSelectedVideo(session);
    }
  };

  // Convert IST time range to other time zones (EST, CST, PST)
  const convertIstRangeToZone = (range, offsetHours, offsetMinutes = 0) => {
    if (!range || typeof range !== 'string') return null;

    const parts = range.split('-').map(p => p.trim());
    if (parts.length !== 2) return null;

    const parseTime = (str) => {
      const match = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
      if (!match) return null;
      let [ , h, m, ap ] = match;
      let hour = parseInt(h, 10);
      const minute = parseInt(m, 10);
      const isPM = ap.toUpperCase() === 'PM';
      if (hour === 12) {
        hour = isPM ? 12 : 0;
      } else if (isPM) {
        hour += 12;
      }
      return hour * 60 + minute;
    };

    const formatTime = (minutes) => {
      minutes = ((minutes % (24 * 60)) + (24 * 60)) % (24 * 60);
      let h = Math.floor(minutes / 60);
      const m = minutes % 60;
      const ap = h >= 12 ? 'PM' : 'AM';
      if (h === 0) h = 12;
      else if (h > 12) h -= 12;
      return `${h}:${m.toString().padStart(2, '0')} ${ap}`;
    };

    const startIst = parseTime(parts[0]);
    const endIst = parseTime(parts[1]);
    if (startIst == null || endIst == null) return null;

    const delta = offsetHours * 60 + offsetMinutes;
    const startLocal = startIst + delta;
    const endLocal = endIst + delta;

    return `${formatTime(startLocal)} - ${formatTime(endLocal)}`;
  };

  // Get the most recent video played by user
  const getLastPlayedVideo = useCallback(() => {
    if (videoWatchHistory.length === 0) {
      // No watch history, return the newest video
      return classroomVideos.length > 0 ? classroomVideos[0] : null;
    }

    // Get the most recently watched video
    const mostRecentRecord = videoWatchHistory
      .sort((a, b) => new Date(b.watchedAt) - new Date(a.watchedAt))[0];
    
    const video = classroomVideos.find(v => v.id === mostRecentRecord.videoId);
    return video ? { ...video, watchedAt: mostRecentRecord.watchedAt, lastWatchedPosition: mostRecentRecord.lastWatchedPosition } : null;
  }, [videoWatchHistory, classroomVideos]);

  // Create enhanced Zoom URL with automatic passcode
  const createEnhancedZoomUrl = (zoomUrl, passcode) => {
    // Remove any existing query parameters
    const baseUrl = zoomUrl.split('?')[0];
    
    // Clean passcode (remove special characters)
    const cleanPasscode = passcode.replace(/[^a-zA-Z0-9]/g, '');
    
    // Add passcode as query parameter for automatic authentication
    return `${baseUrl}?pwd=${cleanPasscode}`;
  };
  const formatClassDate = (dateStr) => {
    const date = new Date(dateStr);
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`;
  };

  // Group sessions by date
  const groupedSessions = classroomSessions.reduce((groups, session) => {
    const date = session.date;
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(session);
    return groups;
  }, {});

  // Complete Course Curriculum - DATA SCIENCE & AI
  const dsCourseData = {
    title: 'Full Stack Data Science & AI',
    duration: '6 months',
    modules: 10,
    progress: 0,
    lessons: '0/157',
    modules_detail: [
      {
        id: 1,
        name: 'Module 1: Introduction to Computer Programming',
        duration: '3 weeks',
        lessons: 15,
        progress: 0,
        chapters: [
          {
            id: 1,
            title: 'Python Fundamentals',
            lessons: ['Introduction to Python', 'Variables and Data Types', 'Control Flow Statements']
          },
          {
            id: 2,
            title: 'Data Structures in Python',
            lessons: ['Lists and Tuples', 'Dictionaries and Sets', 'String Manipulation']
          }
        ]
      },
      {
        id: 2,
        name: 'Module 2: Statistics for Data Science',
        duration: '4 weeks',
        lessons: 18,
        progress: 0,
        chapters: [
          {
            id: 1,
            title: 'Descriptive Statistics',
            lessons: ['Mean, Median, Mode', 'Variance and Standard Deviation', 'Data Distribution']
          },
          {
            id: 2,
            title: 'Inferential Statistics',
            lessons: ['Hypothesis Testing', 'Confidence Intervals', 'P-values and Significance']
          }
        ]
      },
      {
        id: 3,
        name: 'Module 3: Data Analysis with Python',
        duration: '4 weeks',
        lessons: 16,
        progress: 0,
        chapters: [
          {
            id: 1,
            title: 'NumPy Fundamentals',
            lessons: ['NumPy Arrays', 'Array Operations', 'Broadcasting and Vectorization']
          },
          {
            id: 2,
            title: 'Pandas for Data Analysis',
            lessons: ['DataFrames and Series', 'Data Cleaning', 'Data Aggregation']
          }
        ]
      },
      {
        id: 4,
        name: 'Module 4: Data Visualization',
        duration: '3 weeks',
        lessons: 14,
        progress: 0,
        chapters: [
          {
            id: 1,
            title: 'Matplotlib & Seaborn',
            lessons: ['Basic Plotting', 'Statistical Visualizations', 'Customizing Charts']
          },
          {
            id: 2,
            title: 'Interactive Visualization',
            lessons: ['Plotly Basics', 'Dashboard Creation', 'Storytelling with Data']
          }
        ]
      },
      {
        id: 5,
        name: 'Module 5: SQL and Database Management',
        duration: '3 weeks',
        lessons: 12,
        progress: 0,
        chapters: [
          {
            id: 1,
            title: 'SQL Fundamentals',
            lessons: ['SELECT Queries', 'JOINs and Subqueries', 'Aggregations and Grouping']
          },
          {
            id: 2,
            title: 'Database Design',
            lessons: ['Normalization', 'Entity Relationships', 'Database Optimization']
          }
        ]
      },
      {
        id: 6,
        name: 'Module 6: Machine Learning Fundamentals',
        duration: '5 weeks',
        lessons: 20,
        progress: 0,
        chapters: [
          {
            id: 1,
            title: 'Supervised Learning',
            lessons: ['Linear Regression', 'Logistic Regression', 'Decision Trees']
          },
          {
            id: 2,
            title: 'Unsupervised Learning',
            lessons: ['K-Means Clustering', 'Hierarchical Clustering', 'PCA and Dimensionality Reduction']
          }
        ]
      },
      {
        id: 7,
        name: 'Module 7: Advanced Machine Learning',
        duration: '4 weeks',
        lessons: 16,
        progress: 0,
        chapters: [
          {
            id: 1,
            title: 'Ensemble Methods',
            lessons: ['Random Forests', 'Gradient Boosting', 'XGBoost and LightGBM']
          },
          {
            id: 2,
            title: 'Model Optimization',
            lessons: ['Hyperparameter Tuning', 'Cross-Validation', 'Feature Engineering']
          }
        ]
      },
      {
        id: 8,
        name: 'Module 8: Deep Learning',
        duration: '5 weeks',
        lessons: 18,
        progress: 0,
        chapters: [
          {
            id: 1,
            title: 'Neural Networks',
            lessons: ['Perceptrons and MLPs', 'Activation Functions', 'Backpropagation']
          },
          {
            id: 2,
            title: 'Deep Learning Frameworks',
            lessons: ['TensorFlow Basics', 'Keras API', 'PyTorch Introduction']
          }
        ]
      },
      {
        id: 9,
        name: 'Module 9: Natural Language Processing',
        duration: '4 weeks',
        lessons: 14,
        progress: 0,
        chapters: [
          {
            id: 1,
            title: 'Text Processing',
            lessons: ['Tokenization', 'TF-IDF', 'Word Embeddings']
          },
          {
            id: 2,
            title: 'NLP Models',
            lessons: ['Sentiment Analysis', 'Named Entity Recognition', 'Transformers and BERT']
          }
        ]
      },
      {
        id: 10,
        name: 'Module 10: MLOps and Deployment',
        duration: '3 weeks',
        lessons: 14,
        progress: 0,
        chapters: [
          {
            id: 1,
            title: 'Model Deployment',
            lessons: ['Flask and FastAPI', 'Docker Containerization', 'Cloud Deployment']
          },
          {
            id: 2,
            title: 'MLOps Best Practices',
            lessons: ['Model Monitoring', 'CI/CD for ML', 'A/B Testing']
          }
        ]
      }
    ]
  };

  // Complete Course Curriculum - Cyber Security & Ethical Hacking
  const cyberCourseData = {
    title: 'Cyber Security & Ethical Hacking',
    duration: '6 months',
    modules: 10,
    progress: 0,
    lessons: '0/520',
    modules_detail: [
      {
        id: 1,
        name: 'Module 1: Introduction to Cyber Security and Ethical Hacking',
        duration: '3 weeks',
        lessons: 52,
        progress: 0,
        chapters: [
          {
            id: 1,
            title: 'Basics of Cyber Security and Threat Landscape',
            lessons: ['What is Cyber Security?', 'Common Cyber Threats and Attack Vectors', 'Security Goals and CIA Triad']
          },
          {
            id: 2,
            title: 'Ethical Hacking Concepts and Types of Hackers',
            lessons: ['Understanding Ethical Hacking', 'Black Hat, White Hat, and Grey Hat Hackers', 'Legal and Ethical Responsibilities']
          },
          {
            id: 3,
            title: 'Phases of Ethical Hacking',
            lessons: ['Reconnaissance', 'Scanning and Enumeration', 'Exploitation, Post-Exploitation, and Reporting']
          },
          {
            id: 4,
            title: 'Security and Risk Management',
            lessons: ['Risk Identification and Assessment', 'Risk Mitigation and Control Measures', 'Security Policies and Frameworks']
          }
        ]
      },
      {
        id: 2,
        name: 'Module 2: Networking Fundamentals for Cyber Security',
        duration: '4 weeks',
        lessons: 48,
        progress: 0,
        chapters: [
          {
            id: 1,
            title: 'Networking Concepts',
            lessons: ['OSI and TCP/IP Models', 'IP Addressing and Subnetting', 'Network Devices and Topologies']
          },
          {
            id: 2,
            title: 'Networking Protocols',
            lessons: ['HTTP, DNS, FTP, SMTP Overview', 'How Protocols Are Exploited', 'Securing Common Network Protocols']
          },
          {
            id: 3,
            title: 'Network Security Devices',
            lessons: ['Firewalls and Their Configuration', 'IDS and IPS Fundamentals', 'Proxy Servers and VPNs']
          },
          {
            id: 4,
            title: 'Packet Analysis and Monitoring',
            lessons: ['Introduction to Wireshark', 'Capturing and Inspecting Packets', 'Identifying Suspicious Network Traffic']
          }
        ]
      },
      {
        id: 3,
        name: 'Module 3: Linux Fundamentals',
        duration: '4 weeks',
        lessons: 56,
        progress: 0,
        chapters: [
          {
            id: 1,
            title: 'Introduction to Linux',
            lessons: ['Basics of the Linux Operating System', 'Linux Distributions for Cyber Security (Kali, Parrot OS)', 'Setting Up the Lab Environment']
          },
          {
            id: 2,
            title: 'Linux File System and Directory Structure',
            lessons: ['Navigating File Systems', 'File Permissions and Ownership', 'Hidden Files and Configuration Paths']
          },
          {
            id: 3,
            title: 'Command Line and System Management',
            lessons: ['Essential Linux Commands for Security Tasks', 'Managing Users, Groups, and Permissions', 'Process Management and System Monitoring']
          },
          {
            id: 4,
            title: 'Shell Scripting for Cyber Security',
            lessons: ['Basics of Bash Scripting', 'Writing Security Automation Scripts', 'Task Scheduling and Automation with Cron Jobs']
          }
        ]
      },
      {
        id: 4,
        name: 'Module 4: Reconnaissance and Footprinting',
        duration: '4 weeks',
        lessons: 50,
        progress: 0,
        chapters: [
          {
            id: 1,
            title: 'Active and Passive Reconnaissance',
            lessons: ['OSINT Techniques and Data Sources', 'Passive Scanning and Metadata Extraction', 'Active Network Probing']
          },
          {
            id: 2,
            title: 'Information Gathering Tools',
            lessons: ['WHOIS, NSLookup, and Dig', 'Recon-ng and Maltego', 'Shodan and Censys for Network Discovery']
          },
          {
            id: 3,
            title: 'Network Scanning with Nmap',
            lessons: ['Nmap Basics and Syntax', 'Service Version and OS Detection', 'Vulnerability Scanning with Nmap Scripts']
          },
          {
            id: 4,
            title: 'Identifying Devices and Open Ports',
            lessons: ['Network Mapping', 'Device Fingerprinting', 'Service Enumeration and Banner Grabbing']
          }
        ]
      },
      {
        id: 5,
        name: 'Module 5: Vulnerability Analysis',
        duration: '4 weeks',
        lessons: 54,
        progress: 0,
        chapters: [
          {
            id: 1,
            title: 'Vulnerability Assessment Methodologies',
            lessons: ['Understanding Vulnerability Management', 'Assessment Phases and Workflows', 'Vulnerability Scoring Systems (CVSS)']
          },
          {
            id: 2,
            title: 'Tools for Vulnerability Scanning',
            lessons: ['Nessus Overview and Setup', 'OWASP ZAP for Web Scanning', 'Comparing Automated and Manual Scans']
          },
          {
            id: 3,
            title: 'Identifying CVEs and Exploits',
            lessons: ['Using Exploit Databases (Exploit-DB, CVE Details)', 'Mapping Vulnerabilities to Exploits', 'Validating Vulnerabilities']
          },
          {
            id: 4,
            title: 'Analyzing Vulnerability Reports',
            lessons: ['Report Interpretation and Prioritization', 'False Positive Analysis', 'Remediation Planning']
          }
        ]
      },
      {
        id: 6,
        name: 'Module 6: System Hacking',
        duration: '4 weeks',
        lessons: 52,
        progress: 0,
        chapters: [
          {
            id: 1,
            title: 'Password Cracking Techniques',
            lessons: ['Dictionary and Brute-Force Attacks', 'Tools (Hydra, John the Ripper, Hashcat)', 'Password Policy Enforcement']
          },
          {
            id: 2,
            title: 'Privilege Escalation',
            lessons: ['Windows Privilege Escalation', 'Linux Privilege Escalation', 'Maintaining Access']
          },
          {
            id: 3,
            title: 'Backdoors and Trojans',
            lessons: ['Creating and Detecting Backdoors', 'RATs and Persistence Mechanisms', 'Defense Against Backdoors']
          },
          {
            id: 4,
            title: 'Anti-Forensics Techniques',
            lessons: ['Covering Tracks and Clearing Logs', 'Steganography and Data Hiding', 'Rootkits and Evasion']
          }
        ]
      },
      {
        id: 7,
        name: 'Module 7: Web Application Security',
        duration: '4 weeks',
        lessons: 56,
        progress: 0,
        chapters: [
          {
            id: 1,
            title: 'OWASP Top 10 Vulnerabilities',
            lessons: ['Injection Attacks (SQLi, Command Injection)', 'Authentication and Session Issues', 'Security Misconfigurations']
          },
          {
            id: 2,
            title: 'Hands-On Labs (Juice Shop, DVWA)',
            lessons: ['Setting Up Vulnerable Web Apps', 'Exploiting Common Vulnerabilities', 'Writing Secure Code to Prevent Attacks']
          },
          {
            id: 3,
            title: 'Exploiting Web Vulnerabilities',
            lessons: ['SQL Injection Exploits', 'XSS and CSRF Attacks', 'File Upload and Directory Traversal']
          },
          {
            id: 4,
            title: 'Web Security Tools',
            lessons: ['Burp Suite for Interception', 'SQLmap for Injection Testing', 'ZAP Proxy for Automated Scans']
          }
        ]
      },
      {
        id: 8,
        name: 'Module 8: Wireless Network Security',
        duration: '4 weeks',
        lessons: 52,
        progress: 0,
        chapters: [
          {
            id: 1,
            title: 'Wireless Network Fundamentals',
            lessons: ['Wi-Fi Standards and Protocols', 'Authentication Mechanisms', 'Encryption (WEP, WPA, WPA2, WPA3)']
          },
          {
            id: 2,
            title: 'Wireless Attacks and Tools',
            lessons: ['Packet Capture and Sniffing', 'Deauthentication and Handshake Captures', 'WPA/WPA2 Cracking Tools']
          },
          {
            id: 3,
            title: 'Wireless Network Exploitation',
            lessons: ['Evil Twin Attacks', 'Rogue AP Setup', 'MITM on Wireless Networks']
          },
          {
            id: 4,
            title: 'Securing Wireless Networks',
            lessons: ['Implementing WPA3 and MAC Filtering', 'Wireless IDS/IPS', 'Secure Network Configuration Practices']
          }
        ]
      },
      {
        id: 9,
        name: 'Module 9: Penetration Testing Methodologies',
        duration: '5 weeks',
        lessons: 60,
        progress: 0,
        chapters: [
          {
            id: 1,
            title: 'Planning and Scoping',
            lessons: ['Defining Engagement Rules', 'Scoping and Legal Considerations', 'Project Documentation Templates']
          },
          {
            id: 2,
            title: 'Penetration Testing Process',
            lessons: ['Pre-Engagement Activities', 'Execution and Reporting', 'Validation of Findings']
          },
          {
            id: 3,
            title: 'Reporting and Documentation',
            lessons: ['Writing Professional Pen Test Reports', 'Communicating Findings to Clients', 'Mitigation Recommendations']
          },
          {
            id: 4,
            title: 'Real-World Simulations',
            lessons: ['Simulated Enterprise Network Attack', 'Exploitation to Post-Exploitation', 'Defensive Countermeasures']
          }
        ]
      },
      {
        id: 10,
        name: 'Module 10: Advanced Topics in Cyber Security',
        duration: '4 weeks',
        lessons: 44,
        progress: 0,
        chapters: [
          {
            id: 1,
            title: 'Cloud Security',
            lessons: ['Common Cloud Vulnerabilities', 'Cloud Security Controls and IAM', 'Securing Cloud Applications']
          },
          {
            id: 2,
            title: 'IoT Security',
            lessons: ['IoT Architecture and Attack Surface', 'Common IoT Threats', 'Securing IoT Devices']
          },
          {
            id: 3,
            title: 'Threat Hunting and Mitigation',
            lessons: ['Understanding Threat Intelligence', 'Detection and Response Strategies', 'Using SIEM Tools for Threat Analysis']
          }
        ]
      }
    ]
  };

  // Select courseData based on user's enrolled course - Use dynamic data
  const courseData = courseContent ? {
    title: courseContent.title || (isDataScience() ? 'Full Stack Data Science & AI' : 'Cyber Security & Ethical Hacking'),
    duration: courseContent.duration || '6 months',
    modules: courseContent.modules ? courseContent.modules.length : (isDataScience() ? dsCourseData.modules : cyberCourseData.modules),
    totalFiles: courseContent.totalFiles || 0
  } : (isDataScience() ? dsCourseData : cyberCourseData);

  // Course-specific Capstone Projects
  const dsCapstoneProjects = [
    { id: 1, icon: '📊', color: '#e6f3ff', title: 'Customer Churn Prediction', description: 'End-to-End ML Pipeline' },
    { id: 2, icon: '🏠', color: '#fff0e6', title: 'Real Estate Price Prediction', description: 'Regression Analysis with Feature Engineering' },
    { id: 3, icon: '🎬', color: '#f0e6ff', title: 'Movie Recommendation System', description: 'Collaborative Filtering & Content-Based' },
    { id: 4, icon: '📈', color: '#e6ffe6', title: 'Stock Market Analysis', description: 'Time Series Forecasting with LSTM' },
    { id: 5, icon: '🛒', color: '#ffe6e6', title: 'E-commerce Analytics Dashboard', description: 'Data Visualization & BI' }
  ];

  const cyberCapstoneProjects = [
    { id: 1, icon: '🔐', color: '#ffe6e6', title: 'Enterprise Network Penetration Test', description: 'End-to-End Security Assessment' },
    { id: 2, icon: '🌐', color: '#fff0e6', title: 'Web Application Security Audit', description: 'OWASP Top 10 Vulnerability Assessment' },
    { id: 3, icon: '📡', color: '#e6f0ff', title: 'Wireless Network Security Analysis', description: 'Wi-Fi Penetration Testing & Security' },
    { id: 4, icon: '🛡️', color: '#f0e6ff', title: 'Incident Response Simulation', description: 'Threat Detection & Response Plan' },
    { id: 5, icon: '🔍', color: '#e6ffe6', title: 'Digital Forensics Investigation', description: 'Evidence Collection & Analysis' }
  ];

  const capstoneProjects = isDataScience() ? dsCapstoneProjects : cyberCapstoneProjects;

  // Course-specific Practice Assessments
  const dsPracticeAssessments = [
    { id: 1, icon: '🐍', title: 'Python Coding Challenges', meta: '15 Questions | 60 Min' },
    { id: 2, icon: '📊', title: 'Statistics & Probability Quiz', meta: '20 Questions | 45 Min' },
    { id: 3, icon: '🤖', title: 'Machine Learning Concepts', meta: '25 Questions | 90 Min' }
  ];

  const cyberPracticeAssessments = [
    { id: 1, icon: '🔐', title: 'Network Security Challenges', meta: '8 Questions | 90 Min' },
    { id: 2, icon: '🛡️', title: 'Web Application Security Lab', meta: '6 Questions | 120 Min' },
    { id: 3, icon: '⚔️', title: 'CTF Challenges', meta: '10 Questions | 180 Min' }
  ];

  const practiceAssessments = isDataScience() ? dsPracticeAssessments : cyberPracticeAssessments;

  // Course-specific Quiz Assessments
  const dsQuizAssessments = [
    { id: 1, icon: 'SQL', title: 'SQL Proficiency Test', iconClass: 'nn-icon' },
    { id: 2, icon: '📊', title: 'Data Visualization Quiz', iconClass: 'microsoft-icon' },
    { id: 3, icon: '🧠', title: 'Deep Learning Fundamentals', iconClass: 'meta-icon' }
  ];

  const cyberQuizAssessments = [
    { id: 1, icon: 'CEH', title: 'CEH Mock Exam', iconClass: 'nn-icon' },
    { id: 2, icon: '🔒', title: 'CompTIA Security+ Practice Test', iconClass: 'microsoft-icon' },
    { id: 3, icon: '🌐', title: 'OSCP Preparation Quiz', iconClass: 'meta-icon' }
  ];

  const quizAssessments = isDataScience() ? dsQuizAssessments : cyberQuizAssessments;

  // Course-specific Supplementary Courses
  const dsSupplementaryCourses = [
    { id: 1, badge: 'A', color: '#e6f3ff', title: 'Advanced Analytics', meta: '📚 25 Lessons • ⏱️ 15000 min', desc: 'Business Intelligence, A/B Testing, and Advanced Statistical Methods...' },
    { id: 2, badge: 'B', color: '#f0e6ff', title: 'Big Data Technologies', meta: '📚 30 Lessons • ⏱️ 18000 min', desc: 'Spark, Hadoop, and distributed computing for large-scale data processing...' },
    { id: 3, badge: 'C', color: '#e6ffe6', title: 'Cloud ML Platforms', meta: '📚 22 Lessons • ⏱️ 13200 min', desc: 'AWS SageMaker, Google Vertex AI, and Azure ML for cloud-based ML...' }
  ];

  const cyberSupplementaryCourses = [
    { id: 1, badge: 'K', color: '#e6f3ff', title: 'Kali Linux Mastery', meta: '📚 32 Lessons • ⏱️ 18000 min', desc: 'Master Kali Linux tools and techniques for penetration testing and...' },
    { id: 2, badge: 'C', color: '#e6d9ff', title: 'Cloud Security', meta: '📚 28 Lessons • ⏱️ 16200 min', desc: 'AWS, Azure, and GCP security best practices, IAM, and cloud archi...' },
    { id: 3, badge: 'M', color: '#d9f0e6', title: 'Malware Analysis', meta: '📚 30 Lessons • ⏱️ 17400 min', desc: 'Reverse engineering, dynamic analysis, and threat detection techn...' }
  ];

  const supplementaryCourses = isDataScience() ? dsSupplementaryCourses : cyberSupplementaryCourses;

  // Course-specific Job Types
  const dsJobTypes = ['Data Scientist', 'ML Engineer', 'Data Analyst', 'AI Engineer', 'Business Analyst'];
  const cyberJobTypes = ['Security Analyst', 'Penetration Tester', 'SOC Analyst', 'Security Engineer', 'Threat Hunter'];
  const relevantJobTypes = isDataScience() ? dsJobTypes : cyberJobTypes;

  useEffect(() => {
    fetchDashboardData();
    
    // Handle responsive sidebar
    const handleResize = () => {
      if (window.innerWidth <= 1024) {
        setSidebarOpen(false);
      } else {
        setSidebarOpen(true);
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Call on mount
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Load course content when switching to Learn section
  useEffect(() => {
    if (activeSection === 'courses' && !courseContent) {
      loadCourseContent();
    }
  }, [activeSection]);

  const fetchDashboardData = async () => {
    try {
      // Set minimum loading time to 2 seconds
      const startTime = Date.now();
      
      // Fetch all data from Firebase
      const [coursesRes, modulesRes, lessonsRes, projectsRes, jobsRes, mentorsRes, contentRes, liveClassesRes] = await Promise.all([
        firebaseService.getAll(COLLECTIONS.COURSES),
        firebaseService.getAll(COLLECTIONS.MODULES),
        firebaseService.getAll(COLLECTIONS.LESSONS),
        firebaseService.getAll(COLLECTIONS.PROJECTS),
        firebaseService.getAll(COLLECTIONS.JOBS),
        firebaseService.getAll(COLLECTIONS.MENTORS),
        firebaseService.getAll(COLLECTIONS.CONTENT),
        firebaseService.getAll(COLLECTIONS.LIVE_CLASSES)
      ]);

      // Extract data
      const coursesData = coursesRes.success ? coursesRes.data : [];
      const modulesData = modulesRes.success ? modulesRes.data : [];
      const lessonsData = lessonsRes.success ? lessonsRes.data : [];
      const projectsData = projectsRes.success ? projectsRes.data : [];
      const jobsData = jobsRes.success ? jobsRes.data : [];
      const mentorsData = mentorsRes.success ? mentorsRes.data : [];
      const contentData = contentRes.success ? contentRes.data : [];
      const liveClassesData = liveClassesRes.success ? liveClassesRes.data : [];

      // Calculate stats from real data
      const calculatedStats = {
        enrolled: coursesData.length,
        completed: 0,
        inProgress: coursesData.length,
        totalHours: coursesData.length * 40, // Estimate 40 hours per course
        certificates: 0,
        upcomingClasses: lessonsData.length
      };

      // Map courses with real data
      const mappedCourses = coursesData.map(course => ({
        ...course,
        progress: 0,
        modules: modulesData.filter(m => m.courseId === course.id).length,
        lessons: lessonsData.filter(l => {
          const module = modulesData.find(m => m.id === l.moduleId);
          return module && module.courseId === course.id;
        }).length
      }));

      // Create recent activities from content
      const recentActivities = contentData
        .filter(c => c.type === 'announcement')
        .slice(0, 5)
        .map(announcement => ({
          type: 'announcement',
          title: announcement.title,
          description: announcement.content,
          time: announcement.createdAt ? new Date(announcement.createdAt.seconds * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently'
        }));

      setStats(calculatedStats);
      setCourses(mappedCourses);
  setLessons(lessonsData);
      setActivities(recentActivities);
      setProjects(projectsData);
      setJobs(jobsData.filter(j => j.status === 'active'));
      setMentors(mentorsData);
      setLiveClasses(liveClassesData);
      
      // Store additional data for other sections
      window.dashboardData = {
        courses: coursesData,
        modules: modulesData,
        lessons: lessonsData,
        projects: projectsData,
        jobs: jobsData,
        mentors: mentorsData,
        content: contentData,
        liveClasses: liveClassesData
      };
      
      // Ensure loading animation shows for at least 2 seconds
      const elapsedTime = Date.now() - startTime;
      const remainingTime = Math.max(2000 - elapsedTime, 0);
      
      setTimeout(() => {
        setLoading(false);
      }, remainingTime);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      // Reset to 0 on error
      setStats({ enrolled: 0, completed: 0, inProgress: 0, totalHours: 0, certificates: 0, upcomingClasses: 0 });
      setCourses([]);
      setActivities([]);
      
      // Still respect 2-second minimum on error
      setTimeout(() => {
        setLoading(false);
      }, 2000);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loader"></div>
        <p>Loading your dashboard...</p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* 3D Educational Background Elements */}
      <div className="edu-3d-container">
        <div className="edu-3d-element book">📚</div>
        <div className="edu-3d-element graduation-cap">🎓</div>
        <div className="edu-3d-element microscope">🔬</div>
        <div className="edu-3d-element calculator">🧮</div>
        <div className="edu-3d-element flask">⚗️</div>
        <div className="edu-3d-element laptop">💻</div>
        <div className="edu-3d-element dna">🧬</div>
        <div className="edu-3d-element brain">🧠</div>
      </div>

      {/* Mobile Menu Toggle */}
      <button 
        className="mobile-menu-toggle"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        <span style={{ fontSize: '1.5rem' }}>☰</span>
      </button>

      {/* Top Navigation Bar */}
      <header className="top-nav">
        <div className="top-nav-header">
          <h2>LMS</h2>
          <div className="subtitle">Student Portal</div>
        </div>
        
        <nav className="top-nav-menu">
          <button 
            className={`nav-item ${activeSection === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveSection('overview')}
            title="Home"
          >
            <span className="nav-icon">🏠</span>
            <span>Home</span>
          </button>
          
          <button 
            className={`nav-item ${activeSection === 'classroom' ? 'active' : ''}`}
            onClick={() => setActiveSection('classroom')}
            title="Classroom"
          >
            <span className="nav-icon">🎥</span>
            <span>Classroom</span>
          </button>
          
          <button 
            className={`nav-item ${activeSection === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveSection('profile')}
            title="My Profile"
          >
            <span className="nav-icon">👤</span>
            <span>My Profile</span>
          </button>
          
          <button 
            className="nav-item dark-mode-toggle" 
            onClick={toggleDarkMode}
            title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            <span className="nav-icon">{darkMode ? '☀️' : '🌙'}</span>
            <span>{darkMode ? 'Light' : 'Dark'}</span>
          </button>
          
          <button className="nav-item logout-btn" onClick={onLogout}>
            <span className="nav-icon">🚪</span>
            <span>Logout</span>
          </button>
        </nav>
        
        <div className="top-nav-spacer"></div>
      </header>

      {/* Main Content */}
      <main className="main-content">

        {/* Dashboard Content */}
        <div className="dashboard-content">
          {activeSection === 'overview' && (
            <div className="animate-in">
              
              {/* Welcome Header - Only on home page */}
              <div className="welcome-header">
                <div className="rotating-text-container">
                  <h1 className="rotating-text">
                    Welcome back, <span>{user?.name}</span>! Welcome back, <span>{user?.name}</span>! Welcome back, <span>{user?.name}</span>!
                  </h1>
                </div>
                <div className="subtitle">
                  {isDataScience() 
                    ? <TypingAnimation text="Continue your Data Science & AI journey" speed={80} />
                    : <TypingAnimation text="Advance your cybersecurity skills" speed={80} />}
                </div>
              </div>
              
              {/* Background Image Slider - Only on home page */}
              <BackgroundImageSlider />

              {/* Stats Grid */}
              {/* <div className="stats-grid">
                <div className="stat-card animate-in">
                  <div className="stat-icon">📚</div>
                  <div className="stat-value">{contentLoading ? '...' : courseData.modules}</div>
                  <div className="stat-label">Total Modules</div>
                </div>
                <div className="stat-card animate-in">
                  <div className="stat-icon">⏱️</div>
                  <div className="stat-value">{courseData.duration}</div>
                  <div className="stat-label">Course Duration</div>
                </div>
                <div className="stat-card animate-in">
                  <div className="stat-icon">📈</div>
                  <div className="stat-value">{progressPercent}%</div>
                  <div className="stat-label">Progress</div>
                </div>
                <div className="stat-card animate-in">
                  <div className="stat-icon">🎯</div>
                  <div className="stat-value">{classroomVideos.length}</div>
                  <div className="stat-label">Class Videos</div>
                </div>
              </div> */}

              {/* Current Course Section */}
              {/* Commented out - Your Learning Journey section disabled */}
              {/* <div className="content-section animate-in">
                <div className="section-header">
                  <div className="section-title">
                    <div className="section-icon">🎓</div>
                    Your Learning Journey
                  </div>
                </div>

                <div className="course-grid">
                  <div className="course-card">
                    <div className="course-header">
                      <div className="course-title">{courseData.title}</div>
                      <div className="course-meta">
                        {courseData.modules} modules • {courseData.duration}
                      </div>
                    </div>
                    <div className="course-body">
                      <div className="course-progress">
                        <div className="course-stats">
                          <span>Progress: {progressPercent}%</span>
                          <span>{viewedFiles.length} of {courseData.totalFiles || '...'} files viewed</span>
                        </div>
                        <div className="progress-bar">
                          <div 
                            className="progress-fill" 
                            style={{ width: `${progressPercent}%` }}
                          ></div>
                        </div>
                      </div>
                      <button 
                        className="nav-item" 
                        style={{ width: '100%', justifyContent: 'center', marginTop: '1rem' }}
                        onClick={() => setActiveSection('courses')}
                      >
                        <span className="nav-icon">📖</span>
                        <span>Continue Learning</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div> */}

              
              {/* Quick Actions */}
              <div className="content-section animate-in">
                <div className="section-header">
                  <div className="section-title">
                    {/* <div className="section-icon">⚡</div> */}
                    {/* Quick Actions */}
                  </div>
                </div>

                {/* Commented out - Bottom action cards disabled */}
                {/* <div className="stats-grid">
                  <button 
                    className="stat-card"
                    onClick={() => setActiveSection('liveClasses')}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="stat-icon">📡</div>
                    <div className="stat-value">Live</div>
                    <div className="stat-label">Join Classes</div>
                  </button>
                  <button 
                    className="stat-card"
                    onClick={() => setActiveSection('classroom')}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="stat-icon">🎥</div>
                    <div className="stat-value">Watch</div>
                    <div className="stat-label">Recordings</div>
                  </button>
                  <button 
                    className="stat-card"
                    onClick={() => setShowProfileModal(true)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="stat-icon">👤</div>
                    <div className="stat-value">View</div>
                    <div className="stat-label">Profile</div>
                  </button>
                  <button 
                    className="stat-card"
                    onClick={() => window.open('https://skystates.com/', '_blank')}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="stat-icon">🌐</div>
                    <div className="stat-value">Visit</div>
                    <div className="stat-label">SkyStates.com</div>
                  </button>
                </div> */}
              </div>
            </div>
          )}

          {/* Classroom Section */}
          {activeSection === 'classroom' && (
            <div className="animate-in">
              <div className="header">
                <h1>🎥 Classroom Recordings</h1>
                <div className="subtitle">
                  Access your class recordings and learning materials
                </div>
              </div>

              {batchInfo && (
                <div className="batch-details-banner">
                  <div className="batch-details-left">
                    <div className="batch-name">{batchInfo.name}</div>
                    <div className="batch-meta-row">
                      <span className="meta-item">Course: {batchInfo.course || 'N/A'}</span>
                      {batchInfo.teacherName && (
                        <span className="meta-item">Teacher: {batchInfo.teacherName}</span>
                      )}
                    </div>
                  </div>
                  <div className="batch-details-right">
                    {batchInfo.schedule && (batchInfo.schedule.days || batchInfo.schedule.time) ? (
                      <>
                        <div className="timing-label">Batch Timing (EST / CST / PST)</div>
                        {batchInfo.schedule.days && (
                          <div className="timing-days">Days: {batchInfo.schedule.days}</div>
                        )}
                        <div className="timing-value-multi">
                          <div className="timing-row">
                            <span className="timing-zone">EST</span>
                            <span className="timing-text">
                              {convertIstRangeToZone(batchInfo.schedule.time, -10, -30) || 'Unavailable'}
                            </span>
                          </div>
                          <div className="timing-row">
                            <span className="timing-zone">CST</span>
                            <span className="timing-text">
                              {convertIstRangeToZone(batchInfo.schedule.time, -11, -30) || 'Unavailable'}
                            </span>
                          </div>
                          <div className="timing-row">
                            <span className="timing-zone">PST</span>
                            <span className="timing-text">
                              {convertIstRangeToZone(batchInfo.schedule.time, -13, -30) || 'Unavailable'}
                            </span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="timing-label">Batch Timing (EST / CST / PST)</div>
                        <div className="timing-value">Not set yet</div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {classroomVideos.length > 0 ? (
                <div className="content-section">
                  <div className="section-header">
                    <div className="section-title">
                      <div className="section-icon">📹</div>
                      Available Recordings ({classroomVideos.length})
                    </div>
                  </div>

                  <div className="cards-grid">
                    {classroomVideos.map((video, index) => (
                      <div 
                        key={video.id} 
                        className="project-card"
                        style={{ cursor: 'pointer' }}
                        onClick={() => setSelectedVideo(video)}
                      >
                        <div className="session-rank-badge">
                          {index === 0
                            ? 'Latest Session'
                            : index === 1
                              ? '2nd Latest'
                              : `Session ${index + 1}`}
                        </div>
                        {/* Video Thumbnail */}
                        <div style={{ 
                          position: 'relative',
                          borderRadius: '12px',
                          overflow: 'hidden',
                          marginBottom: '15px',
                          height: '180px',
                          backgroundColor: '#f7fafc'
                        }}>
                          {video.videoSource === 'youtube-url' && videoThumbnails[video.id] ? (
                            <img 
                              src={videoThumbnails[video.id]} 
                              alt={video.title}
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                borderRadius: '12px'
                              }}
                              onError={(e) => {
                                // Fallback to placeholder if thumbnail fails
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          
                          {/* Fallback placeholder */}
                          <div style={{
                            display: video.videoSource === 'youtube-url' && videoThumbnails[video.id] ? 'none' : 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '100%',
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            color: 'white',
                            fontSize: '48px'
                          }}>
                            {video.videoSource === 'youtube-url' ? '📺' : 
                             video.videoSource === 'youtube' ? '📺' : '🎥'}
                          </div>
                          
                          {/* Duration badge */}
                          {videoDurations[video.id] && videoDurations[video.id] !== 'Duration not available' && (
                            <div style={{
                              position: 'absolute',
                              bottom: '8px',
                              right: '8px',
                              backgroundColor: 'rgba(0, 0, 0, 0.8)',
                              color: 'white',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '12px',
                              fontWeight: 'bold'
                            }}>
                              {videoDurations[video.id]}
                            </div>
                          )}
                        </div>
                        
                        <h3 style={{ 
                          fontSize: '18px', 
                          fontWeight: '600', 
                          margin: '0 0 12px 0', 
                          color: '#2d3748',
                          lineHeight: '1.4'
                        }}>
                          {video.title}
                        </h3>
                        
                        <div style={{ 
                          color: '#718096', 
                          fontSize: '14px', 
                          marginBottom: '15px',
                          lineHeight: '1.5'
                        }}>
                          <div style={{ marginBottom: '8px' }}>
                            <strong>👨‍🏫 Teacher:</strong> {getTeacherName(video.batchId)}
                          </div>
                          {videoDurations[video.id] && videoDurations[video.id] !== 'Duration not available' && (
                            <div style={{ marginBottom: '8px' }}>
                              <strong>⏱️ Duration:</strong> {videoDurations[video.id]}
                            </div>
                          )}
                          <div style={{ marginBottom: '8px' }}>
                            <strong>📅 Class Date:</strong> {new Date(video.date || video.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </div>
                        </div>
                        
                        <div className="card-actions">
                          <button 
                            className="btn-edit"
                            style={{ 
                              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                              border: 'none',
                              color: 'white',
                              padding: '12px 20px',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              fontSize: '14px',
                              fontWeight: '500',
                              width: '100%',
                              transition: 'all 0.3s ease'
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedVideo(video);
                            }}
                          >
                            ▶️ Watch Video
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="content-section">
                  <div className="empty-state">
                    <div className="empty-state-icon">📹</div>
                    <div className="empty-state-title">No Recordings Available</div>
                    <div className="empty-state-text">
                      Class recordings will appear here within 24 hours after each live session.
                    </div>
                  </div>
                </div>
              )}

              <div className="content-section">
                <div className="section-header">
                  <div className="section-title">
                    <div className="section-icon">📢</div>
                    Important Information
                  </div>
                </div>
                <div style={{ 
                  padding: '1.5rem', 
                  background: 'rgba(102, 126, 234, 0.1)', 
                  borderRadius: '12px',
                  border: '1px solid rgba(102, 126, 234, 0.2)'
                }}>
                  <p style={{ margin: 0, color: '#4a5568' }}>
                    📌 New class recordings are added within 24 hours after each live session. 
                    Click on any recording to start watching. Videos are available for all enrolled students.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Live Classes Section */}
          {activeSection === 'liveClasses' && (
            <div className="animate-in">
              <div className="header">
                <h1>📡 Live Classes</h1>
                <div className="subtitle">
                  Join upcoming live sessions and interact with instructors
                </div>
              </div>

              <div className="content-section">
                <div className="section-header">
                  <div className="section-title">
                    <div className="section-icon">📅</div>
                    Upcoming Sessions
                  </div>
                </div>

                {lessons && lessons.filter(l => l.classLink).length > 0 ? (
                  <div className="video-grid">
                    {lessons.filter(l => l.classLink).slice(0, 6).map((lesson) => (
                      <div key={lesson.id} className="video-card">
                        <div className="video-thumbnail">📡</div>
                        <div className="video-info">
                          <div className="video-title">{lesson.title}</div>
                          <div className="video-meta">
                            <div className="video-meta-row">
                              <span>⏱️ {lesson.duration || 'TBD'}</span>
                              <span className="learning-badge warning">Live</span>
                            </div>
                            <div className="video-meta-row">
                              <span>🔴 Click to join</span>
                            </div>
                          </div>
                          <div className="learning-actions">
                            <a 
                              href={lesson.classLink} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="action-btn"
                              style={{ textDecoration: 'none', marginTop: '1rem' }}
                            >
                              <span>🔴</span>
                              <span>Join Class</span>
                            </a>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <div className="empty-state-icon">📡</div>
                    <div className="empty-state-title">No Live Classes Scheduled</div>
                    <div className="empty-state-text">
                      Check back later for upcoming live sessions with your instructors.
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          {activeSection === 'progress' && (
            <div className="animate-in">
              <div className="header">
                <h1>📊 Learning Progress</h1>
                <div className="subtitle">
                  Track your learning journey and achievements
                </div>
              </div>

              <div className="content-section">
                <div className="section-header">
                  <div className="section-title">
                    <div className="section-icon">📈</div>
                    Overall Progress
                  </div>
                </div>

                <div className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-icon">📚</div>
                    <div className="stat-value">{progressPercent}%</div>
                    <div className="stat-label">Course Completion</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon">📁</div>
                    <div className="stat-value">{viewedFiles.length}</div>
                    <div className="stat-label">Files Viewed</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon">🎥</div>
                    <div className="stat-value">{classroomVideos.length}</div>
                    <div className="stat-label">Videos Available</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon">🏆</div>
                    <div className="stat-value">{Math.floor(progressPercent / 25)}</div>
                    <div className="stat-label">Achievements</div>
                  </div>
                </div>

                <div style={{ marginTop: '2rem' }}>
                  <div className="progress-stats">
                    <span>Course Progress</span>
                    <span>{progressPercent}%</span>
                  </div>
                  <div className="progress-bar" style={{ height: '20px' }}>
                    <div 
                      className="progress-fill" 
                      style={{ width: `${progressPercent}%` }}
                    ></div>
                  </div>
                  <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                    <span className="learning-badge success">
                      {progressPercent === 100 ? '🎉 Course Completed!' : `Keep going! ${100 - progressPercent}% to go`}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {activeSection === 'profile' && (
            <div className="animate-in">
              <StudentProfile 
                user={user} 
                onProfileUpdate={(updatedUser) => {
                  // Update the user state in localStorage
                  localStorage.setItem('user', JSON.stringify(updatedUser));
                  
                  // If email changed, show message about potential re-login
                  if (user.email !== updatedUser.email) {
                    alert('Email updated! You may need to login again with your new email address.');
                  }
                  
                  // Update the user prop by triggering a re-render
                  // In a real app, you'd use a state management system
                  window.location.reload();
                }}
              />
            </div>
          )}
        </div>
      </main>

      {/* Video Player Modal */}
      {selectedVideo && (
        <CustomVideoPlayer
          video={selectedVideo}
          resumePosition={getVideoResumePosition(selectedVideo.id)}
          onProgressUpdate={updateVideoProgress}
          onClose={() => setSelectedVideo(null)}
        />
      )}
    </div>
  );
};

export default Dashboard;
