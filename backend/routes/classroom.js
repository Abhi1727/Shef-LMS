const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/auth');
const { roleAuth } = require('../middleware/roleAuth');
const classroomService = require('../services/classroomService');
const { logActivity } = require('../utils/activityLogger');
const Classroom = require('../models/Classroom');

// Content-Type mapping for proper file download headers
const contentTypes = {
  'pdf': 'application/pdf',
  'doc': 'application/msword',
  'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'txt': 'text/plain',
  'ppt': 'application/vnd.ms-powerpoint',
  'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'xls': 'application/vnd.ms-excel',
  'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'csv': 'text/csv',
  'zip': 'application/zip',
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'png': 'image/png',
  'gif': 'image/gif',
  'ipynb': 'application/json'
};

// Helper function to get content-type based on file extension
function getContentType(filename) {
  const fileExtension = path.extname(filename).toLowerCase().substring(1);
  return contentTypes[fileExtension] || 'application/octet-stream';
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

// @route   GET /api/classroom/:id/notes
// @desc    Download notes file for a classroom video
// @access  Private (Admin, Teacher, Student)
// NOTE: This route is defined first to avoid conflicts with other routes
router.get('/:id/notes', async (req, res) => {
  try {
    console.log('Download request received for video ID:', req.params.id);
    
    const { id } = req.params;
    
    // Use standard auth middleware for consistency
    const token = req.header('x-auth-token') || req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      console.log('No token provided for download request');
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    // Verify token
    const jwt = require('jsonwebtoken');
    const jwtSecret = process.env.JWT_SECRET || 'dev_only_fallback';
    
    try {
      const decoded = jwt.verify(token, jwtSecret);
      req.user = decoded.user;
      console.log('User authenticated for download:', req.user.email, 'Role:', req.user.role);
    } catch (err) {
      console.log('Invalid token for download:', err.message);
      return res.status(401).json({ message: 'Token is not valid' });
    }
    
    // Find the classroom video
    const video = await Classroom.findById(id).exec();
    if (!video) {
      console.log('Video not found for ID:', id);
      return res.status(404).json({ message: 'Video not found' });
    }
    
    console.log('Video found:', video.title, 'Notes available:', video.notesAvailable);
    
    // Check if notes are available
    if (!video.notesAvailable || !video.notesFilePath) {
      console.log('No notes available for video:', id);
      return res.status(404).json({ message: 'No notes available for this video' });
    }
    
    // Construct file path - handle both relative and absolute paths
    let notesPath;
    if (video.notesFilePath.startsWith('/')) {
      // Absolute path - remove leading slash and make relative to backend root
      notesPath = path.join(__dirname, '..', video.notesFilePath.substring(1));
    } else {
      // Relative path - make relative to backend root
      notesPath = path.join(__dirname, '..', video.notesFilePath);
    }
    
    console.log('Constructed notes path:', notesPath);
    
    // Security check - prevent directory traversal
    const normalizedPath = path.normalize(notesPath);
    const uploadsDir = path.normalize(path.join(__dirname, '..', 'uploads'));
    if (!normalizedPath.startsWith(uploadsDir)) {
      console.error('Security violation - path traversal attempt:', normalizedPath);
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Check if file exists
    if (!fs.existsSync(notesPath)) {
      console.error('Notes file not found:', notesPath);
      return res.status(404).json({ message: 'Notes file not found on server' });
    }
    
    // Get file stats
    const stats = fs.statSync(notesPath);
    console.log('File stats:', { size: stats.size, modified: stats.mtime });
    
    // Set appropriate headers
    const filename = video.notesFileName || path.basename(notesPath);
    const contentType = getContentType(filename);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    
    // Create read stream and pipe to response
    const fileStream = fs.createReadStream(notesPath);
    
    fileStream.on('error', (error) => {
      console.error('Error reading notes file:', error);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Error reading notes file' });
      }
    });
    
    fileStream.on('end', () => {
      console.log('Notes file downloaded successfully:', {
        videoId: id,
        filename: filename,
        size: stats.size,
        userId: req.user?.id
      });
    });
    
    // Pipe the file to the response
    fileStream.pipe(res);
    
  } catch (error) {
    console.error('Error downloading notes:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Failed to download notes' });
    }
  }
});

// Apply authentication middleware to all routes EXCEPT download endpoints
// Download endpoints will have their own auth logic to handle multiple auth methods
router.use((req, res, next) => {
  // Skip auth for download endpoints - they handle auth manually
  if (req.path.includes('/notes')) {
    return next();
  }
  // Apply auth to all other routes
  return auth(req, res, next);
});

// @route   POST /api/admin/classroom/upload
// @desc    Upload video + metadata to Firebase Storage
// @access  Private (Admin only)
router.post('/upload', roleAuth('admin'), upload.single('video'), async (req, res) => {
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

    // If batchId is provided, fetch and include batch name
    if (metadata.batchId) {
      try {
        const batchDoc = await db.collection('batches').doc(metadata.batchId).get();
        if (batchDoc.exists) {
          const batchData = batchDoc.data();
          metadata.batchName = batchData.name;
        }
      } catch (error) {
        console.error('Error fetching batch name:', error);
      }
    }

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

// @route   GET /api/classroom/:courseId
// @desc    List lectures visible to logged-in user
// @access  Private
router.get('/:courseId', async (req, res) => {
  try {
    const { courseId } = req.params;
    const user = req.user;

    if (!courseId) {
      return res.status(400).json({ message: 'Course ID is required' });
    }

    // Get accessible lectures for the user
    const lectures = await classroomService.getAccessibleLectures(user, courseId);

    // Return lecture metadata without storage paths
    const lectureList = lectures.map(lecture => ({
      id: lecture.id,
      title: lecture.title,
      description: lecture.description,
      courseId: lecture.courseId,
      batchId: lecture.batchId,
      domain: lecture.domain,
      duration: lecture.duration,
      uploadedBy: lecture.uploadedBy,
      createdAt: lecture.createdAt,
      videoSource: lecture.videoSource
    }));

    res.json({
      courseId,
      lectures: lectureList,
      total: lectureList.length
    });

  } catch (error) {
    console.error('Error fetching lectures:', error);
    res.status(500).json({ message: 'Failed to fetch lectures' });
  }
});

// @route   GET /api/classroom/play/:lectureId
// @desc    Validate access and return Firebase signed URL
// @access  Private
router.get('/play/:lectureId', async (req, res) => {
  try {
    const { lectureId } = req.params;
    const user = req.user;

    if (!lectureId) {
      return res.status(400).json({ message: 'Lecture ID is required' });
    }

    // Get lecture metadata
    const lecture = await classroomService.getLectureById(lectureId);

    // Verify lecture is Firebase Storage based
    if (lecture.videoSource !== 'firebase') {
      return res.status(400).json({ 
        message: 'This lecture is not available for streaming' 
      });
    }

    // Check user access permissions
    const accessibleLectures = await classroomService.getAccessibleLectures(user);
    const hasAccess = accessibleLectures.some(l => l.id === lectureId);

    if (!hasAccess) {
      return res.status(403).json({ 
        message: 'Access denied. You do not have permission to view this lecture' 
      });
    }

    // Generate signed URL for video playback (2 hours validity)
    const signedUrl = await classroomService.getSignedUrl(lecture.firebaseStoragePath);

    // Log video view
    try {
      await logActivity({
        action: 'video_view',
        userId: user.id,
        userName: user.name || '',
        userEmail: user.email || '',
        userRole: user.role || 'student',
        videoId: lectureId,
            videoTitle: lecture.title || null,
            req
      });
    } catch (logErr) {
      console.warn('ActivityLog video_view failed:', logErr.message);
    }

    res.json({
      lectureId: lecture.id,
      title: lecture.title,
      description: lecture.description,
      duration: lecture.duration,
      signedUrl: signedUrl,
      expiresAt: new Date(Date.now() + (2 * 60 * 60 * 1000)).toISOString() // 2 hours from now
    });

  } catch (error) {
    console.error('Error generating video URL:', error);
    
    if (error.message === 'Lecture not found') {
      return res.status(404).json({ message: 'Lecture not found' });
    }
    
    if (error.message === 'Video file not found in storage') {
      return res.status(404).json({ message: 'Video file not available' });
    }
    
    res.status(500).json({ message: 'Failed to generate video access URL' });
  }
});

// @route   DELETE /api/admin/classroom/:lectureId
// @desc    Delete lecture (both storage and metadata)
// @access  Private (Admin only)
router.delete('/:lectureId', roleAuth('admin'), async (req, res) => {
  try {
    const { lectureId } = req.params;

    if (!lectureId) {
      return res.status(400).json({ message: 'Lecture ID is required' });
    }

    // Get lecture metadata
    const lecture = await classroomService.getLectureById(lectureId);

    // Delete video from Firebase Storage
    if (lecture.firebaseStoragePath) {
      await classroomService.deleteVideo(lecture.firebaseStoragePath);
    }

    // Delete lecture metadata from Firestore
    await classroomService.deleteLectureMetadata(lectureId);

    res.json({ message: 'Lecture deleted successfully' });

  } catch (error) {
    console.error('Error deleting lecture:', error);
    
    if (error.message === 'Lecture not found') {
      return res.status(404).json({ message: 'Lecture not found' });
    }
    
    res.status(500).json({ message: 'Failed to delete lecture' });
  }
});

// @route   POST /api/admin/classroom/youtube-url
// @desc    Add lecture with manual YouTube URL
// @access  Private (Admin only)
router.post('/youtube-url', roleAuth('admin'), async (req, res) => {
  try {
    const { title, instructor, description, course, batchId, domain, duration, youtubeVideoUrl, youtubeVideoId, youtubeEmbedUrl, type, date } = req.body;

    // Validate required fields
    if (!title || !course || !youtubeVideoUrl) {
      return res.status(400).json({ 
        message: 'Title, course, and YouTube URL are required' 
      });
    }

    // Prepare lecture data
    const lectureData = {
      title: title.trim(),
      instructor: instructor?.trim() || '',
      description: description?.trim() || '',
      course: course.trim(),
      batchId: batchId?.trim() || '',
      domain: domain?.trim() || '',
      duration: duration?.trim() || '',
      type: type?.trim() || 'Lecture',
      date: date?.trim() || new Date().toISOString().split('T')[0],
      videoSource: 'youtube-url',
      youtubeVideoId: youtubeVideoId?.trim() || '',
      youtubeVideoUrl: youtubeVideoUrl?.trim() || '',
      youtubeEmbedUrl: youtubeEmbedUrl?.trim() || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // If batchId is provided, fetch and include batch name
    if (lectureData.batchId) {
      try {
        const batchDoc = await db.collection('batches').doc(lectureData.batchId).get();
        if (batchDoc.exists) {
          const batchData = batchDoc.data();
          lectureData.batchName = batchData.name;
        }
      } catch (error) {
        console.error('Error fetching batch name:', error);
      }
    }

    // Save lecture metadata to Firestore
    const docRef = await db.collection('classroom').add(lectureData);

    res.status(201).json({
      success: true,
      message: 'YouTube video lecture added successfully',
      lectureId: docRef.id,
      ...lectureData
    });

  } catch (error) {
    console.error('Error adding YouTube URL lecture:', error);
    res.status(500).json({ message: 'Failed to add YouTube video lecture' });
  }
});

// Error handling middleware for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'Video file size exceeds 2GB limit' });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ message: 'Unexpected file field' });
    }
  }
  
  if (error.message === 'Only video files are allowed') {
    return res.status(400).json({ message: error.message });
  }
  
  next(error);
});

// @route   GET /api/classroom/notes/:id
// @desc    Alternative endpoint for downloading notes
// @access  Private (Admin, Teacher, Student)
router.get('/notes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Use standard auth for consistency
    const token = req.header('x-auth-token') || req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    // Verify token
    const jwt = require('jsonwebtoken');
    const jwtSecret = process.env.JWT_SECRET || 'dev_only_fallback';
    
    try {
      const decoded = jwt.verify(token, jwtSecret);
      req.user = decoded.user;
    } catch (err) {
      return res.status(401).json({ message: 'Token is not valid' });
    }
    
    // Find the classroom video
    const video = await Classroom.findById(id).exec();
    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }
    
    // Check if notes are available
    if (!video.notesAvailable || !video.notesFilePath) {
      return res.status(404).json({ message: 'No notes available for this video' });
    }
    
    // Construct file path - handle both relative and absolute paths
    let notesPath;
    if (video.notesFilePath.startsWith('/')) {
      // Absolute path - remove leading slash and make relative to backend root
      notesPath = path.join(__dirname, '..', video.notesFilePath.substring(1));
    } else {
      // Relative path - make relative to backend root
      notesPath = path.join(__dirname, '..', video.notesFilePath);
    }
    
    // Security check - prevent directory traversal
    const normalizedPath = path.normalize(notesPath);
    const uploadsDir = path.normalize(path.join(__dirname, '..', 'uploads'));
    if (!normalizedPath.startsWith(uploadsDir)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Check if file exists
    if (!fs.existsSync(notesPath)) {
      return res.status(404).json({ message: 'Notes file not found on server' });
    }
    
    // Get file stats
    const stats = fs.statSync(notesPath);
    
    // Set appropriate headers
    const filename = video.notesFileName || path.basename(notesPath);
    const contentType = getContentType(filename);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    
    // Create read stream and pipe to response
    const fileStream = fs.createReadStream(notesPath);
    fileStream.pipe(res);
    
  } catch (error) {
    console.error('Error downloading notes (alternative endpoint):', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Failed to download notes' });
    }
  }
});

module.exports = router;
