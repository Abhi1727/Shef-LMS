const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../config/firebase');

// Demo Credentials
// Student: lqdeleon@gmail.com / Admin@123
// Admin: admin@sheflms.com / SuperAdmin@123

// @route   POST /api/auth/register
// @desc    Register user
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Check if user exists
    const usersSnapshot = await db.collection('users').where('email', '==', email).get();
    if (!usersSnapshot.empty) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const userData = {
      name,
      email,
      password: hashedPassword,
      role: role || 'student',
      status: 'active',
      createdAt: new Date().toISOString()
    };

    const docRef = await db.collection('users').add(userData);

    const payload = {
      user: {
        id: docRef.id,
        name,
        email,
        role: role || 'student'
      }
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET || 'shef_lms_secret_key_2025',
      { expiresIn: '7d' },
      (err, token) => {
        if (err) throw err;
        res.json({ token, user: payload.user });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   POST /api/auth/login
// @desc    Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check for demo student credentials
    if (email === 'lqdeleon@gmail.com' && password === 'Admin@123') {
      const demoUser = {
        id: 'leonardo_deleon_user_id',
        name: 'Leonardo De Leon',
        email: 'lqdeleon@gmail.com',
        role: 'student',
        enrollmentDate: '2025-11-07',
        enrollmentNumber: 'SU-2025-001',
        currentCourse: 'Cyber Security & Ethical Hacking',
        courseDuration: '6 months'
      };

      const payload = { user: demoUser };
      const token = jwt.sign(
        payload,
        process.env.JWT_SECRET || 'shef_lms_secret_key_2025',
        { expiresIn: '7d' }
      );

      return res.json({ token, user: demoUser });
    }

    // Check for demo admin credentials
    if (email === 'admin@sheflms.com' && password === 'SuperAdmin@123') {
      const adminUser = {
        id: 'super_admin_user_id',
        name: 'Super Admin',
        email: 'admin@sheflms.com',
        role: 'admin'
      };

      const payload = { user: adminUser };
      const token = jwt.sign(
        payload,
        process.env.JWT_SECRET || 'shef_lms_secret_key_2025',
        { expiresIn: '7d' }
      );

      return res.json({ token, user: adminUser });
    }

    // Check Firebase for user
    const usersSnapshot = await db.collection('users').where('email', '==', email).get();
    
    if (usersSnapshot.empty) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    let userData;
    let userId;
    usersSnapshot.forEach(doc => {
      userId = doc.id;
      userData = doc.data();
    });

    const isMatch = await bcrypt.compare(password, userData.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const payload = {
      user: {
        id: userId,
        name: userData.name,
        email: userData.email,
        role: userData.role
      }
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET || 'shef_lms_secret_key_2025',
      { expiresIn: '7d' },
      (err, token) => {
        if (err) throw err;
        res.json({ token, user: payload.user });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET /api/auth/me
// @desc    Get current user
router.get('/me', async (req, res) => {
  try {
    const token = req.header('x-auth-token');
    if (!token) {
      return res.status(401).json({ message: 'No token' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'shef_lms_secret_key_2025');
    res.json({ user: decoded.user });
  } catch (err) {
    res.status(401).json({ message: 'Token is not valid' });
  }
});

module.exports = router;
