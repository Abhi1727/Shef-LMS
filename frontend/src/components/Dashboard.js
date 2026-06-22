import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import CustomVideoPlayer from './CustomVideoPlayer';
import StudentProfile from './StudentProfile';
import StudentAnalyticsDashboard from './StudentAnalyticsDashboard';
import { YouTubeUtils } from '../utils/youtubeUtils';
import { convertIstRangeToZone } from '../utils/timezoneUtils';
import { formatDateForComponent } from '../utils/dateUtils';
import { ToastContainer, showToast } from './Toast';
import './Dashboard.css';

// Premium Image Slider Component with Advanced Features
const ImageSlider = ({ setActiveSection }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const [loadedImages, setLoadedImages] = useState(new Set());
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dynamicSlides, setDynamicSlides] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Enhanced slide data with course-specific educational content
  const defaultSlides = [
    {
      id: 1,
      image: '/images/courses/data-science/ds-ai-banner.webp',
      title: 'Data Science & AI',
      description: 'Master machine learning, data analytics, and artificial intelligence',
      category: 'Data Science',
      badge: 'Trending',
      link: '#data-science',
      stats: { students: '3.1k', rating: 4.9, duration: '12 weeks' }
    },
    {
      id: 2,
      image: '/images/courses/cyber-security/cyber-security-banner.webp',
      title: 'Cyber Security & Ethical Hacking',
      description: 'Learn penetration testing, security fundamentals, and defense strategies',
      category: 'Security',
      badge: 'Popular',
      link: '#cyber-security',
      stats: { students: '2.2k', rating: 4.8, duration: '14 weeks' }
    },
    {
      id: 3,
      image: '/images/courses/devops/devops-banner.webp',
      title: 'DevOps & Cloud Computing',
      description: 'Master CI/CD pipelines, containerization, and cloud infrastructure',
      category: 'DevOps',
      badge: 'Featured',
      link: '#devops',
      stats: { students: '1.8k', rating: 4.7, duration: '10 weeks' }
    },
    {
      id: 4,
      image: '/images/courses/one-to-one/one-to-one-banner.webp',
      title: 'One-to-One Personal Learning',
      description: 'Get personalized mentorship and customized learning paths',
      category: 'Personal',
      badge: 'Premium',
      link: '#one-to-one',
      stats: { students: '850', rating: 4.9, duration: 'Flexible' }
    }
  ];

  const slides = dynamicSlides.length > 0 ? dynamicSlides : defaultSlides;

  // Fetch real course data and integrate with slider
  useEffect(() => {
    const loadCourseData = async () => {
      try {
        setIsLoading(true);
        
        // Fetch course data from API
        const token = localStorage.getItem('token');
        const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
        
        let courseData = null;
        try {
          const response = await fetch(`${apiUrl}/api/courses`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (response.ok) {
            courseData = await response.json();
            console.log('Course data loaded:', courseData);
          }
        } catch (err) {
          console.log('Course API not available, using default slides');
        }
        
        // Enhance slides with real course data if available
        let enhancedSlides = defaultSlides;
        
        if (courseData && Array.isArray(courseData)) {
          enhancedSlides = defaultSlides.map((slide, index) => {
            const matchingCourse = courseData.find(course => 
              course.name && (
                course.name.toLowerCase().includes('data science') && slide.title.toLowerCase().includes('data') ||
                course.name.toLowerCase().includes('cyber') && slide.title.toLowerCase().includes('cyber') ||
                course.name.toLowerCase().includes('devops') && slide.title.toLowerCase().includes('devops') ||
                course.name.toLowerCase().includes('one-to-one') && slide.title.toLowerCase().includes('one-to-one')
              )
            );
            
            if (matchingCourse) {
              return {
                ...slide,
                stats: {
                  students: matchingCourse.enrolledStudents || slide.stats.students,
                  rating: matchingCourse.rating || slide.stats.rating,
                  duration: matchingCourse.duration || slide.stats.duration
                },
                lastUpdated: new Date().toLocaleDateString(),
                featured: index === 0,
                priority: index < 3 ? 'high' : 'medium',
                courseId: matchingCourse._id
              };
            }
            
            return {
              ...slide,
              lastUpdated: new Date().toLocaleDateString(),
              featured: index === 0,
              priority: index < 3 ? 'high' : 'medium'
            };
          });
        } else {
          // Add dynamic data to default slides
          enhancedSlides = defaultSlides.map((slide, index) => ({
            ...slide,
            lastUpdated: new Date().toLocaleDateString(),
            featured: index === 0,
            priority: index < 3 ? 'high' : 'medium'
          }));
        }
        
        setDynamicSlides(enhancedSlides);
        setError(null);
      } catch (err) {
        setError('Failed to load course content');
        console.error('Course content loading error:', err);
        // Still set default slides on error
        setDynamicSlides(defaultSlides);
      } finally {
        setIsLoading(false);
      }
    };

    loadCourseData();
  }, []);

  // Auto-play with progress tracking
  useEffect(() => {
    if (!isAutoPlaying || isPaused || isTransitioning) return;
    
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          handleNext();
          return 0;
        }
        return prev + (100 / 40); // 40 seconds total
      });
    }, 400);

    return () => clearInterval(interval);
  }, [isAutoPlaying, isPaused, isTransitioning, slides.length]);

  // Reset progress when slide changes
  useEffect(() => {
    setProgress(0);
  }, [currentSlide]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 'ArrowLeft') handlePrevious();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === ' ') {
        e.preventDefault();
        setIsPaused(!isPaused);
      }
      if (e.key === 'Escape' && isFullscreen) {
        toggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isPaused, isFullscreen]);

  // Touch gesture handlers
  const handleTouchStart = (e) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe) handleNext();
    if (isRightSwipe) handlePrevious();
  };

  // Enhanced lazy loading images with fallback support
  const loadImage = (src) => {
    if (loadedImages.has(src)) return Promise.resolve();
    
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        setLoadedImages(prev => new Set([...prev, src]));
        resolve();
      };
      img.onerror = (error) => {
        console.warn(`Failed to load image: ${src}`, error);
        // Try to load fallback image if it's a course image
        if (src.includes('/images/courses/')) {
          // Use a gradient placeholder as fallback
          const fallbackUrl = `https://picsum.photos/seed/course-${src.split('/').pop().split('.')[0]}/1200/400.jpg`;
          const fallbackImg = new Image();
          fallbackImg.onload = () => {
            setLoadedImages(prev => new Set([...prev, src])); // Mark original as loaded to prevent retry
            resolve();
          };
          fallbackImg.onerror = () => {
            setLoadedImages(prev => new Set([...prev, src])); // Mark as loaded to prevent infinite retry
            resolve(); // Resolve anyway to allow slider to continue
          };
          fallbackImg.src = fallbackUrl;
        } else {
          reject(error);
        }
      };
      img.src = src;
    });
  };

  // Preload adjacent images
  useEffect(() => {
    const preloadImages = async () => {
      const currentIndex = currentSlide;
      const nextIndex = (currentIndex + 1) % slides.length;
      const prevIndex = (currentIndex - 1 + slides.length) % slides.length;
      
      try {
        await Promise.all([
          loadImage(slides[currentIndex].image),
          loadImage(slides[nextIndex].image),
          loadImage(slides[prevIndex].image)
        ]);
      } catch (err) {
        console.error('Image preloading error:', err);
      }
    };

    if (slides.length > 0) {
      preloadImages();
    }
  }, [currentSlide, slides]);

  const handleSlideChange = (index) => {
    if (isTransitioning) return;
    
    setIsTransitioning(true);
    setCurrentSlide(index);
    setIsAutoPlaying(false);
    setIsPaused(true);
    
    setTimeout(() => {
      setIsTransitioning(false);
      setIsAutoPlaying(true);
      setIsPaused(false);
    }, 1000);
  };

  const handleNext = () => {
    if (isTransitioning) return;
    handleSlideChange((currentSlide + 1) % slides.length);
  };

  const handlePrevious = () => {
    if (isTransitioning) return;
    handleSlideChange((currentSlide - 1 + slides.length) % slides.length);
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const toggleAutoPlay = () => {
    setIsAutoPlaying(!isAutoPlaying);
    setIsPaused(!isPaused);
  };

  const handleSlideClick = (link, slide) => {
    // Enhanced slide navigation to actual course content
    console.log('Navigating to:', link, 'Slide:', slide);
    
    // Navigate based on course type
    if (link.includes('data-science')) {
      setActiveSection('courses');
      // Could add course filtering or specific course navigation
    } else if (link.includes('cyber-security')) {
      setActiveSection('courses');
      // Could add course filtering or specific course navigation
    } else if (link.includes('devops')) {
      setActiveSection('courses');
      // Could add course filtering or specific course navigation
    } else if (link.includes('one-to-one')) {
      setActiveSection('classroom');
      // Navigate to one-to-one sessions
    } else {
      // Default navigation
      setActiveSection('courses');
    }
    
    // If slide has courseId, could navigate to specific course details
    if (slide.courseId) {
      console.log('Course ID available:', slide.courseId);
      // Future enhancement: navigate to specific course page
    }
  };

  return (
    <div className={`premium-image-slider-container ${isFullscreen ? 'fullscreen' : ''}`}>
      {/* Loading State */}
      {isLoading && (
        <div className="slider-loading">
          <div className="loading-spinner"></div>
          <p>Loading amazing content...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="slider-error">
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      )}

      {/* Main Slider */}
      {!isLoading && !error && (
        <>
          {/* Progress Bar */}
          <div className="slider-progress">
            <div 
              className="progress-fill" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>

          {/* Slider Wrapper */}
          <div 
            className="premium-slider-wrapper"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {slides.map((slide, index) => (
              <div
                key={slide.id}
                className={`premium-slide ${index === currentSlide ? 'active' : ''} ${isTransitioning ? 'transitioning' : ''}`}
              >
                {/* Parallax Background */}
                <div className="slide-parallax">
                  <img 
                    src={slide.image} 
                    alt={slide.title}
                    className={loadedImages.has(slide.image) ? 'loaded' : 'loading'}
                  />
                </div>
                
                {/* Enhanced Overlay */}
                <div className="premium-slide-overlay">
                  <div className="slide-content">
                    {/* Badge and Category */}
                    <div className="slide-meta">
                      <span className="slide-category">{slide.category}</span>
                      <span className={`slide-badge ${slide.badge.toLowerCase()}`}>{slide.badge}</span>
                      {slide.featured && <span className="featured-badge">Featured</span>}
                    </div>
                    
                    {/* Title and Description */}
                    <h3 className="slide-title">{slide.title}</h3>
                    <p className="slide-description">{slide.description}</p>
                    
                    {/* Stats - Commented out */}
                    {/* <div className="slide-stats">
                      <div className="stat">
                        <span className="stat-value">{slide.stats.students}</span>
                        <span className="stat-label">Students</span>
                      </div>
                      <div className="stat">
                        <span className="stat-value">{slide.stats.rating} &#9733;</span>
                        <span className="stat-label">Rating</span>
                      </div>
                      <div className="stat">
                        <span className="stat-value">{slide.stats.duration}</span>
                        <span className="stat-label">Duration</span>
                      </div>
                    </div> */}
                    
                    {/* Action Button */}
                    <button 
                      className="slide-action-btn"
                      onClick={() => handleSlideClick(slide.link, slide)}
                    >
                      Explore Course
                      <span className="btn-arrow">→</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Enhanced Navigation Controls */}
          <button className="premium-slider-btn prev-btn" onClick={handlePrevious}>
            <span className="btn-icon">‹</span>
            <span className="btn-label">Previous</span>
          </button>
          <button className="premium-slider-btn next-btn" onClick={handleNext}>
            <span className="btn-label">Next</span>
            <span className="btn-icon">›</span>
          </button>

          {/* Enhanced Controls */}
          <div className="premium-slider-controls">
            {/* Play/Pause Button */}
            <button className="control-btn play-pause-btn" onClick={toggleAutoPlay}>
              {isPaused ? '▶' : '⏸'}
            </button>
            
            {/* Fullscreen Button */}
            <button className="control-btn fullscreen-btn" onClick={toggleFullscreen}>
              {isFullscreen ? '⛶' : '⛶'}
            </button>
            
            {/* Slide Counter */}
            <div className="slide-counter">
              <span className="current-slide">{currentSlide + 1}</span>
              <span className="divider">/</span>
              <span className="total-slides">{slides.length}</span>
            </div>
          </div>

          {/* Enhanced Dot Indicators */}
          <div className="premium-slider-dots">
            {slides.map((slide, index) => (
              <button
                key={index}
                className={`premium-dot ${index === currentSlide ? 'active' : ''}`}
                onClick={() => handleSlideChange(index)}
                aria-label={`Go to slide ${index + 1}`}
              >
                <span className="dot-progress"></span>
              </button>
            ))}
          </div>

          {/* Thumbnail Navigation */}
          <div className="thumbnail-nav">
            {slides.map((slide, index) => (
              <button
                key={index}
                className={`thumbnail ${index === currentSlide ? 'active' : ''}`}
                onClick={() => handleSlideChange(index)}
              >
                <img src={slide.image} alt={slide.title} />
                <span className="thumbnail-title">{slide.title}</span>
              </button>
            ))}
          </div>
        </>
      )}
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

// Enhanced file utility functions for Dashboard
const getFileTypeIcon = (fileName) => {
  if (!fileName) return '📄';
  const extension = fileName?.split('.').pop()?.toLowerCase();
  const iconMap = {
    'pdf': '📄',
    'doc': '📝',
    'docx': '📝',
    'txt': '📃',
    'ppt': '📊',
    'pptx': '📊',
    'xls': '📈',
    'xlsx': '📈',
    'csv': '📋',
    'ipynb': '🧪',
    'zip': '🗜️',
    'jpg': '🖼️',
    'jpeg': '🖼️',
    'png': '🖼️',
    'gif': '🖼️'
  };
  return iconMap[extension] || '📄';
};

const Dashboard = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [lessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [darkMode, setDarkMode] = useState(true);
  
  // Course content state
  const [courseContent, setCourseContent] = useState(null);
  
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

  // Real-time stats state
  const [realTimeStats, setRealTimeStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [statsError, setStatsError] = useState(null);

  // Navigation button width tracking state
  const [studentAssessments, setStudentAssessments] = useState([]);
  const [navButtonWidths, setNavButtonWidths] = useState({});
  const navButtonRefs = useRef({
    overview: useRef(null),
    classroom: useRef(null),
    analytics: useRef(null),
    profile: useRef(null)
  });

  // Helper functions inside component
  const getPersonalizedGreeting = useCallback(() => {
    return 'Welcome back';
  }, []);

  const getGreetingEmoji = useCallback(() => {
    return '👋';
  }, []);

  const getDynamicMessages = useCallback((courseType) => {
    if (courseType === 'data-science') {
      return [
        "Ready to master Data Science & AI? 🚀",
        "Let's explore machine learning today 🤖",
        "Your data science journey continues! 📊",
        "Time to build amazing AI models ⚡",
        "Unlock the power of data analytics 🔓"
      ];
    } else if (courseType === 'cyber-security') {
      return [
        "Ready to enhance your cybersecurity skills? 🛡️",
        "Let's explore ethical hacking today 🔍",
        "Your cybersecurity journey continues! 🔐",
        "Time to master penetration testing ⚔️",
        "Become a security expert! 🎯"
      ];
    } else if (courseType === 'devops-ai') {
      return [
        "Ready to master DevOps & AI? 🚀",
        "Let's build intelligent deployment pipelines today 🤖",
        "Your DevOps & AI journey continues! ⚙️",
        "Time to automate with AI and DevOps! ⚡",
        "Become a DevOps & AI expert! 🎯"
      ];
    } else if (courseType === 'devops-cloud') {
      return [
        "Ready to master DevOps & Cloud? ☁️",
        "Let's build scalable cloud infrastructure today 🌩️",
        "Your DevOps & Cloud journey continues! ⚙️",
        "Time to deploy to the cloud! ⚡",
        "Become a cloud DevOps expert! 🎯"
      ];
    } else {
      return [
        "Ready to start your learning journey? 🚀",
        "Let's explore new topics today 📚",
        "Your learning journey continues! 🎯",
        "Time to master new skills! ⚡",
        "Become an expert in your field! 🔥"
      ];
    }
  }, []);

  const calculateStreak = useCallback(() => {
    // This would normally come from user data/progress tracking
    // For now, return a random streak between 1-30
    return Math.floor(Math.random() * 30) + 1;
  }, []);

  // API integration function to load real-time stats
  const loadRealTimeStats = useCallback(async () => {
    try {
      setLoadingStats(true);
      setStatsError(null);
      
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      // Use the same API base URL pattern as other functions in the component
      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000/api' : '/api';
      const response = await fetch(`${apiUrl}/student/progress-summary`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Token expired, logout user
          onLogout();
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setRealTimeStats(data);
      console.log('✅ Real-time stats loaded:', data);
    } catch (error) {
      console.error('❌ Error loading real-time stats:', error);
      setStatsError(error.message);
      
      // Use actual real-time data from the component instead of hardcoded values
      // Use base course data since courseData isn't available yet
      const isDataScienceCourse = user?.currentCourse?.toLowerCase().includes('data science');
      const baseModules = isDataScienceCourse ? 10 : 10; // Both courses have 10 modules
      
      const actualData = {
        modules: { 
          total: baseModules, 
          completed: Math.floor((progressPercent / 100) * baseModules), 
          inProgress: Math.min(baseModules - Math.floor((progressPercent / 100) * baseModules), 2)
        },
        videos: { 
          total: classroomVideos.length, 
          watched: viewedFiles.length, 
          progressPercentage: progressPercent 
        },
        streak: { 
          current: calculateStreak(), 
          longest: calculateStreak(), // Use same for now 
          lastLoginDate: new Date().toISOString().split('T')[0] 
        },
        overallProgress: progressPercent
      };
      
      setRealTimeStats(actualData);
      console.log('🔄 Using actual component data:', actualData);
    } finally {
      setLoadingStats(false);
    }
  }, [onLogout]);

  // Card click handler
  const handleCardClick = useCallback((cardType) => {
    switch(cardType) {
      case 'modules':
        setActiveSection('courses');
        // Could add scroll to modules section or focus
        break;
      case 'progress':
        setActiveSection('progress');
        break;
      case 'videos':
        setActiveSection('classroom');
        // Could add filter for unwatched videos
        break;
      case 'streak':
        // Could show streak details modal or navigate to profile
        setActiveSection('profile');
        break;
      default:
        break;
    }
  }, []);

  // Navigation helper functions
  const getNavIndicatorPosition = useCallback(() => {
    const buttonOrder = ['overview', 'classroom', 'analytics', 'profile'];
    let leftPosition = 0;
    
    for (let i = 0; i < buttonOrder.length; i++) {
      const buttonKey = buttonOrder[i];
      if (buttonKey === activeSection) {
        break;
      }
      leftPosition += navButtonWidths[buttonKey] || 0;
    }
    
    return `${leftPosition}px`;
  }, [activeSection, navButtonWidths]);

  const getNavIndicatorWidth = useCallback(() => {
    return `${navButtonWidths[activeSection] || 0}px`;
  }, [activeSection, navButtonWidths]);

  // Modern Animated Gradient Background Component
  const AnimatedGradientBackground = useCallback(() => {
    const particles = Array.from({ length: 20 }, (_, i) => {
      return {
        id: i,
        left: `${Math.random() * 100}%`,
        animationDelay: `${Math.random() * 5}s`,
        animationDuration: `${15 + Math.random() * 10}s`
      };
    });

    const shapes = Array.from({ length: 6 }, (_, i) => {
      return {
        id: i,
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        animationDelay: `${Math.random() * 3}s`,
        animationDuration: `${20 + Math.random() * 15}s`
      };
    });

    return (
      <div className="animated-gradient-background">
        <div className="gradient-overlay">
          {/* <div className="floating-particles">
            {particles.map(particle => (
              <div
                key={particle.id}
                className="particle"
                style={{
                  left: particle.left,
                  animationDelay: particle.animationDelay,
                  animationDuration: particle.animationDuration
                }}
              />
            ))}
          </div> */}
          {/* <div className="geometric-patterns">
            {shapes.map(shape => (
              <div
                key={shape.id}
                className="geometric-shape"
                style={{
                  left: shape.left,
                  top: shape.top,
                  animationDelay: shape.animationDelay,
                  animationDuration: shape.animationDuration
                }}
              />
            ))}
          </div> */}
        </div>
      </div>
    );
  }, []);

  // Dark mode toggle
  const toggleDarkMode = () => {
    // Keep dark mode always active for students
    setDarkMode(true);
    localStorage.setItem('darkMode', 'true');
  };

  // Load dark mode preference on mount
  useEffect(() => {
    // Always set dark mode for students
    setDarkMode(true);
    localStorage.setItem('darkMode', 'true');
  }, []);

  useEffect(() => {
    const fetchStudentAssessments = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/assessment-studio/assessments', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setStudentAssessments(data);
        }
      } catch (err) {
        console.error('Failed to fetch student assessments', err);
      }
    };
    fetchStudentAssessments();
  }, []);

  // Apply dark mode class to body
  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [darkMode]);

  // Measure navigation button widths and set up ResizeObserver
  useEffect(() => {
    const measureButtonWidths = () => {
      const widths = {};
      Object.keys(navButtonRefs.current).forEach(key => {
        const ref = navButtonRefs.current[key];
        if (ref.current) {
          const rect = ref.current.getBoundingClientRect();
          widths[key] = rect.width;
        }
      });
      setNavButtonWidths(widths);
    };

    // Initial measurement
    measureButtonWidths();

    // Set up ResizeObserver for responsive width tracking
    const resizeObserver = new ResizeObserver(() => {
      measureButtonWidths();
    });

    // Observe all navigation buttons
    Object.values(navButtonRefs.current).forEach(ref => {
      if (ref.current) {
        resizeObserver.observe(ref.current);
      }
    });

    // Cleanup
    return () => {
      resizeObserver.disconnect();
    };
  }, []);

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
    if (lowerCourse.includes('devops') && lowerCourse.includes('ai')) {
      return 'devops-ai';
    }
    if (lowerCourse.includes('devops') && lowerCourse.includes('cloud')) {
      return 'devops-cloud';
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

  // Load user's progress from localStorage and initialize if new
  const loadUserProgress = useCallback(async () => {
    try {
      const coursePrefix = getCourseSlug();
      const storedHistory = localStorage.getItem(`${coursePrefix}_videoWatchHistory`);
      const storedViewed = localStorage.getItem(`${coursePrefix}_viewedFiles`);
      
      if (storedHistory) {
        setVideoWatchHistory(JSON.parse(storedHistory));
      } else {
        setVideoWatchHistory([]);
      }
      
      if (storedViewed) {
        setViewedFiles(JSON.parse(storedViewed));
      } else {
        setViewedFiles([]);
      }
    } catch (e) {
      console.error('Error loading user progress from local storage:', e);
      setViewedFiles([]);
      setVideoWatchHistory([]);
    }
  }, [getCourseSlug]);

  // Update video progress tracking (local + persisted)
  const updateVideoProgress = async (videoId, progress, position) => {
    const coursePrefix = getCourseSlug();
    setVideoWatchHistory(prevHistory => {
      const videoHistory = prevHistory || [];
      const exists = videoHistory.some(record => record.videoId === videoId);
      let updatedHistory;
      
      if (exists) {
        updatedHistory = videoHistory.map(record => {
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
      } else {
        updatedHistory = [
          ...videoHistory,
          {
            videoId,
            watchProgress: progress,
            lastWatchedPosition: position,
            lastWatchedAt: new Date().toISOString(),
            isCompleted: progress >= 95
          }
        ];
      }
      
      localStorage.setItem(`${coursePrefix}_videoWatchHistory`, JSON.stringify(updatedHistory));
      
      // Also mark as viewed file if progress started
      setViewedFiles(prevViewed => {
        if (!prevViewed.includes(videoId)) {
          const updatedViewed = [...prevViewed, videoId];
          localStorage.setItem(`${coursePrefix}_viewedFiles`, JSON.stringify(updatedViewed));
          return updatedViewed;
        }
        return prevViewed;
      });

      // Store the exact last played video info to resume it
      const currentVideo = classroomVideos.find(v => v.id === videoId);
      if (currentVideo) {
        localStorage.setItem(`${coursePrefix}_lastPlayedVideo`, JSON.stringify(currentVideo));
      }

      return updatedHistory;
    });
  };

  // Get video resume position
  const getVideoResumePosition = (videoId) => {
    const videoRecord = videoWatchHistory.find(record => record.videoId === videoId);
    return videoRecord ? videoRecord.lastWatchedPosition : 0;
  };

  // Local storage streak helper for real-time streak count
  const getLocalStorageStreak = useCallback(() => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const lastActive = localStorage.getItem('student_streak_lastActiveDate');
      let currentStreak = parseInt(localStorage.getItem('student_streak_currentCount') || '1', 10);
      
      if (!lastActive) {
        localStorage.setItem('student_streak_lastActiveDate', todayStr);
        localStorage.setItem('student_streak_currentCount', '1');
        return 1;
      }
      
      if (lastActive === todayStr) {
        return currentStreak;
      }
      
      const lastActiveDate = new Date(lastActive);
      const todayDate = new Date(todayStr);
      const diffTime = Math.abs(todayDate - lastActiveDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        currentStreak += 1;
        localStorage.setItem('student_streak_lastActiveDate', todayStr);
        localStorage.setItem('student_streak_currentCount', currentStreak.toString());
      } else if (diffDays > 1) {
        currentStreak = 1;
        localStorage.setItem('student_streak_lastActiveDate', todayStr);
        localStorage.setItem('student_streak_currentCount', '1');
      }
      return currentStreak;
    } catch (e) {
      console.error(e);
      return 1;
    }
  }, []);

  // Play video helper to immediately save lastPlayedVideo
  const handlePlayVideo = useCallback((video) => {
    if (!video) return;
    setSelectedVideo(video);
    try {
      const coursePrefix = getCourseSlug();
      localStorage.setItem(`${coursePrefix}_lastPlayedVideo`, JSON.stringify(video));
    } catch (e) {
      console.error('Error saving last played video:', e);
    }
  }, [getCourseSlug]);


  // Enhanced notes download function
  const handleDownloadNotes = async (video) => {
    try {
      const token = localStorage.getItem('token');
      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
      
      // Create download progress indicator
      const downloadButton = document.querySelector(`[title*="Download ${video.notesFileName || 'notes'} for ${video.title}"]`);
      if (downloadButton) {
        downloadButton.classList.add('downloading');
        downloadButton.disabled = true;
      }
      
      // Try different possible endpoints for notes download
      let response;
      const endpoints = [
        `${apiUrl}/api/classroom/${video.id}/notes`,
        `${apiUrl}/api/admin/classroom/${video.id}/notes`,
        `${apiUrl}/api/classroom/notes/${video.id}`,
        `${apiUrl}/api/admin/classroom/notes/${video.id}`
      ];
      
      for (const endpoint of endpoints) {
        try {
          response = await fetch(endpoint, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (response.ok) {
            break;
          }
        } catch (error) {
          console.log(`Failed to fetch from ${endpoint}:`, error);
        }
      }
      
      if (response && response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        // Try to get filename from response headers or use default
        const contentDisposition = response.headers.get('content-disposition');
        let filename = video.notesFileName || `notes-${video.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
        
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename="(.+)"/);
          if (filenameMatch) {
            filename = filenameMatch[1];
          }
        }
        
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        // Track notes downloaded as viewed file
        setViewedFiles(prevViewed => {
          const noteKey = `${video.id}_notes`;
          if (!prevViewed.includes(noteKey)) {
            const updatedViewed = [...prevViewed, noteKey];
            const coursePrefix = getCourseSlug();
            localStorage.setItem(`${coursePrefix}_viewedFiles`, JSON.stringify(updatedViewed));
            return updatedViewed;
          }
          return prevViewed;
        });

        // Show success message
        showToast('Notes downloaded successfully!', 'success');
      } else {
        // If no endpoint works, try to get notes from video object directly
        if (video.notesFileUrl || video.notesUrl || video.notesFilePath) {
          const notesUrl = video.notesFileUrl || video.notesUrl || video.notesFilePath;
          const notesResponse = await fetch(`${apiUrl}${notesUrl}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (notesResponse.ok) {
            const blob = await notesResponse.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = video.notesFileName || `notes-${video.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            // Track notes downloaded as viewed file
            setViewedFiles(prevViewed => {
              const noteKey = `${video.id}_notes`;
              if (!prevViewed.includes(noteKey)) {
                const updatedViewed = [...prevViewed, noteKey];
                const coursePrefix = getCourseSlug();
                localStorage.setItem(`${coursePrefix}_viewedFiles`, JSON.stringify(updatedViewed));
                return updatedViewed;
              }
              return prevViewed;
            });

            showToast('Notes downloaded successfully!', 'success');
            return;
          }
        }
        
        showToast('Failed to download notes. The notes file may not be available yet.', 'error');
      }
    } catch (error) {
      console.error('Error downloading notes:', error);
      showToast('Error downloading notes. Please try again later.', 'error');
    } finally {
      // Remove download progress indicator
      const downloadButton = document.querySelector(`[title*="Download ${video.notesFileName || 'notes'} for ${video.title}"]`);
      if (downloadButton) {
        downloadButton.classList.remove('downloading');
        downloadButton.disabled = false;
      }
    }
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

      const response = await fetch(`${apiUrl}/api/dashboard/classroom`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const raw = await response.json();
        const videos = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.videos)
            ? raw.videos
            : [];

        // Additional sorting on frontend to ensure correct ordering (newest class date first)
        const sortedVideos = videos.sort((a, b) => {
          const getVideoDate = (v) => {
            if (v.isOneToOne && v.classDate) {
              try {
                return new Date(v.classDate.split('-').reverse().join('-'));
              } catch (e) {
                // fallback
              }
            }
            return new Date(v.date || v.createdAt || v.addedAt || 0);
          };
          const dateA = getVideoDate(a);
          const dateB = getVideoDate(b);
          return dateB - dateA;
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
    const loadInitialData = async () => {
      try {
        await Promise.all([
          loadClassroomVideos(),
          loadBatches(),
          loadBatchInfo()
        ]);
      } catch (error) {
        console.error('Error loading initial dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (user?.currentCourse) {
      loadInitialData();
    } else {
      setLoading(false);
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

  // Load real-time stats on mount and when user changes
  useEffect(() => {
    if (user?.id) {
      loadRealTimeStats();
    }
  }, [user?.id, loadRealTimeStats]);

  // Auto-refresh real-time stats every 5 minutes
  useEffect(() => {
    if (!user?.id) return;
    
    const interval = setInterval(() => {
      loadRealTimeStats();
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [user?.id, loadRealTimeStats]);

  // Load course content from API
  const loadCourseContent = useCallback(async () => {
    const slug = getCourseSlug();
    try {
      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000/api' : '/api';
      const response = await fetch(`${apiUrl}/content/${slug}`);
      const data = await response.json();
      if (data && data.success) {
        setCourseContent(data);
      } else {
        setCourseContent(null);
      }
    } catch (error) {
      console.error('Error loading course content:', error);
    }
  }, [getCourseSlug]);

  // Load course content on mount and when course changes
  useEffect(() => {
    if (user?.currentCourse) {
      loadCourseContent();
    }
  }, [user?.currentCourse, loadCourseContent]);

  // Check if user is Data Science or Cybersecurity
  const isDataScience = () => {
    const courseName = user?.currentCourse || '';
    return courseName.toLowerCase().includes('data science') || courseName.toLowerCase().includes('ai');
  };

  
  // Complete Course Curriculum - DATA SCIENCE & AI

  // Get the most recent video played by user
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
    console.log('🔍 formatClassDate called with:', dateStr);
    
    if (!dateStr || dateStr === '' || dateStr === 'Not specified') {
      console.log('🔍 No date provided, returning Not specified');
      return 'Not specified';
    }
    
    // Handle different date formats
    // If it's in dd-mm-yyyy format (from backend), convert it
    if (typeof dateStr === 'string' && dateStr.includes('-')) {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        // Check if it's dd-mm-yyyy format
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        const year = parseInt(parts[2], 10);
        
        if (!isNaN(day) && !isNaN(month) && !isNaN(year) && day <= 31 && month <= 12) {
          const date = new Date(year, month - 1, day);
          const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          const formatted = `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]} ${year}`;
          console.log('🔍 Formatted dd-mm-yyyy date:', formatted);
          return formatted;
        }
      }
    }
    
    // Handle yyyy-mm-dd format (HTML date input format)
    if (typeof dateStr === 'string' && dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const formatted = `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
        console.log('🔍 Formatted yyyy-mm-dd date:', formatted);
        return formatted;
      }
    }
    
    // Fallback to regular date parsing
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        console.log('🔍 Could not parse date, returning original:', dateStr);
        return dateStr; // Return original if can't parse
      }
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const formatted = `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
      console.log('🔍 Formatted with regular parsing:', formatted);
      return formatted;
    } catch (error) {
      console.log('🔍 Error parsing date, returning original:', dateStr);
      return dateStr; // Return original if error
    }
  };

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
    // Start collapsed so the user has full screen mode by default
    setSidebarOpen(false);
  }, []);

  // Load course content when switching to Learn section
  useEffect(() => {
    if (activeSection === 'courses' && !courseContent) {
      loadCourseContent();
    }
  }, [activeSection]);

  // Custom global search function
  const [searchQuery, setSearchQuery] = useState('');
  const getFilteredSearchItems = () => {
    if (!searchQuery) return [];
    const query = searchQuery.toLowerCase();
    const results = [];

    // Search videos
    classroomVideos.forEach(video => {
      if ((video.title || '').toLowerCase().includes(query) || (video.instructor || '').toLowerCase().includes(query)) {
        results.push({ type: 'video', title: video.title, icon: '🎥', item: video });
      }
    });

    // Search modules/lessons
    const list = isDataScience() ? dsCourseData.modules_detail : cyberCourseData.modules_detail;
    list.forEach(mod => {
      if (mod.name.toLowerCase().includes(query)) {
        results.push({ type: 'module', title: mod.name, icon: '📦', action: () => { setActiveSection('classroom') } });
      }
      mod.chapters.forEach(ch => {
        if (ch.title.toLowerCase().includes(query)) {
          results.push({ type: 'lesson', title: ch.title, icon: '📄', action: () => { setActiveSection('classroom') } });
        }
      });
    });

    return results;
  };

  return (
    <div className="dashboard aetherial-theme dark">
      {/* Background Neural / Grid Overlay */}
      <div className="grid-overlay" />
      <div className="aurora-glow bg-primary top-1/4 left-1/4" />
      <div className="aurora-glow bg-secondary bottom-1/4 right-1/4" />

      {/* Modern Sidebar Navigation */}
      <aside className={`sidebar ${sidebarOpen ? 'expanded' : 'collapsed'}`}>
        <div className="sidebar-brand" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="brand-logo">🌌</div>
            <span className="brand-text">Sky States</span>
          </div>
          {sidebarOpen && (
            <button 
              className="sidebar-close-btn" 
              onClick={() => setSidebarOpen(false)}
              style={{ background: 'none', border: 'none', color: 'var(--on-surface-variant)', fontSize: '18px', cursor: 'pointer' }}
            >
              ✖
            </button>
          )}
        </div>

        <nav className="sidebar-menu">
          <button 
            className={`menu-item ${activeSection === 'overview' ? 'active' : ''}`}
            onClick={() => { setActiveSection('overview'); setSidebarOpen(false); }}
          >
            <span className="menu-icon">🏠</span>
            <span className="menu-label">Home</span>
          </button>
          
          <button 
            className={`menu-item ${activeSection === 'classroom' ? 'active' : ''}`}
            onClick={() => { setActiveSection('classroom'); setSidebarOpen(false); }}
          >
            <span className="menu-icon">🎥</span>
            <span className="menu-label">Classroom</span>
            {classroomVideos.length > 0 && (
              <span className="menu-badge">{classroomVideos.length}</span>
            )}
          </button>

          <button 
            className={`menu-item ${activeSection === 'assessments' ? 'active' : ''}`}
            onClick={() => { setActiveSection('assessments'); setSidebarOpen(false); }}
          >
            <span className="menu-icon">✏️</span>
            <span className="menu-label">Assessments</span>
            {studentAssessments.length > 0 && (
              <span className="menu-badge">{studentAssessments.length}</span>
            )}
          </button>
          
          <button 
            className="menu-item"
            onClick={() => { navigate('/resources'); setSidebarOpen(false); }}
          >
            <span className="menu-icon">📚</span>
            <span className="menu-label">Resources</span>
          </button>

          <button 
            className={`menu-item ${activeSection === 'profile' ? 'active' : ''}`}
            onClick={() => { setActiveSection('profile'); setSidebarOpen(false); }}
          >
            <span className="menu-icon">👤</span>
            <span className="menu-label">Profile</span>
          </button>

          <button 
            className="menu-item logout-menu-btn"
            onClick={onLogout}
          >
            <span className="menu-icon">🚪</span>
            <span className="menu-label">Logout</span>
          </button>
        </nav>
      </aside>

      {/* Sidebar overlay backdrop for mobile/collapsing close */}
      {sidebarOpen && (
        <div 
          className="sidebar-overlay visible" 
          onClick={() => setSidebarOpen(false)} 
          style={{ zIndex: 99, position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} 
        />
      )}

      {/* Main Layout Container */}
      <div className="main-layout">
        {/* Top Header Bar */}
        <header className="aetherial-header">
          <button 
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle Sidebar"
          >
            ☰
          </button>
          
          <div className="global-search-container">
            <span className="search-icon">🔍</span>
            <input 
              type="text" 
              placeholder="Search lessons, videos, resources, modules..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="global-search-input"
            />
            {searchQuery && (
              <div className="search-results-dropdown glass-card">
                {getFilteredSearchItems().length > 0 ? (
                  getFilteredSearchItems().map((res, i) => (
                    <div 
                      key={i} 
                      className="search-result-item" 
                      onClick={() => {
                        if (res.item) {
                          handlePlayVideo(res.item);
                        } else if (res.action) {
                          res.action();
                        }
                        setSearchQuery('');
                      }}
                    >
                      <span className="res-icon">{res.icon}</span>
                      <span className="res-title">{res.title}</span>
                      <span className="res-type">{res.type}</span>
                    </div>
                  ))
                ) : (
                  <div className="no-search-results">No matches found</div>
                )}
              </div>
            )}
          </div>

          <div className="header-user-profile">
            <span className="streak-badge">🔥 {Math.max(realTimeStats?.streak?.current || 0, getLocalStorageStreak())} Days</span>
            <div className="user-avatar-rect" onClick={() => setActiveSection('profile')}>
              {user?.name?.charAt(0) || 'S'}
            </div>
          </div>
        </header>

        {/* Dashboard Content Pages */}
        <main className="main-content-scroll">
          {activeSection === 'overview' && (
            <div className="overview-page animate-in">
              {/* Hero Banner Section */}
              <section className="hero-section glass-card">
                <div className="hero-text-content">
                  <span className="badge-mono">AETHERIAL ACADEMY</span>
                  <h1 className="hero-title shimmer-text">
                    Transform Your Mind. <br />Build Future Architecture.
                  </h1>
                  <p className="hero-desc">
                    Welcome back, <strong className="glow-text">{user?.name}</strong>. You are currently enrolled in <strong>{user?.currentCourse || 'Data Science & AI'}</strong>.
                  </p>
                  <div className="hero-actions">
                    <button className="shimmer-btn primary-btn" onClick={() => setActiveSection('classroom')}>
                      Resume Learning
                    </button>
                  </div>
                </div>
                <div className="hero-visual-card">
                  <div className="metric-ring-large">
                    <svg viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="45" className="ring-bg" />
                      <circle cx="50" cy="50" r="45" className="ring-fill" strokeDasharray="283" strokeDashoffset={283 - (283 * progressPercent) / 100} />
                    </svg>
                    <div className="ring-inner">
                      <span className="percentage-number">{progressPercent}%</span>
                      <span className="percentage-label">COMPLETE</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* Continue Learning & Timeline Columns */}
              <div className="dashboard-columns-grid">
                <div className="column-left">
                  {/* Continue Learning Progress Card */}
                  <section className="dashboard-widget-section glass-card">
                    <div className="widget-header">
                      <span className="widget-icon">⚡</span>
                      <h2 className="widget-title">Continue Learning</h2>
                    </div>
                    <div className="widget-body">
                      {(() => {
                        const coursePrefix = getCourseSlug();
                        const lastPlayed = localStorage.getItem(`${coursePrefix}_lastPlayedVideo`);
                        const videoToResume = lastPlayed ? JSON.parse(lastPlayed) : (classroomVideos.length > 0 ? classroomVideos[0] : null);
                        
                        if (videoToResume) {
                          const progressRecord = videoWatchHistory.find(r => r.videoId === videoToResume.id);
                          const progressPercentage = progressRecord ? Math.round(progressRecord.watchProgress) : 0;
                          
                          return (
                            <div className="continue-learning-video-card" onClick={() => handlePlayVideo(videoToResume)}>
                              <div className="video-card-thumb">
                                <span className="play-button-overlay">▶</span>
                              </div>
                              <div className="video-card-meta">
                                <span className="lesson-badge-mono">RESUME SESSION</span>
                                <h3 className="video-card-title">{videoToResume.title}</h3>
                                <p className="video-card-desc">Instructor: {videoToResume.instructor || 'Staff'}</p>
                                <div className="progress-bar-thin">
                                  <div className="progress-bar-fill" style={{ width: `${progressPercentage || 10}%` }} />
                                </div>
                                <span style={{ fontSize: '11px', color: 'var(--on-surface-variant)', marginTop: '4px' }}>
                                  {progressPercentage}% Watched
                                </span>
                              </div>
                            </div>
                          );
                        } else {
                          return <p className="empty-text">No class sessions available yet.</p>;
                        }
                      })()}
                    </div>
                  </section>

                  {/* Learning Journey / Roadmap Section */}
                  <section className="dashboard-widget-section glass-card">
                    <div className="widget-header">
                      <span className="widget-icon">🛣️</span>
                      <h2 className="widget-title">Learning Journey</h2>
                    </div>
                    <div className="widget-body">
                      <div className="roadmap-journey">
                        <div className="roadmap-progress-bar" />
                        <div className="roadmap-steps">
                          <div className="roadmap-step completed">
                            <div className="step-marker">✓</div>
                            <div className="step-content">
                              <h4 className="step-title">Foundation & Basics</h4>
                              <p className="step-desc">Core variables, environments, and setups.</p>
                            </div>
                          </div>
                          <div className="roadmap-step active">
                            <div className="step-marker">●</div>
                            <div className="step-content">
                              <h4 className="step-title">Intermediate Deep Dive</h4>
                              <p className="step-desc">Interactive scripts and API pipelines.</p>
                            </div>
                          </div>
                          <div className="roadmap-step locked">
                            <div className="step-marker">🔒</div>
                            <div className="step-content">
                              <h4 className="step-title">Advanced Capstone</h4>
                              <p className="step-desc">High-performance production integrations.</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>
                </div>

                <div className="column-right">
                  {/* Today's Learning Stats / Quick Actions */}
                  <section className="dashboard-widget-section glass-card">
                    <div className="widget-header">
                      <span className="widget-icon">📊</span>
                      <h2 className="widget-title">Today's Achievements</h2>
                    </div>
                    <div className="widget-body grid-stats-2">
                      <div className="dashboard-stat-pill">
                        <span className="pill-number">{Math.max(realTimeStats?.streak?.current || 0, getLocalStorageStreak())}</span>
                        <span className="pill-label">Daily Streak</span>
                      </div>
                      <div className="dashboard-stat-pill">
                        <span className="pill-number">{viewedFiles.length}</span>
                        <span className="pill-label">Files Viewed</span>
                      </div>
                      <div className="dashboard-stat-pill">
                        <span className="pill-number">{videoWatchHistory.filter(r => r.watchProgress > 0).length}</span>
                        <span className="pill-label">Videos Watched</span>
                      </div>
                      <div className="dashboard-stat-pill">
                        <span className="pill-number">
                          {(() => {
                            const videoSeconds = videoWatchHistory.reduce((acc, curr) => acc + (curr.lastWatchedPosition || 0), 0);
                            const videoHours = videoSeconds / 3600;
                            const noteFilesCount = viewedFiles.filter(id => id.includes('_notes')).length;
                            const noteHours = noteFilesCount * 0.25;
                            const totalHours = videoHours + noteHours;
                            const baselineHours = (viewedFiles.length * 0.6);
                            const finalHours = totalHours > 0 ? Math.max(totalHours, baselineHours) : 0;
                            return finalHours > 0 ? finalHours.toFixed(1) + 'h' : '0.0h';
                          })()}
                        </span>
                        <span className="pill-label">Learning Hours</span>
                      </div>
                    </div>
                  </section>

                  {/* Upcoming Zoom Class Classroom Preview */}
                  <section className="dashboard-widget-section glass-card">
                    <div className="widget-header">
                      <span className="widget-icon">🎥</span>
                      <h2 className="widget-title">Classroom Preview</h2>
                    </div>
                    <div className="widget-body">
                      {batchInfo ? (
                        <div className="classroom-preview-card">
                          <div className="preview-header">
                            <span className="batch-name-badge">{batchInfo.name}</span>
                            <span className="pulse-dot">🔴 Live Soon</span>
                          </div>
                          <p className="preview-schedule">Schedule: {batchInfo.schedule?.days || 'N/A'} at {batchInfo.schedule?.time || 'N/A'}</p>
                          <button className="join-session-btn" onClick={() => setActiveSection('classroom')}>
                            Go to Classroom
                          </button>
                        </div>
                      ) : (
                        <p className="empty-text">No active batch assigned.</p>
                      )}
                    </div>
                  </section>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'classroom' && (
            <div className="classroom-page animate-in">
              <div className="page-header">
                <h1 className="page-title">🎥 Classroom Recordings</h1>
                <p className="page-subtitle">Access your batch live sessions, record replays, and download notes.</p>
              </div>

              {batchInfo && (
                <div className="batch-details-banner glass-card">
                  <div className="batch-banner-left">
                    <span className="batch-banner-title">{batchInfo.name}</span>
                    <span className="batch-banner-meta">Course: {batchInfo.course} | Instructor: {batchInfo.teacherName}</span>
                  </div>
                  <div className="batch-banner-right">
                    <span className="schedule-label">Schedules (EST / CST / PST):</span>
                    <span className="schedule-time">{batchInfo.schedule?.days} @ {batchInfo.schedule?.time}</span>
                  </div>
                </div>
              )}

              {classroomVideos.length > 0 ? (
                <div className="videos-grid-layout">
                  {classroomVideos.map((video, idx) => (
                    <div 
                      key={video.id} 
                      className="video-recording-card glass-card"
                      onClick={() => handlePlayVideo(video)}
                    >
                      <div className="video-card-thumbnail-wrapper">
                        {video.youtubeVideoId ? (
                          <img 
                            src={`https://img.youtube.com/vi/${video.youtubeVideoId}/mqdefault.jpg`} 
                            alt={video.title} 
                            className="video-thumbnail-img"
                          />
                        ) : (
                          <div className="video-thumbnail-fallback">🎥</div>
                        )}
                        <span className="session-number-badge">Session {idx + 1}</span>
                      </div>
                      <div className="video-card-details">
                        <h3 className="video-title">{video.title}</h3>
                        <p className="video-meta-text">👤 {video.instructor || 'Staff'} • 📅 {formatDateForComponent(video.date || video.createdAt)}</p>
                        {video.notesAvailable && video.notesFilePath && (
                          <button 
                            className="download-notes-action-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadNotes(video);
                            }}
                          >
                            📥 Download Lecture Notes
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state-container glass-card">
                  <span className="empty-icon">📺</span>
                  <h3>No Recordings Yet</h3>
                  <p>Your class replays will be posted here automatically within 24 hours.</p>
                </div>
              )}
            </div>
          )}

          {activeSection === 'assessments' && (
            <div className="classroom-section animate-in">
              <h2 className="section-title">✏️ Dynamic Assessments</h2>
              <p className="section-subtitle">Test your knowledge with AI-driven, secure quizzes and exams.</p>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px', marginTop: '24px' }}>
                {studentAssessments.map(ass => (
                  <div key={ass._id} style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', padding: '24px', color: 'white', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <span style={{ fontSize: '0.8rem', background: 'rgba(79, 70, 229, 0.2)', color: '#818cf8', padding: '4px 10px', borderRadius: '9999px', fontWeight: 'bold' }}>
                        {ass.difficulty.toUpperCase()}
                      </span>
                      <h3 style={{ fontSize: '1.25rem', marginTop: '12px', marginBottom: '8px' }}>{ass.title}</h3>
                      <p style={{ fontSize: '0.9rem', color: '#94a3b8', margin: '0 0 20px 0' }}>{ass.description}</p>
                      
                      <div style={{ fontSize: '0.85rem', color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                        <div>⏱️ <strong>Duration:</strong> {ass.duration} minutes</div>
                        <div>❓ <strong>Questions:</strong> {ass.questions?.length || 0}</div>
                        <div>🎯 <strong>Passing Score:</strong> {ass.passingMarks}%</div>
                      </div>
                    </div>
                    
                    <button 
                      onClick={() => navigate(`/student/assessment/${ass._id}`)}
                      className="btn-primary" 
                      style={{ width: '100%', padding: '12px' }}
                    >
                      Start Assessment
                    </button>
                  </div>
                ))}
                {studentAssessments.length === 0 && (
                  <p style={{ color: '#94a3b8', gridColumn: '1/-1', textAlign: 'center', padding: '40px' }}>
                    No assessments published for you at this time.
                  </p>
                )}
              </div>
            </div>
          )}

          {activeSection === 'profile' && (
            <div className="profile-page animate-in">
              <StudentProfile 
                user={user} 
                onProfileUpdate={(updatedUser) => {
                  localStorage.setItem('user', JSON.stringify(updatedUser));
                  window.location.reload();
                }}
              />
            </div>
          )}
        </main>
      </div>

      {/* Floating AI Assistant Trigger Placeholder */}
      <button className="floating-ai-assistant-btn" title="AI Assistant (Interface Placeholder)" onClick={() => showToast('AI assistant UI ready! Logic implementation pending.', 'info')}>
        ✨ AI
      </button>

      {/* Video Player Modal Overlay */}
      {selectedVideo && (
        <CustomVideoPlayer
          video={selectedVideo}
          resumePosition={getVideoResumePosition(selectedVideo.id)}
          onProgressUpdate={updateVideoProgress}
          onClose={() => setSelectedVideo(null)}
        />
      )}
      
      <ToastContainer />
    </div>
  );
};

export default Dashboard;
