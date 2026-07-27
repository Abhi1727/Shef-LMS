const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { connectMongo } = require('../config/mongo');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const PasswordOtp = require('../models/PasswordOtp');
const logger = require('../utils/logger');
const { getClientIP, getGeoFromIP } = require('../utils/geoIP');
const { sendTransactionalEmail } = require('../services/emailService');
const auth = require('../middleware/auth');

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
    const { name, email, password } = req.body;

    if (!password || !password.trim()) {
      return res.status(400).json({ message: 'Password is required' });
    }

    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      return res.status(400).json({ message: 'Email is required' });
    }

    // Public registration always creates students. Privileged roles must be created by admins.
    if (req.body.role && req.body.role !== 'student') {
      return res.status(403).json({
        message: 'Cannot self-register with a privileged role. Contact an administrator.'
      });
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
      role: 'student',
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
    const mongoUser = await User.findOne({ email: normalizedEmail }).exec();

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

    // Mentors use the teacher product surface; keep JWT role aligned with API guards
    const jwtRole = userData.role === 'mentor' ? 'teacher' : userData.role;

    const payload = {
      user: {
        id: userId,
        name: userData.name,
        email: userData.email,
        role: jwtRole,
        status: userData.status || 'active',
        currentCourse: userData.course,
        enrollmentNumber: userData.enrollmentNumber,
        batchId: userData.batchId,
        domain: userData.domain,
        title: userData.title,
        company: userData.company,
        phone: userData.phone || '',
        address: userData.address || '',
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
    const token = req.header('x-auth-token') || (req.header('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!token) {
      return res.status(401).json({ message: 'No token' });
    }

    const decoded = jwt.verify(token, getJwtSecret());
    res.json({ user: decoded.user });
  } catch (err) {
    res.status(401).json({ message: 'Token is not valid' });
  }
});

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function issuePasswordOtp(email, purpose) {
  const normalizedEmail = normalizeEmail(email);
  const user = await User.findOne({ email: normalizedEmail }).exec();
  if (!user) {
    // Do not reveal whether the email exists
    return { issued: false, normalizedEmail };
  }

  const otp = generateOtpCode();
  const otpHash = await bcrypt.hash(otp, 10);
  await PasswordOtp.deleteMany({ email: normalizedEmail, purpose });
  await PasswordOtp.create({
    email: normalizedEmail,
    otpHash,
    purpose,
    attempts: 0,
    expiresAt: new Date(Date.now() + OTP_TTL_MS)
  });

  await sendTransactionalEmail({
    to: normalizedEmail,
    subject: 'Sky States LMS — password verification code',
    text: `Your Sky States LMS verification code is ${otp}. It expires in 10 minutes. If you did not request this, ignore this email.`,
    html: `
      <div style="font-family: Arial, sans-serif; font-size: 14px; color: #1a1a1a; line-height: 1.5;">
        <p>Your Sky States LMS verification code is:</p>
        <p style="font-size: 28px; letter-spacing: 6px; font-weight: 700; margin: 16px 0;">${otp}</p>
        <p>This code expires in <strong>10 minutes</strong>.</p>
        <p style="color:#666;">If you did not request a password change, you can ignore this email.</p>
      </div>
    `
  });

  return { issued: true, normalizedEmail, user };
}

async function consumePasswordOtp(email, otp, purpose) {
  const normalizedEmail = normalizeEmail(email);
  const record = await PasswordOtp.findOne({ email: normalizedEmail, purpose })
    .sort({ createdAt: -1 })
    .exec();

  if (!record) {
    return { ok: false, message: 'No verification code found. Request a new code.' };
  }
  if (record.expiresAt.getTime() < Date.now()) {
    await PasswordOtp.deleteMany({ email: normalizedEmail, purpose });
    return { ok: false, message: 'Verification code expired. Request a new code.' };
  }
  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    await PasswordOtp.deleteMany({ email: normalizedEmail, purpose });
    return { ok: false, message: 'Too many invalid attempts. Request a new code.' };
  }

  const match = await bcrypt.compare(String(otp || '').trim(), record.otpHash);
  if (!match) {
    record.attempts += 1;
    await record.save();
    return { ok: false, message: 'Invalid verification code.' };
  }

  await PasswordOtp.deleteMany({ email: normalizedEmail, purpose });
  return { ok: true, normalizedEmail };
}

function validateNewPassword(password) {
  if (!password || String(password).length < 8) {
    return 'Password must be at least 8 characters long';
  }
  if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
    return 'Password must include uppercase, lowercase, and a number';
  }
  return null;
}

// @route   POST /api/auth/forgot-password
// @desc    Send OTP to email for password reset (all roles)
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email || !String(email).trim()) {
      return res.status(400).json({ message: 'Email is required' });
    }

    try {
      await issuePasswordOtp(email, 'reset');
    } catch (mailErr) {
      logger.error('Forgot-password email failed', { error: mailErr.message });
      return res.status(500).json({ message: 'Could not send verification email. Please try again later.' });
    }

    // Always return the same message (anti-enumeration)
    res.json({
      message: 'If an account exists for that email, a verification code has been sent.'
    });
  } catch (err) {
    logger.error('Forgot-password error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/auth/reset-password
// @desc    Reset password with email OTP (logged-out flow)
router.post('/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body || {};
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: 'Email, verification code, and new password are required' });
    }

    const pwdError = validateNewPassword(newPassword);
    if (pwdError) {
      return res.status(400).json({ message: pwdError });
    }

    const consumed = await consumePasswordOtp(email, otp, 'reset');
    if (!consumed.ok) {
      return res.status(400).json({ message: consumed.message });
    }

    const user = await User.findOne({ email: consumed.normalizedEmail }).exec();
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.updatedAt = new Date();
    await user.save();

    try {
      await ActivityLog.create({
        action: 'password_reset',
        userId: String(user._id),
        userName: user.name || '',
        userEmail: user.email || '',
        userRole: user.role || 'student',
        timestamp: new Date()
      });
    } catch (_) { /* non-blocking */ }

    res.json({ message: 'Password updated successfully. You can sign in now.' });
  } catch (err) {
    logger.error('Reset-password error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/auth/password/request-otp
// @desc    Logged-in user requests OTP to change password (all roles)
router.post('/password/request-otp', auth, async (req, res) => {
  try {
    const email = req.user?.email;
    if (!email) {
      return res.status(400).json({ message: 'Account email not found on token' });
    }

    try {
      const result = await issuePasswordOtp(email, 'change');
      if (!result.issued) {
        return res.status(404).json({ message: 'User not found' });
      }
    } catch (mailErr) {
      logger.error('Change-password OTP email failed', { error: mailErr.message });
      return res.status(500).json({ message: 'Could not send verification email. Please try again later.' });
    }

    res.json({ message: 'Verification code sent to your email.' });
  } catch (err) {
    logger.error('Password request-otp error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/auth/password
// @desc    Change password while logged in (OTP required; all roles)
router.put('/password', auth, async (req, res) => {
  try {
    const { otp, newPassword, currentPassword } = req.body || {};
    const email = req.user?.email;

    if (!email) {
      return res.status(400).json({ message: 'Account email not found on token' });
    }
    if (!otp || !newPassword) {
      return res.status(400).json({ message: 'Verification code and new password are required' });
    }

    const pwdError = validateNewPassword(newPassword);
    if (pwdError) {
      return res.status(400).json({ message: pwdError });
    }

    const user = await User.findById(req.user.id).exec();
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Optional current-password check when provided (extra safety)
    if (currentPassword) {
      const stored = user.password || '';
      if (!stored.startsWith('$2') || !(await bcrypt.compare(currentPassword, stored))) {
        return res.status(400).json({ message: 'Current password is incorrect' });
      }
    }

    const consumed = await consumePasswordOtp(email, otp, 'change');
    if (!consumed.ok) {
      return res.status(400).json({ message: consumed.message });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.updatedAt = new Date();
    await user.save();

    try {
      await ActivityLog.create({
        action: 'password_change',
        userId: String(user._id),
        userName: user.name || '',
        userEmail: user.email || '',
        userRole: user.role || 'student',
        timestamp: new Date()
      });
    } catch (_) { /* non-blocking */ }

    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    logger.error('Change-password error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
