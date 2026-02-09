const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Course = require('../models/Course');

// @route   GET /api/courses
// @desc    Get all courses
router.get('/', async (req, res) => {
  try {
    const courses = await Course.find({}).lean().exec();
    if (!courses || courses.length === 0) {
      const demoCourses = [
        {
          _id: '1',
          title: 'Data Science & AI',
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
          title: 'Cyber Security & Ethical Hacking',
          description: 'Master cybersecurity fundamentals, ethical hacking techniques, and security analysis',
          instructor: 'Sarah Williams',
          duration: '6 months',
          modules: 10,
          progress: 60,
          enrolled: 856,
          thumbnail: '🛡️'
        }
      ];
      return res.json(demoCourses);
    }

    const normalized = courses.map(c => ({ id: String(c._id), ...c }));
    res.json(normalized);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET /api/courses/:id
// @desc    Get course by ID
router.get('/:id', async (req, res) => {
  try {
    const course = await Course.findById(req.params.id).lean().exec();
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }
    res.json({ id: String(course._id), ...course });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   POST /api/courses
// @desc    Create a course
router.post('/', auth, async (req, res) => {
  try {
    const courseData = {
      ...req.body,
      createdAt: new Date()
    };
    const course = new Course(courseData);
    const saved = await course.save();
    res.json({ id: String(saved._id), ...saved.toObject() });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;
