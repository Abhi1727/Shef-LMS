const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Classroom = require('../models/Classroom');
const Batch = require('../models/Batch');

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

    // Refresh course and batch from Mongo so that newly assigned batches
    // take effect without requiring re-login.
    try {
      if (tokenUser.id && tokenUser.role === 'student') {
        const mongoUser = await User.findOne({
          $or: [
            { _id: tokenUser.id },
            { firestoreId: tokenUser.id },
            { email: userEmail }
          ]
        }).exec();

        if (mongoUser) {
          if (mongoUser.course) {
            userCourse = mongoUser.course;
          }
          if (typeof mongoUser.batchId !== 'undefined') {
            userBatchId = mongoUser.batchId || '';
          }
        }
      }
    } catch (lookupError) {
      console.error('Dashboard classroom: failed to refresh user from Mongo, using token values instead:', lookupError);
    }
    
    // Normalize batch ID: treat null/undefined/"null"/"undefined"/empty as no batch
    const normalizeId = (val) => {
      if (!val) return '';
      const str = String(val).trim();
      if (!str || str === 'null' || str === 'undefined') return '';
      return str;
    };

    userBatchId = normalizeId(userBatchId);

    console.log('🔍 Dashboard Debug - User info:', {
      email: userEmail,
      course: userCourse,
      batchId: userBatchId,
      role: tokenUser.role
    });
    
    // Get all classroom videos from Mongo
    const classroomDocs = await Classroom.find({}).lean().exec();
    const allVideos = classroomDocs.map(doc => ({ id: String(doc._id), ...doc }));
    
    console.log('🔍 Dashboard Debug - Total videos found:', allVideos.length);

    // Load batches and build a set of valid batch IDs
    const batchDocs = await Batch.find({}).lean().exec();
    const validBatchIds = new Set(batchDocs.map(b => String(b._id)));

    // If the student's batchId does not correspond to a real batch, treat as no batch
    if (userBatchId && !validBatchIds.has(userBatchId)) {
      console.log('🔍 Dashboard Debug - User batchId is not a valid batch, treating as unassigned:', userBatchId);
      userBatchId = '';
    }

    // Filter videos based on user's role, course, and batch (Mongo-only, no Firestore)
    let filteredVideos = allVideos.filter(video => {
      const videoCourse = video.courseId || video.course || '';

      // Admin can see everything
      if (tokenUser.role === 'admin') {
        return true;
      }

      // Teachers see videos for their course
      if (tokenUser.role === 'teacher') {
        return !!videoCourse && !!userCourse && videoCourse === userCourse;
      }

      // Students must have a *valid* batch assigned and match both course and batch.
      // If a student has no valid batch, they should see no classroom videos.
      if (tokenUser.role === 'student') {
        if (!userBatchId) {
          return false;
        }

        const courseMatch = !!videoCourse && !!userCourse && videoCourse === userCourse;
        if (!courseMatch) return false;

        // Only show videos explicitly tied to a valid batch.
        if (!video.batchId) {
          return false;
        }
        const videoBatchId = normalizeId(video.batchId);
        if (!videoBatchId || !validBatchIds.has(videoBatchId)) {
          return false;
        }

        return videoBatchId === userBatchId;
      }

      return false;
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
