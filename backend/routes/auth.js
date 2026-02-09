const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { connectMongo } = require('../config/mongo');
const User = require('../models/User');

// Demo Credentials
// Student: lqdeleon@gmail.com / Admin@123
// Student: abhi@gmail.com / Admin@123
// Teacher: teacher@sheflms.com / Admin@123
// Admin: admin@sheflms.com / SuperAdmin@123

// Normalize email for consistent lookup (Firestore queries are case-sensitive)
const normalizeEmail = (e) => (e || '').trim().toLowerCase();

// @route   POST /api/auth/register
// @desc    Register user
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!password || !password.trim()) {
      return res.status(400).json({ message: 'Password is required' });
    }

    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      return res.status(400).json({ message: 'Email is required' });
    }

    await connectMongo();

    // Check if user exists in Mongo (use normalized email)
    const existingUser = await User.findOne({ email: normalizedEmail }).exec();
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = new User({
      name,
      email: normalizedEmail,
      password: hashedPassword,
      role: role || 'student',
      status: 'active',
      createdAt: new Date()
    });

    const savedUser = await user.save();

    const payload = {
      user: {
        id: String(savedUser._id),
        name: savedUser.name,
        email: savedUser.email,
        role: savedUser.role
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
    const { email, password, ipAddress, ipDetails } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !password) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Get IP from request headers as fallback
    const clientIP = ipAddress || 
                     req.headers['x-forwarded-for'] || 
                     req.headers['x-real-ip'] || 
                     req.connection.remoteAddress || 
                     req.socket.remoteAddress ||
                     'Unknown';

    // Store login timestamp and IP
    const loginInfo = {
      timestamp: new Date().toISOString(),
      ipAddress: clientIP,
      city: ipDetails?.city || 'Unknown',
      country: ipDetails?.country || 'Unknown',
      isp: ipDetails?.isp || 'Unknown'
    };

    // Check for demo student credentials - Data Science & AI Course
    if (normalizedEmail === 'abhi@gmail.com' && password === 'Admin@123') {
      const demoUser = {
        id: 'abhi_datascience_user_id',
        name: 'Abhi',
        email: 'abhi@gmail.com',
        role: 'student',
        status: 'active',
        enrollmentDate: '2025-12-01',
        enrollmentNumber: 'SU-2025-002',
        currentCourse: 'Data Science & AI',
        courseDuration: '6 months',
        lastLogin: loginInfo
      };

      const payload = { user: demoUser };
      const token = jwt.sign(
        payload,
        process.env.JWT_SECRET || 'shef_lms_secret_key_2025',
        { expiresIn: '7d' }
      );

      return res.json({ token, user: demoUser });
    }

    // Check for demo teacher credentials
    if (normalizedEmail === 'teacher@sheflms.com' && password === 'Admin@123') {
      // Prefer a real Mongo user record if it exists
      await connectMongo();
      let teacherUserDoc = await User.findOne({ email: normalizedEmail }).exec();

      let teacherUser;
      if (teacherUserDoc) {
        teacherUser = {
          id: String(teacherUserDoc._id),
          name: teacherUserDoc.name,
          email: teacherUserDoc.email,
          role: teacherUserDoc.role || 'teacher',
          domain: teacherUserDoc.domain,
          experience: teacherUserDoc.experience,
          assignedCourses: teacherUserDoc.assignedCourses || [],
          department: teacherUserDoc.department,
          phone: teacherUserDoc.phone,
          address: teacherUserDoc.address,
          status: teacherUserDoc.status || 'active',
          lastLogin: loginInfo
        };
      } else {
        // Fallback to hardcoded data if not found in Mongo
        teacherUser = {
          id: 'teacher_cybersecurity_id',
          name: 'Dr. Sarah Mitchell',
          email: 'teacher@sheflms.com',
          role: 'teacher',
          age: 35,
          domain: 'Cyber Security & Ethical Hacking',
          experience: '8 years in cybersecurity education',
          assignedCourses: ['Cyber Security & Ethical Hacking'],
          department: 'Cyber Security',
          phone: '+1-555-0123',
          address: '789 University Ave, Boston, MA',
          status: 'active',
          lastLogin: loginInfo
        };
      }

      const payload = { user: teacherUser };
      const token = jwt.sign(
        payload,
        process.env.JWT_SECRET || 'shef_lms_secret_key_2025',
        { expiresIn: '7d' }
      );

      return res.json({ token, user: teacherUser });
    }

    // Check for demo admin credentials (only if password matches exactly)
    if (normalizedEmail === 'admin@sheflms.com' && password === 'SuperAdmin@123') {
      const adminUser = {
        id: 'super_admin_user_id',
        name: 'Super Admin',
        email: 'admin@sheflms.com',
        role: 'admin',
        lastLogin: loginInfo
      };

      const payload = { user: adminUser };
      const token = jwt.sign(
        payload,
        process.env.JWT_SECRET || 'shef_lms_secret_key_2025',
        { expiresIn: '7d' }
      );

      return res.json({ token, user: adminUser });
    }

    // Look up user in Mongo only (students/teachers/admins/mentors)
    await connectMongo();
    const mongoUser = await User.findOne({ email: normalizedEmail }).exec();

    if (!mongoUser) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const userData = mongoUser;
    const userId = String(mongoUser._id);

    // Guard: user must have a bcrypt-hashed password (register & admin both hash)
    const storedPassword = userData.password;
    if (!storedPassword || typeof storedPassword !== 'string' || !storedPassword.startsWith('$2')) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, storedPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check if user account is active - ONLY for students
    // Admins and teachers can login even if account is inactive
    if (userData.role === 'student' && userData.status !== 'active') {
      return res.status(403).json({ message: 'Account is deactivated. Please contact administrator.' });
    }

    // Commented out: This was blocking admins and teachers from logging in
    // if (userData.status !== 'active') {
    //   return res.status(403).json({ message: 'Account is deactivated. Please contact administrator.' });
    // }

    // Update user's last login info in Mongo
    userData.lastLogin = loginInfo;
    userData.lastLoginIP = clientIP;
    userData.lastLoginTimestamp = new Date();
    await userData.save();

    const payload = {
      user: {
        id: userId,
        name: userData.name,
        email: userData.email,
        role: userData.role,
        status: userData.status || 'active', // Add status field with default
        currentCourse: userData.course,
        enrollmentNumber: userData.enrollmentNumber,
        batchId: userData.batchId,
        domain: userData.domain,
        title: userData.title,
        company: userData.company,
        phone: userData.phone || '', // Add phone number
        address: userData.address || '', // Add address
        lastLogin: loginInfo
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
