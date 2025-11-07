const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

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
        course: 'Full Stack Data Science & AI Program',
        time: '2 hours ago',
        icon: '✅'
      },
      {
        id: 2,
        type: 'assignment_submitted',
        title: 'Submitted Assignment: Data Analysis Project',
        course: 'Full Stack Data Science & AI Program',
        time: '5 hours ago',
        icon: '📝'
      },
      {
        id: 3,
        type: 'class_attended',
        title: 'Attended Live Class: Advanced Python',
        course: 'Python Programming',
        time: '1 day ago',
        icon: '🎓'
      },
      {
        id: 4,
        type: 'certificate_earned',
        title: 'Earned Certificate: Web Development Fundamentals',
        course: 'Web Development Bootcamp',
        time: '2 days ago',
        icon: '🏆'
      },
      {
        id: 5,
        type: 'course_enrolled',
        title: 'Enrolled in Machine Learning Masterclass',
        course: 'Machine Learning Masterclass',
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
