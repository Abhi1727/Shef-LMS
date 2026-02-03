const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const auth = require('../middleware/auth');

// @route   GET /api/courses
// @desc    Get all courses
router.get('/', async (req, res) => {
  try {
    // Try to get courses from Firestore
    const coursesSnapshot = await db.collection('courses').get();
    
    if (coursesSnapshot.empty) {
      // Return demo courses if DB is empty
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
          thumbnail: '�'
        }
      ];
      return res.json(demoCourses);
    }

    // Convert Firestore docs to array
    const courses = [];
    coursesSnapshot.forEach(doc => {
      courses.push({ id: doc.id, ...doc.data() });
    });

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
    const courseDoc = await db.collection('courses').doc(req.params.id).get();
    if (!courseDoc.exists) {
      return res.status(404).json({ message: 'Course not found' });
    }
    res.json({ id: courseDoc.id, ...courseDoc.data() });
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
      createdAt: new Date().toISOString()
    };
    const courseRef = await db.collection('courses').add(courseData);
    res.json({ id: courseRef.id, ...courseData });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;
