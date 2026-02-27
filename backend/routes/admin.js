const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { roleAuth } = require('../middleware/roleAuth');
const multer = require('multer');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const User = require('../models/User');
const Batch = require('../models/Batch');
const ActivityLog = require('../models/ActivityLog');
const Course = require('../models/Course');
const Module = require('../models/Module');
const Classroom = require('../models/Classroom');
const OneToOne = require('../models/OneToOne');
const { sendEmail } = require('../services/emailService');

// Apply auth and admin role check to all admin routes
router.use(auth);
router.use(roleAuth('admin'));

// Helper: resolve course name for dashboard filtering (User.course is course name)
async function resolveCourseNameForVideo(courseIdOrName) {
  if (!courseIdOrName || typeof courseIdOrName !== 'string') return courseIdOrName;
  const trimmed = courseIdOrName.trim();
  if (!trimmed) return null;
  const isObjectId = /^[a-fA-F0-9]{24}$/.test(trimmed);
  if (isObjectId) {
    const doc = await Course.findById(trimmed).select('title').lean().exec();
    return doc ? doc.title : trimmed;
  }
  return trimmed;
}

// Configure multer for memory storage (for large video files)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024 * 1024, // 2GB limit for large lecture videos
  },
  fileFilter: (req, file, cb) => {
    // Accept video files only
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'), false);
    }
  }
});

// Configure multer for module file uploads (PDF, Word documents)
const moduleUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit for PDF/Word files
  },
  fileFilter: (req, file, cb) => {
    // Accept PDF and Word files
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and Word documents are allowed'), false);
    }
  }
});

// Configure multer for lecture notes uploads (PDF/Word/etc.) stored on disk
const notesUploadStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const notesDir = path.join(__dirname, '..', 'uploads', 'notes');
    if (!fs.existsSync(notesDir)) {
      fs.mkdirSync(notesDir, { recursive: true });
    }
    cb(null, notesDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const safeOriginal = file.originalname.replace(/[^a-zA-Z0-9.\-_/ ]/g, '');
    cb(null, `${timestamp}-${safeOriginal}`);
  }
});

const notesUpload = multer({
  storage: notesUploadStorage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit for notes
  },
  fileFilter: (req, file, cb) => {
    // Allow common document types (PDF, Word, text)
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only document files (PDF, Word, text) are allowed for notes'), false);
    }
  }
});

// Generic dynamic models for collections that previously lived only in Firestore
const genericSchema = new mongoose.Schema({}, { strict: false, timestamps: true });
const dynamicModels = {};
function getDynamicModel(collectionName) {
  if (!dynamicModels[collectionName]) {
    dynamicModels[collectionName] = mongoose.model(
      `Dyn_${collectionName}`,
      genericSchema,
      collectionName
    );
  }
  return dynamicModels[collectionName];
}

// @route   GET /api/admin/users/search
// @desc    Search users by email
router.get('/users/search', async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({ message: 'Email parameter is required' });
    }

    const normalized = normalizeEmail(email);

    const reEscaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const users = await User.find({
      role: 'student',
      email: { $regex: reEscaped, $options: 'i' }
    })
      .limit(10)
      .select('-password')
      .lean()
      .exec();

    const mapped = users.map(u => ({ id: String(u._id), ...u }));
    res.json(mapped);
  } catch (err) {
    console.error('Error searching users:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Normalize batchId for consistent API responses (handles ObjectId/string)
const normalizeBatchId = (v) => (v != null && v !== '' ? String(v) : null);

// @route   GET /api/admin/users
// @desc    Get all users (students)
router.get('/users', async (req, res) => {
  try {
    const users = await User.find({ role: 'student' }).select('-password').lean().exec();
    const mapped = users.map(u => ({ id: String(u._id), ...u, batchId: normalizeBatchId(u.batchId) }));
    res.json(mapped);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Normalize email for consistent login lookup (Firestore queries are case-sensitive)
const normalizeEmail = (e) => (e || '').trim().toLowerCase();

// @route   POST /api/admin/users
// @desc    Create a new user
router.post('/users', async (req, res) => {
  try {
    const { name, email, password, enrollmentNumber, course, batchId, status, role, phone, address } = req.body;

    // Password is required for new users (needed for login)
    if (!password || !String(password).trim()) {
      return res.status(400).json({ message: 'Password is required for new users' });
    }

    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      return res.status(400).json({ message: 'Email is required' });
    }

    // Hash password (always use plain text from admin form; never store pre-hashed)
    let finalPassword = password;
    if (!password.startsWith('$2')) {
      const bcrypt = require('bcryptjs');
      const salt = await bcrypt.genSalt(10);
      finalPassword = await bcrypt.hash(password, salt);
    }

    const userData = {
      name,
      email: normalizedEmail,
      password: finalPassword,
      enrollmentNumber,
      course,
      batchId: batchId || null,
      status: status || 'active',
      role: role || 'student'
    };

    if (phone) userData.phone = phone;
    if (address) userData.address = address;

    const user = new User(userData);
    const saved = await user.save();

    res.json({ id: String(saved._id), message: 'User created successfully' });
  } catch (err) {
    console.error('Error creating user:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/admin/users/:id
// @desc    Update a user
router.put('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = {
      ...req.body,
      updatedAt: new Date()
    };
    delete updateData.password; // Never update password via this endpoint; use dedicated flow

    await User.findByIdAndUpdate(id, updateData, { new: true }).exec();
    res.json({ message: 'User updated successfully' });
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/admin/users/:id
// @desc    Delete a user
router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await User.findByIdAndDelete(id).exec();
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/admin/debug-ip
// @desc    Debug: see what IP/headers the server receives (for verifying geo works)
router.get('/debug-ip', async (req, res) => {
  try {
    const { getClientIP, getGeoFromIP } = require('../utils/geoIP');
    const clientIP = getClientIP(req);
    const geo = await getGeoFromIP(clientIP);
    const headers = {
      'x-forwarded-for': req.headers['x-forwarded-for'],
      'x-real-ip': req.headers['x-real-ip'],
      'cf-connecting-ip': req.headers['cf-connecting-ip'],
      'true-client-ip': req.headers['true-client-ip']
    };
    res.json({ clientIP, geo, headers });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route   GET /api/admin/activity
// @desc    Get activity log (logins, video views, etc.) from ActivityLog + User fallback
router.get('/activity', async (req, res) => {
  try {
    const { role, action, limit = 200, source = 'all' } = req.query;
    const maxLimit = Math.min(parseInt(limit, 10) || 200, 500);

    const fromLog = [];
    const fromUsers = [];

    // 1. Read from ActivityLog (primary source for new data)
    if (source !== 'users') {
      const logFilter = {};
      if (role && ['student', 'teacher', 'mentor', 'admin', 'instructor'].includes(role)) {
        logFilter.userRole = role;
      }
      if (action) logFilter.action = action;

      const logs = await ActivityLog.find(logFilter)
        .sort({ timestamp: -1 })
        .limit(maxLimit)
        .lean()
        .exec();

      fromLog.push(...logs.map(doc => ({
        action: doc.action,
        userId: doc.userId,
        userName: doc.userName || '',
        userEmail: doc.userEmail || '',
        userRole: doc.userRole || 'student',
        timestamp: doc.timestamp ? new Date(doc.timestamp).toISOString() : null,
        ipAddress: doc.ipAddress || null,
        city: doc.city || null,
        country: doc.country || null,
        isp: doc.isp || null,
        videoId: doc.videoId || null,
        videoTitle: doc.videoTitle || null,
        assessmentId: doc.assessmentId || null,
        assessmentTitle: doc.assessmentTitle || null,
        score: doc.score,
        path: doc.path || null
      })));
    }

    // 2. Fallback: aggregate from User.loginHistory (for historical data before ActivityLog)
    if ((source === 'all' || source === 'users') && fromLog.length < 50) {
      const roles = ['student', 'teacher', 'mentor', 'admin', 'instructor'];
      const userFilter = role && roles.includes(role) ? { role } : { role: { $in: roles } };
      const users = await User.find(userFilter)
        .select('name email role loginHistory lastLogin lastLoginIP lastLoginTimestamp')
        .lean()
        .exec();

      for (const u of users) {
        const userId = String(u._id);
        const userName = u.name || 'Unknown';
        const userEmail = u.email || '';
        const userRole = u.role || 'student';
        const history = Array.isArray(u.loginHistory) ? u.loginHistory : [];

        for (const h of history) {
          const ts = h.timestamp ? new Date(h.timestamp) : null;
          if (ts && !isNaN(ts.getTime())) {
            fromUsers.push({
              action: 'login',
              userId,
              userName,
              userEmail,
              userRole,
              timestamp: ts.toISOString(),
              ipAddress: h.ipAddress || null,
              city: h.city || null,
              country: h.country || null,
              isp: h.isp || null
            });
          }
        }
        if (history.length === 0 && u.lastLogin) {
          const lastTs = u.lastLogin.timestamp ? new Date(u.lastLogin.timestamp) : (u.lastLoginTimestamp ? new Date(u.lastLoginTimestamp) : null);
          if (lastTs && !isNaN(lastTs.getTime())) {
            fromUsers.push({
              action: 'login',
              userId,
              userName,
              userEmail,
              userRole,
              timestamp: lastTs.toISOString(),
              ipAddress: u.lastLogin.ipAddress || u.lastLoginIP || null,
              city: u.lastLogin.city || null,
              country: u.lastLogin.country || null,
              isp: u.lastLogin.isp || null
            });
          }
        }
      }
      fromUsers.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    // Merge and dedupe by userId+timestamp (same second = same event)
    const seen = new Set();
    const merged = [];
    for (const a of [...fromLog, ...fromUsers]) {
      const ts = new Date(a.timestamp).getTime();
      const key = `${a.userId}_${isNaN(ts) ? 0 : Math.floor(ts / 1000)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(a);
    }
    merged.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const sliced = merged.slice(0, maxLimit);

    res.json({ activities: sliced, total: merged.length });
  } catch (err) {
    console.error('Error fetching activity:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/admin/activity/:studentId
// @desc    Get activity log for a specific student with filtering options
// @access  Private (Admin only)
router.get('/activity/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;
    const { 
      action, 
      startDate, 
      endDate, 
      limit = 100, 
      page = 1,
      export: exportFormat 
    } = req.query;

    if (!studentId) {
      return res.status(400).json({ message: 'Student ID is required' });
    }

    const maxLimit = Math.min(parseInt(limit, 10) || 100, 500);
    const skip = (parseInt(page, 10) - 1) * maxLimit;

    // Build filter
    const filter = { userId: studentId };
    
    if (action) {
      filter.action = action;
    }

    // Date range filtering
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) {
        filter.timestamp.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.timestamp.$lte = new Date(endDate);
      }
    }

    // Get student info
    const student = await User.findById(studentId).select('name email role').lean();
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Fetch activities
    const activities = await ActivityLog.find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(maxLimit)
      .lean()
      .exec();

    // Get total count for pagination
    const total = await ActivityLog.countDocuments(filter);

    // Format activities
    const formattedActivities = activities.map(doc => ({
      id: doc._id,
      action: doc.action,
      userId: doc.userId,
      userName: doc.userName || student.name,
      userEmail: doc.userEmail || student.email,
      userRole: doc.userRole || student.role,
      timestamp: doc.timestamp ? new Date(doc.timestamp).toISOString() : null,
      ipAddress: doc.ipAddress || null,
      city: doc.city || null,
      country: doc.country || null,
      isp: doc.isp || null,
      videoId: doc.videoId || null,
      videoTitle: doc.videoTitle || null,
      assessmentId: doc.assessmentId || null,
      assessmentTitle: doc.assessmentTitle || null,
      score: doc.score,
      path: doc.path || null,
      userAgent: doc.userAgent || null
    }));

    // Handle CSV export
    if (exportFormat === 'csv') {
      const csv = [
        'Timestamp,Action,User Name,User Email,IP Address,City,Country,ISP,Video Title,Assessment Title,Score,Path'
      ];
      
      formattedActivities.forEach(activity => {
        csv.push([
          activity.timestamp ? new Date(activity.timestamp).toLocaleString() : '',
          activity.action || '',
          `"${activity.userName || ''}"`,
          `"${activity.userEmail || ''}"`,
          activity.ipAddress || '',
          activity.city || '',
          activity.country || '',
          activity.isp || '',
          `"${activity.videoTitle || ''}"`,
          `"${activity.assessmentTitle || ''}"`,
          activity.score || '',
          activity.path || ''
        ].join(','));
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="activity-${student.name.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.csv"`);
      return res.send(csv.join('\n'));
    }

    res.json({
      student: {
        id: student._id,
        name: student.name,
        email: student.email,
        role: student.role
      },
      activities: formattedActivities,
      pagination: {
        page: parseInt(page, 10),
        limit: maxLimit,
        total,
        pages: Math.ceil(total / maxLimit)
      }
    });
  } catch (err) {
    console.error('Error fetching student activity:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/admin/mentors
// @desc    Get all mentors
router.get('/mentors', async (req, res) => {
  try {
    const mentors = await User.find({ role: 'mentor' }).select('-password').lean().exec();
    const mapped = mentors.map(m => ({ id: String(m._id), ...m }));
    res.json(mapped);
  } catch (err) {
    console.error('Error fetching mentors:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/admin/mentors
// @desc    Create a new mentor
router.post('/mentors', async (req, res) => {
  try {
    const { name, email, password, title, company, domain, bio, linkedin, status, role } = req.body;

    if (!password || !String(password).trim()) {
      return res.status(400).json({ message: 'Password is required for new mentors' });
    }

    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const bcrypt = require('bcryptjs');
    const salt = await bcrypt.genSalt(10);
    const finalPassword = await bcrypt.hash(password, salt);

    const mentorData = {
      name,
      email: normalizedEmail,
      password: finalPassword,
      title,
      company,
      domain,
      bio: bio || '',
      linkedin: linkedin || '',
      status: status || 'active',
      role: role || 'mentor'
    };

    const mentor = new User(mentorData);
    const saved = await mentor.save();
    console.log('✅ Mentor created successfully with ID:', saved._id);

    res.json({
      id: String(saved._id),
      message: 'Mentor created successfully',
      mentor: { id: String(saved._id), ...saved.toObject() }
    });
  } catch (err) {
    console.error('Error creating mentor:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/admin/mentors/:id
// @desc    Update a mentor
router.put('/mentors/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = {
      ...req.body,
      updatedAt: new Date()
    };

    if (updateData.password) {
      delete updateData.password;
    }

    await User.findByIdAndUpdate(id, updateData, { new: true }).exec();
    res.json({ message: 'Mentor updated successfully' });
  } catch (err) {
    console.error('Error updating mentor:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/admin/mentors/:id
// @desc    Delete a mentor
router.delete('/mentors/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await User.findByIdAndDelete(id).exec();
    res.json({ message: 'Mentor deleted successfully' });
  } catch (err) {
    console.error('Error deleting mentor:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/admin/teachers
// @desc    Get all teachers
router.get('/teachers', async (req, res) => {
  try {
    const teachers = await User.find({ role: 'teacher' }).select('-password').lean().exec();
    const mapped = teachers.map(t => ({ id: String(t._id), ...t }));
    res.json(mapped);
  } catch (err) {
    console.error('Error fetching teachers:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/admin/teachers
// @desc    Create a new teacher
router.post('/teachers', async (req, res) => {
  try {
    const { name, email, password, age, domain, experience, status, role, phone, address } = req.body;

    if (!password || !String(password).trim()) {
      return res.status(400).json({ message: 'Password is required for new teachers' });
    }

    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const bcrypt = require('bcryptjs');
    const salt = await bcrypt.genSalt(10);
    const finalPassword = await bcrypt.hash(password, salt);

    const teacherData = {
      name,
      email: normalizedEmail,
      password: finalPassword,
      age: age ? parseInt(age, 10) : null,
      domain,
      experience,
      status: status || 'active',
      role: role || 'teacher'
    };

    if (phone) teacherData.phone = phone;
    if (address) teacherData.address = address;

    const teacher = new User(teacherData);
    const saved = await teacher.save();

    console.log('✅ Teacher created successfully with ID:', saved._id);

    res.json({
      id: String(saved._id),
      message: 'Teacher created successfully',
      teacher: { id: String(saved._id), ...saved.toObject() }
    });
  } catch (err) {
    console.error('Error creating teacher:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/admin/teachers/:id
// @desc    Update a teacher
router.put('/teachers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = {
      ...req.body,
      updatedAt: new Date()
    };

    await User.findByIdAndUpdate(id, updateData, { new: true }).exec();
    res.json({ message: 'Teacher updated successfully' });
  } catch (err) {
    console.error('Error updating teacher:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/admin/teachers/:id
// @desc    Delete a teacher
router.delete('/teachers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await User.findByIdAndDelete(id).exec();
    res.json({ message: 'Teacher deleted successfully' });
  } catch (err) {
    console.error('Error deleting teacher:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/admin/classroom/upload
// @desc    Upload video + metadata to Firebase Storage
// @access  Private (Admin only)
router.post('/classroom/upload', upload.single('video'), async (req, res) => {
  try {
    // Legacy Firebase Storage upload is no longer supported
    return res.status(503).json({
      message: 'Direct video file upload is temporarily disabled. Please use YouTube URL based uploads instead.'
    });
  } catch (error) {
    console.error('Error uploading lecture:', error);
    
    if (error.message === 'Only video files are allowed') {
      return res.status(400).json({ message: error.message });
    }
    
    if (error.message.includes('File too large')) {
      return res.status(400).json({ message: 'Video file size exceeds 2GB limit' });
    }
    
    res.status(500).json({ message: 'Failed to upload lecture' });
  }
});

// @route   POST /api/admin/classroom/youtube-upload
// @desc    Upload video to YouTube and save metadata
// @access  Private (Admin only)
router.post('/classroom/youtube-upload', upload.single('video'), async (req, res) => {
  try {
    const youtubeService = require('../services/youtubeService');
    
    // Check if YouTube API is configured
    if (!youtubeService.isConfigured()) {
      return res.status(500).json({ 
        message: 'YouTube API not configured. Please set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET in environment variables.' 
      });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Video file is required' });
    }

    const { title, description, courseId, batchId, domain, duration, courseType, instructor } = req.body;

    // Validate required fields
    if (!title || !courseId) {
      return res.status(400).json({ 
        message: 'Title and courseId are required' 
      });
    }

    // Prepare metadata for YouTube
    const metadata = {
      title: title.trim(),
      description: description?.trim() || `Educational video - ${courseType || 'Course'}`,
      courseId: courseId.trim(),
      batchId: batchId?.trim() || null,
      domain: domain?.trim() || null,
      duration: duration || null,
      courseType: courseType?.trim() || null,
      instructor: instructor?.trim() || 'Admin',
      tags: ['education', 'shef-lms', courseType, instructor]
    };

    // Upload video to YouTube
    const youtubeResult = await youtubeService.uploadVideo(req.file.path, metadata);

    // Legacy YouTube upload with Firebase metadata is no longer supported
    return res.status(503).json({
      message: 'Server-side YouTube file upload is temporarily disabled. Please use manual YouTube URL mode.'
    });

  } catch (error) {
    console.error('Error uploading lecture to YouTube:', error);
    
    if (error.message === 'Only video files are allowed') {
      return res.status(400).json({ message: error.message });
    }
    
    if (error.message.includes('File too large')) {
      return res.status(400).json({ message: 'Video file size exceeds 2GB limit' });
    }
    
    if (error.message.includes('YouTube authentication failed')) {
      return res.status(401).json({ message: error.message });
    }
    
    if (error.message.includes('YouTube API quota exceeded')) {
      return res.status(429).json({ message: error.message });
    }
    
    res.status(500).json({ message: 'Failed to upload lecture to YouTube: ' + error.message });
  }
});

// @route   POST /api/admin/classroom/youtube-url
// @desc    Save manual YouTube URL video metadata (optionally with notes upload)
// @access  Private (Admin only)
router.post('/classroom/youtube-url', notesUpload.single('notesFile'), async (req, res) => {
  try {
    const {
      title,
      instructor,
      description,
      courseId,
      batchId,
      domain,
      duration,
      courseType,
      type,
      date,
      youtubeVideoId,
      youtubeVideoUrl,
      youtubeEmbedUrl,
      notesAvailable,
      notesFileName
    } = req.body;

    // Validate required fields
    if (!title || !courseId || !youtubeVideoId || !youtubeVideoUrl) {
      return res.status(400).json({ 
        message: 'Title, courseId, and YouTube URL are required' 
      });
    }

    // Prevent duplicate: same YouTube video already assigned to this batch
    const batchIdNorm = (batchId && typeof batchId === 'string') ? batchId.trim() : null;
    if (batchIdNorm) {
      const existing = await Classroom.findOne({
        youtubeVideoId: youtubeVideoId.trim(),
        batchId: batchIdNorm
      }).lean().exec();
      if (existing) {
        return res.status(400).json({
          message: 'This video is already assigned to this batch. Each video can only be in a batch once.'
        });
      }
    }

    const resolvedCourse = await resolveCourseNameForVideo(courseId);
    const lectureData = {
      title: title.trim(),
      instructor: instructor?.trim() || 'Admin',
      description: description?.trim() || '',
      courseId: courseId.trim(),
      course: resolvedCourse || courseId.trim(),
      batchId: batchId?.trim() || null,
      domain: domain?.trim() || null,
      duration: duration || null,
      courseType: courseType?.trim() || null,
      type: type?.trim() || 'Lecture',
      date: date || new Date().toISOString().split('T')[0],
      videoSource: 'youtube-url',
      youtubeVideoId: youtubeVideoId,
      youtubeVideoUrl: youtubeVideoUrl,
      youtubeEmbedUrl: youtubeEmbedUrl || `https://www.youtube.com/embed/${youtubeVideoId}`,
      uploadedBy: req.user.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Attach notes metadata if provided
    const notesFlag = String(notesAvailable).trim().toLowerCase() === 'true';
    if (notesFlag && (req.file || notesFileName)) {
      lectureData.notesAvailable = true;
      lectureData.notesFileName = (notesFileName || req.file?.originalname || '').trim() || undefined;
      if (req.file) {
        lectureData.notesFilePath = `/uploads/notes/${req.file.filename}`;
      }
    }

    const lecture = new Classroom(lectureData);
    const saved = await lecture.save();

    res.status(201).json({
      message: 'YouTube video added successfully',
      lecture: {
        id: String(saved._id),
        ...saved.toObject()
      }
    });

  } catch (error) {
    console.error('Error saving YouTube URL video:', error);
    res.status(500).json({ 
      message: 'Failed to save YouTube video: ' + error.message 
    });
  }
});

// @route   POST /api/admin/classroom
// @desc    Add a new video to classroom (supports both Drive and Zoom, optionally with notes upload)
router.post('/classroom', notesUpload.single('notesFile'), async (req, res) => {
  try {
    const {
      title,
      instructor,
      duration,
      date,
      courseType,
      type,
      instructorColor,
      courseId,
      batchId,
      // Zoom specific fields
      zoomUrl,
      zoomPasscode,
      // Drive specific field (for backward compatibility)
      driveId,
      // Notes metadata (optional)
      notesAvailable,
      notesFileName
    } = req.body;

    // Validate required fields
    if (!title || !instructor || !courseType) {
      return res.status(400).json({ message: 'Title, instructor, and course type are required' });
    }

    // Validate that either Zoom URL or Drive ID is provided
    if (!zoomUrl && !driveId) {
      return res.status(400).json({ message: 'Either Zoom URL or Drive ID is required' });
    }

    // Passcode extraction is handled by middleware if needed

    const resolvedCourse = await resolveCourseNameForVideo(courseId || courseType);
    const videoData = {
      title,
      instructor,
      duration: duration || '',
      date: date || new Date().toISOString().split('T')[0],
      courseType,
      type: type || 'Live Class',
      instructorColor: instructorColor || '#E91E63',
      course: resolvedCourse || courseId || courseType || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      courseId: courseId || courseType || null,
      batchId: batchId || null
    };

    // Add video source specific fields
    if (zoomUrl) {
      videoData.zoomUrl = zoomUrl;
      videoData.zoomPasscode = zoomPasscode;
      videoData.videoSource = 'zoom';
    } else if (driveId) {
      videoData.driveId = driveId;
      videoData.videoSource = 'drive';
    }

    // Attach notes metadata if provided
    const notesFlag = String(notesAvailable).trim().toLowerCase() === 'true';
    if (notesFlag && (req.file || notesFileName)) {
      videoData.notesAvailable = true;
      videoData.notesFileName = (notesFileName || req.file?.originalname || '').trim() || undefined;
      if (req.file) {
        videoData.notesFilePath = `/uploads/notes/${req.file.filename}`;
      }
    }

    const video = new Classroom(videoData);
    const saved = await video.save();

    res.status(201).json({ 
      message: 'Video added successfully', 
      videoId: String(saved._id),
      video: { id: String(saved._id), ...saved.toObject() }
    });
  } catch (err) {
    console.error('Error adding classroom video:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/admin/classroom/:id
// @desc    Update a classroom video (optionally with notes upload)
router.put('/classroom/:id', notesUpload.single('notesFile'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      instructor,
      duration,
      date,
      courseType,
      type,
      instructorColor,
      zoomUrl,
      zoomPasscode,
      driveId,
      videoSource,
      youtubeVideoId,
      youtubeVideoUrl,
      youtubeEmbedUrl,
      description,
      courseId,
      batchId,
      notesAvailable,
      notesFileName
    } = req.body;

    // Validate that at least one video source is provided
    const hasVideoSource = zoomUrl || driveId || youtubeVideoUrl || videoSource;
    if (!hasVideoSource) {
      return res.status(400).json({ 
        message: 'A video source is required. Please provide either a Zoom URL, Drive ID, or YouTube URL.' 
      });
    }

    const videoData = {
      updatedAt: new Date().toISOString()
    };

    // Add provided fields
    if (title) videoData.title = title;
    if (instructor) videoData.instructor = instructor;
    if (duration) videoData.duration = duration;
    if (date) videoData.date = date;
    if (courseType) videoData.courseType = courseType;
    if (type) videoData.type = type;
    if (instructorColor) videoData.instructorColor = instructorColor;
    if (description !== undefined) videoData.description = description;
    if (courseId) {
      videoData.courseId = courseId;
      videoData.course = await resolveCourseNameForVideo(courseId);
    }
    if (batchId !== undefined) videoData.batchId = batchId;

    // Add video source specific fields
    if (zoomUrl) {
      videoData.zoomUrl = zoomUrl;
      videoData.zoomPasscode = zoomPasscode;
      videoData.videoSource = 'zoom';
      // Remove other video source fields if switching to Zoom
      videoData.driveId = null;
      videoData.youtubeVideoId = null;
      videoData.youtubeVideoUrl = null;
      videoData.youtubeEmbedUrl = null;
    } else if (driveId) {
      videoData.driveId = driveId;
      videoData.videoSource = 'drive';
      // Remove other video source fields if switching to Drive
      videoData.zoomUrl = null;
      videoData.zoomPasscode = null;
      videoData.youtubeVideoId = null;
      videoData.youtubeVideoUrl = null;
      videoData.youtubeEmbedUrl = null;
    } else if (youtubeVideoUrl || videoSource === 'youtube-url') {
      videoData.videoSource = 'youtube-url';
      videoData.youtubeVideoId = youtubeVideoId;
      videoData.youtubeVideoUrl = youtubeVideoUrl;
      videoData.youtubeEmbedUrl = youtubeEmbedUrl;
      // Remove other video source fields if switching to YouTube
      videoData.zoomUrl = null;
      videoData.zoomPasscode = null;
      videoData.driveId = null;
    }

    // Attach or update notes metadata if provided
    if (typeof notesAvailable !== 'undefined') {
      const notesFlag = String(notesAvailable).trim().toLowerCase() === 'true';
      if (notesFlag && (req.file || notesFileName)) {
        videoData.notesAvailable = true;
        videoData.notesFileName = (notesFileName || req.file?.originalname || '').trim() || undefined;
        if (req.file) {
          videoData.notesFilePath = `/uploads/notes/${req.file.filename}`;
        }
      } else {
        // Explicitly clear notes when notesAvailable is false
        videoData.notesAvailable = false;
        videoData.notesFileName = null;
        videoData.notesFilePath = null;
      }
    } else if (req.file) {
      // If a new notes file is uploaded without explicit flag, assume notes are available
      videoData.notesAvailable = true;
      videoData.notesFileName = (notesFileName || req.file.originalname || '').trim() || undefined;
      videoData.notesFilePath = `/uploads/notes/${req.file.filename}`;
    }

    await Classroom.findByIdAndUpdate(id, videoData, { new: true }).exec();

    res.json({ message: 'Video updated successfully' });
  } catch (err) {
    console.error('Error updating classroom video:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/admin/classroom/:id
// @desc    Delete a classroom video
router.delete('/classroom/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await Classroom.findByIdAndDelete(id).exec();
    res.json({ message: 'Video deleted successfully' });
  } catch (err) {
    console.error('Error deleting classroom video:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Module-specific routes with file upload support
// @route   POST /api/admin/modules/upload
// @desc    Create a new module with file upload
router.post('/modules/upload', moduleUpload.single('file'), async (req, res) => {
  try {
    const { name, courseId, batchId, duration, contentType, content, externalLink } = req.body;
    
    if (!name || !courseId) {
      return res.status(400).json({ message: 'Module name and course are required' });
    }

    let fileUrl = '';
    let fileName = '';
    let fileSize = 0;

    // Handle file upload
    if (req.file) {
      const { buffer, originalname, size } = req.file;
      
      // For now, store file as base64 (in production, use cloud storage)
      const base64File = buffer.toString('base64');
      fileUrl = `data:${req.file.mimetype};base64,${base64File}`;
      fileName = originalname;
      fileSize = size;
    }

    // Validate and convert courseId
    let convertedCourseId;
    try {
      convertedCourseId = new mongoose.Types.ObjectId(courseId);
    } catch (error) {
      console.error('Invalid courseId format:', courseId, error);
      return res.status(400).json({ message: 'Invalid course ID format' });
    }

    const moduleData = {
      name,
      courseId: convertedCourseId,
      batchId: batchId || '',
      duration: duration || '',
      contentType: contentType || 'text',
      content: content || '',
      externalLink: externalLink || '',
      fileUrl,
      fileName,
      fileSize,
      createdAt: new Date()
    };

    const module = new Module(moduleData);
    const savedModule = await module.save();

    res.status(201).json({
      message: 'Module created successfully',
      module: { id: String(savedModule._id), ...savedModule.toObject() }
    });
  } catch (err) {
    console.error('Error creating module with upload:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// @route   PUT /api/admin/modules/:id/upload
// @desc    Update a module with file upload
router.put('/modules/:id/upload', moduleUpload.single('file'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, courseId, batchId, duration, contentType, content, externalLink } = req.body;
    
    const module = await Module.findById(id);
    if (!module) {
      return res.status(404).json({ message: 'Module not found' });
    }

    // Update basic fields
    if (name) module.name = name;
    if (courseId) module.courseId = new mongoose.Types.ObjectId(courseId); // Convert to ObjectId
    if (batchId) module.batchId = batchId;
    if (duration) module.duration = duration;
    if (contentType) module.contentType = contentType;
    if (content) module.content = content;
    if (externalLink) module.externalLink = externalLink;

    // Handle file upload
    if (req.file) {
      const { buffer, originalname, size } = req.file;
      
      // For now, store file as base64 (in production, use cloud storage)
      const base64File = buffer.toString('base64');
      module.fileUrl = `data:${req.file.mimetype};base64,${base64File}`;
      module.fileName = originalname;
      module.fileSize = size;
    }

    module.updatedAt = new Date();
    const updatedModule = await module.save();

    res.json({
      message: 'Module updated successfully',
      module: { id: String(updatedModule._id), ...updatedModule.toObject() }
    });
  } catch (err) {
    console.error('Error updating module with upload:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Generic CRUD operations for all collections
const collections = ['courses', 'modules', 'lessons', 'projects', 'assessments', 'jobs', 'content', 'classroom'];

collections.forEach(collectionName => {
  // Get all items
  router.get(`/${collectionName}`, async (req, res) => {
    try {
      let items;
      if (collectionName === 'courses') {
        items = await Course.find({}).lean().exec();
        items = items.map(c => ({ id: String(c._id), ...c }));
      } else if (collectionName === 'modules') {
        items = await Module.find({}).lean().exec();
        items = items.map(m => ({ id: String(m._id), ...m }));
      } else if (collectionName === 'classroom') {
        items = await Classroom.find({}).lean().exec();
        items = items.map(cl => ({ id: String(cl._id), ...cl, batchId: normalizeBatchId(cl.batchId) }));
      } else {
        const Model = getDynamicModel(collectionName);
        const docs = await Model.find({}).lean().exec();
        items = docs.map(d => ({ id: String(d._id), ...d }));
      }
      res.json(items);
    } catch (err) {
      console.error(`Error fetching ${collectionName}:`, err);
      res.status(500).json({ message: 'Server error' });
    }
  });

  // Get single item
  router.get(`/${collectionName}/:id`, async (req, res) => {
    try {
      const { id } = req.params;
      let doc;
      if (collectionName === 'courses') {
        doc = await Course.findById(id).lean().exec();
      } else if (collectionName === 'modules') {
        doc = await Module.findById(id).lean().exec();
      } else if (collectionName === 'classroom') {
        doc = await Classroom.findById(id).lean().exec();
      } else {
        const Model = getDynamicModel(collectionName);
        doc = await Model.findById(id).lean().exec();
      }
      if (!doc) {
        return res.status(404).json({ message: 'Not found' });
      }
      res.json({ id: String(doc._id), ...doc });
    } catch (err) {
      console.error(`Error fetching ${collectionName} item:`, err);
      res.status(500).json({ message: 'Server error' });
    }
  });

  // Create item
  router.post(`/${collectionName}`, async (req, res) => {
    try {
      let saved;
      if (collectionName === 'courses') {
        const course = new Course(req.body);
        saved = await course.save();
      } else if (collectionName === 'modules') {
        // Handle courseId conversion for modules
        const moduleData = { ...req.body };
        console.log('Module creation data received:', moduleData);
        if (moduleData.courseId) {
          try {
            moduleData.courseId = new mongoose.Types.ObjectId(moduleData.courseId);
            console.log('Converted courseId:', moduleData.courseId);
          } catch (error) {
            console.error('Invalid courseId format:', moduleData.courseId, error);
            return res.status(400).json({ message: 'Invalid course ID format' });
          }
        }
        const module = new Module(moduleData);
        saved = await module.save();
      } else if (collectionName === 'classroom') {
        const classroom = new Classroom(req.body);
        saved = await classroom.save();
      } else {
        const Model = getDynamicModel(collectionName);
        const doc = new Model(req.body);
        saved = await doc.save();
      }
      res.json({ id: String(saved._id), message: `${collectionName} item created successfully` });
    } catch (err) {
      console.error(`Error creating ${collectionName} item:`, err);
      res.status(500).json({ message: 'Server error' });
    }
  });

  // Update item
  router.put(`/${collectionName}/:id`, async (req, res) => {
    try {
      const updateData = {
        ...req.body,
        updatedAt: new Date()
      };
      const { id } = req.params;
      let Model;
      if (collectionName === 'courses') {
        Model = Course;
      } else if (collectionName === 'modules') {
        Model = Module;
        // Handle courseId conversion for modules
        if (updateData.courseId) {
          updateData.courseId = new mongoose.Types.ObjectId(updateData.courseId);
        }
      } else if (collectionName === 'classroom') {
        Model = Classroom;
      } else {
        Model = getDynamicModel(collectionName);
      }
      await Model.findByIdAndUpdate(id, updateData, { new: true }).exec();
      res.json({ message: `${collectionName} item updated successfully` });
    } catch (err) {
      console.error(`Error updating ${collectionName} item:`, err);
      res.status(500).json({ message: 'Server error' });
    }
  });

  // Delete item
  router.delete(`/${collectionName}/:id`, async (req, res) => {
    try {
      const { id } = req.params;
      let Model;
      if (collectionName === 'courses') {
        Model = Course;
      } else if (collectionName === 'modules') {
        Model = Module;
      } else if (collectionName === 'classroom') {
        Model = Classroom;
      } else {
        Model = getDynamicModel(collectionName);
      }
      await Model.findByIdAndDelete(id).exec();
      res.json({ message: `${collectionName} item deleted successfully` });
    } catch (err) {
      console.error(`Error deleting ${collectionName} item:`, err);
      res.status(500).json({ message: 'Server error' });
    }
  });
});

// @route   GET /api/admin/stats
// @desc    Get admin statistics
router.get('/stats', async (req, res) => {
  try {
    const studentsCount = await User.countDocuments({ role: 'student' }).exec();
    const coursesCount = await Course.countDocuments({}).exec();
    const Jobs = getDynamicModel('jobs');
    const activeJobs = await Jobs.countDocuments({ status: 'active' }).exec();

    const stats = {
      totalStudents: studentsCount,
      totalCourses: coursesCount,
      activeJobs,
      timestamp: new Date().toISOString()
    };

    res.json(stats);
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Route to get batches by course ID
router.get('/batches/:courseId', async (req, res) => {
    try {
    const batches = await Batch.find({ course: req.params.courseId }).lean().exec();
    const mapped = batches.map(b => ({ id: String(b._id), ...b }));
    res.json(mapped);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching batches' });
    }
});

// @route   POST /api/admin/batches
// @desc    Create a new batch
router.post('/batches', async (req, res) => {
    try {
        const { name, course, startDate, endDate, teacherId, teacherName, status } = req.body;
        
        // Validate required fields
        if (!name || !course || !teacherId) {
            return res.status(400).json({ message: 'Batch name, course, and teacher are required' });
        }
        
        const batchData = {
          name,
          course,
          startDate: startDate || null,
          endDate: endDate || null,
          teacherId,
          teacherName: teacherName || '',
          status: status || 'active'
        };

        const batch = new Batch(batchData);
        const saved = await batch.save();

        res.status(201).json({
          success: true,
          message: 'Batch created successfully',
          id: String(saved._id),
          ...saved.toObject()
        });
    } catch (error) {
        console.error('Error creating batch:', error);
        res.status(500).json({ message: 'Error creating batch: ' + error.message });
    }
});

// @route   PUT /api/admin/batches/:id
// @desc    Update a batch (general fields)
router.put('/batches/:id', async (req, res) => {
    try {
        const { name, course, startDate, endDate, teacherId, teacherName, status } = req.body;
        
        const updateData = {
          name,
          course,
          startDate: startDate || null,
          endDate: endDate || null,
          teacherId,
          teacherName: teacherName || '',
          status: status || 'active'
        };

        const updated = await Batch.findByIdAndUpdate(req.params.id, updateData, { new: true }).exec();

        res.json({
          success: true,
          message: 'Batch updated successfully',
          id: String(updated?._id || req.params.id),
          ...updateData
        });
    } catch (error) {
        console.error('Error updating batch:', error);
        res.status(500).json({ message: 'Error updating batch: ' + error.message });
    }
});

    // @route   PUT /api/admin/batches/:id/schedule
    // @desc    Update batch timing/schedule (IST)
    // Note: All authenticated admins can call this (router already protected by roleAuth('admin'))
    router.put('/batches/:id/schedule', async (req, res) => {
      try {
        const { days, time, timezone } = req.body;

        const schedule = {
          timezone: timezone || 'IST',
          days: days || '',
          time: time || ''
        };

        await Batch.findByIdAndUpdate(req.params.id, { schedule }, { new: true }).exec();

        res.json({
          success: true,
          message: 'Batch timing updated successfully',
          id: req.params.id,
          schedule
        });
      } catch (error) {
        console.error('Error updating batch schedule:', error);
        res.status(500).json({ message: 'Error updating batch schedule: ' + error.message });
      }
    });

// @route   DELETE /api/admin/batches/:id
// @desc    Delete a batch (cascade: clear User.batchId and Classroom.batchId for affected records)
router.delete('/batches/:id', async (req, res) => {
    try {
        const batchId = req.params.id;
        const batchDoc = await Batch.findById(batchId).lean().exec();
        if (!batchDoc) {
            return res.status(404).json({ message: 'Batch not found' });
        }

        // 1. Clear batchId for all users (students) who were in this batch
        await User.updateMany(
            { batchId: batchId },
            { $unset: { batchId: '' } }
        ).exec();

        // 2. Clear batchId for all classroom videos assigned to this batch
        await Classroom.updateMany(
            { batchId: batchId },
            { $set: { batchId: null, updatedAt: new Date() } }
        ).exec();

        // 3. Delete the batch
        await Batch.findByIdAndDelete(batchId).exec();

        res.json({
            success: true,
            message: 'Batch deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting batch:', error);
        res.status(500).json({ message: 'Error deleting batch: ' + error.message });
    }
});

// @route   GET /api/admin/batches
// @desc    Get all batches
router.get('/batches', async (req, res) => {
    try {
    const batches = await Batch.find({}).lean().exec();
    const mapped = batches.map(b => ({ id: String(b._id), ...b }));
    res.json({ batches: mapped });
    } catch (error) {
        console.error('Error fetching batches:', error);
        res.status(500).json({ message: 'Error fetching batches' });
    }
});

// One-to-One Routes
router.get('/one-to-one', async (req, res) => {
  try {
    const oneToOneClasses = await OneToOne.find({}).lean().exec();
    res.json(oneToOneClasses);
  } catch (error) {
    console.error('Error fetching one-to-one classes:', error);
    res.status(500).json({ message: 'Error fetching one-to-one classes' });
  }
});

router.get('/one-to-one/:id', async (req, res) => {
  try {
    const oneToOneClass = await OneToOne.findById(req.params.id).lean().exec();
    if (!oneToOneClass) {
      return res.status(404).json({ message: 'One-to-one class not found' });
    }
    res.json(oneToOneClass);
  } catch (error) {
    console.error('Error fetching one-to-one class:', error);
    res.status(500).json({ message: 'Error fetching one-to-one class' });
  }
});

router.post('/one-to-one', async (req, res) => {
  try {
    const oneToOneData = new OneToOne(req.body);
    const savedOneToOne = await oneToOneData.save();
    res.status(201).json(savedOneToOne);
  } catch (error) {
    console.error('Error creating one-to-one class:', error);
    res.status(500).json({ message: 'Error creating one-to-one class' });
  }
});

router.put('/one-to-one/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const updatedOneToOne = await OneToOne.findByIdAndUpdate(id, updateData, { new: true });
    res.json(updatedOneToOne);
  } catch (error) {
    console.error('Error updating one-to-one class:', error);
    res.status(500).json({ message: 'Error updating one-to-one class' });
  }
});

router.delete('/one-to-one/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deletedOneToOne = await OneToOne.findByIdAndDelete(id);
    res.json({ message: 'One-to-one class deleted successfully' });
  } catch (error) {
    console.error('Error deleting one-to-one class:', error);
    res.status(500).json({ message: 'Error deleting one-to-one class' });
  }
});

// One-to-One Batches - full mirror of /api/one-to-one-batches (avoids 404 on deployments where that path fails)
const oneToOneBatchController = require('../controllers/oneToOneBatchController');
// Debug: verify route is reachable (GET /api/admin/one-to-one-batches/ping)
router.get('/one-to-one-batches/ping', (req, res) => res.json({ ok: true, path: 'admin/one-to-one-batches' }));
router.get('/one-to-one-batches/course/:courseName', (req, res) => oneToOneBatchController.getBatchesByCourse(req, res));
router.get('/one-to-one-batches/unassigned-students/:course', (req, res) => oneToOneBatchController.getUnassignedStudents(req, res));
router.post('/one-to-one-batches', (req, res) => oneToOneBatchController.createBatch(req, res));
router.get('/one-to-one-batches', (req, res) => oneToOneBatchController.getAllBatches(req, res));
router.get('/one-to-one-batches/:id', (req, res) => oneToOneBatchController.getBatchById(req, res));
router.put('/one-to-one-batches/:id', (req, res) => oneToOneBatchController.updateBatch(req, res));
router.delete('/one-to-one-batches/:id', (req, res) => oneToOneBatchController.deleteBatch(req, res));
router.post('/one-to-one-batches/:id/videos', (req, res) => oneToOneBatchController.addVideo(req, res));
router.put('/one-to-one-batches/:id/videos/:videoId', (req, res) => oneToOneBatchController.updateVideo(req, res));
router.delete('/one-to-one-batches/:id/videos/:videoId', (req, res) => oneToOneBatchController.removeVideo(req, res));
router.delete('/one-to-one-batches/:id/videos/:videoIndex/index', (req, res) => oneToOneBatchController.removeVideoByIndex(req, res));
router.post('/one-to-one-batches/:id/students', (req, res) => oneToOneBatchController.updateStudent(req, res));
router.delete('/one-to-one-batches/:id/students', (req, res) => oneToOneBatchController.removeStudent(req, res));
router.put('/one-to-one-batches/:id/progress', (req, res) => oneToOneBatchController.updateProgress(req, res));

// Email Routes
router.post('/send-batch-email', async (req, res) => {
  try {
    const { batchId, subject, message, studentEmails } = req.body;

    // Validate required fields
    if (!batchId || !subject || !message || !studentEmails || studentEmails.length === 0) {
      return res.status(400).json({ 
        message: 'Missing required fields: batchId, subject, message, or studentEmails' 
      });
    }

    // Verify batch exists
    const batch = await Batch.findById(batchId);
    if (!batch) {
      return res.status(404).json({ message: 'Batch not found' });
    }

    // Send email
    const emailResult = await sendEmail({
      subject,
      message,
      studentEmails,
      batchId
    });

    // Log activity
    try {
      await ActivityLog.create({
        action: 'EMAIL_SENT',
        entityType: 'batch',
        entityId: batchId,
        entityName: batch.name,
        details: {
          recipientCount: studentEmails.length,
          subject: subject,
          messageId: emailResult.messageId
        },
        userId: req.user?.id,
        userEmail: req.user?.email,
        timestamp: new Date()
      });
    } catch (logError) {
      console.error('Failed to log email activity:', logError);
      // Continue with response even if logging fails
    }

    res.json({
      success: true,
      message: `Email sent successfully to ${studentEmails.length} student(s)`,
      recipientCount: studentEmails.length,
      messageId: emailResult.messageId,
      batchName: batch.name
    });

  } catch (error) {
    console.error('Error sending batch email:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to send email' 
    });
  }
});

module.exports = router;
