const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const { isTeacher } = require('../middleware/roleAuth');
const zoomService = require('../services/zoomService');
const multer = require('multer');
const classroomService = require('../services/classroomService');
const {
  verifyCourseOwnership,
  verifyModuleOwnership,
  verifyLessonOwnership,
  verifyProjectOwnership,
  verifyAssessmentOwnership
} = require('../middleware/teacherOwnership');

// Apply auth to all teacher routes
router.use(isTeacher);

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

// @route   POST /api/teacher/classroom/upload
// @desc    Upload video + metadata to Firebase Storage
// @access  Teacher only
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

    // Verify teacher owns the course
    const courseDoc = await db.collection('courses').doc(courseId).get();
    if (!courseDoc.exists) {
      return res.status(404).json({ message: 'Course not found' });
    }

    const courseData = courseDoc.data();
    if (courseData.teacherId !== req.user.id) {
      return res.status(403).json({ 
        message: 'You can only upload lectures to your own courses' 
      });
    }

    // Prepare metadata
    const metadata = {
      title: title.trim(),
      description: description?.trim() || '',
      courseId: courseId.trim(),
      batchId: batchId?.trim() || null,
      domain: domain?.trim() || courseData.domain || req.user.domain,
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

// @route   POST /api/teacher/classroom/youtube-upload
// @desc    Upload video to YouTube and save metadata
// @access  Teacher only
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

    const { title, description, courseId, batchId, domain, duration, courseType } = req.body;

    // Validate required fields
    if (!title || !courseId) {
      return res.status(400).json({ 
        message: 'Title and courseId are required' 
      });
    }

    // Verify teacher owns the course
    const courseDoc = await db.collection('courses').doc(courseId).get();
    if (!courseDoc.exists) {
      return res.status(404).json({ message: 'Course not found' });
    }

    const courseData = courseDoc.data();
    if (courseData.teacherId !== req.user.id) {
      return res.status(403).json({ 
        message: 'You can only upload videos for your own courses' 
      });
    }

    // Prepare metadata for YouTube
    const metadata = {
      title: title.trim(),
      description: description?.trim() || `Educational video - ${courseType || courseData.title || 'Course'}`,
      courseId: courseId.trim(),
      batchId: batchId?.trim() || null,
      domain: domain?.trim() || courseData.domain || req.user.domain,
      duration: duration || null,
      courseType: courseType?.trim() || courseData.title,
      instructor: req.user.name,
      tags: ['education', 'shef-lms', courseType || courseData.title, req.user.name]
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

// @route   GET /api/teacher/classroom/:courseId
// @desc    Get lectures uploaded by teacher for their course
// @access  Teacher only
router.get('/classroom/:courseId', async (req, res) => {
  try {
    const { courseId } = req.params;
    const teacherId = req.user.id;

    if (!courseId) {
      return res.status(400).json({ message: 'Course ID is required' });
    }

    // Verify teacher owns the course
    const courseDoc = await db.collection('courses').doc(courseId).get();
    if (!courseDoc.exists) {
      return res.status(404).json({ message: 'Course not found' });
    }

    const courseData = courseDoc.data();
    if (courseData.teacherId !== teacherId) {
      return res.status(403).json({ 
        message: 'You can only view lectures for your own courses' 
      });
    }

    // Get lectures for this course uploaded by this teacher
    const lecturesSnapshot = await db.collection('lectures')
      .where('courseId', '==', courseId)
      .where('uploadedBy', '==', teacherId)
      .orderBy('createdAt', 'desc')
      .get();

    const lectures = [];
    lecturesSnapshot.forEach(doc => {
      const lectureData = doc.data();
      lectures.push({
        id: doc.id,
        title: lectureData.title,
        description: lectureData.description,
        courseId: lectureData.courseId,
        batchId: lectureData.batchId,
        domain: lectureData.domain,
        duration: lectureData.duration,
        uploadedBy: lectureData.uploadedBy,
        createdAt: lectureData.createdAt,
        videoSource: lectureData.videoSource,
        fileInfo: lectureData.fileInfo
      });
    });

    res.json({
      courseId,
      lectures,
      total: lectures.length
    });

  } catch (error) {
    console.error('Error fetching teacher lectures:', error);
    res.status(500).json({ message: 'Failed to fetch lectures' });
  }
});

// @route   DELETE /api/teacher/classroom/:lectureId
// @desc    Delete lecture uploaded by teacher
// @access  Teacher only
router.delete('/classroom/:lectureId', async (req, res) => {
  try {
    const { lectureId } = req.params;
    const teacherId = req.user.id;

    if (!lectureId) {
      return res.status(400).json({ message: 'Lecture ID is required' });
    }

    // Get lecture metadata
    const lecture = await classroomService.getLectureById(lectureId);

    // Verify teacher uploaded this lecture
    if (lecture.uploadedBy !== teacherId) {
      return res.status(403).json({ 
        message: 'You can only delete lectures you uploaded' 
      });
    }

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

module.exports = router;
