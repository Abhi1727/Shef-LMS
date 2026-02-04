const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { db } = require('../config/firebase');

// Apply auth middleware to all dashboard routes
router.use(auth);

// @route   GET /api/dashboard/classroom
// @desc    Get classroom videos for the student with course and batch filtering
router.get('/classroom', async (req, res) => {
  try {
    const user = req.user;
    const userCourse = user.currentCourse || user.course || '';
    const userBatchId = user.batchId || '';
    const userEmail = user.email || '';
    
    console.log('🔍 Dashboard Debug - User info:', {
      email: userEmail,
      course: userCourse,
      batchId: userBatchId,
      role: user.role
    });
    
    // Get all classroom videos
    const snapshot = await db.collection('classroom').get();
    const allVideos = [];
    snapshot.forEach(doc => {
      allVideos.push({ id: doc.id, ...doc.data() });
    });
    
    console.log('🔍 Dashboard Debug - Total videos found:', allVideos.length);
    
    // Get all batches to map batch names to IDs
    const batchesSnapshot = await db.collection('batches').get();
    const batchMap = {};
    batchesSnapshot.forEach(doc => {
      const data = doc.data();
      batchMap[data.name] = doc.id; // Map batch name to ID
      batchMap[doc.id] = data.name; // Map batch ID to name (for reverse lookup)
    });
    
    console.log('🔍 Dashboard Debug - Batch map:', batchMap);
    
    // Filter videos based on user's course and batch
    const filteredVideos = allVideos.filter(video => {
      // Check if video matches user's course (support both 'course' and 'courseId' fields)
      const videoCourse = video.courseId || video.course; // Use courseId if available, fallback to course
      const courseMatch = videoCourse === userCourse;
      
      // Check batch filtering
      let batchMatch = true;
      if (video.batchId && video.batchId !== '') {
        // Video is assigned to specific batch - check if user is in that batch
        // Handle both batch ID and batch name scenarios
        const userBatchActualId = batchMap[userBatchId] || userBatchId; // Convert batch name to ID if needed
        batchMatch = video.batchId === userBatchActualId;
      }
      // If video.batchId is empty or undefined, video is available to all batches in the course
      
      console.log('🔍 Dashboard Debug - Video filtering:', {
        videoTitle: video.title,
        videoCourse: videoCourse,
        videoBatchId: video.batchId,
        userCourse,
        userBatchId,
        userBatchActualId: batchMap[userBatchId] || userBatchId,
        courseMatch,
        batchMatch
      });
      
      return courseMatch && batchMatch;
    });
    
    console.log('🔍 Dashboard Debug - Filtered videos count:', filteredVideos.length);
    
    // Sort videos by creation date (newest first)
    const sortedVideos = filteredVideos.sort((a, b) => {
      // Use createdAt primarily, fallback to date, then to document ID
      const dateA = new Date(a.createdAt || a.date || 0);
      const dateB = new Date(b.createdAt || b.date || 0);
      
      console.log('🔍 Dashboard Debug - Sorting:', {
        videoA: a.title,
        dateA: dateA,
        videoB: b.title,
        dateB: dateB,
        comparison: dateB - dateA
      });
      
      return dateB - dateA; // Newest first (descending order)
    });
    
    console.log('🔍 Dashboard Debug - Sorted videos (first 3):', sortedVideos.slice(0, 3).map(v => ({
      title: v.title,
      createdAt: v.createdAt,
      date: v.date
    })));
    
    res.json(sortedVideos);
  } catch (error) {
    console.error('Error fetching classroom videos:', error);
    res.status(500).json({ message: 'Error fetching classroom videos' });
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
