const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const auth = require('../middleware/auth');
const { roleAuth } = require('../middleware/roleAuth');
const multer = require('multer');
const classroomService = require('../services/classroomService');
const Course = require('../models/Course');

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

// @route   GET /api/admin/users/search
// @desc    Search users by email
router.get('/users/search', async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({ message: 'Email parameter is required' });
    }

    // Search for users with email containing the search term (case insensitive)
    const usersSnapshot = await db.collection('users')
      .where('role', '==', 'student')
      .where('email', '>=', email.toLowerCase())
      .where('email', '<=', email.toLowerCase() + '\uf8ff')
      .limit(10) // Limit results to prevent excessive reads
      .get();

    const users = [];
    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      if (userData.email && userData.email.toLowerCase().includes(email.toLowerCase())) {
        users.push({ id: doc.id, ...userData });
      }
    });

    res.json(users);
  } catch (err) {
    console.error('Error searching users:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/admin/users
// @desc    Get all users (students)
router.get('/users', async (req, res) => {
  try {
    const usersSnapshot = await db.collection('users').where('role', '==', 'student').get();
    const users = [];
    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      const user = { 
        id: doc.id, 
        ...userData,
        // Ensure phone and address are included with fallbacks
        phone: userData.phone || '',
        address: userData.address || ''
      };
      users.push(user);
      
      // Debug logging for student data
      if (userData.phone || userData.address) {
        console.log(`Student ${doc.id} has phone/address:`, {
          phone: userData.phone,
          address: userData.address
        });
      }
    });
    console.log(`Total students fetched: ${users.length}`);
    res.json(users);
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
      role: role || 'student',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Include optional fields
    if (phone) userData.phone = phone;
    if (address) userData.address = address;

    const docRef = await db.collection('users').add(userData);

    res.json({ id: docRef.id, message: 'User created successfully' });
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
      updatedAt: new Date().toISOString()
    };
    
    await db.collection('users').doc(id).update(updateData);
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
    await db.collection('users').doc(id).delete();
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
    const mentorsSnapshot = await db.collection('mentors').get();
    const mentors = [];
    mentorsSnapshot.forEach(doc => {
      mentors.push({ id: doc.id, ...doc.data() });
    });
    res.json(mentors);
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
      role: role || 'mentor',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const docRef = await db.collection('mentors').add(mentorData);
    console.log('✅ Mentor created successfully with ID:', docRef.id);

    res.json({
      id: docRef.id,
      message: 'Mentor created successfully',
      mentor: { id: docRef.id, ...mentorData }
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
      updatedAt: new Date().toISOString()
    };

    // Remove password from update data if present (password updates should use separate endpoint)
    if (updateData.password) {
      delete updateData.password;
    }

    await db.collection('mentors').doc(id).update(updateData);
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
    await db.collection('mentors').doc(id).delete();
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
    const teachersSnapshot = await db.collection('users').where('role', '==', 'teacher').get();
    const teachers = [];
    teachersSnapshot.forEach(doc => {
      teachers.push({ id: doc.id, ...doc.data() });
    });
    res.json(teachers);
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
      age: age ? parseInt(age) : null,
      domain,
      experience,
      status: status || 'active',
      role: role || 'teacher',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Include optional fields
    if (phone) teacherData.phone = phone;
    if (address) teacherData.address = address;

    const docRef = await db.collection('users').add(teacherData);

    console.log('✅ Teacher created successfully with ID:', docRef.id);

    res.json({
      id: docRef.id,
      message: 'Teacher created successfully',
      teacher: { id: docRef.id, ...teacherData }
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
      updatedAt: new Date().toISOString()
    };

    await db.collection('users').doc(id).update(updateData);
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
    await db.collection('users').doc(id).delete();
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
    if (!req.file) {
      return res.status(400).json({ message: 'Video file is required' });
    }

    const { title, description, courseId, batchId, domain, duration } = req.body;

    // Validate required fields
    if (!title || !courseId) {
      return res.status(400).json({ 
        message: 'Title and courseId are required' 
      });
    }

    // Prepare metadata
    const metadata = {
      title: title.trim(),
      description: description?.trim() || '',
      courseId: courseId.trim(),
      batchId: batchId?.trim() || null,
      domain: domain?.trim() || null,
      duration: duration || null,
      uploadedBy: req.user.id
    };

    // Upload video to Firebase Storage
    const uploadResult = await classroomService.uploadVideo(req.file, metadata);

    // Save lecture metadata to Firestore
    const lectureData = {
      ...metadata,
      firebaseStoragePath: uploadResult.storagePath
    };
    
    const lectureId = await classroomService.saveLectureMetadata(lectureData);

    res.status(201).json({
      message: 'Lecture uploaded successfully',
      lecture: {
        id: lectureId,
        title: metadata.title,
        description: metadata.description,
        courseId: metadata.courseId,
        batchId: metadata.batchId,
        domain: metadata.domain,
        duration: metadata.duration,
        uploadedBy: metadata.uploadedBy,
        createdAt: new Date().toISOString(),
        videoSource: 'firebase',
        fileInfo: {
          filename: uploadResult.filename,
          size: uploadResult.size,
          originalName: uploadResult.originalName
        }
      }
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

    // Save lecture metadata to Firestore with YouTube info
    const lectureData = {
      ...metadata,
      videoSource: 'youtube',
      youtubeVideoId: youtubeResult.videoId,
      youtubeVideoUrl: youtubeResult.videoUrl,
      youtubeEmbedUrl: youtubeResult.embedUrl,
      uploadedBy: req.user.id,
      fileInfo: {
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
      }
    };
    
    const lectureId = await classroomService.saveLectureMetadata(lectureData);

    res.status(201).json({
      message: 'Lecture uploaded successfully to YouTube',
      lecture: {
        id: lectureId,
        title: metadata.title,
        description: metadata.description,
        courseId: metadata.courseId,
        batchId: metadata.batchId,
        domain: metadata.domain,
        duration: metadata.duration,
        courseType: metadata.courseType,
        instructor: metadata.instructor,
        uploadedBy: metadata.uploadedBy,
        createdAt: new Date().toISOString(),
        videoSource: 'youtube',
        youtubeVideoId: youtubeResult.videoId,
        youtubeVideoUrl: youtubeResult.videoUrl,
        youtubeEmbedUrl: youtubeResult.embedUrl,
        fileInfo: lectureData.fileInfo
      }
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
// @desc    Save manual YouTube URL video metadata
// @access  Private (Admin only)
router.post('/classroom/youtube-url', async (req, res) => {
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
      youtubeEmbedUrl
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

    // Save to Firestore
    const docRef = await db.collection('classroom').add(lectureData);

    res.status(201).json({
      message: 'YouTube video added successfully',
      lecture: {
        id: docRef.id,
        ...lectureData
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
// @desc    Add a new video to classroom (supports both Drive and Zoom)
router.post('/classroom', async (req, res) => {
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
      driveId
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

    const docRef = await db.collection('classroom').add(videoData);
    
    res.status(201).json({ 
      message: 'Video added successfully', 
      videoId: docRef.id,
      video: { id: docRef.id, ...videoData }
    });
  } catch (err) {
    console.error('Error adding classroom video:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/admin/classroom/:id
// @desc    Update a classroom video
router.put('/classroom/:id', async (req, res) => {
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
      batchId
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

    await db.collection('classroom').doc(id).update(videoData);
    
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
    await db.collection('classroom').doc(id).delete();
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
    const { name, courseId, batchId, duration, contentType, externalLink } = req.body;
    
    if (!name || !courseId) {
      return res.status(400).json({ message: 'Name and Course ID are required' });
    }

    const moduleData = {
      name,
      courseId,
      batchId: batchId || '',
      duration: duration || '',
      contentType: contentType || 'text',
      content: req.body.content || '',
      externalLink: externalLink || '',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Handle file upload
    if (req.file) {
      const file = req.file;
      const fileName = `${Date.now()}-${file.originalname}`;
      const filePath = `modules/${courseId}/${fileName}`;
      
      // Upload to Firebase Storage
      const bucket = db.storage().bucket();
      const fileUpload = bucket.file(filePath);
      
      await fileUpload.save(file.buffer, {
        metadata: {
          contentType: file.mimetype,
        },
      });
      
      // Get file URL
      const [url] = await fileUpload.getSignedUrl({
        action: 'read',
        expires: '03-01-2500', // Far future expiration
      });
      
      moduleData.fileUrl = url;
      moduleData.fileName = file.originalname;
      moduleData.fileSize = file.size;
      
      // Determine content type based on file
      if (file.mimetype === 'application/pdf') {
        moduleData.contentType = 'pdf';
      } else if (file.mimetype.includes('word')) {
        moduleData.contentType = 'word';
      }
    }

    const docRef = await db.collection('modules').add(moduleData);
    res.json({ 
      id: docRef.id, 
      ...moduleData,
      message: 'Module created successfully with file upload' 
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
    const { name, courseId, batchId, duration, contentType, externalLink } = req.body;
    
    const moduleDoc = await db.collection('modules').doc(id).get();
    if (!moduleDoc.exists) {
      return res.status(404).json({ message: 'Module not found' });
    }

    const moduleData = {
      name,
      courseId,
      batchId: batchId || '',
      duration: duration || '',
      contentType: contentType || 'text',
      content: req.body.content || '',
      externalLink: externalLink || '',
      updatedAt: new Date().toISOString()
    };

    // Handle file upload
    if (req.file) {
      const file = req.file;
      const fileName = `${Date.now()}-${file.originalname}`;
      const filePath = `modules/${courseId}/${fileName}`;
      
      // Upload to Firebase Storage
      const bucket = db.storage().bucket();
      const fileUpload = bucket.file(filePath);
      
      await fileUpload.save(file.buffer, {
        metadata: {
          contentType: file.mimetype,
        },
      });
      
      // Get file URL
      const [url] = await fileUpload.getSignedUrl({
        action: 'read',
        expires: '03-01-2500',
      });
      
      moduleData.fileUrl = url;
      moduleData.fileName = file.originalname;
      moduleData.fileSize = file.size;
      
      // Determine content type based on file
      if (file.mimetype === 'application/pdf') {
        moduleData.contentType = 'pdf';
      } else if (file.mimetype.includes('word')) {
        moduleData.contentType = 'word';
      }
    }

    await db.collection('modules').doc(id).update(moduleData);
    res.json({ 
      id,
      ...moduleData,
      message: 'Module updated successfully with file upload' 
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
      const snapshot = await db.collection(collectionName).get();
      const items = [];
      snapshot.forEach(doc => {
        items.push({ id: doc.id, ...doc.data() });
      });
      res.json(items);
    } catch (err) {
      console.error(`Error fetching ${collectionName}:`, err);
      res.status(500).json({ message: 'Server error' });
    }
  });

  // Get single item
  router.get(`/${collectionName}/:id`, async (req, res) => {
    try {
      const doc = await db.collection(collectionName).doc(req.params.id).get();
      if (!doc.exists) {
        return res.status(404).json({ message: 'Not found' });
      }
      res.json({ id: doc.id, ...doc.data() });
    } catch (err) {
      console.error(`Error fetching ${collectionName} item:`, err);
      res.status(500).json({ message: 'Server error' });
    }
  });

  // Create item
  router.post(`/${collectionName}`, async (req, res) => {
    try {
      const docRef = await db.collection(collectionName).add({
        ...req.body,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      res.json({ id: docRef.id, message: `${collectionName} item created successfully` });
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
        updatedAt: new Date().toISOString()
      };
      await db.collection(collectionName).doc(req.params.id).update(updateData);
      res.json({ message: `${collectionName} item updated successfully` });
    } catch (err) {
      console.error(`Error updating ${collectionName} item:`, err);
      res.status(500).json({ message: 'Server error' });
    }
  });

  // Delete item
  router.delete(`/${collectionName}/:id`, async (req, res) => {
    try {
      await db.collection(collectionName).doc(req.params.id).delete();
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
    const [usersSnapshot, coursesSnapshot, jobsSnapshot] = await Promise.all([
      db.collection('users').where('role', '==', 'student').get(),
      db.collection('courses').get(),
      db.collection('jobs').where('status', '==', 'active').get()
    ]);

    const stats = {
      totalStudents: usersSnapshot.size,
      totalCourses: coursesSnapshot.size,
      activeJobs: jobsSnapshot.size,
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
        const batchesSnapshot = await db.collection('batches')
            .where('course', '==', req.params.courseId)
            .get();
        
        const batches = [];
        batchesSnapshot.forEach(doc => {
            batches.push({ id: doc.id, ...doc.data() });
        });
        
        res.json(batches);
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
        
        // Create new batch in Firebase
        const batchData = {
            name,
            course,
            startDate: startDate || null,
            endDate: endDate || null,
            teacherId,
            teacherName: teacherName || '',
            status: status || 'active',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        const docRef = await db.collection('batches').add(batchData);
        
        res.status(201).json({
            success: true,
            message: 'Batch created successfully',
            id: docRef.id,
            ...batchData
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
        
        // Update batch in Firebase
        const updateData = {
          name,
          course,
          startDate: startDate || null,
          endDate: endDate || null,
          teacherId,
          teacherName: teacherName || '',
          status: status || 'active',
          updatedAt: new Date().toISOString()
        };
        
        await db.collection('batches').doc(req.params.id).update(updateData);
        
        res.json({
          success: true,
          message: 'Batch updated successfully',
          id: req.params.id,
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

        await db.collection('batches').doc(req.params.id).update({
          schedule,
          updatedAt: new Date().toISOString()
        });

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
        await db.collection('batches').doc(req.params.id).delete();
        
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
        const batchesSnapshot = await db.collection('batches').get();
        const batches = [];
        batchesSnapshot.forEach(doc => {
            batches.push({ id: doc.id, ...doc.data() });
        });
        
        res.json({ batches });
    } catch (error) {
        console.error('Error fetching batches:', error);
        res.status(500).json({ message: 'Error fetching batches' });
    }
});

module.exports = router;
