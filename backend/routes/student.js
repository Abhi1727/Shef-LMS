const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { roleAuth } = require('../middleware/roleAuth');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Batch = require('../models/Batch');
const Classroom = require('../models/Classroom');
const ActivityLog = require('../models/ActivityLog');
const LiveClass = require('../models/LiveClass');
const BatchMaterial = require('../models/BatchMaterial');
const StudentShare = require('../models/StudentShare');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const googleDriveService = require('../services/googleDriveService');

const shareUpload = multer({
  dest: path.join(__dirname, '../uploads/tmp-student-shares'),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (req, file, cb) => {
    const ok =
      /^video\//.test(file.mimetype) ||
      /^image\//.test(file.mimetype) ||
      /^application\//.test(file.mimetype) ||
      /^text\//.test(file.mimetype) ||
      /\.(pdf|doc|docx|ppt|pptx|xls|xlsx|zip|rar|txt|csv|md|rtf|mp4|mov|webm|png|jpg|jpeg)$/i.test(
        file.originalname || ''
      );
    if (!ok) return cb(new Error('File type not allowed'));
    cb(null, true);
  }
});

try {
  fs.mkdirSync(path.join(__dirname, '../uploads/tmp-student-shares'), { recursive: true });
} catch (_) {
  /* ignore */
}

async function resolveStudentBatchIds(userId) {
  const userDoc = await User.findOne({
    $or: [{ _id: userId }, { firestoreId: userId }]
  })
    .select('batchId oneToOneBatchId')
    .lean()
    .exec();
  const batchIds = [userDoc?.batchId, userDoc?.oneToOneBatchId].filter(Boolean).map(String);
  const memberBatches = await Batch.find({ students: userId }).select('_id').lean().exec();
  memberBatches.forEach((b) => batchIds.push(String(b._id)));
  return [...new Set(batchIds)];
}

// Apply auth and student role check to all student routes
router.use(auth);
router.use(roleAuth('student'));

// Normalize email for consistent lookup (Firestore queries are case-sensitive)
const normalizeEmail = (e) => (e || '').trim().toLowerCase();

// @route   GET /api/student/profile
// @desc    Get current student's profile
router.get('/profile', async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Handle demo students
    if (userId === 'leonardo_deleon_user_id' || userId === 'abhi_datascience_user_id') {
      const demoProfile = {
        id: userId,
        name: userId === 'leonardo_deleon_user_id' ? 'Leonardo De Leon' : 'Abhi',
        email: userId === 'leonardo_deleon_user_id' ? 'lqdeleon@gmail.com' : 'abhi@gmail.com',
        currentCourse: userId === 'leonardo_deleon_user_id' ? 'Cyber Security & Ethical Hacking' : (Math.random() > 0.5 ? 'DevOps & AI' : 'DevOps & Cloud'),
        status: 'active',
        role: 'student'
      };
      return res.json(demoProfile);
    }
    
    // Get student data from Mongo
    const userDoc = await User.findOne({
      $or: [
        { _id: userId },
        { firestoreId: userId }
      ]
    }).exec();

    if (!userDoc) {
      return res.status(404).json({ message: 'Student profile not found' });
    }
    
    // Return only necessary profile information (exclude password)
    const profileData = {
      id: String(userDoc._id),
      name: userDoc.name,
      email: userDoc.email,
      currentCourse: userDoc.course || userDoc.currentCourse,
      status: userDoc.status,
      role: userDoc.role,
      createdAt: userDoc.createdAt,
      updatedAt: userDoc.updatedAt
    };

    res.json(profileData);
  } catch (err) {
    console.error('Error fetching student profile:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/student/profile
// @desc    Update current student's profile
router.put('/profile', async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, email, phone, address } = req.body;

    console.log('🔧 Profile Update Request:', {
      userId,
      name,
      email,
      phone,
      address
    });

    // Validate required fields
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Name is required' });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const normalizedEmail = normalizeEmail(email);

    // Handle demo students differently
    if (userId === 'leonardo_deleon_user_id' || userId === 'abhi_datascience_user_id') {
      console.log('🔧 Updating demo student profile:', userId);
      
      // For demo students, simulate the update (in real implementation, these would be in database)
      const demoResponse = {
        message: 'Profile updated successfully',
        profile: {
          id: userId,
          name: name.trim(),
          email: normalizedEmail,
          currentCourse: userId === 'leonardo_deleon_user_id' ? 'Cyber Security & Ethical Hacking' : (Math.random() > 0.5 ? 'DevOps & AI' : 'DevOps & Cloud'),
          enrollmentNumber: userId === 'leonardo_deleon_user_id' ? 'SU-2025-001' : 'SU-2025-002',
          batchId: null,
          phone: phone?.trim() || '',
          address: address?.trim() || '',
          enrollmentDate: userId === 'leonardo_deleon_user_id' ? '2025-11-07' : '2025-12-01',
          courseDuration: '6 months',
          status: 'active',
          role: 'student',
          updatedAt: new Date().toISOString()
        }
      };

      console.log('✅ Demo student profile updated:', demoResponse.profile);
      return res.json(demoResponse);
    }

    // Check if email is being changed and if new email already exists (Mongo)
    const userDoc = await User.findOne({
      $or: [
        { _id: userId },
        { firestoreId: userId }
      ]
    }).exec();

    if (!userDoc) {
      return res.status(404).json({ message: 'Student profile not found' });
    }

    const currentEmail = userDoc.email;

    if (currentEmail !== normalizedEmail) {
      // Email is being changed, check for duplicates
      const existingUser = await User.findOne({ email: normalizedEmail }).exec();
      if (existingUser) {
        return res.status(400).json({ message: 'Email already exists' });
      }
    }

    // Prepare update data
    userDoc.name = name.trim();
    userDoc.email = normalizedEmail;
    if (phone !== undefined && phone !== null) {
      userDoc.phone = phone.trim();
    }
    if (address !== undefined && address !== null) {
      userDoc.address = address.trim();
    }
    await userDoc.save();

    const responseProfile = {
      id: String(userDoc._id),
      name: userDoc.name,
      email: userDoc.email,
      currentCourse: userDoc.course || userDoc.currentCourse,
      status: userDoc.status,
      role: userDoc.role,
      phone: userDoc.phone || '',
      address: userDoc.address || '',
      updatedAt: new Date().toISOString()
    };

    console.log('✅ Student profile updated in database:', responseProfile);

    res.json({
      message: 'Profile updated successfully',
      profile: responseProfile
    });
  } catch (err) {
    console.error('❌ Error updating student profile:', err);
    res.status(500).json({ message: 'Server error: ' + err.message });
  }
});

// @route   PUT /api/student/password
// @desc    Update current student's password
router.put('/password', async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    console.log('🔧 Password Update Request:', {
      userId,
      hasCurrentPassword: !!currentPassword,
      hasNewPassword: !!newPassword
    });

    // Validate required fields
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters long' });
    }

    // Handle demo students
    if (userId === 'leonardo_deleon_user_id' || userId === 'abhi_datascience_user_id') {
      console.log('🔧 Updating demo student password:', userId);
      
      // For demo students, verify current password is the demo password
      if (currentPassword === 'Admin@123') {
        // In a real implementation, you would update the password in the database
        // For demo purposes, we'll just return success
        console.log('✅ Demo student password updated successfully');
        return res.json({ message: 'Password updated successfully' });
      } else {
        console.log('❌ Demo student current password incorrect');
        return res.status(400).json({ message: 'Current password is incorrect' });
      }
    }

    // Get current student data from Mongo
    const userDoc = await User.findOne({
      $or: [
        { _id: userId },
        { firestoreId: userId }
      ]
    }).exec();
    
    if (!userDoc) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const storedPassword = userDoc.password;

    console.log('🔧 Verifying current password for user:', userId);

    // Verify current password for regular students
    if (!storedPassword || typeof storedPassword !== 'string' || !storedPassword.startsWith('$2')) {
      return res.status(400).json({ message: 'Invalid password format in database' });
    }

    const isMatch = await bcrypt.compare(currentPassword, storedPassword);
    if (!isMatch) {
      console.log('❌ Current password verification failed');
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    console.log('✅ Current password verified, updating to new password');

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedNewPassword = await bcrypt.hash(newPassword, salt);

    // Update password in Mongo
    userDoc.password = hashedNewPassword;
    userDoc.updatedAt = new Date();
    await userDoc.save();

    console.log('✅ Password updated in database for user:', userId);

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('❌ Error updating password:', err);
    res.status(500).json({ message: 'Server error: ' + err.message });
  }
});

// @route   GET /api/student/batch-materials
// @desc    Drive materials for the student's enrolled batches
router.get('/batch-materials', async (req, res) => {
  try {
    const userId = String(req.user.id);
    const userDoc = await User.findOne({
      $or: [{ _id: userId }, { firestoreId: userId }]
    })
      .select('batchId oneToOneBatchId')
      .lean()
      .exec();
    const batchIds = [userDoc?.batchId, userDoc?.oneToOneBatchId].filter(Boolean).map(String);
    const memberBatches = await Batch.find({ students: userId }).select('_id').lean().exec();
    memberBatches.forEach((b) => batchIds.push(String(b._id)));
    const unique = [...new Set(batchIds)];
    if (!unique.length) {
      return res.json({ success: true, materials: [] });
    }
    const materials = await BatchMaterial.find({ batchId: { $in: unique } })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean()
      .exec();
    res.json({
      success: true,
      materials: materials.map((m) => ({
        id: String(m._id),
        batchId: m.batchId,
        kind: m.kind,
        name: m.name,
        driveLink: m.driveLink,
        mimeType: m.mimeType,
        liveClassId: m.liveClassId || '',
        classroomLectureId: m.classroomLectureId || '',
        createdAt: m.createdAt
      }))
    });
  } catch (err) {
    console.error('GET /student/batch-materials error:', err);
    res.status(500).json({ success: false, message: 'Failed to load materials' });
  }
});

// @route   GET /api/student/shares
router.get('/shares', async (req, res) => {
  try {
    const userId = String(req.user.id);
    const unique = await resolveStudentBatchIds(userId);
    const batches = unique.length
      ? await Batch.find({ _id: { $in: unique } })
          .select('name studentUploadsEnabled course')
          .lean()
      : [];
    const shares = await StudentShare.find({ studentId: userId })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json({
      success: true,
      batches: batches.map((b) => ({
        id: String(b._id),
        name: b.name || '',
        course: b.course || '',
        studentUploadsEnabled: Boolean(b.studentUploadsEnabled)
      })),
      shares: shares.map((s) => ({ id: String(s._id), ...s }))
    });
  } catch (err) {
    console.error('GET /student/shares error:', err);
    res.status(500).json({ success: false, message: 'Failed to load shares' });
  }
});

// @route   POST /api/student/shares
router.post('/shares', shareUpload.single('file'), async (req, res) => {
  let tempPath = req.file?.path;
  try {
    const userId = String(req.user.id);
    const batchId = String(req.body?.batchId || '');
    if (!batchId) {
      return res.status(400).json({ success: false, message: 'batchId is required' });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'file is required' });
    }

    const allowed = await resolveStudentBatchIds(userId);
    if (!allowed.includes(batchId)) {
      return res.status(403).json({ success: false, message: 'Not enrolled in this batch' });
    }

    const batch = await Batch.findById(batchId).lean();
    if (!batch) return res.status(404).json({ success: false, message: 'Batch not found' });
    if (!batch.studentUploadsEnabled) {
      return res.status(403).json({
        success: false,
        message: 'Your trainer has not enabled student uploads for this batch yet'
      });
    }

    let folderId = batch.driveFolderId || '';
    let folderLink = batch.driveFolderLink || '';
    if (!folderId) {
      const ensured = await googleDriveService.ensureBatchFolder({
        batchId,
        batchName: batch.name || 'Batch'
      });
      folderId = ensured.folderId;
      folderLink = ensured.folderLink;
      await Batch.updateOne(
        { _id: batchId },
        { $set: { driveFolderId: folderId, driveFolderLink: folderLink, updatedAt: new Date() } }
      );
    }

    const uploaded = await googleDriveService.uploadBatchFile({
      batchId,
      batchName: batch.name || '',
      folderId,
      filePath: req.file.path,
      fileName: `student-${userId}-${Date.now()}-${req.file.originalname || 'share'}`,
      mimeType: req.file.mimetype,
      title: req.body?.title || req.file.originalname
    });

    const KIND_OK = ['assignment', 'project', 'writing', 'video', 'other'];
    let kind = KIND_OK.includes(req.body?.kind) ? req.body.kind : 'assignment';
    const mime = String(req.file.mimetype || '');
    if (/^video\//.test(mime)) kind = 'video';
    else if (/\.(pdf|doc|docx|txt|md)$/i.test(req.file.originalname || '')) kind = kind === 'assignment' ? 'writing' : kind;

    const user = await User.findById(userId).select('name').lean();
    const share = await StudentShare.create({
      batchId,
      studentId: userId,
      studentName: user?.name || req.user.name || '',
      title: String(req.body?.title || req.file.originalname || 'Student share').slice(0, 200),
      note: String(req.body?.note || '').slice(0, 2000),
      kind,
      mimeType: req.file.mimetype || '',
      driveFileId: uploaded.driveFileId,
      driveLink: uploaded.driveLink,
      status: 'submitted',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    res.status(201).json({
      success: true,
      share: { id: String(share._id), ...share.toObject() },
      driveFolderLink: folderLink
    });
  } catch (err) {
    console.error('POST /student/shares error:', err);
    const code = err.code === 'MEET_DISABLED' || err.code === 'MEET_NOT_CONFIGURED' ? 503 : 500;
    res.status(code).json({
      success: false,
      message: err.message || 'Failed to upload share'
    });
  } finally {
    if (tempPath && fs.existsSync(tempPath)) {
      try {
        fs.unlinkSync(tempPath);
      } catch (_) {
        /* ignore */
      }
    }
  }
});

// @route   GET /api/student/schedule
// @desc    Unified calendar events: upcoming live classes + classroom recordings
router.get('/schedule', async (req, res) => {
  try {
    const userId = String(req.user.id);
    const userDoc = await User.findOne({
      $or: [{ _id: userId }, { firestoreId: userId }]
    })
      .select('batchId oneToOneBatchId')
      .lean()
      .exec();

    const batchIds = [userDoc?.batchId, userDoc?.oneToOneBatchId].filter(Boolean).map(String);
    const memberBatches = await Batch.find({ students: userId }).select('_id').lean().exec();
    memberBatches.forEach((b) => batchIds.push(String(b._id)));
    const unique = [...new Set(batchIds)];

    if (!unique.length) {
      return res.json({ success: true, events: [], cohort: [], batchIds: [] });
    }

    const now = Date.now();
    const meetings = await LiveClass.find({
      batchId: { $in: unique },
      status: { $ne: 'cancelled' },
      meetLink: { $ne: '' }
    })
      .sort({ scheduledStart: 1 })
      .lean()
      .exec();

    const batchesMeta = await Batch.find({ _id: { $in: unique } })
      .select('name course schedule teacherName')
      .lean()
      .exec();

    const liveEvents = meetings.map((m) => {
      const start = m.scheduledStart ? new Date(m.scheduledStart) : null;
      const end = m.scheduledEnd ? new Date(m.scheduledEnd) : null;
      const ended = end && end.getTime() < now;
      const batch = batchesMeta.find((b) => String(b._id) === String(m.batchId));
      return {
        id: `live-${m._id}`,
        type: ended || m.status === 'completed' ? 'live_past' : 'live',
        title: m.title,
        start: start ? start.toISOString() : null,
        end: end ? end.toISOString() : null,
        meetingId: String(m._id),
        batchId: String(m.batchId || ''),
        batchName: batch?.name || '',
        status: m.status,
        hasMeetLink: Boolean(m.meetLink),
        hasRecording: Boolean(m.driveFileId || m.classroomLectureId),
        classroomLectureId: m.classroomLectureId || '',
        teacherName: m.teacherName || m.instructor || '',
        duration: m.duration || '',
        description: m.description || '',
        videoSource: m.driveFileId ? 'drive' : ''
      };
    });

    const lectures = await Classroom.find({ batchId: { $in: unique } })
      .sort({ date: -1, createdAt: -1 })
      .limit(80)
      .lean()
      .exec();

    const recordingEvents = lectures.map((l) => {
      let start = null;
      if (l.date) {
        const d = new Date(l.date);
        if (!Number.isNaN(d.getTime())) start = d.toISOString();
      }
      if (!start && l.createdAt) start = new Date(l.createdAt).toISOString();
      return {
        id: `rec-${l._id}`,
        type: 'recording',
        title: l.title,
        start,
        end: null,
        lectureId: String(l._id),
        batchId: String(l.batchId || ''),
        videoSource: l.videoSource || (l.driveId ? 'drive' : l.youtubeVideoUrl ? 'youtube-url' : ''),
        driveId: l.driveId || '',
        youtubeVideoUrl: l.youtubeVideoUrl || '',
        youtubeVideoId: l.youtubeVideoId || '',
        youtubeEmbedUrl: l.youtubeEmbedUrl || '',
        duration: l.duration || '',
        instructor: l.instructor || ''
      };
    });

    const events = [...liveEvents, ...recordingEvents].sort((a, b) => {
      const ta = a.start ? new Date(a.start).getTime() : 0;
      const tb = b.start ? new Date(b.start).getTime() : 0;
      return ta - tb;
    });

    const cohort = batchesMeta.map((b) => ({
      batchId: String(b._id),
      batchName: b.name || '',
      course: b.course || '',
      teacherName: b.teacherName || '',
      schedule: b.schedule || null
    }));

    res.json({ success: true, events, batchIds: unique, cohort });
  } catch (err) {
    console.error('GET /student/schedule error:', err);
    res.status(500).json({ success: false, message: 'Failed to load schedule' });
  }
});

// @route   GET /api/student/batch-info
// @desc    Get batch information for current student
router.get('/batch-info', async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get student data to find batchId (Mongo)
    const userDoc = await User.findOne({
      $or: [
        { _id: userId },
        { firestoreId: userId }
      ]
    }).exec();
    
    if (!userDoc) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const batchId = userDoc.batchId;

    if (!batchId) {
      return res.json({ message: 'Student not assigned to any batch' });
    }

    // Get batch information from Mongo
    const batchDoc = await Batch.findById(batchId).lean().exec();
    
    if (!batchDoc) {
      return res.status(404).json({ message: 'Batch not found' });
    }

    res.json({
      id: String(batchDoc._id),
      name: batchDoc.name,
      course: batchDoc.course,
      teacherName: batchDoc.teacherName,
      schedule: batchDoc.schedule,
      startDate: batchDoc.startDate,
      endDate: batchDoc.endDate,
      status: batchDoc.status
    });
  } catch (err) {
    console.error('Error fetching batch info:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/student/course-progress
// @desc    Get course progress for current student
router.get('/course-progress', async (req, res) => {
  try {
    const userId = req.user.id;
    
    // TODO: Implement Mongo-backed course progress tracking.
    // For now, return an empty progress structure to keep the
    // endpoint working without Firebase.
    return res.json({
      message: 'No progress data found',
      progress: {
        viewedFiles: [],
        completedModules: [],
        progress: 0,
        lastUpdated: null
      }
    });
  } catch (err) {
    console.error('Error fetching course progress:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Helper function to calculate login streak
const calculateLoginStreak = async (userId) => {
  try {
    const loginActivities = await ActivityLog.find({
      userId: userId,
      action: 'login'
    }).sort({ timestamp: -1 }).limit(60); // Last 60 days max

    if (loginActivities.length === 0) {
      return { current: 0, longest: 0, lastLoginDate: null };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    let lastLoginDate = loginActivities[0].timestamp;
    
    // Check if user logged in today or yesterday to continue streak
    const lastLogin = new Date(lastLoginDate);
    lastLogin.setHours(0, 0, 0, 0);
    const daysDiff = Math.floor((today - lastLogin) / (1000 * 60 * 60 * 24));
    
    // If last login was more than 2 days ago, streak is 0
    if (daysDiff > 1) {
      return { current: 0, longest: 0, lastLoginDate };
    }

    // Calculate current streak
    let expectedDate = new Date(lastLogin);
    currentStreak = 1;
    
    for (let i = 1; i < loginActivities.length; i++) {
      expectedDate.setDate(expectedDate.getDate() - 1);
      const currentActivityDate = new Date(loginActivities[i].timestamp);
      currentActivityDate.setHours(0, 0, 0, 0);
      
      if (expectedDate.getTime() === currentActivityDate.getTime()) {
        currentStreak++;
      } else {
        break;
      }
    }

    // Calculate longest streak
    tempStreak = 1;
    for (let i = 1; i < loginActivities.length; i++) {
      const prevDate = new Date(loginActivities[i - 1].timestamp);
      const currDate = new Date(loginActivities[i].timestamp);
      prevDate.setHours(0, 0, 0, 0);
      currDate.setHours(0, 0, 0, 0);
      
      const daysDiff = Math.floor((prevDate - currDate) / (1000 * 60 * 60 * 24));
      
      if (daysDiff === 1) {
        tempStreak++;
      } else {
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = 1;
      }
    }
    longestStreak = Math.max(longestStreak, tempStreak);

    return { 
      current: currentStreak, 
      longest: longestStreak, 
      lastLoginDate: lastLoginDate.toISOString().split('T')[0]
    };
  } catch (error) {
    console.error('Error calculating login streak:', error);
    return { current: 0, longest: 0, lastLoginDate: null };
  }
};

// Helper function to calculate video progress from batch classroom recordings
const calculateVideoProgress = async (userId) => {
  try {
    const userDoc = await User.findOne({
      $or: [
        { _id: userId },
        { firestoreId: userId }
      ]
    }).exec();

    if (!userDoc) {
      return { total: 0, watched: 0, progressPercentage: 0 };
    }

    const batchId = userDoc.batchId ? String(userDoc.batchId) : null;
    if (!batchId) {
      return { total: 0, watched: 0, progressPercentage: 0 };
    }

    const batchVideos = await Classroom.find({ batchId }).select('_id').lean().exec();
    const totalVideos = batchVideos.length;
    const videoIds = batchVideos.map((v) => String(v._id));

    if (totalVideos === 0) {
      return { total: 0, watched: 0, progressPercentage: 0 };
    }

    const watchedIds = await ActivityLog.distinct('videoId', {
      userId: String(userId),
      action: 'video_view',
      videoId: { $in: videoIds }
    });

    const watchedCount = watchedIds.length;
    const progressPercentage = Math.min(100, Math.round((watchedCount / totalVideos) * 100));

    return {
      total: totalVideos,
      watched: watchedCount,
      progressPercentage
    };
  } catch (error) {
    console.error('Error calculating video progress:', error);
    return { total: 0, watched: 0, progressPercentage: 0 };
  }
};

// @route   GET /api/student/progress-summary
// @desc    Get comprehensive progress summary for current student
router.get('/progress-summary', async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get student data
    const userDoc = await User.findOne({
      $or: [
        { _id: userId },
        { firestoreId: userId }
      ]
    }).exec();

    if (!userDoc) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Handle demo students
    if (userId === 'leonardo_deleon_user_id' || userId === 'abhi_datascience_user_id') {
      return res.json({
        modules: { total: 0, completed: 0, inProgress: 0 },
        videos: { total: 0, watched: 0, progressPercentage: 0 },
        streak: { current: 0, longest: 0, lastLoginDate: null },
        overallProgress: 0,
        message: 'No batch progress available for demo accounts'
      });
    }

    // Calculate login streak
    const streak = await calculateLoginStreak(userId);
    
    // Calculate video progress from batch recordings
    const videos = await calculateVideoProgress(userId);

    const progressSummary = {
      modules: {
        total: 0,
        completed: 0,
        inProgress: 0
      },
      videos,
      streak,
      overallProgress: videos.progressPercentage,
      hasBatch: Boolean(userDoc.batchId)
    };

    res.json(progressSummary);
  } catch (err) {
    console.error('Error fetching progress summary:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/student/analytics
// @desc    Get comprehensive analytics data for current student
router.get('/analytics', async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get student data
    const userDoc = await User.findOne({
      $or: [
        { _id: userId },
        { firestoreId: userId }
      ]
    }).exec();

    if (!userDoc) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Handle demo students with realistic data
    if (userId === 'leonardo_deleon_user_id' || userId === 'abhi_datascience_user_id') {
      const isDataScience = userId === 'abhi_datascience_user_id';
      const courseName = isDataScience ? 'Data Science & AI' : 'Cyber Security & Ethical Hacking';
      
      const demoAnalytics = {
        summary: {
          totalCourses: 1,
          totalVideosWatched: isDataScience ? 18 : 13,
          totalWatchTime: isDataScience ? 12.5 : 8.3,
          averageProgress: isDataScience ? 60 : 52,
          completionRate: isDataScience ? 60 : 52,
          currentStreak: isDataScience ? 7 : 5,
          weeklyProgress: isDataScience ? 85 : 72,
          achievements: isDataScience ? 6 : 4
        },
        courseProgress: [
          {
            courseName: courseName,
            totalVideos: isDataScience ? 30 : 25,
            videosWatched: isDataScience ? 18 : 13,
            completedVideos: isDataScience ? 15 : 10,
            totalWatchTime: isDataScience ? 12.5 : 8.3,
            overallProgress: isDataScience ? 60 : 52,
            lastActivityDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() // 2 days ago
          }
        ],
        recentActivity: [
          {
            videoTitle: isDataScience ? 'Introduction to Machine Learning' : 'Network Security Fundamentals',
            courseName: courseName,
            activityType: 'video_watched',
            date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            watchDuration: isDataScience ? 1800 : 1500 // 30 or 25 minutes in seconds
          },
          {
            videoTitle: isDataScience ? 'Python for Data Science' : 'Ethical Hacking Basics',
            courseName: courseName,
            activityType: 'video_completed',
            date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
            watchDuration: isDataScience ? 2400 : 2100
          },
          {
            videoTitle: isDataScience ? 'Data Visualization Techniques' : 'Penetration Testing Tools',
            courseName: courseName,
            activityType: 'video_watched',
            date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            watchDuration: isDataScience ? 1600 : 1800
          }
        ],
        weeklyProgress: [
          { week: 'Week 1', progress: 15 },
          { week: 'Week 2', progress: 28 },
          { week: 'Week 3', progress: 35 },
          { week: 'Week 4', progress: isDataScience ? 60 : 52 }
        ]
      };
      return res.json(demoAnalytics);
    }

    // Calculate login streak
    const streak = await calculateLoginStreak(userId);
    
    // Calculate video progress
    const videos = await calculateVideoProgress(userId);
    
    // Get recent activity
    const recentActivity = await ActivityLog.find({
      userId: userId,
      action: { $in: ['video_view', 'video_completed'] },
      videoId: { $exists: true, $ne: null }
    })
    .sort({ timestamp: -1 })
    .limit(10)
    .lean();

    // Format recent activity
    const formattedActivity = recentActivity.map(activity => ({
      videoTitle: activity.metadata?.videoTitle || 'Unknown Video',
      courseName: activity.metadata?.courseName || userDoc.course || userDoc.currentCourse || 'Unknown Course',
      activityType: activity.action === 'video_completed' ? 'video_completed' : 'video_watched',
      date: activity.timestamp,
      watchDuration: activity.metadata?.watchDuration || 0
    }));

    // Calculate weekly progress (last 4 weeks)
    const weeklyProgress = [];
    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - (i * 7));
      weekStart.setHours(0, 0, 0, 0);
      
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      
      const weekVideos = await ActivityLog.countDocuments({
        userId: userId,
        action: 'video_view',
        timestamp: { $gte: weekStart, $lte: weekEnd }
      });
      
      const weekProgress = videos.total > 0 ? Math.min((weekVideos / videos.total) * 100, 100) : 0;
      
      weeklyProgress.push({
        week: `Week ${4 - i}`,
        progress: Math.round(weekProgress)
      });
    }

    // Calculate weekly progress percentage
    const weeklyProgressPercentage = weeklyProgress.length > 0 
      ? Math.round(weeklyProgress.reduce((sum, week) => sum + week.progress, 0) / weeklyProgress.length)
      : 0;

    // Get course information
    const course = userDoc.course || userDoc.currentCourse || 'Unknown Course';
    
    // Calculate achievements based on milestones
    const achievements = Math.floor(videos.progressPercentage / 10) + Math.floor(streak.current / 7);

    const analyticsData = {
      summary: {
        totalCourses: 1,
        totalVideosWatched: videos.watched,
        totalWatchTime: videos.watched * 0.7, // Estimate 0.7 hours per video
        averageProgress: videos.progressPercentage,
        completionRate: videos.progressPercentage,
        currentStreak: streak.current,
        weeklyProgress: weeklyProgressPercentage,
        achievements: achievements
      },
      courseProgress: [
        {
          courseName: course,
          totalVideos: videos.total,
          videosWatched: videos.watched,
          completedVideos: Math.floor(videos.watched * 0.8), // Estimate 80% of watched are completed
          totalWatchTime: videos.watched * 0.7,
          overallProgress: videos.progressPercentage,
          lastActivityDate: recentActivity.length > 0 ? recentActivity[0].timestamp : null
        }
      ],
      recentActivity: formattedActivity,
      weeklyProgress: weeklyProgress
    };

    res.json(analyticsData);
  } catch (err) {
    console.error('Error fetching analytics data:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
