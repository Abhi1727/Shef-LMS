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
const Course = require('../models/Course');
const Module = require('../models/Module');
const Classroom = require('../models/Classroom');
const OneToOne = require('../models/OneToOne');

// Apply auth and admin role check to all admin routes
router.use(auth);
router.use(roleAuth('admin'));

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

    const users = await User.find({
      role: 'student',
      email: { $regex: normalized, $options: 'i' }
    })
      .limit(10)
      .lean()
      .exec();

    const mapped = users.map(u => ({ id: String(u._id), ...u }));
    res.json(mapped);
  } catch (err) {
    console.error('Error searching users:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/admin/users
// @desc    Get all users (students)
router.get('/users', async (req, res) => {
  try {
    const users = await User.find({ role: 'student' }).lean().exec();
    const mapped = users.map(u => ({ id: String(u._id), ...u }));
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

// @route   GET /api/admin/mentors
// @desc    Get all mentors
router.get('/mentors', async (req, res) => {
  try {
    const mentors = await User.find({ role: 'mentor' }).lean().exec();
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
    const teachers = await User.find({ role: 'teacher' }).lean().exec();
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

    // Prepare lecture data
    const lectureData = {
      title: title.trim(),
      instructor: instructor?.trim() || 'Admin',
      description: description?.trim() || '',
      courseId: courseId.trim(),
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

    const videoData = {
      title,
      instructor,
      duration: duration || '',
      date: date || new Date().toISOString().split('T')[0],
      courseType,
      type: type || 'Live Class',
      instructorColor: instructorColor || '#E91E63',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      // Optional course and batch association for stricter access control
      courseId: courseId || null,
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
    if (courseId) videoData.courseId = courseId;
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
        items = items.map(cl => ({ id: String(cl._id), ...cl }));
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
// @desc    Delete a batch
router.delete('/batches/:id', async (req, res) => {
    try {
    await Batch.findByIdAndDelete(req.params.id).exec();
        
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

module.exports = router;
