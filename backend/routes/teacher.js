const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const { isTeacher } = require('../middleware/roleAuth');
const multer = require('multer');
const Batch = require('../models/Batch');
const User = require('../models/User');
const Classroom = require('../models/Classroom');
const classroomService = require('../services/classroomService');
const { logActivity } = require('../utils/activityLogger');
const {
  verifyCourseOwnership,
  verifyModuleOwnership,
  verifyLessonOwnership,
  verifyProjectOwnership,
  verifyAssessmentOwnership
} = require('../middleware/teacherOwnership');
const {
  validateVideoUpdate,
  validateNotesUpload,
  validateBatchData,
  validateObjectId,
  rateLimit
} = require('../middleware/teacherValidation');

// Apply auth to all teacher routes
router.use(isTeacher);

// ----- MongoDB-backed teacher routes -----

// @route   GET /api/teacher/courses
// @desc    Get teacher's batches as course-like cards
// @access  Teacher only
router.get('/courses', async (req, res) => {
  try {
    const teacherId = String(req.user.id);
    const batches = await Batch.find({ teacherId }).lean().exec();
    const courses = batches.map(b => ({
      id: String(b._id),
      title: `${b.course || 'Course'} - ${b.name || 'Batch'}`,
      description: b.name,
      modules: 0,
      enrollmentCount: (b.students || []).length,
      course: b.course,
      batchId: String(b._id)
    }));
    res.json({ success: true, courses });
  } catch (error) {
    console.error('Error fetching teacher courses:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch courses' });
  }
});

// @route   GET /api/teacher/batches
// @desc    Get teacher's batches with students populated
// @access  Teacher only
router.get('/batches', async (req, res) => {
  try {
    const teacherId = String(req.user.id);
    const { courseId } = req.query;
    let query = { teacherId };
    if (courseId) {
      const batch = await Batch.findById(courseId).lean().exec();
      if (batch && String(batch.teacherId) === teacherId && batch.course) {
        query.course = batch.course;
      }
    }
    const batches = await Batch.find(query)
      .populate('students', 'name email enrollmentNumber course status')
      .lean()
      .exec();
    const result = batches.map(b => ({
      id: String(b._id),
      ...b,
      studentsList: (b.students || []).map(s => ({
        id: String(s._id),
        name: s.name,
        email: s.email,
        enrollmentNumber: s.enrollmentNumber,
        course: s.course,
        status: s.status
      })),
      studentCount: (b.students || []).length
    }));
    res.json({ success: true, batches: result });
  } catch (error) {
    console.error('Error fetching teacher batches:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch batches' });
  }
});

// @route   GET /api/teacher/classroom/:batchId
// @desc    Get lectures for a batch (teacher's batches only)
// @access  Teacher only
router.get('/classroom/:batchId', async (req, res) => {
  try {
    const { batchId } = req.params;
    const teacherId = String(req.user.id);
    const batch = await Batch.findById(batchId).lean().exec();
    if (!batch || String(batch.teacherId) !== teacherId) {
      return res.status(404).json({ message: 'Batch not found' });
    }
    const lectures = await Classroom.find({
      batchId: String(batchId)
    })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    const list = lectures.map(l => ({
      id: String(l._id),
      title: l.title,
      description: l.description,
      courseId: l.courseId || batchId,
      batchId: l.batchId,
      domain: l.domain,
      duration: l.duration,
      course: l.course,
      youtubeVideoId: l.youtubeVideoId,
      youtubeVideoUrl: l.youtubeVideoUrl,
      youtubeEmbedUrl: l.youtubeEmbedUrl,
      videoSource: l.videoSource,
      createdAt: l.createdAt,
      fileInfo: l.fileInfo
    }));
    res.json({ courseId: batchId, lectures: list, total: list.length });
  } catch (error) {
    console.error('Error fetching teacher classroom:', error);
    res.status(500).json({ message: 'Failed to fetch lectures' });
  }
});

// @route   GET /api/teacher/batches/:id
// @desc    Get single batch with students and notes
// @access  Teacher only
router.get('/batches/:id', async (req, res) => {
  try {
    const batchId = req.params.id;
    const teacherId = String(req.user.id);
    const batch = await Batch.findById(batchId)
      .populate('students', 'name email enrollmentNumber course status')
      .lean()
      .exec();
    if (!batch || String(batch.teacherId) !== teacherId) {
      return res.status(404).json({ message: 'Batch not found' });
    }
    const result = {
      id: String(batch._id),
      ...batch,
      studentsList: (batch.students || []).map(s => ({
        id: String(s._id),
        name: s.name,
        email: s.email,
        enrollmentNumber: s.enrollmentNumber,
        course: s.course,
        status: s.status
      })),
      studentCount: (batch.students || []).length
    };
    res.json({ success: true, batch: result });
  } catch (error) {
    console.error('Error fetching batch:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch batch' });
  }
});

// @route   PUT /api/teacher/batches/:id/notes
// @desc    Update teacher notes for a batch
// @access  Teacher only
router.put('/batches/:id/notes', async (req, res) => {
  try {
    const batchId = req.params.id;
    const { teacherNotes } = req.body;
    const teacherId = String(req.user.id);
    const batch = await Batch.findById(batchId).exec();
    if (!batch || String(batch.teacherId) !== teacherId) {
      return res.status(404).json({ message: 'Batch not found' });
    }
    batch.teacherNotes = teacherNotes != null ? String(teacherNotes) : batch.teacherNotes;
    batch.updatedAt = new Date();
    await batch.save();
    res.json({ success: true, teacherNotes: batch.teacherNotes });
  } catch (error) {
    console.error('Error updating batch notes:', error);
    res.status(500).json({ success: false, message: 'Failed to update notes' });
  }
});

// Extract YouTube video ID from URL
function extractYouTubeVideoId(url) {
  if (!url || typeof url !== 'string') return null;
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

// @route   POST /api/teacher/classroom/youtube-url
// @desc    Add lecture via YouTube URL (JSON body)
// @access  Teacher only
router.post('/classroom/youtube-url', async (req, res) => {
  try {
    const { title, description, courseId, batchId, domain, duration, youtubeUrl } = req.body;
    const teacherId = String(req.user.id);

    if (!title || !youtubeUrl) {
      return res.status(400).json({ message: 'Title and YouTube URL are required' });
    }

    const videoId = extractYouTubeVideoId(youtubeUrl);
    if (!videoId) {
      return res.status(400).json({ message: 'Invalid YouTube URL. Use format: https://www.youtube.com/watch?v=... or https://youtu.be/...' });
    }

    const youtubeVideoUrl = youtubeUrl.trim();
    const youtubeEmbedUrl = `https://www.youtube.com/embed/${videoId}`;

    let batch = null;
    let resolvedCourse = '';
    const batchIdNorm = (batchId || courseId || '').trim();
    if (batchIdNorm) {
      batch = await Batch.findById(batchIdNorm).lean().exec();
      if (!batch || String(batch.teacherId) !== teacherId) {
        return res.status(403).json({ message: 'Batch not found or access denied' });
      }
      resolvedCourse = batch.course || batchIdNorm;
    }

    if (batchIdNorm) {
      const existing = await Classroom.findOne({
        youtubeVideoId: videoId,
        batchId: batchIdNorm
      }).lean().exec();
      if (existing) {
        return res.status(400).json({ message: 'This video is already assigned to this batch.' });
      }
    }

    const lectureData = {
      title: title.trim(),
      description: (description || '').trim(),
      courseId: batchIdNorm || null,
      course: resolvedCourse,
      batchId: batchIdNorm || null,
      domain: (domain || '').trim() || null,
      duration: (duration || '').trim() || null,
      videoSource: 'youtube-url',
      youtubeVideoId: videoId,
      youtubeVideoUrl,
      youtubeEmbedUrl,
      uploadedBy: teacherId
    };

    const doc = new Classroom(lectureData);
    await doc.save();

    res.status(201).json({
      message: 'Lecture added successfully',
      lecture: {
        id: String(doc._id),
        title: lectureData.title,
        description: lectureData.description,
        courseId: lectureData.courseId,
        batchId: lectureData.batchId,
        domain: lectureData.domain,
        duration: lectureData.duration,
        youtubeVideoUrl: lectureData.youtubeVideoUrl,
        youtubeEmbedUrl: lectureData.youtubeEmbedUrl,
        createdAt: doc.createdAt
      }
    });
  } catch (error) {
    console.error('Error adding YouTube lecture:', error);
    res.status(500).json({ message: 'Failed to add lecture: ' + (error.message || 'Unknown error') });
  }
});

// @route   DELETE /api/teacher/classroom/:lectureId
// @desc    Delete a lecture (teacher must own the batch)
// @access  Teacher only
router.delete('/classroom/:lectureId', async (req, res) => {
  try {
    const { lectureId } = req.params;
    const teacherId = String(req.user.id);

    const lecture = await classroomService.getLectureById(lectureId);
    if (!lecture) {
      return res.status(404).json({ message: 'Lecture not found' });
    }

    if (lecture.batchId) {
      const batch = await Batch.findById(lecture.batchId).lean().exec();
      if (!batch || String(batch.teacherId) !== teacherId) {
        return res.status(403).json({ message: 'You can only delete lectures for your own batches' });
      }
    } else if (lecture.course) {
      const batch = await Batch.findOne({ teacherId, course: lecture.course }).lean().exec();
      if (!batch) {
        return res.status(403).json({ message: 'You can only delete lectures for your own batches' });
      }
    } else {
      return res.status(403).json({ message: 'Lecture not associated with your batch' });
    }

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

// @route   DELETE /api/teacher/batches/:id
// @desc    Delete batch (teacher can only delete own batches - admin functionality)
// @access  Teacher only - ownership verified
router.delete('/batches/:id', async (req, res) => {
  try {
    const batchId = req.params.id;
    const teacherId = String(req.user.id);
    const batch = await Batch.findById(batchId).exec();
    if (!batch) return res.status(404).json({ message: 'Batch not found' });
    if (String(batch.teacherId) !== teacherId) {
      return res.status(403).json({ message: 'You can only delete your own batches' });
    }
    await Batch.findByIdAndDelete(batchId).exec();
    res.json({ success: true, message: 'Batch deleted successfully' });
  } catch (error) {
    console.error('Error deleting batch:', error);
    res.status(500).json({ success: false, message: 'Failed to delete batch' });
  }
});

// Multer for teacher notes uploads
const NOTES_MAX_FILE_SIZE = 10 * 1024 * 1024;
const teacherNotesStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const notesDir = path.join(__dirname, '..', 'uploads', 'teacher-notes');
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

const teacherNotesUpload = multer({
  storage: teacherNotesStorage,
  limits: {
    fileSize: NOTES_MAX_FILE_SIZE,
  },
  fileFilter: (req, file, cb) => {
    // Allow common document types, presentations, spreadsheets, images, and zip files
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'application/zip',
      'application/x-zip-compressed',
      'application/octet-stream',
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/json' // For .ipynb files
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only document files (PDF, Word, PowerPoint, Excel, CSV, text), images, Jupyter notebooks, and zip files are allowed'), false);
    }
  }
});

// Multer (kept for potential future use)
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

// Legacy: use POST /classroom/youtube-url for adding lectures
router.post('/classroom/upload', (req, res) => {
  res.status(410).json({ message: 'Use POST /api/teacher/classroom/youtube-url with a YouTube URL instead.' });
});

// Legacy: use POST /classroom/youtube-url instead
router.post('/classroom/youtube-upload', (req, res) => {
  res.status(410).json({ message: 'Use POST /api/teacher/classroom/youtube-url with a YouTube URL.' });
});
// GET /classroom/:batchId is defined above - handles teacher lectures

// (GET /classroom/:batchId and DELETE /classroom/:lectureId defined above)

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

// @route   GET /api/teacher/dashboard
// @desc    Get teacher dashboard data
// @access  Teacher only
router.get('/dashboard', async (req, res) => {
  try {
    const teacherId = req.user.id;

    // Get teacher's courses
    const teacherDoc = await db.collection('users').doc(teacherId).get();
    const teacherData = teacherDoc.data();
    const assignedCourses = teacherData.assignedCourses || [];

    // Get teacher's batches
    const batchesSnapshot = await db.collection('batches')
      .where('teacherId', '==', teacherId)
      .get();

    const batches = [];
    batchesSnapshot.forEach(doc => {
      batches.push({ id: doc.id, ...doc.data() });
    });

    // Get students count for teacher's batches
    let totalStudents = 0;
    batches.forEach(batch => {
      totalStudents += batch.students?.length || 0;
    });

    // Get upcoming classes
    const classesSnapshot = await db.collection('liveClasses')
      .where('teacherId', '==', teacherId)
      .where('status', '==', 'scheduled')
      .get();

    const upcomingClasses = [];
    classesSnapshot.forEach(doc => {
      upcomingClasses.push({ id: doc.id, ...doc.data() });
    });

    res.json({
      success: true,
      data: {
        teacher: {
          id: teacherId,
          name: teacherData.name,
          email: teacherData.email,
          assignedCourses
        },
        batches,
        totalStudents,
        upcomingClasses: upcomingClasses.length,
        stats: {
          totalBatches: batches.length,
          totalStudents,
          totalClasses: upcomingClasses.length
        }
      }
    });
  } catch (error) {
    console.error('Error fetching teacher dashboard:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to load dashboard' 
    });
  }
});

// @route   GET /api/teacher/batches
// @desc    Get all batches assigned to teacher
// @access  Teacher only
router.get('/batches', async (req, res) => {
  try {
    const teacherId = req.user.id;

    const batchesSnapshot = await db.collection('batches')
      .where('teacherId', '==', teacherId)
      .get();

    const batches = [];
    for (const doc of batchesSnapshot.docs) {
      const batchData = { id: doc.id, ...doc.data() };
      
      // Get students for this batch
      if (batchData.students && batchData.students.length > 0) {
        const studentsPromises = batchData.students.map(studentId => 
          db.collection('users').doc(studentId).get()
        );
        const studentsSnapshots = await Promise.all(studentsPromises);
        batchData.studentsList = studentsSnapshots
          .filter(snap => snap.exists)
          .map(snap => ({
            id: snap.id,
            ...snap.data(),
            password: undefined // Don't send passwords
          }));
      }

      batches.push(batchData);
    }

    res.json({
      success: true,
      batches
    });
  } catch (error) {
    console.error('Error fetching batches:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch batches' 
    });
  }
});

// @route   GET /api/teacher/students
// @desc    Get all students in teacher's batches
// @access  Teacher only
router.get('/students', async (req, res) => {
  try {
    const teacherId = req.user.id;

    // Get teacher's batches
    const batchesSnapshot = await db.collection('batches')
      .where('teacherId', '==', teacherId)
      .get();

    const studentIds = new Set();
    batchesSnapshot.forEach(doc => {
      const batch = doc.data();
      if (batch.students) {
        batch.students.forEach(id => studentIds.add(id));
      }
    });

    // Get student details
    const students = [];
    for (const studentId of studentIds) {
      const studentDoc = await db.collection('users').doc(studentId).get();
      if (studentDoc.exists) {
        const studentData = studentDoc.data();
        students.push({
          id: studentDoc.id,
          name: studentData.name,
          email: studentData.email,
          enrollmentNumber: studentData.enrollmentNumber,
          currentCourse: studentData.currentCourse,
          batchId: studentData.batchId,
          status: studentData.status
        });
      }
    }

    res.json({
      success: true,
      students
    });
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch students' 
    });
  }
});

// @route   POST /api/teacher/class
// @desc    Create a live class (with Zoom)
// @access  Teacher only
router.post('/class', async (req, res) => {
  try {
    const { title, batchId, scheduledDate, scheduledTime, duration, description } = req.body;
    const teacherId = req.user.id;
    const teacherName = req.user.name;

    // Validate required fields
    if (!title || !batchId || !scheduledDate || !scheduledTime) {
      return res.status(400).json({ 
        success: false, 
        message: 'Title, batch, date, and time are required' 
      });
    }

    // Get batch details
    const batchDoc = await db.collection('batches').doc(batchId).get();
    if (!batchDoc.exists) {
      return res.status(404).json({ 
        success: false, 
        message: 'Batch not found' 
      });
    }

    const batchData = batchDoc.data();

    // Verify teacher owns this batch
    if (batchData.teacherId !== teacherId) {
      return res.status(403).json({ 
        success: false, 
        message: 'You do not have permission to create classes for this batch' 
      });
    }

    // Create Zoom meeting
    const startTime = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
    const durationMinutes = parseInt(duration) || 60;

    const zoomResult = await zoomService.createMeeting({
      topic: title,
      startTime: startTime,
      duration: durationMinutes,
      agenda: description || '',
      timezone: 'Asia/Kolkata'
    });

    if (!zoomResult.success) {
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to create Zoom meeting' 
      });
    }

    // Create live class document
    const classData = {
      title,
      course: batchData.course,
      batchId,
      batchName: batchData.name,
      teacherId,
      teacherName,
      instructor: teacherName,
      zoomMeetingId: zoomResult.meeting.id,
      joinUrl: zoomResult.meeting.joinUrl,
      startUrl: zoomResult.meeting.startUrl,
      password: zoomResult.meeting.password,
      scheduledDate,
      scheduledTime,
      date: scheduledDate, // for compatibility
      time: scheduledTime, // for compatibility
      duration: `${durationMinutes} min`,
      description: description || '',
      status: 'scheduled',
      enrolledStudents: batchData.students || [],
      attendedStudents: [],
      students: batchData.students?.length || 0,
      createdBy: teacherId,
      createdAt: new Date().toISOString()
    };

    const classRef = await db.collection('liveClasses').add(classData);

    res.json({
      success: true,
      message: 'Live class created successfully',
      class: {
        id: classRef.id,
        ...classData
      }
    });
  } catch (error) {
    console.error('Error creating class:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to create class' 
    });
  }
});

// @route   GET /api/teacher/classes
// @desc    Get all classes created by teacher
// @access  Teacher only
router.get('/classes', async (req, res) => {
  try {
    const teacherId = req.user.id;

    const classesSnapshot = await db.collection('liveClasses')
      .where('teacherId', '==', teacherId)
      .get();

    const classes = [];
    classesSnapshot.forEach(doc => {
      classes.push({ id: doc.id, ...doc.data() });
    });

    // Sort by date
    classes.sort((a, b) => {
      const dateA = new Date(`${a.scheduledDate} ${a.scheduledTime}`);
      const dateB = new Date(`${b.scheduledDate} ${b.scheduledTime}`);
      return dateB - dateA;
    });

    res.json({
      success: true,
      classes
    });
  } catch (error) {
    console.error('Error fetching classes:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch classes' 
    });
  }
});

// @route   DELETE /api/teacher/class/:id
// @desc    Delete a class
// @access  Teacher only
router.delete('/class/:id', async (req, res) => {
  try {
    const classId = req.params.id;
    const teacherId = req.user.id;

    const classDoc = await db.collection('liveClasses').doc(classId).get();
    
    if (!classDoc.exists) {
      return res.status(404).json({ 
        success: false, 
        message: 'Class not found' 
      });
    }

    const classData = classDoc.data();

    // Verify teacher owns this class
    if (classData.teacherId !== teacherId) {
      return res.status(403).json({ 
        success: false, 
        message: 'You do not have permission to delete this class' 
      });
    }

    // Delete from Zoom if meeting ID exists
    if (classData.zoomMeetingId) {
      try {
        await zoomService.deleteMeeting(classData.zoomMeetingId);
      } catch (error) {
        console.log('Could not delete from Zoom:', error.message);
      }
    }

    // Delete from Firestore
    await db.collection('liveClasses').doc(classId).delete();

    res.json({
      success: true,
      message: 'Class deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting class:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete class' 
    });
  }
});

// @route   PUT /api/teacher/class/:id
// @desc    Update a live class (reschedule, etc.)
router.put('/class/:id', async (req, res) => {
  try {
    const classDoc = await db.collection('liveClasses').doc(req.params.id).get();
    if (!classDoc.exists) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }
    const classData = classDoc.data();
    if (classData.teacherId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'You do not have permission to update this class' });
    }
    const { scheduledDate, scheduledTime, duration, title, description } = req.body;
    const updateData = { updatedAt: new Date().toISOString() };
    if (scheduledDate) updateData.scheduledDate = scheduledDate;
    if (scheduledTime) updateData.scheduledTime = scheduledTime;
    if (duration) updateData.duration = duration;
    if (title) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (classData.zoomMeetingId && (scheduledDate || scheduledTime || duration)) {
      const startTime = new Date(`${scheduledDate || classData.scheduledDate}T${scheduledTime || classData.scheduledTime}`).toISOString();
      await zoomService.updateMeeting(classData.zoomMeetingId, {
        start_time: startTime,
        duration: parseInt(duration || classData.duration) || 60,
        topic: title || classData.title,
        agenda: description !== undefined ? description : classData.description
      });
    }
    await db.collection('liveClasses').doc(req.params.id).update(updateData);
    res.json({ success: true, message: 'Class updated successfully' });
  } catch (error) {
    console.error('Error updating class:', error);
    res.status(500).json({ success: false, message: 'Failed to update class' });
  }
});

// @route   GET /api/teacher/class/:id/start
router.get('/class/:id/start', async (req, res) => {
  try {
    const classDoc = await db.collection('liveClasses').doc(req.params.id).get();
    if (!classDoc.exists) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }
    const classData = classDoc.data();
    if (classData.teacherId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'You do not have permission to start this class' });
    }
    res.json({
      success: true,
      startUrl: classData.startUrl,
      joinUrl: classData.joinUrl,
      password: classData.password,
      title: classData.title
    });
  } catch (error) {
    console.error('Error getting start URL:', error);
    res.status(500).json({ success: false, message: 'Failed to get start URL' });
  }
});

// ==================== COURSES ====================
router.get('/courses', async (req, res) => {
  try {
    const snapshot = await db.collection('courses').where('teacherId', '==', req.user.id).get();
    const courses = [];
    snapshot.forEach(doc => courses.push({ id: doc.id, ...doc.data() }));
    res.json({ success: true, courses });
  } catch (error) {
    console.error('Error fetching courses:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch courses' });
  }
});

router.post('/courses', async (req, res) => {
  try {
    const teacherDoc = await db.collection('users').doc(req.user.id).get();
    const teacherData = teacherDoc.data();
    const domain = teacherData.domain || req.body.domain || 'General';
    const courseData = {
      ...req.body,
      teacherId: req.user.id,
      domain,
      status: req.body.status || 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const docRef = await db.collection('courses').add(courseData);
    res.json({ success: true, course: { id: docRef.id, ...courseData } });
  } catch (error) {
    console.error('Error creating course:', error);
    res.status(500).json({ success: false, message: 'Failed to create course' });
  }
});

router.put('/courses/:id', async (req, res) => {
  try {
    const result = await verifyCourseOwnership(req.user.id, req.params.id);
    if (!result.allowed) return res.status(403).json({ success: false, message: result.error });
    const updateData = { ...req.body, updatedAt: new Date().toISOString() };
    delete updateData.teacherId;
    await db.collection('courses').doc(req.params.id).update(updateData);
    res.json({ success: true, message: 'Course updated successfully' });
  } catch (error) {
    console.error('Error updating course:', error);
    res.status(500).json({ success: false, message: 'Failed to update course' });
  }
});

router.delete('/courses/:id', async (req, res) => {
  try {
    const result = await verifyCourseOwnership(req.user.id, req.params.id);
    if (!result.allowed) return res.status(403).json({ success: false, message: result.error });
    await db.collection('courses').doc(req.params.id).delete();
    res.json({ success: true, message: 'Course deleted successfully' });
  } catch (error) {
    console.error('Error deleting course:', error);
    res.status(500).json({ success: false, message: 'Failed to delete course' });
  }
});

// ==================== MODULES ====================
router.get('/courses/:courseId/modules', async (req, res) => {
  try {
    const result = await verifyCourseOwnership(req.user.id, req.params.courseId);
    if (!result.allowed) return res.status(403).json({ success: false, message: result.error });
    const snapshot = await db.collection('modules').where('courseId', '==', req.params.courseId).get();
    const modules = [];
    snapshot.forEach(doc => modules.push({ id: doc.id, ...doc.data() }));
    modules.sort((a, b) => (a.order || 0) - (b.order || 0));
    res.json({ success: true, modules });
  } catch (error) {
    console.error('Error fetching modules:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch modules' });
  }
});

router.post('/courses/:courseId/modules', async (req, res) => {
  try {
    const result = await verifyCourseOwnership(req.user.id, req.params.courseId);
    if (!result.allowed) return res.status(403).json({ success: false, message: result.error });
    const moduleData = { ...req.body, courseId: req.params.courseId, status: req.body.status || 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    const docRef = await db.collection('modules').add(moduleData);
    res.json({ success: true, module: { id: docRef.id, ...moduleData } });
  } catch (error) {
    console.error('Error creating module:', error);
    res.status(500).json({ success: false, message: 'Failed to create module' });
  }
});

router.put('/modules/:id', async (req, res) => {
  try {
    const result = await verifyModuleOwnership(req.user.id, req.params.id);
    if (!result.allowed) return res.status(403).json({ success: false, message: result.error });
    const updateData = { ...req.body, updatedAt: new Date().toISOString() };
    delete updateData.courseId;
    await db.collection('modules').doc(req.params.id).update(updateData);
    res.json({ success: true, message: 'Module updated successfully' });
  } catch (error) {
    console.error('Error updating module:', error);
    res.status(500).json({ success: false, message: 'Failed to update module' });
  }
});

router.delete('/modules/:id', async (req, res) => {
  try {
    const result = await verifyModuleOwnership(req.user.id, req.params.id);
    if (!result.allowed) return res.status(403).json({ success: false, message: result.error });
    await db.collection('modules').doc(req.params.id).delete();
    res.json({ success: true, message: 'Module deleted successfully' });
  } catch (error) {
    console.error('Error deleting module:', error);
    res.status(500).json({ success: false, message: 'Failed to delete module' });
  }
});

// ==================== LESSONS ====================
router.get('/modules/:moduleId/lessons', async (req, res) => {
  try {
    const result = await verifyModuleOwnership(req.user.id, req.params.moduleId);
    if (!result.allowed) return res.status(403).json({ success: false, message: result.error });
    const snapshot = await db.collection('lessons').where('moduleId', '==', req.params.moduleId).get();
    const lessons = [];
    snapshot.forEach(doc => lessons.push({ id: doc.id, ...doc.data() }));
    lessons.sort((a, b) => (a.order || 0) - (b.order || 0));
    res.json({ success: true, lessons });
  } catch (error) {
    console.error('Error fetching lessons:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch lessons' });
  }
});

router.post('/modules/:moduleId/lessons', async (req, res) => {
  try {
    const result = await verifyModuleOwnership(req.user.id, req.params.moduleId);
    if (!result.allowed) return res.status(403).json({ success: false, message: result.error });
    const lessonData = { ...req.body, moduleId: req.params.moduleId, status: req.body.status || 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    const docRef = await db.collection('lessons').add(lessonData);
    res.json({ success: true, lesson: { id: docRef.id, ...lessonData } });
  } catch (error) {
    console.error('Error creating lesson:', error);
    res.status(500).json({ success: false, message: 'Failed to create lesson' });
  }
});

router.put('/lessons/:id', async (req, res) => {
  try {
    const result = await verifyLessonOwnership(req.user.id, req.params.id);
    if (!result.allowed) return res.status(403).json({ success: false, message: result.error });
    const updateData = { ...req.body, updatedAt: new Date().toISOString() };
    delete updateData.moduleId;
    await db.collection('lessons').doc(req.params.id).update(updateData);
    res.json({ success: true, message: 'Lesson updated successfully' });
  } catch (error) {
    console.error('Error updating lesson:', error);
    res.status(500).json({ success: false, message: 'Failed to update lesson' });
  }
});

router.delete('/lessons/:id', async (req, res) => {
  try {
    const result = await verifyLessonOwnership(req.user.id, req.params.id);
    if (!result.allowed) return res.status(403).json({ success: false, message: result.error });
    await db.collection('lessons').doc(req.params.id).delete();
    res.json({ success: true, message: 'Lesson deleted successfully' });
  } catch (error) {
    console.error('Error deleting lesson:', error);
    res.status(500).json({ success: false, message: 'Failed to delete lesson' });
  }
});

// ==================== PROJECTS ====================
router.get('/courses/:courseId/projects', async (req, res) => {
  try {
    const result = await verifyCourseOwnership(req.user.id, req.params.courseId);
    if (!result.allowed) return res.status(403).json({ success: false, message: result.error });
    const snapshot = await db.collection('projects').where('courseId', '==', req.params.courseId).get();
    const projects = [];
    snapshot.forEach(doc => projects.push({ id: doc.id, ...doc.data() }));
    res.json({ success: true, projects });
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch projects' });
  }
});

router.post('/courses/:courseId/projects', async (req, res) => {
  try {
    const result = await verifyCourseOwnership(req.user.id, req.params.courseId);
    if (!result.allowed) return res.status(403).json({ success: false, message: result.error });
    const projectData = { ...req.body, courseId: req.params.courseId, status: req.body.status || 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    const docRef = await db.collection('projects').add(projectData);
    res.json({ success: true, project: { id: docRef.id, ...projectData } });
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ success: false, message: 'Failed to create project' });
  }
});

router.put('/projects/:id', async (req, res) => {
  try {
    const result = await verifyProjectOwnership(req.user.id, req.params.id);
    if (!result.allowed) return res.status(403).json({ success: false, message: result.error });
    const updateData = { ...req.body, updatedAt: new Date().toISOString() };
    delete updateData.courseId;
    await db.collection('projects').doc(req.params.id).update(updateData);
    res.json({ success: true, message: 'Project updated successfully' });
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ success: false, message: 'Failed to update project' });
  }
});

router.delete('/projects/:id', async (req, res) => {
  try {
    const result = await verifyProjectOwnership(req.user.id, req.params.id);
    if (!result.allowed) return res.status(403).json({ success: false, message: result.error });
    await db.collection('projects').doc(req.params.id).delete();
    res.json({ success: true, message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ success: false, message: 'Failed to delete project' });
  }
});

// ==================== ASSESSMENTS ====================
router.get('/courses/:courseId/assessments', async (req, res) => {
  try {
    const result = await verifyCourseOwnership(req.user.id, req.params.courseId);
    if (!result.allowed) return res.status(403).json({ success: false, message: result.error });
    const snapshot = await db.collection('assessments').where('courseId', '==', req.params.courseId).get();
    const assessments = [];
    snapshot.forEach(doc => assessments.push({ id: doc.id, ...doc.data() }));
    res.json({ success: true, assessments });
  } catch (error) {
    console.error('Error fetching assessments:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch assessments' });
  }
});

router.post('/courses/:courseId/assessments', async (req, res) => {
  try {
    const result = await verifyCourseOwnership(req.user.id, req.params.courseId);
    if (!result.allowed) return res.status(403).json({ success: false, message: result.error });
    const assessmentData = { ...req.body, courseId: req.params.courseId, status: req.body.status || 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    const docRef = await db.collection('assessments').add(assessmentData);
    res.json({ success: true, assessment: { id: docRef.id, ...assessmentData } });
  } catch (error) {
    console.error('Error creating assessment:', error);
    res.status(500).json({ success: false, message: 'Failed to create assessment' });
  }
});

router.put('/assessments/:id', async (req, res) => {
  try {
    const result = await verifyAssessmentOwnership(req.user.id, req.params.id);
    if (!result.allowed) return res.status(403).json({ success: false, message: result.error });
    const updateData = { ...req.body, updatedAt: new Date().toISOString() };
    delete updateData.courseId;
    await db.collection('assessments').doc(req.params.id).update(updateData);
    res.json({ success: true, message: 'Assessment updated successfully' });
  } catch (error) {
    console.error('Error updating assessment:', error);
    res.status(500).json({ success: false, message: 'Failed to update assessment' });
  }
});

router.delete('/assessments/:id', async (req, res) => {
  try {
    const result = await verifyAssessmentOwnership(req.user.id, req.params.id);
    if (!result.allowed) return res.status(403).json({ success: false, message: result.error });
    await db.collection('assessments').doc(req.params.id).delete();
    res.json({ success: true, message: 'Assessment deleted successfully' });
  } catch (error) {
    console.error('Error deleting assessment:', error);
    res.status(500).json({ success: false, message: 'Failed to delete assessment' });
  }
});

// ==================== STUDENT PROGRESS ====================
router.get('/students/:studentId/progress', async (req, res) => {
  try {
    const teacherId = req.user.id;
    const studentId = req.params.studentId;
    const batchesSnapshot = await db.collection('batches').where('teacherId', '==', teacherId).get();
    let studentInBatch = false;
    batchesSnapshot.forEach(doc => {
      if (doc.data().students && doc.data().students.includes(studentId)) studentInBatch = true;
    });
    if (!studentInBatch) {
      return res.status(403).json({ success: false, message: 'You can only view progress of students in your batches' });
    }
    const progressDoc = await db.collection('userProgress').doc(studentId).get();
    const studentDoc = await db.collection('users').doc(studentId).get();
    if (!studentDoc.exists) return res.status(404).json({ success: false, message: 'Student not found' });
    const studentData = studentDoc.data();
    const progressData = progressDoc.exists ? progressDoc.data() : {};
    res.json({
      success: true,
      student: { id: studentDoc.id, name: studentData.name, email: studentData.email, enrollmentNumber: studentData.enrollmentNumber, currentCourse: studentData.course },
      progress: { viewedFiles: progressData.viewedFiles || [], completedModules: progressData.completedModules || [], progress: progressData.progress || 0, lastUpdated: progressData.lastUpdated || null, courseSlug: progressData.courseSlug, enrollmentDate: progressData.enrollmentDate }
    });
  } catch (error) {
    console.error('Error fetching student progress:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch student progress' });
  }
});

// @route   PUT /api/teacher/videos/:id
// @desc    Update a video (teacher can only update videos in their own batches)
// @access  Teacher only
router.put('/videos/:id', validateVideoUpdate, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description } = req.body;
    const teacherId = String(req.user.id);

    // Get the video/lecture
    const lecture = await classroomService.getLectureById(id);
    if (!lecture) {
      return res.status(404).json({ message: 'Video not found' });
    }

    // Verify teacher owns the batch containing this video
    if (lecture.batchId) {
      // Check regular batches
      const batch = await Batch.findById(lecture.batchId);
      
      if (batch && String(batch.teacherId) !== teacherId) {
        return res.status(403).json({ 
          message: 'Access denied. You do not have permission to update this video' 
        });
      }

      // Check one-to-one batches if not found in regular batches
      if (!batch) {
        const OneToOneBatch = require('../models/OneToOneBatch');
        const oneToOneBatch = await OneToOneBatch.findById(lecture.batchId);
        
        if (oneToOneBatch && String(oneToOneBatch.teacherId) !== teacherId) {
          return res.status(403).json({ 
            message: 'Access denied. You do not have permission to update this video' 
          });
        }
      }

      // If batch is found but doesn't belong to teacher, deny access
      if (!batch && !oneToOneBatch) {
        return res.status(404).json({ 
          message: 'Batch not found or access denied' 
        });
      }
    } else {
      // For videos without batchId, check if teacher uploaded the video
      if (lecture.uploadedBy !== teacherId) {
        return res.status(403).json({ 
          message: 'Access denied. You can only update videos you uploaded' 
        });
      }
    }

    // Prepare update data
    const updateData = {
      updatedAt: new Date()
    };

    if (title !== undefined) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description.trim();

    // Update the video
    const updatedLecture = await Classroom.findByIdAndUpdate(
      id, 
      updateData, 
      { new: true }
    ).lean().exec();

    // Log the update activity
    try {
      await logActivity({
        action: 'video_updated',
        userId: teacherId,
        userName: req.user.name || '',
        userEmail: req.user.email || '',
        userRole: 'teacher',
        videoId: id,
        videoTitle: updatedLecture.title || null,
        details: `Updated video: ${title ? 'title' : ''}${title && description ? ' and ' : ''}${description ? 'description' : ''}`
      });
    } catch (logErr) {
      console.warn('ActivityLog video_updated failed:', logErr.message);
    }

    res.json({
      success: true,
      message: 'Video updated successfully',
      video: {
        id: String(updatedLecture._id),
        title: updatedLecture.title,
        description: updatedLecture.description
      }
    });

  } catch (error) {
    console.error('Error updating teacher video:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update video' 
    });
  }
});

// @route   POST /api/teacher/videos/:videoId/notes
// @desc    Upload notes for a video
// @access  Teacher only
router.post('/videos/:videoId/notes', teacherNotesUpload.single('notesFile'), async (req, res) => {
  try {
    const { videoId } = req.params;
    const teacherId = String(req.user.id);

    // Get the video/lecture
    const lecture = await classroomService.getLectureById(videoId);
    if (!lecture) {
      return res.status(404).json({ message: 'Video not found' });
    }

    // Verify teacher owns the batch containing this video
    if (lecture.batchId) {
      // Check regular batches
      const batch = await Batch.findById(lecture.batchId);
      
      if (batch && String(batch.teacherId) !== teacherId) {
        return res.status(403).json({ 
          message: 'Access denied. You do not have permission to upload notes for this video' 
        });
      }

      // Check one-to-one batches if not found in regular batches
      if (!batch) {
        const OneToOneBatch = require('../models/OneToOneBatch');
        const oneToOneBatch = await OneToOneBatch.findById(lecture.batchId);
        
        if (oneToOneBatch && String(oneToOneBatch.teacherId) !== teacherId) {
          return res.status(403).json({ 
            message: 'Access denied. You do not have permission to upload notes for this video' 
          });
        }
      }

      // If batch is found but doesn't belong to teacher, deny access
      if (!batch && !oneToOneBatch) {
        return res.status(404).json({ 
          message: 'Batch not found or access denied' 
        });
      }
    } else {
      // For videos without batchId, check if teacher uploaded the video
      if (lecture.uploadedBy !== teacherId) {
        return res.status(403).json({ 
          message: 'Access denied. You can only upload notes for videos you uploaded' 
        });
      }
    }

    // Handle file upload
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const notesFileName = req.file.originalname;
    const notesFilePath = `/uploads/teacher-notes/${req.file.filename}`;

    // Update the video with notes information
    const updatedLecture = await Classroom.findByIdAndUpdate(
      videoId,
      {
        notesAvailable: true,
        notesFileName: notesFileName,
        notesFilePath: notesFilePath,
        updatedAt: new Date()
      },
      { new: true }
    ).lean().exec();

    // Log the notes upload activity
    try {
      await logActivity({
        action: 'notes_uploaded',
        userId: teacherId,
        userName: req.user.name || '',
        userEmail: req.user.email || '',
        userRole: 'teacher',
        videoId: videoId,
        videoTitle: lecture.title || null,
        details: `Uploaded notes: ${notesFileName}`
      });
    } catch (logErr) {
      console.warn('ActivityLog notes_uploaded failed:', logErr.message);
    }

    res.json({
      success: true,
      message: 'Notes uploaded successfully',
      notes: {
        fileName: notesFileName,
        filePath: notesFilePath
      }
    });

  } catch (error) {
    console.error('Error uploading teacher notes:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to upload notes' 
    });
  }
});

// @route   POST /api/teacher/batches/:batchId/notes
// @desc    Upload batch-level notes
// @access  Teacher only
router.post('/batches/:batchId/notes', teacherNotesUpload.single('notesFile'), async (req, res) => {
  try {
    const { batchId } = req.params;
    const teacherId = String(req.user.id);

    // Verify teacher owns the batch
    const batch = await Batch.findById(batchId);
    if (!batch || String(batch.teacherId) !== teacherId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Handle file upload
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const notesFileName = req.file.originalname;
    const notesFilePath = `/uploads/teacher-notes/${req.file.filename}`;

    // Update the batch with notes information
    const updatedBatch = await Batch.findByIdAndUpdate(
      batchId,
      {
        notesFile: {
          fileName: notesFileName,
          filePath: notesFilePath
        },
        updatedAt: new Date()
      },
      { new: true }
    ).lean().exec();

    // Log the batch notes upload activity
    try {
      await logActivity({
        action: 'batch_notes_uploaded',
        userId: teacherId,
        userName: req.user.name || '',
        userEmail: req.user.email || '',
        userRole: 'teacher',
        batchId: batchId,
        batchName: batch.name || null,
        details: `Uploaded batch notes: ${notesFileName}`
      });
    } catch (logErr) {
      console.warn('ActivityLog batch_notes_uploaded failed:', logErr.message);
    }

    res.json({
      success: true,
      message: 'Batch notes uploaded successfully',
      notesFile: {
        fileName: notesFileName,
        filePath: notesFilePath
      }
    });

  } catch (error) {
    console.error('Error uploading batch notes:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to upload batch notes' 
    });
  }
});

// @route   GET /api/teacher/classroom/play/:lectureId
// @desc    Validate teacher batch ownership and return video playback URL
// @access  Teacher only
router.get('/classroom/play/:lectureId', async (req, res) => {
  try {
    const { lectureId } = req.params;
    const teacherId = req.user.id;

    if (!lectureId) {
      return res.status(400).json({ message: 'Lecture ID is required' });
    }

    // Get lecture metadata using classroomService
    const lecture = await classroomService.getLectureById(lectureId);

    // Verify teacher owns the batch containing this video
    if (lecture.batchId) {
      // Check regular batches
      const Batch = require('../models/Batch');
      const batch = await Batch.findById(lecture.batchId);
      
      if (batch && String(batch.teacherId) !== String(teacherId)) {
        return res.status(403).json({ 
          message: 'Access denied. You do not have permission to view this lecture' 
        });
      }

      // Check one-to-one batches if not found in regular batches
      if (!batch) {
        const OneToOneBatch = require('../models/OneToOneBatch');
        const oneToOneBatch = await OneToOneBatch.findById(lecture.batchId);
        
        if (oneToOneBatch && String(oneToOneBatch.teacherId) !== String(teacherId)) {
          return res.status(403).json({ 
            message: 'Access denied. You do not have permission to view this lecture' 
          });
        }
      }

      // If batch is found but doesn't belong to teacher, deny access
      if (!batch && !oneToOneBatch) {
        return res.status(404).json({ 
          message: 'Batch not found or access denied' 
        });
      }
    } else {
      // For videos without batchId, check if teacher uploaded the video
      if (lecture.uploadedBy !== teacherId) {
        return res.status(403).json({ 
          message: 'Access denied. You can only play videos you uploaded or that are assigned to your batches' 
        });
      }
    }

    // Handle different video sources
    if (lecture.videoSource === 'firebase' && lecture.firebaseStoragePath) {
      try {
        // Generate signed URL for Firebase Storage video
        const signedUrl = await classroomService.getSignedUrl(lecture.firebaseStoragePath);

        // Log video view
        try {
          await logActivity({
            action: 'video_view',
            userId: teacherId,
            userName: req.user.name || '',
            userEmail: req.user.email || '',
            userRole: 'teacher',
            videoId: lectureId,
            videoTitle: lecture.title || null
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
          expiresAt: new Date(Date.now() + (2 * 60 * 60 * 1000)).toISOString(), // 2 hours from now
          videoSource: 'firebase'
        });
      } catch (firebaseError) {
        console.error('Firebase service error:', firebaseError);
        if (firebaseError.message.includes('disabled') || firebaseError.message.includes('no Firebase Storage')) {
          return res.status(503).json({ 
            message: 'Video streaming service temporarily unavailable. Firebase Storage is not configured.' 
          });
        }
        throw firebaseError;
      }

    } else if (lecture.videoSource === 'youtube' || lecture.videoSource === 'youtube-url') {
      // Return YouTube video information
      const videoData = {
        lectureId: lecture.id,
        title: lecture.title,
        description: lecture.description,
        duration: lecture.duration,
        videoSource: lecture.videoSource,
        youtubeVideoId: lecture.youtubeVideoId,
        youtubeVideoUrl: lecture.youtubeVideoUrl,
        youtubeEmbedUrl: lecture.youtubeEmbedUrl
      };

      // Log video view
      try {
        await logActivity({
          action: 'video_view',
          userId: teacherId,
          userName: req.user.name || '',
          userEmail: req.user.email || '',
          userRole: 'teacher',
          videoId: lectureId,
          videoTitle: lecture.title || null
        });
      } catch (logErr) {
        console.warn('ActivityLog video_view failed:', logErr.message);
      }

      res.json(videoData);

    } else if (lecture.videoSource === 'zoom' && lecture.zoomUrl) {
      // Return Zoom video URL
      const videoData = {
        lectureId: lecture.id,
        title: lecture.title,
        description: lecture.description,
        duration: lecture.duration,
        videoSource: 'zoom',
        zoomUrl: lecture.zoomUrl,
        zoomPasscode: lecture.zoomPasscode
      };

      // Log video view
      try {
        await logActivity({
          action: 'video_view',
          userId: teacherId,
          userName: req.user.name || '',
          userEmail: req.user.email || '',
          userRole: 'teacher',
          videoId: lectureId,
          videoTitle: lecture.title || null
        });
      } catch (logErr) {
        console.warn('ActivityLog video_view failed:', logErr.message);
      }

      res.json(videoData);

    } else {
      return res.status(400).json({ 
        message: 'This lecture is not available for streaming or has an unsupported video source' 
      });
    }

  } catch (error) {
    console.error('Error generating teacher video URL:', error);
    
    if (error.message === 'Lecture not found') {
      return res.status(404).json({ message: 'Lecture not found' });
    }
    
    if (error.message === 'Video file not found in storage') {
      return res.status(404).json({ message: 'Video file not available' });
    }
    
    if (error.message.includes('Direct video upload is disabled') || error.message.includes('Signed URL generation is disabled')) {
      return res.status(503).json({ 
        message: 'Video streaming service temporarily unavailable. Please contact administrator.' 
      });
    }
    
    res.status(500).json({ message: 'Failed to generate video access URL' });
  }
});

module.exports = router;
