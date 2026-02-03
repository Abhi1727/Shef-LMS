const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { db } = require('../config/firebase');

// Apply auth middleware to all dashboard routes
router.use(auth);

// @route   GET /api/dashboard/classroom
// @desc    Get classroom videos for the student with domain validation
router.get('/classroom', async (req, res) => {
  try {
    const user = req.user;
    const courseName = user.currentCourse || user.course || '';
    const userEmail = user.email || '';
    
    // Extract domain from email for validation
    const emailDomain = userEmail.split('@')[1]?.toLowerCase() || '';
    
    const isDataScienceCourse = courseName.toLowerCase().includes('data science') || 
                                courseName.toLowerCase().includes('ai');
    
    const snapshot = await db.collection('classroom').get();
    const allVideos = [];
    snapshot.forEach(doc => {
      allVideos.push({ id: doc.id, ...doc.data() });
    });
    
    // Filter videos based on user's course
    const filteredVideos = allVideos.filter(video => {
      const videoCourseLower = (video.courseType || '').toLowerCase();
      const userCourseLower = courseName.toLowerCase();
      
      if (isDataScienceCourse) {
        // More comprehensive matching for data science courses
        return videoCourseLower.includes('data science') || 
               videoCourseLower.includes('ai') || 
               videoCourseLower.includes('machine learning') ||
               videoCourseLower.includes('data') ||
               userCourseLower.includes('data science') || // Check if user course matches video course
               videoCourseLower.includes(userCourseLower); // Check if video course contains user course keywords
      } else {
        // More flexible matching for cyber security courses
        return videoCourseLower.includes('cyber') || 
               videoCourseLower.includes('security') || 
               videoCourseLower.includes('ethical') || 
               videoCourseLower.includes('hacking') ||
               userCourseLower.includes('cyber') || // Check if user course matches video course
               videoCourseLower.includes(userCourseLower); // Check if video course contains user course keywords
      }
    });
    
    // Sort by date, newest first
    const sortedVideos = filteredVideos.sort((a, b) => {
      return new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt);
    });
    
    // Add domain validation status for each video
    const videosWithAccess = sortedVideos.map(video => {
      // Check if user has access based on domain validation
      // For now, we'll allow access to all enrolled students
      // In a real implementation, you might have specific domain restrictions
      const hasAccess = user.status === 'active' && user.role === 'student';
      
      return {
        ...video,
        hasAccess,
        accessDeniedReason: !hasAccess ? 'Your account is not active or you are not enrolled' : null
      };
    });
    
    res.json(videosWithAccess);
  } catch (err) {
    console.error('Error fetching classroom videos:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/dashboard/classroom/:id/access
// @desc    Validate and grant access to a specific video
router.post('/classroom/:id/access', async (req, res) => {
  try {
    const user = req.user;
    
    const { id } = req.params;
    const userEmail = user.email || '';
    
    // Get the video
    const videoDoc = await db.collection('classroom').doc(id).get();
    if (!videoDoc.exists) {
      return res.status(404).json({ message: 'Video not found' });
    }
    
    const video = { id: videoDoc.id, ...videoDoc.data() };
    
    // Validate user access
    const courseName = user.currentCourse || user.course || '';
    const isDataScienceCourse = courseName.toLowerCase().includes('data science') || 
                                courseName.toLowerCase().includes('ai');
    
    const videoCourseLower = (video.courseType || '').toLowerCase();
    const userCourseLower = courseName.toLowerCase();
    let courseMatch = false;
    
    if (isDataScienceCourse) {
      // More comprehensive matching for data science courses
      courseMatch = videoCourseLower.includes('data science') || 
                   videoCourseLower.includes('ai') || 
                   videoCourseLower.includes('machine learning') ||
                   videoCourseLower.includes('data') ||
                   userCourseLower.includes('data science') || // Check if user course matches video course
                   videoCourseLower.includes(userCourseLower); // Check if video course contains user course keywords
    } else {
      // More flexible matching for cyber security courses
      courseMatch = videoCourseLower.includes('cyber') || 
                   videoCourseLower.includes('security') || 
                   videoCourseLower.includes('ethical') || 
                   videoCourseLower.includes('hacking') ||
                   userCourseLower.includes('cyber') || // Check if user course matches video course
                   videoCourseLower.includes(userCourseLower); // Check if video course contains user course keywords
    }
    
    if (!courseMatch) {
      return res.status(403).json({ 
        message: 'You do not have access to this video based on your enrolled course',
        hasAccess: false
      });
    }
    
    if (user.status !== 'active' || user.role !== 'student') {
      return res.status(403).json({ 
        message: 'Your account is not active or you are not enrolled as a student',
        hasAccess: false
      });
    }
    
    // Log access attempt for analytics
    await db.collection('videoAccess').add({
      userId: user.id,
      userEmail: userEmail,
      videoId: id,
      videoTitle: video.title,
      accessGranted: true,
      timestamp: new Date().toISOString(),
      ipAddress: req.ip
    });
    
    res.json({
      hasAccess: true,
      video: {
        id: video.id,
        title: video.title,
        instructor: video.instructor,
        duration: video.duration,
        zoomUrl: video.zoomUrl,
        zoomPasscode: video.zoomPasscode,
        driveId: video.driveId,
        videoSource: video.videoSource
      }
    });
    
  } catch (err) {
    console.error('Error validating video access:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/dashboard/stats
// @desc    Get dashboard statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = {
      enrolledCourses: 4,
      completedCourses: 1,
      inProgressCourses: 3,
      totalLearningHours: 128,
      certificatesEarned: 1,
      upcomingClasses: 2
    };
    res.json(stats);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET /api/dashboard/activity
// @desc    Get recent activity
router.get('/activity', async (req, res) => {
  try {
    const activities = [
      {
        id: 1,
        type: 'course_completed',
        title: 'Completed Module: Indexing & Slicing',
        course: 'Data Science & AI',
        time: '2 hours ago',
        icon: '✅'
      },
      {
        id: 2,
        type: 'assignment_submitted',
        title: 'Submitted Assignment: Data Analysis Project',
        course: 'Data Science & AI',
        time: '5 hours ago',
        icon: '📝'
      },
      {
        id: 3,
        type: 'class_attended',
        title: 'Attended Live Class: Network Security Fundamentals',
        course: 'Cyber Security & Ethical Hacking',
        time: '1 day ago',
        icon: '🎓'
      },
      {
        id: 4,
        type: 'certificate_earned',
        title: 'Earned Certificate: Security Analysis Basics',
        course: 'Cyber Security & Ethical Hacking',
        time: '2 days ago',
        icon: '🏆'
      },
      {
        id: 5,
        type: 'course_enrolled',
        title: 'Started Advanced Machine Learning Module',
        course: 'Data Science & AI',
        time: '3 days ago',
        icon: '📚'
      }
    ];
    res.json(activities);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;
