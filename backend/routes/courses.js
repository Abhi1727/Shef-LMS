const express = require('express');
const router = express.Router();
const Course = require('../models/Course');
const auth = require('../middleware/auth');

// @route   GET /api/courses
// @desc    Get all courses
router.get('/', async (req, res) => {
  try {
    // Return demo courses if DB is empty
    const courses = await Course.find().sort({ createdAt: -1 });
    
    if (courses.length === 0) {
      const demoCourses = [
        {
          _id: '1',
          title: 'Full Stack Data Science & AI Program',
          description: 'Master data science and AI with hands-on projects',
          instructor: 'Dr. Smith Johnson',
          duration: '6 months',
          modules: 6,
          progress: 45,
          enrolled: 1234,
          thumbnail: '📊'
        },
        {
          _id: '2',
          title: 'Web Development Bootcamp',
          description: 'Learn modern web development from scratch',
          instructor: 'Sarah Williams',
          duration: '4 months',
          modules: 8,
          progress: 60,
          enrolled: 856,
          thumbnail: '💻'
        },
        {
          _id: '3',
          title: 'Machine Learning Masterclass',
          description: 'Deep dive into ML algorithms and applications',
          instructor: 'Prof. Alex Chen',
          duration: '5 months',
          modules: 10,
          progress: 30,
          enrolled: 645,
          thumbnail: '🤖'
        },
        {
          _id: '4',
          title: 'Python Programming',
          description: 'Complete Python course for beginners to advanced',
          instructor: 'John Doe',
          duration: '3 months',
          modules: 12,
          progress: 75,
          enrolled: 1567,
          thumbnail: '🐍'
        }
      ];
      return res.json(demoCourses);
    }

    res.json(courses);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET /api/courses/:id
// @desc    Get course by ID
router.get('/:id', async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }
    res.json(course);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   POST /api/courses
// @desc    Create a course
router.post('/', auth, async (req, res) => {
  try {
    const newCourse = new Course(req.body);
    const course = await newCourse.save();
    res.json(course);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;
