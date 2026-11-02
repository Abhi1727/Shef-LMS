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
const { resolveNotesAbsolutePath, streamNotesFile } = require('../utils/notesDownload');
const { persistNotesToDrive } = require('../services/notesStorage');
const { sortLessonsNewestFirst } = require('../services/lessonPath');
const OneToOne = require('../models/OneToOne');
const OneToOneBatch = require('../models/OneToOneBatch');
const LiveClass = require('../models/LiveClass');
const googleDriveService = require('../services/googleDriveService');
const BatchMaterial = require('../models/BatchMaterial');
const StudentShare = require('../models/StudentShare');
const { sendEmail } = require('../services/emailService');
const { attachPresence, findLiveClassForTeacher, findLiveClassesForTeachers } = require('../utils/teacherPresence');
const {
  allocateEnrollmentNumber,
  planBackfill,
} = require('../utils/enrollmentNumber');
const {
  enrollStudentInBatch,
  unenrollStudentFromBatch,
  activeEnrollments,
  hydrateEnrollments,
  serializeEnrollments
} = require('../utils/studentEnrollment');
const { buildStudentReportPdf } = require('../utils/studentReportPdf');
const {
  allocateFormNumber,
  ensureStudentFormNumber,
  planFormNumberBackfill,
} = require('../utils/reportFormNumber');

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
  'rar': 'application/vnd.rar',
  '7z': 'application/x-7z-compressed',
  'tar': 'application/x-tar',
  'gz': 'application/gzip',
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'png': 'image/png',
  'gif': 'image/gif',
  'webp': 'image/webp',
  'ipynb': 'application/x-ipynb+json',
  'py': 'text/x-python',
  'json': 'application/json',
  'md': 'text/markdown',
  'rtf': 'application/rtf',
  'sql': 'application/sql'
};

// Helper function to get content-type based on file extension
function getContentType(filename) {
  const fileExtension = path.extname(filename).toLowerCase().substring(1);
  return contentTypes[fileExtension] || 'application/octet-stream';
}

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
    // Accept PDF, Word, and document files
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain'
    ];
    const ext = path.extname(file.originalname || '').toLowerCase();
    const allowedExts = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.txt', '.zip', '.md'];
    if (allowedTypes.includes(file.mimetype) || allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('File type not supported. Only PDF, Word, PowerPoint, and text documents are allowed'), false);
    }
  }
});

// Configure multer for lecture notes uploads (PDF/Word/etc.) stored on disk
const NOTES_MAX_FILE_SIZE = 100 * 1024 * 1024;
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
    const safeOriginal = path.basename(file.originalname || 'notes')
      .replace(/[/\\?%*:|"<>]/g, '_')
      .replace(/[^a-zA-Z0-9.\-_ ]/g, '');
    cb(null, `${timestamp}-${safeOriginal || 'notes'}`);
  }
});

const notesUpload = multer({
  storage: notesUploadStorage,
  limits: {
    fileSize: NOTES_MAX_FILE_SIZE,
  },
  fileFilter: (req, file, cb) => {
    // Allow common document types, presentations, spreadsheets, images, notebooks, code, and archives
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
      'image/webp',
      'application/json',
      'application/x-ipynb+json',
      'text/x-python',
      'application/vnd.rar',
      'application/x-7z-compressed',
      'application/x-tar',
      'application/gzip',
      'text/markdown',
      'application/rtf',
      'application/sql'
    ];
    const ext = String(file.originalname || '')
      .toLowerCase()
      .split('.')
      .pop();
    const allowedExt = new Set([
      'pdf',
      'doc',
      'docx',
      'txt',
      'ppt',
      'pptx',
      'xls',
      'xlsx',
      'csv',
      'zip',
      'rar',
      '7z',
      'tar',
      'gz',
      'jpg',
      'jpeg',
      'png',
      'gif',
      'webp',
      'ipynb',
      'py',
      'json',
      'sql',
      'md',
      'rtf'
    ]);
    if (
      allowedTypes.includes(file.mimetype) ||
      allowedExt.has(ext) ||
      (file.mimetype && (file.mimetype.startsWith('image/') || file.mimetype.startsWith('text/')))
    ) {
      cb(null, true);
    } else {
      cb(new Error('File type not supported. Allowed formats: PDF, Word, PowerPoint, Excel, CSV, text, code (.py, .ipynb), images, and archives (.zip, .rar, .7z)'), false);
    }
  }
});

// Generic dynamic models — Firestore when USE_FIRESTORE=true, else Mongoose
const genericSchema = new mongoose.Schema({}, { strict: false, timestamps: true });
const dynamicModels = {};
const FS_DYNAMIC_MAP = {
  lessons: 'Lesson',
  projects: 'Project',
  assessments: 'Assessment',
  jobs: 'Job',
  content: 'Content',
  courses: 'Course',
  modules: 'Module',
  classroom: 'Classroom'
};
function useFirestoreRuntime() {
  return String(process.env.USE_FIRESTORE || '').toLowerCase() === 'true';
}
function getDynamicModel(collectionName) {
  if (useFirestoreRuntime()) {
    const fsModels = require('../firestore/models');
    const mapped = FS_DYNAMIC_MAP[collectionName];
    if (mapped && fsModels[mapped]) return fsModels[mapped];
    const cacheKey = `fs:${collectionName}`;
    if (!dynamicModels[cacheKey]) {
      const { createFsModel } = require('../firestore/FsModel');
      dynamicModels[cacheKey] = createFsModel(`Dyn_${collectionName}`, collectionName);
    }
    return dynamicModels[cacheKey];
  }
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
    // The full batch list is cached and small, so load it alongside students instead of after.
    const [users, batches] = await Promise.all([
      User.find({ role: 'student' }).select('-password').lean().exec(),
      Batch.find({}).select('name course').lean().exec()
    ]);
    const batchMap = new Map(batches.map((b) => [String(b._id), b]));

    const mapped = users.map((u) => {
      const enrollments = serializeEnrollments(u, batchMap);
      return {
        id: String(u._id),
        ...u,
        batchId: normalizeBatchId(u.batchId),
        enrollments,
        enrollmentNumbers: enrollments.map((e) => e.enrollmentNumber).filter(Boolean),
        batchIds: enrollments.map((e) => e.batchId)
      };
    });
    res.json(mapped);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Normalize email for consistent login lookup (Firestore queries are case-sensitive)
const normalizeEmail = (e) => (e || '').trim().toLowerCase();

// @route   POST /api/admin/users
// @desc    Create a new user (auto-assigns SKY enrollment number for students)
router.post('/users', async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      enrollmentNumber,
      course,
      batchId,
      status,
      role,
      phone,
      address,
      joiningDate,
    } = req.body;

    // Password is required for new users (needed for login)
    if (!password || !String(password).trim()) {
      return res.status(400).json({ message: 'Password is required for new users' });
    }

    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const existing = await User.findOne({ email: normalizedEmail }).select('_id').lean();
    if (existing) {
      return res.status(400).json({ message: 'A user with this email already exists' });
    }

    // Hash password (always use plain text from admin form; never store pre-hashed)
    let finalPassword = password;
    if (!password.startsWith('$2')) {
      const bcrypt = require('bcryptjs');
      const salt = await bcrypt.genSalt(10);
      finalPassword = await bcrypt.hash(password, salt);
    }

    const resolvedRole = role || 'student';
    const joinDate = joiningDate ? new Date(joiningDate) : new Date();
    if (Number.isNaN(joinDate.getTime())) {
      return res.status(400).json({ message: 'Invalid joining date' });
    }

    let finalEnrollment = enrollmentNumber ? String(enrollmentNumber).trim() : '';
    if (resolvedRole === 'student' && !finalEnrollment) {
      const allocated = await allocateEnrollmentNumber(User, joinDate);
      finalEnrollment = allocated.enrollmentNumber;
    }

    let finalFormNumber;
    if (resolvedRole === 'student') {
      const allocatedForm = await allocateFormNumber(User);
      finalFormNumber = allocatedForm.formNumber;
    }

    if (finalEnrollment) {
      const clash = await User.findOne({ enrollmentNumber: finalEnrollment }).select('_id email').lean();
      if (clash) {
        return res.status(400).json({
          message: `Enrollment number ${finalEnrollment} is already assigned to ${clash.email}`,
        });
      }
    }

    const userData = {
      name: String(name || '').trim(),
      email: normalizedEmail,
      password: finalPassword,
      enrollmentNumber: finalEnrollment || undefined,
      formNumber: finalFormNumber || undefined,
      course: course || '',
      batchId: batchId || null,
      status: status || 'active',
      role: resolvedRole,
      joiningDate: joinDate,
      createdAt: new Date(),
      enrollments: []
    };

    if (phone) userData.phone = String(phone).trim();
    if (address) userData.address = String(address).trim();

    const user = new User(userData);
    const saved = await user.save();

    let enrollmentMeta = null;
    // Multi-program enrollments array + Batch.students sync
    if (saved.role === 'student' && saved.batchId) {
      try {
        const { enrollment } = await enrollStudentInBatch(saved, saved.batchId);
        enrollmentMeta = enrollment;
      } catch (batchErr) {
        console.error('Warning: student created but enrollment sync failed:', batchErr.message);
        try {
          await Batch.findByIdAndUpdate(saved.batchId, {
            $addToSet: { students: saved._id },
          });
        } catch (_) {
          /* ignore */
        }
      }
    }

    res.json({
      id: String(saved._id),
      enrollmentNumber: enrollmentMeta?.enrollmentNumber || saved.enrollmentNumber || null,
      formNumber: saved.formNumber || null,
      enrollments: enrollmentMeta ? [enrollmentMeta] : [],
      message: 'User created successfully',
    });
  } catch (err) {
    console.error('Error creating user:', err);
    if (err && err.code === 11000) {
      return res.status(400).json({ message: 'Duplicate email, enrollment number, or form number' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/admin/users/:id/enrollments
// @desc    Enroll an existing student into another program/batch (new SKY ID)
router.post('/users/:id/enrollments', async (req, res) => {
  try {
    const studentId = req.params.id;
    const { batchId } = req.body || {};
    if (!batchId) {
      return res.status(400).json({ message: 'batchId is required' });
    }

    const user = await User.findById(studentId).exec();
    if (!user || user.role !== 'student') {
      return res.status(404).json({ message: 'Student not found' });
    }

    const batch = await Batch.findById(batchId).exec();
    if (!batch) {
      return res.status(404).json({ message: 'Batch not found' });
    }

    const { enrollment, created } = await enrollStudentInBatch(user, batch);
    const refreshed = await User.findById(studentId).select('-password').lean().exec();
    const batchDocs = await Batch.find({
      _id: { $in: activeEnrollments(refreshed).map((e) => e.batchId) }
    })
      .select('name course')
      .lean()
      .exec();
    const batchMap = new Map(batchDocs.map((b) => [String(b._id), b]));
    const enrollments = serializeEnrollments(refreshed, batchMap);
    const sameProgramCount = enrollments.filter(
      (e) =>
        String(e.course || '').toLowerCase() ===
        String(batch.course || enrollment.course || '').toLowerCase()
    ).length;

    res.status(created ? 201 : 200).json({
      success: true,
      message: created
        ? `Enrolled in ${batch.course || batch.name} (${batch.name}) with enrollment ${enrollment.enrollmentNumber}`
        : `Already enrolled in ${batch.name || batch.course}`,
      warning:
        sameProgramCount > 1
          ? `Student already had another enrollment in the same program (${batch.course}). Multi-program is intended for different courses (e.g. Data Science + Cyber).`
          : null,
      enrollment,
      enrollments,
      student: {
        id: String(refreshed._id),
        name: refreshed.name,
        email: refreshed.email,
        batchId: refreshed.batchId,
        enrollmentNumber: refreshed.enrollmentNumber,
        course: refreshed.course
      }
    });
  } catch (err) {
    console.error('Error enrolling student in program:', err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

// @route   DELETE /api/admin/users/:id/enrollments/:batchId
// @desc    Remove a student from one program/batch only
router.delete('/users/:id/enrollments/:batchId', async (req, res) => {
  try {
    const { id: studentId, batchId } = req.params;
    const user = await User.findById(studentId).exec();
    if (!user || user.role !== 'student') {
      return res.status(404).json({ message: 'Student not found' });
    }
    await unenrollStudentFromBatch(user, batchId);
    const refreshed = await User.findById(studentId).select('-password').lean().exec();
    res.json({
      success: true,
      message: 'Removed from program',
      enrollments: activeEnrollments(refreshed)
    });
  } catch (err) {
    console.error('Error removing enrollment:', err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

// @route   POST /api/admin/form-numbers/backfill
// @desc    Assign SS_US_##### form numbers to students (persistent, one per student)
router.post('/form-numbers/backfill', async (req, res) => {
  try {
    const dryRun = Boolean(req.body?.dryRun);
    const forceResequence = req.body?.forceResequence !== false; // default: full series from 11001
    const students = await User.find({ role: 'student' })
      .select('name email formNumber createdAt joiningDate')
      .lean();

    const { assignments, nextSeries } = planFormNumberBackfill(students, { forceResequence });
    const toWrite = assignments.filter((a) => !a.skipped);

    if (!dryRun) {
      for (const row of toWrite) {
        await User.findByIdAndUpdate(row.id, {
          $set: { formNumber: row.formNumber },
        });
      }
    }

    res.json({
      dryRun,
      forceResequence,
      totalStudents: students.length,
      updated: dryRun ? 0 : toWrite.length,
      wouldUpdate: toWrite.length,
      skipped: assignments.filter((a) => a.skipped).length,
      nextSeries,
      sample: assignments.slice(0, 10),
      message: dryRun
        ? 'Dry run complete — no changes written'
        : `Assigned form numbers to ${toWrite.length} student(s)`,
    });
  } catch (err) {
    console.error('Error backfilling form numbers:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/admin/enrollment/backfill
// @desc    Assign SKY_{MM}_{YYYY}_{series} enrollment numbers to all students
router.post('/enrollment/backfill', async (req, res) => {
  try {
    const dryRun = Boolean(req.body?.dryRun);
    const students = await User.find({ role: 'student' })
      .select('name email enrollmentNumber createdAt joiningDate')
      .lean();

    const { assignments, conflicts, nextSeries } = planBackfill(students);
    const toWrite = assignments.filter((a) => !a.skipped);

    if (!dryRun) {
      for (const row of toWrite) {
        await User.findByIdAndUpdate(row.id, {
          $set: {
            enrollmentNumber: row.enrollmentNumber,
            joiningDate: row.joinDate ? new Date(row.joinDate) : undefined,
          },
        });
      }
    }

    res.json({
      dryRun,
      totalStudents: students.length,
      updated: dryRun ? 0 : toWrite.length,
      wouldUpdate: toWrite.length,
      skipped: assignments.filter((a) => a.skipped).length,
      nextSeries,
      conflicts,
      sample: toWrite.slice(0, 10),
      message: dryRun
        ? 'Dry run complete — no changes written'
        : `Assigned enrollment numbers to ${toWrite.length} student(s)`,
    });
  } catch (err) {
    console.error('Error backfilling enrollment numbers:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// @route   GET /api/admin/enrollment/preview-next
// @desc    Preview the next enrollment number for a joining date
router.get('/enrollment/preview-next', async (req, res) => {
  try {
    const joinDate = req.query.joiningDate ? new Date(req.query.joiningDate) : new Date();
    if (Number.isNaN(joinDate.getTime())) {
      return res.status(400).json({ message: 'Invalid joining date' });
    }
    const allocated = await allocateEnrollmentNumber(User, joinDate);
    res.json(allocated);
  } catch (err) {
    console.error('Error previewing enrollment number:', err);
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
    delete updateData.role; // Role changes should be explicit elsewhere
    // Enrollment numbers are system-managed — do not allow arbitrary overwrite from edit form
    // unless explicitly provided and unique
    if (Object.prototype.hasOwnProperty.call(updateData, 'enrollmentNumber')) {
      const nextEn = updateData.enrollmentNumber ? String(updateData.enrollmentNumber).trim() : '';
      if (!nextEn) {
        delete updateData.enrollmentNumber;
      } else {
        const clash = await User.findOne({
          enrollmentNumber: nextEn,
          _id: { $ne: id },
        }).select('_id email').lean();
        if (clash) {
          return res.status(400).json({
            message: `Enrollment number ${nextEn} is already assigned to ${clash.email}`,
          });
        }
        updateData.enrollmentNumber = nextEn;
      }
    }
    if (updateData.joiningDate) {
      const jd = new Date(updateData.joiningDate);
      if (Number.isNaN(jd.getTime())) {
        return res.status(400).json({ message: 'Invalid joining date' });
      }
      updateData.joiningDate = jd;
    }

    await User.findByIdAndUpdate(id, updateData, { new: true }).exec();
    res.json({ message: 'User updated successfully' });
  } catch (err) {
    console.error('Error updating user:', err);
    if (err && err.code === 11000) {
      return res.status(400).json({ message: 'Duplicate email or enrollment number' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/admin/users/:id/password
// @desc    Update user password only (admin only)
router.put('/users/:id/password', async (req, res) => {
  try {
    // Validate request body structure
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ message: 'Invalid request body' });
    }

    const { id } = req.params;
    const { newPassword, confirmPassword } = req.body;

    // Validation
    if (!newPassword || !confirmPassword) {
      return res.status(400).json({ message: 'Both password fields are required' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }

    // Password strength requirements
    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters long' });
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/.test(newPassword)) {
      return res.status(400).json({ 
        message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character' 
      });
    }

    // Check if user exists
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Hash new password
    const bcrypt = require('bcryptjs');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    const { invalidateSessionCache } = require('../middleware/sessionGuard');
    const nextTv = Number(user.tokenVersion || 0) + 1;

    // Update user password and revoke all existing sessions
    await User.findByIdAndUpdate(id, { 
      password: hashedPassword,
      tokenVersion: nextTv,
      updatedAt: new Date()
    });
    invalidateSessionCache(id);

    // Log activity for audit trail
    try {
      await ActivityLog.create({
        user: req.user.id,
        action: 'Password Updated',
        details: `Admin ${req.user.name} updated password for user ${user.name} (${user.email})`,
        timestamp: new Date(),
        ipAddress: req.ip || req.connection.remoteAddress
      });
    } catch (logError) {
      console.error('Error logging password update:', logError);
      // Continue even if logging fails
    }

    res.json({ 
      message: 'Password updated successfully',
      userUpdated: true,
      sessionsInvalidated: true
    });
  } catch (err) {
    console.error('Error updating user password:', err);
    // Ensure we always return proper JSON
    try {
      res.status(500).json({ 
        message: 'Server error while updating password',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    } catch (jsonError) {
      console.error('Failed to send JSON error response:', jsonError);
      res.status(500).set('Content-Type', 'application/json').end('{"message":"Server error"}');
    }
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

// @route   GET /api/admin/liveClasses (and /live-classes)
// @desc    List Google Meet / live classes for admin UI
async function listAdminLiveClasses(req, res) {
  try {
    const includeCancelled = String(req.query.includeCancelled || '') === 'true';
    const query = includeCancelled ? {} : { status: { $ne: 'cancelled' } };
    const docs = await LiveClass.find(query).sort({ scheduledStart: 1 }).lean().exec();
    const items = docs.map((o) => {
      const start = o.scheduledStart ? new Date(o.scheduledStart) : null;
      const tz = o.timezone || 'Asia/Kolkata';
      return {
        id: String(o._id),
        title: o.title,
        description: o.description || '',
        batchId: o.batchId || '',
        teacherId: o.teacherId || '',
        teacherName: o.teacherName || o.instructor || '',
        instructor: o.teacherName || o.instructor || '',
        course: o.course || '',
        scheduledStart: start ? start.toISOString() : null,
        scheduledEnd: o.scheduledEnd || null,
        scheduledDate: start
          ? start.toLocaleDateString('en-CA', { timeZone: tz })
          : o.scheduledDate || '',
        scheduledTime: start
          ? start.toLocaleTimeString('en-GB', {
              timeZone: tz,
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
            })
          : o.scheduledTime || '',
        duration: o.duration || '60 mins',
        status: o.status || 'scheduled',
        meetLink: o.meetLink || '',
        zoomLink: o.meetLink || o.zoomLink || '',
        calendarEventId: o.calendarEventId || '',
        jointLeadId: o.jointLeadId || '',
        jointBatchNames: o.jointBatchNames || null,
        timezone: tz,
        createdAt: o.createdAt
      };
    });
    res.json(items);
  } catch (err) {
    console.error('Error listing admin live classes:', err);
    res.status(500).json({ message: 'Server error' });
  }
}

router.get('/liveClasses', listAdminLiveClasses);
router.get('/live-classes', listAdminLiveClasses);

// @route   GET /api/admin/live-now
// @desc    Classes running right now, one card per room (combined-class followers folded into their lead)
router.get('/live-now', async (req, res) => {
  try {
    const rows = await LiveClass.find({ status: 'live' }).lean().exec();
    const batchIds = [...new Set(rows.map((r) => String(r.batchId || '')).filter(Boolean))];
    const batches = batchIds.length
      ? await Batch.find({ _id: { $in: batchIds } }).select('name students').lean().exec()
      : [];
    const batchById = new Map(batches.map((b) => [String(b._id), b]));
    const present = (r) =>
      (Array.isArray(r.attendance) ? r.attendance : []).filter(
        (a) => String(a.status || '').toLowerCase() === 'present'
      ).length;

    const leads = rows.filter((r) => !r.jointLeadId || !rows.some((o) => String(o._id) === String(r.jointLeadId)));
    const items = leads.map((lead) => {
      const group = [lead, ...rows.filter((r) => String(r.jointLeadId || '') === String(lead._id))];
      const groupBatches = group.map((r) => batchById.get(String(r.batchId || ''))).filter(Boolean);
      return {
        id: String(lead._id),
        title: lead.title || 'Live class',
        teacherName: lead.teacherName || lead.instructor || '',
        provider: lead.conferenceProvider || (lead.zoomLink ? 'zoom' : 'meet'),
        batchNames: groupBatches.map((b) => b.name),
        rosterCount: groupBatches.reduce((sum, b) => sum + (b.students || []).length, 0),
        joinedCount: group.reduce((sum, r) => sum + present(r), 0),
        startedAt: lead.actualStartedAt || lead.scheduledStart || null,
        scheduledEnd: lead.scheduledEnd || null
      };
    });
    items.sort((a, b) => new Date(a.startedAt || 0) - new Date(b.startedAt || 0));
    res.json({ success: true, liveClasses: items });
  } catch (err) {
    console.error('Error listing live-now classes:', err);
    res.status(500).json({ success: false, message: 'Could not load live classes' });
  }
});

// @route   GET /api/admin/activity
// @desc    Get activity log (logins, video views, etc.) from ActivityLog + User fallback
const ATTENDANCE_SUMMARY_CACHE_MS = 5 * 60 * 1000;
const attendanceSummaryCache = new Map();

async function getCachedAttendanceSummary(batchId) {
  const hit = attendanceSummaryCache.get(batchId);
  if (hit && Date.now() - hit.at < ATTENDANCE_SUMMARY_CACHE_MS) return hit.summary;
  try {
    const summary = await require('../services/attendanceAnalytics').getBatchAttendanceSummary(batchId);
    attendanceSummaryCache.set(batchId, { at: Date.now(), summary });
    return summary;
  } catch (_) {
    return null;
  }
}

// @route   GET /api/admin/attendance-alerts
// @desc    Recent consecutive no-join streak alerts for admin overview
router.get('/attendance-alerts', roleAuth('admin'), async (req, res) => {
  try {
    const limit = Math.min(50, parseInt(req.query.limit || '20', 10) || 20);
    const logs = await ActivityLog.find({
      action: { $in: ['ATTENDANCE_STREAK_ALERT', 'ENGAGEMENT_NUDGE', 'ENGAGEMENT_DIGEST'] }
    })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean()
      .exec();

    const streakBatchIds = [
      ...new Set(
        logs
          .filter((l) => l.action === 'ATTENDANCE_STREAK_ALERT' && l.userId && l.path)
          .map((l) => String(l.path))
      )
    ];
    const summaries = new Map(
      await Promise.all(
        streakBatchIds.map(async (batchId) => [batchId, await getCachedAttendanceSummary(batchId)])
      )
    );

    const alerts = [];
    for (const l of logs) {
      let engagement = null;
      if (l.action === 'ATTENDANCE_STREAK_ALERT' && l.userId && l.path) {
        const summary = summaries.get(String(l.path));
        const student = (summary?.students || []).find((s) => s.studentId === String(l.userId));
        engagement = student?.engagement || 'Unengaged';
      } else if (l.action === 'ENGAGEMENT_NUDGE') {
        const title = String(l.videoTitle || '');
        if (title.startsWith('Unengaged')) engagement = 'Unengaged';
        else if (title.startsWith('Passive')) engagement = 'Passive';
        else engagement = 'Passive';
      }

      alerts.push({
        id: String(l._id),
        type: l.action,
        studentId: l.userId,
        studentName: l.userName || '',
        studentEmail: l.userEmail || '',
        batchId: l.path || '',
        batchName: l.assessmentTitle || '',
        consecutiveAbsent: l.action === 'ATTENDANCE_STREAK_ALERT' ? l.score || null : null,
        joinRate: l.action === 'ENGAGEMENT_NUDGE' ? l.score || null : null,
        engagement,
        lastSessionId: l.action === 'ATTENDANCE_STREAK_ALERT' ? l.videoId || '' : '',
        lastSessionTitle: l.videoTitle || '',
        timestamp: l.timestamp
      });
    }
    res.json({ success: true, alerts });
  } catch (error) {
    console.error('GET /admin/attendance-alerts error:', error);
    res.status(500).json({ success: false, message: 'Failed to load attendance alerts' });
  }
});

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

// @route   GET /api/admin/students/:studentId/report.pdf
// @desc    Download full student dossier PDF (personal, batch, login, interactivity)
router.get('/students/:studentId/report.pdf', async (req, res) => {
  try {
    const { studentId } = req.params;
    const { startDate, endDate, period } = req.query;

    const student = await User.findById(studentId).select('-password').lean();
    if (!student || student.role !== 'student') {
      return res.status(404).json({ message: 'Student not found' });
    }

    let batch = null;
    let oneToOneBatch = null;
    if (student.batchId) {
      try {
        batch = await Batch.findById(student.batchId).lean();
      } catch (_) {
        batch = null;
      }
    }
    if (student.oneToOneBatchId) {
      try {
        oneToOneBatch = await OneToOneBatch.findById(student.oneToOneBatchId).lean();
      } catch (_) {
        oneToOneBatch = null;
      }
    }

    const filter = { userId: String(studentId) };
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.timestamp.$lte = end;
      }
    }

    const activities = await ActivityLog.find(filter)
      .sort({ timestamp: -1 })
      .limit(500)
      .lean();

    const formattedActivities = activities.map((doc) => ({
      action: doc.action,
      timestamp: doc.timestamp,
      ipAddress: doc.ipAddress || null,
      city: doc.city || null,
      country: doc.country || null,
      isp: doc.isp || null,
      videoTitle: doc.videoTitle || null,
      assessmentTitle: doc.assessmentTitle || null,
      score: doc.score,
      path: doc.path || null,
    }));

    const summary = {
      totalActivities: formattedActivities.length,
      videoViews: formattedActivities.filter((a) => a.action === 'video_view').length,
      logins: formattedActivities.filter((a) => a.action === 'login').length,
      assessments: formattedActivities.filter(
        (a) => a.action === 'assessment_submit' || a.action === 'assessment'
      ).length,
    };

    let periodLabel = 'All available activity';
    if (startDate && endDate) {
      periodLabel = `${startDate} to ${endDate}`;
    } else if (period) {
      periodLabel = `Last ${period} day(s)`;
    }

    const formNo = await ensureStudentFormNumber(User, student);
    const pdfBuffer = await buildStudentReportPdf({
      student: { ...student, id: String(student._id), formNumber: formNo },
      batch: batch
        ? { ...batch, id: String(batch._id) }
        : null,
      oneToOneBatch: oneToOneBatch
        ? { ...oneToOneBatch, id: String(oneToOneBatch._id) }
        : null,
      period: { label: periodLabel, startDate, endDate },
      summary,
      activities: formattedActivities,
      formNo,
      generatedAt: new Date(),
    });

    const safeName = String(student.name || 'student')
      .replace(/[^\w\-]+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 40);
    const filename = `sky-states-report-${safeName}-${new Date().toISOString().slice(0, 10)}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    return res.send(pdfBuffer);
  } catch (err) {
    console.error('Error generating student PDF report:', err);
    res.status(500).json({ message: 'Failed to generate PDF report', error: err.message });
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

// @route   GET /api/admin/teachers/:id/session-stats
router.get('/teachers/:id/session-stats', async (req, res) => {
  try {
    const teacherId = String(req.params.id);
    const sessions = await LiveClass.find({ teacherId }).sort({ scheduledStart: -1 }).lean().exec();
    let presentSum = 0;
    let rosterSum = 0;
    let hoursTaught = 0;
    for (const s of sessions) {
      if (s.status === 'cancelled') continue;
      const att = Array.isArray(s.attendance) ? s.attendance : [];
      const present = att.filter((a) => a.status === 'present' || a.status === 'late').length;
      presentSum += present;
      rosterSum += att.length || 0;
      const mins = parseInt(String(s.duration || '60').match(/(\d+)/)?.[1] || '60', 10);
      if (s.status === 'completed' || s.status === 'live') hoursTaught += mins / 60;
    }
    const stats = {
      teacherId,
      sessionsTotal: sessions.length,
      sessionsScheduled: sessions.filter((s) => s.status === 'scheduled').length,
      sessionsLive: sessions.filter((s) => s.status === 'live').length,
      sessionsCompleted: sessions.filter((s) => s.status === 'completed').length,
      sessionsCancelled: sessions.filter((s) => s.status === 'cancelled').length,
      recordingsUploaded: sessions.filter((s) => s.driveFileId).length,
      avgAttendanceRate: rosterSum > 0 ? Math.round((presentSum / rosterSum) * 100) : 0,
      hoursTaught: Math.round(hoursTaught * 10) / 10,
      recent: sessions.slice(0, 10).map((s) => ({
        id: String(s._id),
        title: s.title,
        batchId: s.batchId,
        status: s.status,
        scheduledStart: s.scheduledStart,
        attendanceCount: (s.attendance || []).filter(
          (a) => a.status === 'present' || a.status === 'late'
        ).length,
        hasRecording: Boolean(s.driveFileId)
      }))
    };
    const teacher = await User.findById(teacherId)
      .select('name email isAvailable weeklyAvailability availabilityUpdatedAt')
      .lean()
      .exec();
    const live = await findLiveClassForTeacher(teacherId);
    const presence = attachPresence(teacher || {}, live);
    res.json({
      success: true,
      stats,
      teacher: teacher
        ? {
            id: String(teacher._id),
            name: teacher.name,
            email: teacher.email,
            weeklyAvailability: teacher.weeklyAvailability || [],
            ...presence
          }
        : null
    });
  } catch (error) {
    console.error('GET teacher session-stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to load session stats' });
  }
});

// @route   GET /api/admin/teachers
// @desc    Get all teachers
router.get('/teachers', async (req, res) => {
  try {
    const teachers = await User.find({ role: 'teacher' }).select('-password').lean().exec();
    const liveMap = await findLiveClassesForTeachers(teachers.map((t) => t._id));
    const mapped = teachers.map((t) => {
      const presence = attachPresence(t, liveMap[String(t._id)]);
      return { id: String(t._id), ...t, ...presence };
    });
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
    const { name, email, password, age, domain, assignedCourses, experience, status, role, phone, address } = req.body;

    console.log('🔍 Backend received teacher data:', { name, email, age, domain, assignedCourses, experience, status, role, phone, address });

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

    // Handle assignedCourses array
    if (assignedCourses && Array.isArray(assignedCourses) && assignedCourses.length > 0) {
      teacherData.assignedCourses = assignedCourses;
      // Always set domain to first course for consistency
      teacherData.domain = assignedCourses[0];
      console.log('✅ Backend: Creating teacher with assignedCourses:', assignedCourses);
    } else if (domain) {
      // For backward compatibility, if only domain is provided, populate assignedCourses
      teacherData.assignedCourses = [domain];
      console.log('✅ Backend: Creating teacher with domain only:', domain);
    } else {
      console.log('⚠️ Backend: Creating teacher with no course assignment');
    }

    if (phone) teacherData.phone = phone;
    if (address) teacherData.address = address;
    if (req.body.conferenceProvider === 'zoom' || req.body.conferenceProvider === 'meet') {
      teacherData.conferenceProvider = req.body.conferenceProvider;
    }
    if (req.body.zoomUserId !== undefined) {
      teacherData.zoomUserId = String(req.body.zoomUserId || '').trim();
    }

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
    const { assignedCourses, domain, ...otherData } = req.body;
    
    console.log('🔍 Backend received teacher update data:', { id, assignedCourses, domain, otherData });
    
    const updateData = {
      ...otherData,
      updatedAt: new Date()
    };

    // Handle assignedCourses array - always prioritize assignedCourses over domain
    if (assignedCourses && Array.isArray(assignedCourses) && assignedCourses.length > 0) {
      updateData.assignedCourses = assignedCourses;
      // Always update domain to first course for consistency
      updateData.domain = assignedCourses[0];
      console.log('✅ Backend: Updated with assignedCourses:', assignedCourses);
    } else if (domain !== undefined && domain !== null && domain !== '') {
      // If only domain is provided, update assignedCourses for consistency
      updateData.domain = domain;
      updateData.assignedCourses = [domain];
      console.log('✅ Backend: Updated with domain only:', domain);
    } else if (domain === null) {
      // Allow clearing domain
      updateData.domain = null;
      console.log('✅ Backend: Cleared domain');
    } else {
      console.log('⚠️ Backend: No course assignment data provided');
    }

    const updatedTeacher = await User.findByIdAndUpdate(id, updateData, { new: true }).exec();
    console.log('✅ Backend: Teacher updated successfully:', {
      id: updatedTeacher._id,
      name: updatedTeacher.name,
      assignedCourses: updatedTeacher.assignedCourses,
      domain: updatedTeacher.domain
    });
    
    const responseObj = { 
      message: 'Teacher updated successfully',
      teacher: updatedTeacher.toObject()
    };
    
    console.log('🔍 Backend: Sending response object:', {
      hasMessage: !!responseObj.message,
      hasTeacher: !!responseObj.teacher,
      teacherId: responseObj.teacher?._id,
      teacherAssignedCourses: responseObj.teacher?.assignedCourses
    });
    
    res.json(responseObj);
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

// @route   GET /api/admin/classroom
// @desc    Get all classroom videos (optionally filtered by batchId)
// @access  Private (Admin only)
router.get('/classroom', async (req, res) => {
  try {
    const { batchId, assignment, page, limit } = req.query;

    let query = {};
    if (batchId) {
      query.batchId = String(batchId).trim();
    }

    const videos = await Classroom.find(query).lean().exec();
    const mappedVideos = videos.map((v) => ({
      id: String(v._id),
      ...v,
      batchId: normalizeBatchId(v.batchId)
    }));

    const isUnassigned = (v) => {
      const b = v.batchId;
      if (b == null || b === '') return true;
      const s = String(b).trim().toLowerCase();
      return !s || s === 'null' || s === 'undefined' || s === 'unassigned';
    };

    const assignedCount = mappedVideos.filter((v) => !isUnassigned(v)).length;
    const unassignedCount = mappedVideos.filter(isUnassigned).length;

    const assignmentFilter = String(assignment || '').toLowerCase();
    let filtered = mappedVideos;
    if (assignmentFilter === 'unassigned') {
      filtered = mappedVideos.filter(isUnassigned);
    } else if (assignmentFilter === 'assigned') {
      filtered = mappedVideos.filter((v) => !isUnassigned(v));
    }

    filtered = sortLessonsNewestFirst(filtered);

    const wantsPagination = page != null && page !== '';
    if (!wantsPagination) {
      // Legacy/array clients (e.g. batch detail by batchId)
      res.set('X-Classroom-Assigned-Count', String(assignedCount));
      res.set('X-Classroom-Unassigned-Count', String(unassignedCount));
      return res.json(filtered);
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(100, Math.max(5, parseInt(limit, 10) || 25));
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(pageNum, totalPages);
    const start = (safePage - 1) * pageSize;
    const pageVideos = filtered.slice(start, start + pageSize);

    return res.json({
      videos: pageVideos,
      page: safePage,
      limit: pageSize,
      total,
      totalPages,
      counts: {
        assigned: assignedCount,
        unassigned: unassignedCount
      }
    });
  } catch (error) {
    console.error('Error fetching classroom videos:', error);
    res.status(500).json({ message: 'Error fetching classroom videos' });
  }
});

// @route   PATCH /api/admin/classroom/:id/visibility
// @desc    Show or hide a lecture from students
// @access  Private (Admin only)
router.patch('/classroom/:id/visibility', async (req, res) => {
  try {
    const { id } = req.params;
    const visible = req.body?.studentVisible ?? req.body?.visible;
    if (visible === undefined || visible === null) {
      return res.status(400).json({ message: 'studentVisible (boolean) is required' });
    }

    const lecture = await Classroom.findById(id).exec();
    if (!lecture) {
      return res.status(404).json({ message: 'Lecture not found' });
    }

    lecture.studentVisible = Boolean(visible);
    lecture.updatedAt = new Date();
    await lecture.save();

    res.json({
      success: true,
      message: lecture.studentVisible ? 'Lecture is visible to students' : 'Lecture hidden from students',
      lecture: {
        id: String(lecture._id),
        studentVisible: lecture.studentVisible !== false
      }
    });
  } catch (error) {
    console.error('Error updating lecture visibility:', error);
    res.status(500).json({ message: 'Failed to update visibility' });
  }
});

// @route   POST /api/admin/classroom/youtube-url
// @desc    Save manual YouTube URL video metadata (optionally with notes upload)
// @access  Private (Admin only)
router.post('/classroom/youtube-url', notesUpload.single('notesFile'), async (req, res) => {
  try {
    // Ensure uploads directory exists
    const fs = require('fs');
    const path = require('path');
    const uploadsDir = path.join(__dirname, '..', 'uploads', 'notes');
    
    if (!fs.existsSync(uploadsDir)) {
      console.log('Creating uploads directory:', uploadsDir);
      try {
        fs.mkdirSync(uploadsDir, { recursive: true });
      } catch (mkdirError) {
        console.error('Failed to create uploads directory:', mkdirError);
        return res.status(500).json({
          message: 'Server configuration error: Cannot create upload directory',
          code: 'UPLOAD_DIR_ERROR'
        });
      }
    }
    
    // Check directory permissions
    try {
      fs.accessSync(uploadsDir, fs.constants.W_OK);
      console.log('Uploads directory is writable:', uploadsDir);
    } catch (accessError) {
      console.error('Uploads directory is not writable:', accessError);
      return res.status(500).json({
        message: 'Server configuration error: Upload directory not writable',
        code: 'UPLOAD_DIR_PERMISSION'
      });
    }

    // Enhanced logging for file upload debugging
    console.log('YouTube URL upload request received:', {
      body: req.body,
      file: req.file ? {
        fieldname: req.file.fieldname,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        destination: req.file.destination,
        filename: req.file.filename,
        path: req.file.path
      } : null,
      headers: req.headers
    });
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
    const batchIdNorm = (batchId && typeof batchId === 'string') ? batchId.trim() : '';
    if (!batchIdNorm) {
      return res.status(400).json({
        message: 'Batch is required. Videos without a batch do not show for trainers or students.'
      });
    }
    {
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
      batchId: batchIdNorm,
      domain: domain?.trim() || null,
      duration: duration || null,
      courseType: courseType?.trim() || null,
      type: type?.trim() || 'Lecture',
      date: date || new Date().toISOString().split('T')[0],
      videoSource: 'youtube-url',
      youtubeVideoId: youtubeVideoId,
      youtubeVideoUrl: youtubeVideoUrl,
      youtubeEmbedUrl: youtubeEmbedUrl || `https://www.youtube.com/embed/${youtubeVideoId}`,
      studentVisible: true,
      uploadedBy: req.user.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Attach notes metadata if provided with enhanced validation
    const notesFlag = String(notesAvailable).trim().toLowerCase() === 'true';
    if (notesFlag && (req.file || notesFileName)) {
      lectureData.notesAvailable = true;
      lectureData.notesFileName = (notesFileName || req.file?.originalname || '').trim() || undefined;
      
      if (req.file) {
        // Validate file size
        if (req.file.size > NOTES_MAX_FILE_SIZE) {
          return res.status(413).json({
            message: 'File too large. Maximum size is 100MB.',
            code: 'FILE_TOO_LARGE'
          });
        }
        
        // Check if file actually exists on disk
        const fs = require('fs');
        const filePath = req.file.path;
        if (!fs.existsSync(filePath)) {
          return res.status(500).json({
            message: 'Uploaded file was not saved properly.',
            code: 'FILE_NOT_SAVED'
          });
        }
        
        console.log('Notes file upload processed:', {
          originalname: req.file.originalname,
          filename: req.file.filename,
          size: req.file.size,
          mimetype: req.file.mimetype
        });
        
        lectureData.notesFilePath = `/uploads/notes/${req.file.filename}`;
        const driveNotes = await persistNotesToDrive({
          file: req.file,
          batchId: lectureData.batchId,
          lectureTitle: lectureData.title
        });
        Object.assign(lectureData, driveNotes);
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
        Object.assign(
          videoData,
          await persistNotesToDrive({
            file: req.file,
            batchId: videoData.batchId,
            lectureTitle: videoData.title
          })
        );
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

    const rawDrive = req.body.driveUrl || driveId || req.body.drive;
    const resolvedDriveId = rawDrive
      ? (googleDriveService.extractDriveFileId(rawDrive) || String(rawDrive).trim())
      : null;

    // Validate that at least one video source is provided
    const hasVideoSource = zoomUrl || resolvedDriveId || youtubeVideoUrl || videoSource;
    if (!hasVideoSource) {
      return res.status(400).json({ 
        message: 'A video source is required. Please provide either a Zoom URL, Drive ID/URL, or YouTube URL.' 
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
    // batchId is required for trainer/student visibility — empty string unassigns the video
    // and it only remains visible in the admin global list.
    if (batchId !== undefined) {
      const batchIdNorm = String(batchId || '').trim();
      if (!batchIdNorm) {
        return res.status(400).json({
          message:
            'Batch is required. Videos without a batch do not show for trainers or students.'
        });
      }
      const batchDoc = await Batch.findById(batchIdNorm).select('_id name').lean().exec();
      if (!batchDoc) {
        return res.status(400).json({ message: 'Selected batch was not found.' });
      }
      videoData.batchId = batchIdNorm;
      // Re-assigning to a batch should make the lecture visible unless admin hid it explicitly.
      if (req.body.studentVisible === undefined && req.body.visible === undefined) {
        videoData.studentVisible = true;
      }
    }

    // Add video source specific fields — only clear other sources when explicitly switching.
    if (zoomUrl) {
      videoData.zoomUrl = zoomUrl;
      videoData.zoomPasscode = zoomPasscode;
      videoData.videoSource = 'zoom';
      videoData.driveId = null;
      videoData.youtubeVideoId = null;
      videoData.youtubeVideoUrl = null;
      videoData.youtubeEmbedUrl = null;
    } else if (resolvedDriveId && (videoSource === 'drive' || req.body.forceDrive || (!youtubeVideoUrl && videoSource !== 'youtube-url'))) {
      videoData.driveId = resolvedDriveId;
      videoData.videoSource = 'drive';
      videoData.zoomUrl = null;
      videoData.zoomPasscode = null;
      videoData.youtubeVideoId = null;
      videoData.youtubeVideoUrl = null;
      videoData.youtubeEmbedUrl = null;
    } else if (youtubeVideoUrl || videoSource === 'youtube-url') {
      videoData.videoSource = 'youtube-url';
      if (youtubeVideoId !== undefined) videoData.youtubeVideoId = youtubeVideoId;
      if (youtubeVideoUrl !== undefined) videoData.youtubeVideoUrl = youtubeVideoUrl;
      if (youtubeEmbedUrl !== undefined) videoData.youtubeEmbedUrl = youtubeEmbedUrl;
      if (resolvedDriveId) videoData.driveId = resolvedDriveId;
      videoData.zoomUrl = null;
      videoData.zoomPasscode = null;
      // Keep existing Drive archive link if present; do not wipe on YouTube metadata edits.
    }

    // Attach or update notes metadata if provided
    if (typeof notesAvailable !== 'undefined') {
      const notesFlag = String(notesAvailable).trim().toLowerCase() === 'true';
      if (notesFlag && (req.file || notesFileName)) {
        videoData.notesAvailable = true;
        videoData.notesFileName = (notesFileName || req.file?.originalname || '').trim() || undefined;
        if (req.file) {
          videoData.notesFilePath = `/uploads/notes/${req.file.filename}`;
          Object.assign(
            videoData,
            await persistNotesToDrive({
              file: req.file,
              batchId: videoData.batchId || req.body.batchId,
              lectureTitle: videoData.title || req.body.title
            })
          );
        }
      } else {
        // Explicitly clear notes when notesAvailable is false
        videoData.notesAvailable = false;
        videoData.notesFileName = null;
        videoData.notesFilePath = null;
      }
    } else if (req.file) {
      videoData.notesAvailable = true;
      videoData.notesFileName = (notesFileName || req.file.originalname || '').trim() || undefined;
      videoData.notesFilePath = `/uploads/notes/${req.file.filename}`;
      Object.assign(
        videoData,
        await persistNotesToDrive({
          file: req.file,
          batchId: videoData.batchId || req.body.batchId,
          lectureTitle: videoData.title || req.body.title
        })
      );
    }

    const updatedLecture = await Classroom.findByIdAndUpdate(id, videoData, { new: true }).exec();

    if (videoData.videoSource === 'drive' && videoData.driveId) {
      await LiveClass.updateMany(
        { $or: [{ classroomDocId: id }, { classroomId: id }, { classroomLectureId: id }] },
        { $set: { driveFileId: videoData.driveId, status: 'ready-drive-fallback' } }
      );
    }

    res.json({ message: 'Video updated successfully', lecture: updatedLecture });
  } catch (err) {
    console.error('Error updating classroom video:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/admin/classroom/:id/set-drive
// @desc    Update classroom video to Google Drive playback link/id (e.g. when YouTube deletes video)
router.post('/classroom/:id/set-drive', async (req, res) => {
  try {
    const { id } = req.params;
    const raw = req.body.driveUrl || req.body.driveId || req.body.drive;
    if (!raw) {
      return res.status(400).json({ message: 'driveUrl or driveId is required' });
    }
    const resolvedId = googleDriveService.extractDriveFileId(raw) || String(raw).trim();
    if (!resolvedId) {
      return res.status(400).json({ message: 'Could not extract Google Drive file ID from link' });
    }
    const videoData = {
      driveId: resolvedId,
      videoSource: 'drive',
      youtubeVideoId: null,
      youtubeVideoUrl: null,
      youtubeEmbedUrl: null,
      studentVisible: true,
      updatedAt: new Date().toISOString()
    };
    const updated = await Classroom.findByIdAndUpdate(id, { $set: videoData }, { new: true }).exec();
    if (!updated) {
      return res.status(404).json({ message: 'Lecture not found' });
    }
    await LiveClass.updateMany(
      { $or: [{ classroomDocId: id }, { classroomId: id }, { classroomLectureId: id }] },
      { $set: { driveFileId: resolvedId, status: 'ready-drive-fallback' } }
    );
    res.json({
      success: true,
      message: 'Classroom recording updated to Google Drive fallback successfully',
      lecture: updated
    });
  } catch (err) {
    console.error('Error updating classroom to drive:', err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

// @route   POST /api/admin/classroom/fallback-deleted-youtube
// @desc    Scan for deleted YouTube videos and switch them to Google Drive fallback
router.post('/classroom/fallback-deleted-youtube', async (req, res) => {
  try {
    const { google } = require('googleapis');
    const youtubeService = require('../services/youtubeService');
    const yt = google.youtube({ version: 'v3', auth: youtubeService.oauth2Client });

    const classrooms = await Classroom.find({
      youtubeVideoId: { $nin: ['', null] },
      driveId: { $nin: ['', null] }
    }).lean().exec();

    const results = [];
    for (const room of classrooms) {
      let isAlive = false;
      try {
        const check = await yt.videos.list({ part: ['status'], id: [room.youtubeVideoId] });
        isAlive = Boolean(check.data.items?.length);
      } catch (checkErr) {
        isAlive = true; // don't flag if check itself failed
      }

      if (!isAlive) {
        if (!req.body.dryRun) {
          await Classroom.findByIdAndUpdate(room._id, {
            $set: {
              videoSource: 'drive',
              youtubeVideoId: null,
              youtubeVideoUrl: null,
              youtubeEmbedUrl: null,
              studentVisible: true,
              updatedAt: new Date().toISOString()
            }
          });
          await LiveClass.updateMany(
            { $or: [{ classroomDocId: room._id }, { classroomId: room._id }, { classroomLectureId: room._id }] },
            { $set: { driveFileId: room.driveId, status: 'ready-drive-fallback' } }
          );
        }
        results.push({ id: room._id, title: room.title, driveId: room.driveId, action: req.body.dryRun ? 'detected' : 'switched_to_drive' });
      }
    }

    res.json({
      success: true,
      count: results.length,
      dryRun: Boolean(req.body.dryRun),
      switched: results
    });
  } catch (err) {
    console.error('Error falling back deleted YouTube videos:', err);
    res.status(500).json({ message: err.message || 'Server error' });
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
    const Jobs = getDynamicModel('jobs');
    const [studentsCount, coursesCount, activeJobs] = await Promise.all([
      User.countDocuments({ role: 'student' }),
      Course.countDocuments({}),
      Jobs.countDocuments({ status: 'active' })
    ]);

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
        const { name, course, startDate, endDate, teacherId, teacherName, status, batchType, programLabel, resourceUniverse } = req.body;
        
        // Validate required fields
        if (!name || !course || !teacherId) {
            return res.status(400).json({ message: 'Batch name, course, and teacher are required' });
        }

        const resolvedType = ['one-to-one', 'project'].includes(batchType) ? batchType : 'regular';
        
        const batchData = {
          name,
          course,
          batchType: resolvedType,
          programLabel: programLabel || (resolvedType !== 'regular' ? course : ''),
          startDate: startDate || null,
          endDate: endDate || null,
          teacherId,
          teacherName: teacherName || '',
          status: status || 'active',
          resourceUniverse: resourceUniverse || 'data-science-ai'
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
/**
 * Replace a batch's combined-class links with `wanted` (all taught by `teacherId`), keeping
 * every link symmetric. Batches previously linked but not wanted are unlinked on both sides.
 */
async function saveCombinedLinks(batch, requested, teacherId, { dropOtherTrainers = false } = {}) {
  const id = String(batch._id);
  const siblings = teacherId ? await Batch.find({ teacherId: String(teacherId) }).lean().exec() : [];
  const siblingIds = new Set(siblings.map((b) => String(b._id)));
  const wanted = dropOtherTrainers ? requested.filter((b) => siblingIds.has(b)) : requested;
  if (wanted.some((b) => !siblingIds.has(b))) {
    const err = new Error('Only batches taught by the same trainer can be combined.');
    err.status = 400;
    throw err;
  }
  await Batch.updateOne({ _id: id }, { $set: { combinedClassWith: wanted, updatedAt: new Date() } });
  const others = new Map(siblings.map((b) => [String(b._id), b]));
  for (const oldId of (batch.combinedClassWith || []).map(String)) {
    if (!others.has(oldId)) {
      const old = await Batch.findById(oldId).lean().exec();
      if (old) others.set(oldId, old);
    }
  }
  for (const [otherId, other] of others) {
    if (otherId === id) continue;
    const links = new Set((other.combinedClassWith || []).map(String));
    const shouldLink = wanted.includes(otherId);
    if (shouldLink === links.has(id)) continue;
    if (shouldLink) links.add(id);
    else links.delete(id);
    await Batch.updateOne({ _id: otherId }, { $set: { combinedClassWith: [...links], updatedAt: new Date() } });
  }
  return wanted;
}

router.put('/batches/:id', async (req, res) => {
    try {
        const { name, course, startDate, endDate, teacherId, teacherName, status, batchType, programLabel, resourcesEnabled, resourceUniverse, mergeWithBatchId } = req.body;

        const existing = await Batch.findById(req.params.id).lean().exec();
        if (!existing) {
          return res.status(404).json({ message: 'Batch not found' });
        }

        const trainerChanging =
          teacherId !== undefined && String(teacherId || '') !== String(existing.teacherId || '');
        let mergeTarget = null;
        if (mergeWithBatchId) {
          mergeTarget = await Batch.findById(String(mergeWithBatchId)).lean().exec();
          const targetTeacher = String(teacherId !== undefined ? teacherId || '' : existing.teacherId || '');
          if (
            !mergeTarget ||
            String(mergeTarget._id) === String(existing._id) ||
            !targetTeacher ||
            String(mergeTarget.teacherId || '') !== targetTeacher
          ) {
            return res.status(400).json({ message: 'Pick a batch taught by the new trainer to merge with.' });
          }
        }

        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (course !== undefined) updateData.course = course;
        if (startDate !== undefined) updateData.startDate = startDate || null;
        if (endDate !== undefined) updateData.endDate = endDate || null;
        if (teacherId !== undefined) updateData.teacherId = teacherId;
        if (teacherName !== undefined) updateData.teacherName = teacherName || '';
        if (status !== undefined) updateData.status = status || 'active';
        if (batchType !== undefined) {
          updateData.batchType = ['one-to-one', 'project'].includes(batchType) ? batchType : 'regular';
        }
        if (programLabel !== undefined) updateData.programLabel = programLabel || '';
        updateData.updatedAt = new Date();

        if (typeof resourcesEnabled !== 'undefined') {
          updateData.resourcesEnabled = resourcesEnabled;
        }
        if (resourceUniverse) {
          updateData.resourceUniverse = resourceUniverse;
        }
        // A merged batch must share the target's slot, otherwise starting it never combines.
        if (mergeTarget?.schedule?.time) {
          updateData.schedule = mergeTarget.schedule;
        }

        const updated = await Batch.findByIdAndUpdate(req.params.id, updateData, { new: true }).exec();

        let migratedLiveClasses = 0;
        const nextTeacherId =
          teacherId !== undefined ? String(teacherId || '') : String(existing.teacherId || '');
        const prevTeacherId = String(existing.teacherId || '');
        if (teacherId !== undefined && nextTeacherId && nextTeacherId !== prevTeacherId) {
          let nextTeacherName = teacherName;
          if (nextTeacherName === undefined || nextTeacherName === '') {
            const t = await User.findById(nextTeacherId).select('name').lean().exec();
            nextTeacherName = t?.name || '';
          }
          const open = await LiveClass.find({
            batchId: String(req.params.id),
            status: { $in: ['scheduled', 'live'] }
          }).exec();
          for (const session of open) {
            session.teacherId = nextTeacherId;
            session.teacherName = nextTeacherName || session.teacherName || '';
            // Clear Zoom artifacts so next start binds the new trainer's PMI
            session.zoomMeetingId = '';
            session.zoomLink = '';
            session.zoomStartUrl = '';
            session.zoomPassword = '';
            session.zoomIsPmr = false;
            session.updatedAt = new Date();
            await session.save();
            migratedLiveClasses += 1;
          }
        }

        let combinedWith = null;
        if (mergeTarget || trainerChanging) {
          const wanted = mergeTarget
            ? [String(mergeTarget._id), ...(mergeTarget.combinedClassWith || []).map(String)].filter(
                (b, i, all) => b !== String(existing._id) && all.indexOf(b) === i
              )
            : [];
          combinedWith = await saveCombinedLinks(existing, wanted, nextTeacherId, { dropOtherTrainers: true });
        }

        res.json({
          success: true,
          message: 'Batch updated successfully',
          id: String(updated?._id || req.params.id),
          migratedLiveClasses,
          combinedWith,
          ...(updated ? updated.toObject() : updateData)
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

// @route   GET /api/admin/batches/:id/combined-class
// @desc    Same-trainer batches that can share one live room with this batch
router.get('/batches/:id/combined-class', async (req, res) => {
  try {
    const { parseSlot } = require('../utils/jointBatchSessions');
    const batch = await Batch.findById(req.params.id).lean().exec();
    if (!batch) return res.status(404).json({ success: false, message: 'Batch not found' });
    // ?teacherId= lists another trainer's batches (used when transferring this batch to them).
    const teacherId = String(req.query.teacherId || batch.teacherId || '');
    if (!teacherId) return res.json({ success: true, linkedBatchIds: [], candidates: [] });

    const id = String(batch._id);
    const slot = parseSlot(batch.schedule);
    const linked = new Set((batch.combinedClassWith || []).map(String));
    const siblings = await Batch.find({ teacherId }).lean().exec();
    const candidates = siblings
      .filter((b) => String(b._id) !== id && !['completed', 'inactive', 'archived', 'cancelled'].includes(String(b.status || '').toLowerCase()))
      .map((b) => {
        const other = parseSlot(b.schedule);
        const isLinked = linked.has(String(b._id)) || (b.combinedClassWith || []).map(String).includes(id);
        return {
          id: String(b._id),
          name: b.name || '',
          studentCount: (b.students || []).length,
          schedule: b.schedule || null,
          sameTiming: Boolean(
            slot && other && slot.start === other.start && slot.end === other.end && [...slot.days].some((d) => other.days.has(d))
          ),
          linked: isLinked
        };
      })
      .sort((a, b) => Number(b.sameTiming) - Number(a.sameTiming) || a.name.localeCompare(b.name));
    res.json({
      success: true,
      linkedBatchIds: candidates.filter((c) => c.linked).map((c) => c.id),
      candidates
    });
  } catch (error) {
    console.error('GET /admin/batches/:id/combined-class error:', error);
    res.status(500).json({ success: false, message: 'Failed to load combined class options' });
  }
});

// @route   PUT /api/admin/batches/:id/combined-class
// @desc    Link batches (same trainer) so a class started in their shared slot uses one room
router.put('/batches/:id/combined-class', async (req, res) => {
  try {
    const batch = await Batch.findById(req.params.id).lean().exec();
    if (!batch) return res.status(404).json({ success: false, message: 'Batch not found' });
    const id = String(batch._id);
    const wanted = [...new Set((req.body?.batchIds || []).map(String))].filter((b) => b && b !== id);
    await saveCombinedLinks(batch, wanted, batch.teacherId);
    res.json({ success: true, linkedBatchIds: wanted, message: 'Combined class settings saved' });
  } catch (error) {
    if (error.status === 400) {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error('PUT /admin/batches/:id/combined-class error:', error);
    res.status(500).json({ success: false, message: 'Failed to save combined class settings' });
  }
});

// @route   DELETE /api/admin/batches/:id
// @desc    Delete a batch (unenroll students, detach classroom, drop sessions/materials)
router.delete('/batches/:id', async (req, res) => {
    try {
        const batchId = String(req.params.id);
        const batchDoc = await Batch.findById(batchId).lean().exec();
        if (!batchDoc) {
            return res.status(404).json({ message: 'Batch not found' });
        }

        const users = await User.find({}).select('batchId oneToOneBatchId enrollments').lean().exec();
        const enrolled = (users || []).filter((u) => {
            if (String(u.batchId || '') === batchId) return true;
            if (String(u.oneToOneBatchId || '') === batchId) return true;
            return (u.enrollments || []).some((e) => String(e.batchId || '') === batchId);
        });
        for (const u of enrolled) {
            await unenrollStudentFromBatch(u._id || u.id, batchId);
        }

        await Classroom.updateMany(
            { batchId },
            { $set: { batchId: null, updatedAt: new Date() } }
        ).exec();

        await LiveClass.deleteMany({ batchId }).exec();
        await BatchMaterial.deleteMany({ batchId }).exec();
        await StudentShare.deleteMany({ batchId }).exec();

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

// @route   GET /api/admin/analytics
// @desc    Get comprehensive platform analytics for admin dashboard
// @access  Private (Admin only)
router.get('/analytics', async (req, res) => {
  try {
    const { period = '30days', startDate, endDate } = req.query;
    
    // Calculate date range
    let start = new Date();
    let end = new Date();
    
    switch (period) {
      case '7days':
        start.setDate(end.getDate() - 7);
        break;
      case '30days':
        start.setDate(end.getDate() - 30);
        break;
      case '90days':
        start.setDate(end.getDate() - 90);
        break;
      case 'custom':
        if (startDate && endDate) {
          start = new Date(startDate);
          end = new Date(endDate);
        } else {
          return res.status(400).json({ message: 'Custom range requires start and end dates' });
        }
        break;
    }
    
    // Get overall statistics
    const [people, totalBatches, totalActivities] = await Promise.all([
      User.find({ role: { $in: ['student', 'teacher'] } }).select('role lastLogin').lean().exec(),
      Batch.countDocuments(),
      ActivityLog.countDocuments({ timestamp: { $gte: start, $lte: end } })
    ]);
    // lastLogin is stored as { timestamp, ip, … }, which the Firestore facade cannot range-query.
    const loggedInSince = (u) => {
      const at = new Date(u.lastLogin?.timestamp || u.lastLogin || 0);
      return !Number.isNaN(at.getTime()) && at >= start;
    };
    const students = people.filter((u) => u.role === 'student');
    const teachers = people.filter((u) => u.role === 'teacher');
    const totalStudents = students.length;
    const totalTeachers = teachers.length;
    const activeStudents = students.filter(loggedInSince).length;
    const activeTeachers = teachers.filter(loggedInSince).length;
    
    // Get activity breakdown
    const activityBreakdown = await ActivityLog.aggregate([
      { $match: { timestamp: { $gte: start, $lte: end } } },
      { $group: { _id: '$action', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    // Get course analytics
    const courseAnalytics = await ActivityLog.aggregate([
      { $match: { timestamp: { $gte: start, $lte: end }, action: 'video_view' } },
      { $group: { _id: '$courseName', count: { $sum: 1 }, uniqueUsers: { $addToSet: '$userId' } } },
      { $addFields: { uniqueStudentCount: { $size: '$uniqueUsers' } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
    
    // Get student engagement metrics
    const studentEngagement = await ActivityLog.aggregate([
      { $match: { timestamp: { $gte: start, $lte: end } } },
      { $group: { _id: '$userId', totalActivities: { $sum: 1 }, videoViews: { $sum: { $cond: [{ $eq: ['$action', 'video_view'] }, 1, 0] } } } },
      { $sort: { totalActivities: -1 } },
      { $limit: 20 }
    ]);
    
    // Get daily activity trends
    const dailyTrends = await ActivityLog.aggregate([
      { $match: { timestamp: { $gte: start, $lte: end } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    
    // Batch performance: video views per enrolled student
    const [videoViews, batches] = await Promise.all([
      ActivityLog.find({ action: 'video_view', timestamp: { $gte: start, $lte: end } })
        .select('userId')
        .lean()
        .exec(),
      Batch.find({}).select('name course students').lean().exec()
    ]);
    const viewsByUser = new Map();
    for (const v of videoViews) {
      const uid = String(v.userId || '');
      if (uid) viewsByUser.set(uid, (viewsByUser.get(uid) || 0) + 1);
    }
    const completionRates = batches.map((batch) => {
      const roster = (batch.students || []).map(String);
      const studentCount = roster.length;
      const batchActivities = roster.reduce((sum, sid) => sum + (viewsByUser.get(sid) || 0), 0);
      const totalPossibleVideos = studentCount * 25; // Estimate 25 videos per student
      const completionRate = totalPossibleVideos > 0 ? Math.min((batchActivities / totalPossibleVideos) * 100, 100) : 0;
      return {
        batchName: batch.name,
        course: batch.course,
        studentCount,
        completionRate: Math.round(completionRate)
      };
    }).sort((a, b) => b.studentCount - a.studentCount);
    
    // Get login trends
    const loginTrends = await ActivityLog.aggregate([
      { $match: { timestamp: { $gte: start, $lte: end }, action: 'login' } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    
    // Get top performing students
    const topStudents = await Promise.all(
      studentEngagement.slice(0, 10).map(async (student) => {
        const user = await User.findById(student._id).select('name email').lean();
        return {
          studentId: student._id,
          name: user?.name || 'Unknown',
          email: user?.email || 'Unknown',
          totalActivities: student.totalActivities,
          videoViews: student.videoViews,
          avgDailyActivities: Math.round(student.totalActivities / Math.max(1, (end - start) / (1000 * 60 * 60 * 24)))
        };
      })
    );
    
    const analyticsData = {
      period: { start, end, type: period },
      overview: {
        totalStudents,
        totalTeachers,
        totalBatches,
        totalActivities,
        activeStudents,
        activeTeachers,
        studentEngagementRate: totalStudents > 0 ? Math.round((activeStudents / totalStudents) * 100) : 0,
        teacherEngagementRate: totalTeachers > 0 ? Math.round((activeTeachers / totalTeachers) * 100) : 0
      },
      activityBreakdown: activityBreakdown.map(item => ({ action: item._id, count: item.count })),
      courseAnalytics: courseAnalytics.map(item => ({
        courseName: item._id || 'Unknown',
        totalViews: item.count,
        uniqueStudents: item.uniqueStudentCount
      })),
      studentEngagement: topStudents,
      batchPerformance: completionRates,
      trends: {
        daily: dailyTrends.map(item => ({ date: item._id, activities: item.count })),
        logins: loginTrends.map(item => ({ date: item._id, logins: item.count }))
      }
    };
    
    res.json(analyticsData);
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/admin/classroom/:id/notes
// @desc    Download notes file for a classroom video (Admin endpoint)
// @access  Private (Admin only)
router.get('/classroom/:id/notes', roleAuth('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Admin download request received for video ID:', id);
    
    // Find the classroom video
    const video = await Classroom.findById(id).exec();
    if (!video) {
      console.log('Video not found for ID:', id);
      return res.status(404).json({ message: 'Video not found' });
    }
    
    console.log('Video found:', video.title, 'Notes available:', video.notesAvailable);
    
    const { sendLectureNotes } = require('../services/notesStorage');
    await sendLectureNotes(res, video);
  } catch (error) {
    console.error('Error downloading notes (admin endpoint):', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Failed to download notes' });
    }
  }
});

// @route   GET /api/admin/classroom/notes/:id
// @desc    Alternative admin endpoint for downloading notes
// @access  Private (Admin only)
router.get('/classroom/notes/:id', roleAuth('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Admin alternative download request received for video ID:', id);
    
    const video = await Classroom.findById(id).exec();
    if (!video) {
      console.log('Video not found for ID:', id);
      return res.status(404).json({ message: 'Video not found' });
    }
    
    const { sendLectureNotes } = require('../services/notesStorage');
    await sendLectureNotes(res, video);
  } catch (error) {
    console.error('Error downloading notes (admin alternative endpoint):', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Failed to download notes' });
    }
  }
});

// @route   GET /api/admin/live-class-settings
// @desc    Meet / Zoom / YouTube recording pipeline flags
router.get('/live-class-settings', roleAuth('admin'), async (req, res) => {
  try {
    const {
      getLiveClassSettings
    } = require('../services/liveClassSettings');
    const settings = await getLiveClassSettings();
    res.json({ success: true, settings });
  } catch (error) {
    console.error('GET /live-class-settings error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to load settings' });
  }
});

// @route   PATCH /api/admin/live-class-settings
// @desc    Enable/disable Google Meet live sessions (Zoom remains primary when Meet is off)
router.patch('/live-class-settings', roleAuth('admin'), async (req, res) => {
  try {
    const { setGoogleMeetEnabled } = require('../services/liveClassSettings');
    if (typeof req.body?.googleMeetEnabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'googleMeetEnabled (boolean) is required'
      });
    }
    const settings = await setGoogleMeetEnabled(req.body.googleMeetEnabled, req.user || {});
    res.json({
      success: true,
      message: settings.googleMeetEnabled
        ? 'Google Meet enabled for live classes and Meet recording sync.'
        : 'Google Meet disabled. Live sessions and classroom recordings use Zoom → Drive → YouTube.',
      settings
    });
  } catch (error) {
    console.error('PATCH /live-class-settings error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to update settings' });
  }
});

module.exports = router;
