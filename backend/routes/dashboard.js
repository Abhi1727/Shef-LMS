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
    const tokenUser = req.user;
    let userCourse = tokenUser.currentCourse || tokenUser.course || '';
    let userBatchId = tokenUser.batchId || '';
    const userEmail = tokenUser.email || '';

    // Always try to refresh course and batch from Firestore for students
    // so that newly assigned batches take effect immediately without
    // requiring the student to log out and log back in.
    try {
      if (tokenUser.id && tokenUser.role === 'student') {
        const userDoc = await db.collection('users').doc(tokenUser.id).get();
        if (userDoc.exists) {
          const freshData = userDoc.data();
          if (freshData.course) {
            userCourse = freshData.course;
          }
          if (typeof freshData.batchId !== 'undefined') {
            userBatchId = freshData.batchId || '';
          }
        }
      }
    } catch (lookupError) {
      console.error('Dashboard classroom: failed to refresh user from Firestore, using token values instead:', lookupError);
    }
    
    console.log('🔍 Dashboard Debug - User info:', {
      email: userEmail,
      course: userCourse,
      batchId: userBatchId,
      role: tokenUser.role
    });
    
    // Get all classroom videos
    const snapshot = await db.collection('classroom').get();
    const allVideos = [];
    snapshot.forEach(doc => {
      allVideos.push({ id: doc.id, ...doc.data() });
    });
    
    console.log('🔍 Dashboard Debug - Total videos found:', allVideos.length);
    
    // Get all batches to map batch names to IDs (one-way)
    const batchesSnapshot = await db.collection('batches').get();
    const batchNameToId = {};
    batchesSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.name) {
        batchNameToId[data.name] = doc.id; // Map batch name to ID
      }
    });
    
    console.log('🔍 Dashboard Debug - Batch name → ID map:', batchNameToId);
    const filteredVideos = [];
    for (const video of allVideos) {
      // Admin can access all videos
      if (tokenUser.role === 'admin') {
        filteredVideos.push(video);
        continue;
      }
      
      // Teacher can access videos for their courses
      if (tokenUser.role === 'teacher') {
        const videoCourse = video.courseId || video.course;
        if (videoCourse === userCourse) {
          filteredVideos.push(video);
        }
        continue;
      }
      
      // Student access logic - require both course AND batch to match
      if (tokenUser.role === 'student') {
        // Check if video matches user's course (support both 'course' and 'courseId' fields)
        const videoCourse = video.courseId || video.course;
        const courseMatch = videoCourse === userCourse;

        // Get student's batch information to check batch name
        let studentBatchName = null;
        if (userBatchId) {
          try {
            const batchDoc = await db.collection('batches').doc(userBatchId).get();
            if (batchDoc.exists) {
              const batchData = batchDoc.data();
              studentBatchName = batchData.name;
            }
          } catch (error) {
            console.error('Error fetching student batch info:', error);
          }
        }

        // Check batch match - require both batchId AND batch name to match
        let batchMatch = false;
        if (video.batchId && userBatchId) {
          batchMatch = video.batchId === userBatchId;
          
          // Additional check: verify batch names match if we have batch data
          if (batchMatch && studentBatchName && video.batchName) {
            batchMatch = video.batchName === studentBatchName;
          }
        }

        // Student must be enrolled in course AND have matching batch
        // Domain match alone is not sufficient for access
        if (courseMatch && batchMatch) {
          filteredVideos.push(video);
        }
      }
    }

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
