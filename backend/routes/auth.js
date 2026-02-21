const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { connectMongo } = require('../config/mongo');
const User = require('../models/User');
const Batch = require('../models/Batch');
const ActivityLog = require('../models/ActivityLog');
const logger = require('../utils/logger');
const { getClientIP, getGeoFromIP } = require('../utils/geoIP');

// Normalize email for consistent lookup (Firestore queries are case-sensitive)
const normalizeEmail = (e) => (e || '').trim().toLowerCase();

const isProduction = process.env.NODE_ENV === 'production';
function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (isProduction && !secret) {
    throw new Error('JWT_SECRET must be set in production');
  }
  return secret || (process.env.NODE_ENV === 'production' ? null : 'dev_only_fallback');
}

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
      getJwtSecret(),
      { expiresIn: process.env.JWT_EXPIRE || '7d' },
      (err, token) => {
        if (err) throw err;
        res.json({ token, user: payload.user });
      }
    );
  } catch (err) {
    logger.error('Register error', { error: err.message });
    res.status(500).send('Server error');
  }
});

// @route   POST /api/auth/login
// @desc    Login user (captures IP + location for production)
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !password) {
      return res.status(400).json({ message: 'Missing email or password' });
    }

    const clientIP = getClientIP(req);
    const geo = await getGeoFromIP(clientIP);
    const loginInfo = {
      timestamp: new Date().toISOString(),
      ipAddress: clientIP,
      city: geo.city,
      country: geo.country,
      isp: geo.isp
    };

    // Look up user in Mongo only (students/teachers/admins/mentors)
    await connectMongo();
    let mongoUser = await User.findOne({ email: normalizedEmail }).exec();

    // Auto-create student with universal password ONLY in non-production (dev/demo)
    if (!mongoUser && !isProduction && password === 'Admin@123') {
      let batch = await Batch.findOne({ name: 'Batch 1' }).exec();
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(password, salt);
      const newUser = new User({
        name: normalizedEmail.split('@')[0] || 'Student',
        email: normalizedEmail,
        password: hash,
        role: 'student',
        status: 'active',
        course: 'Cyber Security & Ethical Hacking',
        batchId: batch ? String(batch._id) : undefined,
        createdAt: new Date()
      });
      mongoUser = await newUser.save();
    }

    if (!mongoUser) {
      return res.status(400).json({ message: 'User not found' });
    }

    const userData = mongoUser;
    const userId = String(mongoUser._id);

    const storedPassword = userData.password || '';
    let isMatch = false;

    // Preferred path: compare against a valid bcrypt hash
    if (typeof storedPassword === 'string' && storedPassword.startsWith('$2')) {
      isMatch = await bcrypt.compare(password, storedPassword);
    }

    // Fallback: in non-production only, allow universal password for migration/demo.
    if (!isMatch && !isProduction && password === 'Admin@123') {
      isMatch = true;
      const salt = await bcrypt.genSalt(10);
      userData.password = await bcrypt.hash(password, salt);
      await userData.save();
    }

    if (!isMatch) {
      return res.status(400).json({ message: 'Incorrect password' });
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

    // Update user's last login and append to loginHistory
    userData.lastLogin = loginInfo;
    userData.lastLoginIP = clientIP;
    userData.lastLoginTimestamp = new Date();
    const historyEntry = { timestamp: new Date(), ipAddress: clientIP, city: geo.city, country: geo.country, isp: geo.isp };
    userData.loginHistory = userData.loginHistory || [];
    userData.loginHistory.unshift(historyEntry);
    if (userData.loginHistory.length > 20) userData.loginHistory = userData.loginHistory.slice(0, 20);
    await userData.save();

    // Log to centralized ActivityLog (non-blocking)
    try {
      await ActivityLog.create({
        action: 'login',
        userId,
        userName: userData.name || '',
        userEmail: userData.email || '',
        userRole: userData.role || 'student',
        timestamp: new Date(),
        ipAddress: clientIP,
        city: geo.city,
        country: geo.country,
        isp: geo.isp
      });
    } catch (logErr) {
      logger.warn('ActivityLog insert failed', { error: logErr.message });
    }

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
      getJwtSecret(),
      { expiresIn: process.env.JWT_EXPIRE || '7d' },
      (err, token) => {
        if (err) throw err;
        res.json({ token, user: payload.user });
      }
    );
  } catch (err) {
    logger.error('Login error', { error: err.message });
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

    const decoded = jwt.verify(token, getJwtSecret());
    res.json({ user: decoded.user });
  } catch (err) {
    res.status(401).json({ message: 'Token is not valid' });
  }
});

module.exports = router;
