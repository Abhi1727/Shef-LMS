const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/auth');
const LiveClass = require('../models/LiveClass');
const Batch = require('../models/Batch');
const User = require('../models/User');
const Classroom = require('../models/Classroom');
const googleCalendarService = require('../services/googleCalendarService');
const googleDriveService = require('../services/googleDriveService');
const attendanceAnalytics = require('../services/attendanceAnalytics');
const lessonPath = require('../services/lessonPath');
const sessionSummary = require('../services/sessionSummary');
const { sendEmail } = require('../services/emailService');
const { logActivity } = require('../utils/activityLogger');

const recordingUpload = multer({
  dest: path.join(__dirname, '../uploads/tmp-recordings'),
  limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2GB
  fileFilter: (req, file, cb) => {
    const ok =
      /^video\//.test(file.mimetype) ||
      /\.(mp4|mov|webm|mkv|avi)$/i.test(file.originalname || '');
    if (!ok) return cb(new Error('Only video files are allowed'));
    cb(null, true);
  }
});

const sessionMaterialUpload = multer({
  dest: path.join(__dirname, '../uploads/tmp-recordings'),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
  fileFilter: (req, file, cb) => {
    const ok =
      /^video\//.test(file.mimetype) ||
      /^image\//.test(file.mimetype) ||
      /^application\//.test(file.mimetype) ||
      /^text\//.test(file.mimetype) ||
      /\.(pdf|doc|docx|ppt|pptx|xls|xlsx|zip|rar|txt|csv|md|rtf|mp4|mov|webm|png|jpg|jpeg)$/i.test(
        file.originalname || ''
      );
    if (!ok) return cb(new Error('File type not allowed for session materials'));
    cb(null, true);
  }
});

try {
  fs.mkdirSync(path.join(__dirname, '../uploads/tmp-recordings'), { recursive: true });
} catch (_) {
  /* ignore */
}

router.use(auth);

function isAdmin(role) {
  return role === 'admin';
}

function isTeacherRole(role) {
  return role === 'teacher' || role === 'instructor' || role === 'mentor';
}

function isStudentRole(role) {
  return role === 'student';
}

function parseDurationMinutes(duration) {
  if (typeof duration === 'number' && Number.isFinite(duration)) {
    return Math.max(15, Math.min(480, Math.round(duration)));
  }
  const raw = String(duration || '60').trim().toLowerCase();
  const match = raw.match(/(\d+)/);
  const mins = match ? parseInt(match[1], 10) : 60;
  return Math.max(15, Math.min(480, mins));
}

function serializeMeeting(doc, { includeMeetLink = true } = {}) {
  const o = doc.toObject ? doc.toObject() : doc;
  const id = String(o._id || o.id);
  const start = o.scheduledStart ? new Date(o.scheduledStart) : null;
  const end = o.scheduledEnd ? new Date(o.scheduledEnd) : null;
  const scheduledDate = start
    ? start.toLocaleDateString('en-CA', { timeZone: o.timezone || 'Asia/Kolkata' })
    : o.scheduledDate || '';
  const scheduledTime = start
    ? start.toLocaleTimeString('en-GB', {
        timeZone: o.timezone || 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      })
    : o.scheduledTime || '';

  const now = Date.now();
  const endMs = end ? end.getTime() : null;
  const needsRecording =
    Boolean(o.meetLink) &&
    o.status !== 'cancelled' &&
    !o.recordingPromptDismissedAt &&
    !o.driveFileId &&
    endMs !== null &&
    endMs < now &&
    o.status !== 'completed';

  const attendance = Array.isArray(o.attendance) ? o.attendance : [];
  const attendanceCount = attendance.filter(
    (a) => String(a.status || '').toLowerCase() === 'present' || String(a.status || '').toLowerCase() === 'late'
  ).length;
  const attendanceAbsent = attendance.filter(
    (a) => String(a.status || '').toLowerCase() === 'absent'
  ).length;

  const link = o.meetLink || '';
  return {
    id,
    title: o.title,
    description: o.description || '',
    batchId: o.batchId || '',
    teacherId: o.teacherId || '',
    teacherName: o.teacherName || o.instructor || '',
    instructor: o.teacherName || o.instructor || '',
    course: o.course || '',
    courseId: o.courseId || '',
    scheduledStart: start ? start.toISOString() : null,
    scheduledEnd: end ? end.toISOString() : null,
    scheduledDate,
    scheduledTime,
    timezone: o.timezone || 'Asia/Kolkata',
    duration: o.duration || '60 mins',
    status: o.status || 'scheduled',
    hasMeetLink: Boolean(link),
    // Students only receive the Meet URL from POST /join (so join marks attendance).
    meetLink: includeMeetLink ? link : '',
    calendarEventId: includeMeetLink ? o.calendarEventId || '' : '',
    meetSpaceId: includeMeetLink ? o.meetSpaceId || '' : '',
    zoomLink: includeMeetLink ? o.zoomLink || link : '',
    createdBy: o.createdBy || '',
    reminderSentAt: o.reminderSentAt || null,
    recordingPromptDismissedAt: o.recordingPromptDismissedAt || null,
    attendanceCount,
    attendanceAbsent,
    attendanceRosterSize: attendance.length,
    needsRecording,
    driveFileId: o.driveFileId || '',
    driveLink: o.driveLink || '',
    driveFolderId: o.driveFolderId || '',
    recordingUploadedAt: o.recordingUploadedAt || null,
    classroomLectureId: o.classroomLectureId || '',
    sessionSummary: o.sessionSummary || '',
    sessionSummaryStatus: o.sessionSummaryStatus || '',
    sessionSummaryGeneratedAt: o.sessionSummaryGeneratedAt || null,
    materials: Array.isArray(o.materials)
      ? o.materials.map((m) => ({
          driveFileId: m.driveFileId || '',
          driveLink: m.driveLink || '',
          name: m.name || '',
          mimeType: m.mimeType || '',
          uploadedAt: m.uploadedAt || null
        }))
      : [],
    createdAt: o.createdAt,
    updatedAt: o.updatedAt
  };
}

/** Mark a student present when they join via LMS (source of truth for attendance). */
function markStudentPresent(doc, { studentId, studentName }) {
  const attendance = Array.isArray(doc.attendance) ? [...doc.attendance] : [];
  const idx = attendance.findIndex((a) => String(a.studentId) === String(studentId));
  const now = new Date();
  if (idx >= 0) {
    const prev = String(attendance[idx].status || '').toLowerCase();
    attendance[idx] = {
      ...attendance[idx],
      studentName: studentName || attendance[idx].studentName || '',
      status: 'present',
      source: 'join',
      updatedAt: now
    };
    doc.attendance = attendance;
    return prev !== 'present';
  }
  attendance.push({
    studentId: String(studentId),
    studentName: studentName || '',
    status: 'present',
    source: 'join',
    updatedAt: now
  });
  doc.attendance = attendance;
  return true;
}

async function assertTeacherOrAdminOwns(user, meeting) {
  if (isAdmin(user.role)) return true;
  return isTeacherRole(user.role) && String(meeting.teacherId) === String(user.id);
}

async function getBatchRoster(batchId) {
  const batch = await Batch.findById(batchId).select('students name').lean().exec();
  if (!batch) return [];
  const ids = (batch.students || []).map((s) => String(s));
  const extra = await User.find({
    role: 'student',
    $or: [{ batchId: String(batchId) }, { oneToOneBatchId: String(batchId) }]
  })
    .select('name')
    .lean()
    .exec();
  const allIds = [...new Set([...ids, ...extra.map((u) => String(u._id))])];
  if (!allIds.length) return [];
  const users = await User.find({ _id: { $in: allIds }, role: 'student' })
    .select('name enrollmentNumber')
    .lean()
    .exec();
  return users.map((u) => ({
    studentId: String(u._id),
    studentName: u.name || '',
    enrollmentNumber: u.enrollmentNumber || ''
  }));
}

async function findBatchForTeacher(batchId, teacherId) {
  const batch = await Batch.findById(batchId).lean().exec();
  if (!batch) return null;
  if (String(batch.teacherId) !== String(teacherId)) return null;
  return batch;
}

async function studentCanAccessBatch(userId, batchId) {
  if (!batchId) return false;
  const user = await User.findById(userId).select('batchId oneToOneBatchId').lean().exec();
  if (!user) return false;
  if (String(user.batchId || '') === String(batchId)) return true;
  if (String(user.oneToOneBatchId || '') === String(batchId)) return true;

  const batch = await Batch.findById(batchId).select('students').lean().exec();
  if (!batch) return false;
  return (batch.students || []).some((s) => String(s) === String(userId));
}

async function assertCanViewMeeting(user, meeting) {
  if (isAdmin(user.role)) return true;
  if (isTeacherRole(user.role) && String(meeting.teacherId) === String(user.id)) return true;
  if (isStudentRole(user.role)) {
    return studentCanAccessBatch(user.id, meeting.batchId);
  }
  return false;
}

// @route   GET /api/meetings/status
router.get('/status', async (req, res) => {
  try {
    res.json({ success: true, ...googleCalendarService.getMeetStatus() });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to read Meet status' });
  }
});

// @route   GET /api/meetings/needing-recording
router.get('/needing-recording', async (req, res) => {
  try {
    if (!isAdmin(req.user.role) && !isTeacherRole(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const query = {
      status: { $nin: ['cancelled', 'completed'] },
      meetLink: { $ne: '' },
      recordingPromptDismissedAt: null,
      $or: [{ driveFileId: { $exists: false } }, { driveFileId: '' }, { driveFileId: null }],
      scheduledEnd: { $lt: new Date() }
    };
    if (!isAdmin(req.user.role)) {
      query.teacherId = String(req.user.id);
    }
    const docs = await LiveClass.find(query).sort({ scheduledEnd: -1 }).lean().exec();
    res.json({
      success: true,
      meetings: docs.map((d) => serializeMeeting(d))
    });
  } catch (error) {
    console.error('GET /needing-recording error:', error);
    res.status(500).json({ success: false, message: 'Failed to list sessions needing recording' });
  }
});

// @route   GET /api/meetings/attendance-summary?batchId=
router.get('/attendance-summary', async (req, res) => {
  try {
    if (!isAdmin(req.user.role) && !isTeacherRole(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const batchId = String(req.query.batchId || '');
    if (!batchId) {
      return res.status(400).json({ success: false, message: 'batchId is required' });
    }
    if (!isAdmin(req.user.role)) {
      const owned = await findBatchForTeacher(batchId, req.user.id);
      if (!owned) {
        return res.status(403).json({ success: false, message: 'Not your batch' });
      }
    }
    const summary = await attendanceAnalytics.getBatchAttendanceSummary(batchId);
    if (!summary.batch) {
      return res.status(404).json({ success: false, message: 'Batch not found' });
    }
    // Do not expose student emails to the client
    const students = summary.students.map(({ email, ...rest }) => rest);
    res.json({ success: true, ...summary, students });
  } catch (error) {
    console.error('GET /attendance-summary error:', error);
    res.status(500).json({ success: false, message: 'Failed to load attendance summary' });
  }
});

// @route   POST /api/meetings/intimate-low-attendance
router.post('/intimate-low-attendance', async (req, res) => {
  try {
    if (!isAdmin(req.user.role) && !isTeacherRole(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const batchId = String(req.body?.batchId || '');
    if (!batchId) {
      return res.status(400).json({ success: false, message: 'batchId is required' });
    }
    if (!isAdmin(req.user.role)) {
      const owned = await findBatchForTeacher(batchId, req.user.id);
      if (!owned) {
        return res.status(403).json({ success: false, message: 'Not your batch' });
      }
    }

    const summary = await attendanceAnalytics.getBatchAttendanceSummary(batchId);
    if (!summary.batch) {
      return res.status(404).json({ success: false, message: 'Batch not found' });
    }

    const selected = Array.isArray(req.body?.studentIds)
      ? req.body.studentIds.map(String)
      : null;
    // mode: low-attendance (default) | engagement (Passive + Unengaged) | unengaged
    const mode = String(req.body?.mode || 'low-attendance').toLowerCase();
    const targets = summary.students.filter((s) => {
      if (!s.email) return false;
      if (selected?.length) return selected.includes(s.studentId);
      if (mode === 'engagement') return s.engagement === 'Passive' || s.engagement === 'Unengaged';
      if (mode === 'unengaged') return s.engagement === 'Unengaged';
      if (mode === 'passive') return s.engagement === 'Passive';
      return s.belowThreshold;
    });

    if (!targets.length) {
      return res.json({
        success: true,
        sent: 0,
        message:
          mode === 'engagement' || mode === 'passive' || mode === 'unengaged'
            ? 'No students in the selected engagement segment (or no emails) to nudge'
            : 'No students below threshold (or no emails) to intimate'
      });
    }

    const threshold = summary.threshold;
    const frontend = process.env.FRONTEND_URL || 'https://dev.learnwithus.sbs';
    let sent = 0;

    for (const t of targets) {
      const isEngagement =
        mode === 'engagement' || mode === 'passive' || mode === 'unengaged' || t.engagement;
      const segment = t.engagement || 'Passive';
      const subject =
        segment === 'Unengaged'
          ? `We miss you in class — ${summary.batch.name || 'your batch'}`
          : segment === 'Passive'
            ? `Come back to learning — ${summary.batch.name || 'your batch'}`
            : `Attendance notice — ${summary.batch.name || 'your batch'}`;

      const message =
        segment === 'Unengaged'
          ? [
              `Hi ${t.studentName || 'there'},`,
              ``,
              `Your trainer noticed low live-class engagement in ${summary.batch.name || 'your batch'}.`,
              `Current join rate: ${t.joinRate}% (expected ${threshold}%+).`,
              ``,
              `Please join the next session from your LMS dashboard so we can support your progress:`,
              frontend,
              ``,
              `If something is blocking you, message your trainer — we're here to help.`,
              ``,
              `— Sky States LMS`
            ].join('\n')
          : segment === 'Passive'
            ? [
                `Hi ${t.studentName || 'there'},`,
                ``,
                `It's been a while since we saw activity in ${summary.batch.name || 'your batch'}.`,
                `Your join rate is ${t.joinRate}%. A short catch-up on Classroom recordings and the next live class will get you back on track.`,
                ``,
                `Open your dashboard:`,
                frontend,
                ``,
                `— Sky States LMS`
              ].join('\n')
            : [
                `Hi ${t.studentName || 'there'},`,
                ``,
                `This is a notice from your trainer regarding live-class attendance.`,
                ``,
                `Batch: ${summary.batch.name || batchId}`,
                `Your join rate is below the expected ${threshold}% for recent live sessions.`,
                ``,
                `Please join upcoming classes from your LMS dashboard so your attendance is recorded:`,
                frontend,
                ``,
                `If you have trouble joining, reply to support or message your trainer.`,
                ``,
                `— Sky States LMS`
              ].join('\n');

      await sendEmail({
        subject,
        message,
        studentEmails: [t.email],
        batchId
      });

      await logActivity({
        action: isEngagement && (segment === 'Passive' || segment === 'Unengaged')
          ? 'ENGAGEMENT_NUDGE'
          : 'ATTENDANCE_INTIMATE',
        userId: String(t.studentId),
        userName: t.studentName || '',
        userEmail: t.email || '',
        userRole: 'student',
        path: batchId,
        videoId: String(req.user.id),
        videoTitle: `${segment} nudge by ${req.user.name || req.user.role}`,
        assessmentTitle: summary.batch.name || '',
        score: t.joinRate
      });
      sent += 1;
    }

    res.json({
      success: true,
      sent,
      mode,
      message: `Notice sent to ${sent} student(s)`
    });
  } catch (error) {
    console.error('POST /intimate-low-attendance error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to send attendance notices'
    });
  }
});

// @route   GET /api/meetings
router.get('/', async (req, res) => {
  try {
    const role = req.user.role;
    const userId = String(req.user.id);
    const includeCancelled = String(req.query.includeCancelled || '') === 'true';
    const batchIdFilter = req.query.batchId ? String(req.query.batchId) : null;

    let query = {};
    if (!includeCancelled) {
      query.status = { $ne: 'cancelled' };
    }

    if (isAdmin(role)) {
      if (batchIdFilter) query.batchId = batchIdFilter;
    } else if (isTeacherRole(role)) {
      query.teacherId = userId;
      if (batchIdFilter) {
        const owned = await findBatchForTeacher(batchIdFilter, userId);
        if (!owned) {
          return res.status(403).json({ success: false, message: 'Not your batch' });
        }
        query.batchId = batchIdFilter;
      }
    } else if (isStudentRole(role)) {
      const user = await User.findById(userId).select('batchId oneToOneBatchId').lean().exec();
      const batchIds = [user?.batchId, user?.oneToOneBatchId].filter(Boolean).map(String);

      const memberBatches = await Batch.find({ students: userId }).select('_id').lean().exec();
      memberBatches.forEach((b) => batchIds.push(String(b._id)));

      const unique = [...new Set(batchIds)];
      if (unique.length === 0) {
        return res.json({ success: true, meetings: [] });
      }
      query.batchId = batchIdFilter && unique.includes(batchIdFilter) ? batchIdFilter : { $in: unique };
      if (batchIdFilter && !unique.includes(batchIdFilter)) {
        return res.status(403).json({ success: false, message: 'Not enrolled in this batch' });
      }
    } else {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const docs = await LiveClass.find(query).sort({ scheduledStart: 1 }).lean().exec();
    const includeMeetLink = !isStudentRole(role);
    const meetings = docs.map((d) => serializeMeeting(d, { includeMeetLink }));

    res.json({ success: true, meetings, liveClasses: meetings });
  } catch (error) {
    console.error('GET /api/meetings error:', error);
    res.status(500).json({ success: false, message: 'Failed to list meetings' });
  }
});

// @route   GET /api/meetings/:id
router.get('/:id', async (req, res) => {
  try {
    const doc = await LiveClass.findById(req.params.id).lean().exec();
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Meeting not found' });
    }
    const allowed = await assertCanViewMeeting(req.user, doc);
    if (!allowed) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const includeMeetLink = !isStudentRole(req.user.role);
    const meeting = serializeMeeting(doc, { includeMeetLink });
    res.json({
      success: true,
      meeting,
      // Students must POST /join to receive the Meet URL (attendance).
      joinUrl: includeMeetLink ? meeting.meetLink : '',
      startUrl: includeMeetLink ? meeting.meetLink : ''
    });
  } catch (error) {
    console.error('GET /api/meetings/:id error:', error);
    res.status(500).json({ success: false, message: 'Failed to load meeting' });
  }
});

// @route   POST /api/meetings
router.post('/', async (req, res) => {
  try {
    const role = req.user.role;
    if (!isAdmin(role) && !isTeacherRole(role)) {
      return res.status(403).json({ success: false, message: 'Only teachers or admins can schedule Meet classes' });
    }

    const {
      title,
      batchId,
      description,
      scheduledStart,
      scheduledDate,
      scheduledTime,
      duration,
      durationMinutes,
      timezone
    } = req.body || {};

    if (!title || !batchId) {
      return res.status(400).json({ success: false, message: 'title and batchId are required' });
    }

    let batch;
    if (isAdmin(role)) {
      batch = await Batch.findById(batchId).lean().exec();
      if (!batch) {
        return res.status(404).json({ success: false, message: 'Batch not found' });
      }
    } else {
      batch = await findBatchForTeacher(batchId, req.user.id);
      if (!batch) {
        return res.status(403).json({ success: false, message: 'You can only schedule classes for your own batches' });
      }
    }

    const tz = timezone || 'Asia/Kolkata';
    let start;
    if (scheduledStart) {
      start = new Date(scheduledStart);
    } else if (scheduledDate && scheduledTime) {
      // Interpret as local IST wall time when no offset provided
      start = new Date(`${scheduledDate}T${scheduledTime}:00+05:30`);
    } else {
      return res.status(400).json({
        success: false,
        message: 'Provide scheduledStart (ISO) or scheduledDate + scheduledTime'
      });
    }

    if (Number.isNaN(start.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid start date/time' });
    }

    const mins = parseDurationMinutes(durationMinutes ?? duration);
    const end = new Date(start.getTime() + mins * 60 * 1000);

    const teacherId = String(batch.teacherId);
    let teacherName = batch.teacherName || '';
    if (!teacherName) {
      const teacher = await User.findById(teacherId).select('name').lean().exec();
      teacherName = teacher?.name || req.user.name || 'Trainer';
    }

    let calendarEventId = '';
    let meetLink = '';
    let meetSpaceId = '';

    try {
      const created = await googleCalendarService.createMeetEvent({
        title: String(title).trim(),
        description: description || `Live class for batch ${batch.name || batchId}`,
        start,
        end,
        timezone: tz
      });
      calendarEventId = created.calendarEventId || '';
      meetLink = created.meetLink || '';
      meetSpaceId = created.meetSpaceId || '';
    } catch (calErr) {
      console.error('Google Calendar createMeetEvent failed:', calErr?.message || calErr);
      const code = calErr.code === 'MEET_DISABLED' || calErr.code === 'MEET_NOT_CONFIGURED' ? 503 : 502;
      return res.status(code).json({
        success: false,
        message: calErr.message || 'Failed to create Google Meet event',
        code: calErr.code || 'MEET_CREATE_FAILED'
      });
    }

    if (!meetLink) {
      // Clean up orphan calendar event if Meet link missing
      if (calendarEventId) {
        try {
          await googleCalendarService.cancelMeetEvent(calendarEventId);
        } catch (_) {
          /* ignore */
        }
      }
      return res.status(502).json({
        success: false,
        message: 'Calendar event created but no Meet link was returned. Check Workspace Meet licensing for the host user.'
      });
    }

    // Seed full batch roster as absent; Join flips each student to present.
    const roster = await getBatchRoster(String(batchId));
    const seededAttendance = roster.map((s) => ({
      studentId: s.studentId,
      studentName: s.studentName,
      status: 'absent',
      source: 'teacher',
      updatedAt: new Date()
    }));

    const liveClass = await LiveClass.create({
      title: String(title).trim(),
      description: description || '',
      batchId: String(batchId),
      teacherId,
      teacherName,
      instructor: teacherName,
      course: batch.course || '',
      courseId: batch.courseId ? String(batch.courseId) : '',
      scheduledStart: start,
      scheduledEnd: end,
      timezone: tz,
      duration: `${mins} mins`,
      scheduledDate: start.toLocaleDateString('en-CA', { timeZone: tz }),
      scheduledTime: start.toLocaleTimeString('en-GB', {
        timeZone: tz,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }),
      calendarEventId,
      meetLink,
      meetSpaceId,
      zoomLink: meetLink,
      status: 'scheduled',
      attendance: seededAttendance,
      createdBy: String(req.user.id),
      createdAt: new Date(),
      updatedAt: new Date()
    });

    res.status(201).json({
      success: true,
      message: 'Meet class scheduled',
      meeting: serializeMeeting(liveClass)
    });
  } catch (error) {
    console.error('POST /api/meetings error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to schedule meeting' });
  }
});

async function cancelMeetingHandler(req, res) {
  try {
    const doc = await LiveClass.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Meeting not found' });
    }

    const role = req.user.role;
    const isOwner = isTeacherRole(role) && String(doc.teacherId) === String(req.user.id);
    if (!isAdmin(role) && !isOwner) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (doc.status === 'cancelled') {
      return res.json({ success: true, message: 'Already cancelled', meeting: serializeMeeting(doc) });
    }

    if (doc.calendarEventId) {
      try {
        await googleCalendarService.cancelMeetEvent(doc.calendarEventId);
      } catch (calErr) {
        console.error('cancelMeetEvent failed:', calErr?.message || calErr);
        // Still mark cancelled locally if Meet is disabled
        if (calErr.code !== 'MEET_DISABLED' && calErr.code !== 'MEET_NOT_CONFIGURED') {
          return res.status(502).json({
            success: false,
            message: calErr.message || 'Failed to cancel Calendar event'
          });
        }
      }
    }

    doc.status = 'cancelled';
    doc.updatedAt = new Date();
    await doc.save();

    res.json({ success: true, message: 'Class cancelled', meeting: serializeMeeting(doc) });
  } catch (error) {
    console.error('cancel meeting error:', error);
    res.status(500).json({ success: false, message: 'Failed to cancel meeting' });
  }
}

// @route   POST /api/meetings/:id/cancel
router.post('/:id/cancel', cancelMeetingHandler);

// @route   DELETE /api/meetings/:id  (alias for cancel)
router.delete('/:id', cancelMeetingHandler);

// @route   POST /api/meetings/:id/start
router.post('/:id/start', async (req, res) => {
  try {
    const doc = await LiveClass.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Meeting not found' });
    if (!(await assertTeacherOrAdminOwns(req.user, doc))) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    if (doc.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Class is cancelled' });
    }
    if (!doc.meetLink) {
      return res.status(400).json({ success: false, message: 'No Meet link available' });
    }
    if (doc.status === 'scheduled') {
      doc.status = 'live';
      doc.updatedAt = new Date();
      await doc.save();
    }
    res.json({
      success: true,
      meeting: serializeMeeting(doc),
      startUrl: doc.meetLink,
      meetLink: doc.meetLink
    });
  } catch (error) {
    console.error('POST /meetings/:id/start error:', error);
    res.status(500).json({ success: false, message: 'Failed to start class' });
  }
});

// @route   POST /api/meetings/:id/join
router.post('/:id/join', async (req, res) => {
  try {
    const doc = await LiveClass.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Meeting not found' });
    if (doc.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Class is cancelled' });
    }
    if (!doc.meetLink) {
      return res.status(400).json({ success: false, message: 'No Meet link available' });
    }

    const allowed = await assertCanViewMeeting(req.user, doc);
    if (!allowed) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    let markedPresent = false;
    if (isStudentRole(req.user.role)) {
      const studentId = String(req.user.id);
      const user = await User.findById(studentId).select('name').lean().exec();
      // Whoever joins via LMS is Present (overrides prior absent/late).
      markStudentPresent(doc, {
        studentId,
        studentName: user?.name || req.user.name || ''
      });
      markedPresent = true;
      if (doc.status === 'scheduled') doc.status = 'live';
      doc.updatedAt = new Date();
      await doc.save();

      try {
        const certificateService = require('../services/certificateService');
        if (doc.batchId) {
          await certificateService.maybeAutoIssue(studentId, String(doc.batchId));
        }
      } catch (certErr) {
        console.warn('[certificates] auto-issue after join:', certErr.message || certErr);
      }
    }

    res.json({
      success: true,
      meetLink: doc.meetLink,
      joinUrl: doc.meetLink,
      markedPresent,
      meeting: serializeMeeting(doc, { includeMeetLink: !isStudentRole(req.user.role) })
    });
  } catch (error) {
    console.error('POST /meetings/:id/join error:', error);
    res.status(500).json({ success: false, message: 'Failed to join class' });
  }
});

// @route   POST /api/meetings/:id/complete
router.post('/:id/complete', async (req, res) => {
  try {
    const doc = await LiveClass.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Meeting not found' });
    if (!(await assertTeacherOrAdminOwns(req.user, doc))) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const dismissPrompt = req.body?.dismissPrompt !== false;
    doc.status = 'completed';
    if (dismissPrompt) doc.recordingPromptDismissedAt = new Date();
    doc.updatedAt = new Date();
    await doc.save();
    res.json({ success: true, meeting: serializeMeeting(doc) });
  } catch (error) {
    console.error('POST /meetings/:id/complete error:', error);
    res.status(500).json({ success: false, message: 'Failed to complete class' });
  }
});

// @route   POST /api/meetings/:id/materials
// @desc    Upload session material to Drive and attach to LiveClass
router.post('/:id/materials', sessionMaterialUpload.single('file'), async (req, res) => {
  let tempPath = req.file?.path;
  try {
    const doc = await LiveClass.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Meeting not found' });
    if (!(await assertTeacherOrAdminOwns(req.user, doc))) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'file is required' });
    }

    const batch = await Batch.findById(doc.batchId).lean().exec();
    let folderId = batch?.driveFolderId || doc.driveFolderId || '';
    if (!folderId) {
      const ensured = await googleDriveService.ensureBatchFolder({
        batchId: doc.batchId,
        batchName: batch?.name || doc.course || 'Batch'
      });
      folderId = ensured.folderId;
      if (batch) {
        await Batch.updateOne(
          { _id: doc.batchId },
          {
            $set: {
              driveFolderId: ensured.folderId,
              driveFolderLink: ensured.folderLink,
              updatedAt: new Date()
            }
          }
        );
      }
    }

    const uploaded = await googleDriveService.uploadBatchFile({
      batchId: doc.batchId,
      batchName: batch?.name || '',
      folderId,
      filePath: req.file.path,
      fileName: req.file.originalname || `session-material-${Date.now()}`,
      mimeType: req.file.mimetype,
      title: req.body?.name || doc.title
    });

    const entry = {
      driveFileId: uploaded.driveFileId,
      driveLink: uploaded.driveLink,
      name: req.body?.name || req.file.originalname || uploaded.driveName,
      mimeType: req.file.mimetype || '',
      uploadedBy: String(req.user.id),
      uploadedAt: new Date()
    };
    doc.materials = Array.isArray(doc.materials) ? [...doc.materials, entry] : [entry];
    doc.driveFolderId = folderId;
    doc.updatedAt = new Date();
    await doc.save();

    // Also index in BatchMaterial for batch Materials tab
    const BatchMaterial = require('../models/BatchMaterial');
    const mime = String(entry.mimeType || '');
    const nameLower = String(entry.name || '').toLowerCase();
    let kind = 'handout';
    if (/^video\//.test(mime) || /\.(mp4|mov|webm|mkv)$/i.test(nameLower)) kind = 'video';
    else if (/\.(pdf|doc|docx|txt|md|rtf)$/i.test(nameLower) || /word|pdf|text/.test(mime)) {
      kind = 'writing';
    }
    await BatchMaterial.create({
      batchId: String(doc.batchId),
      kind,
      name: entry.name,
      mimeType: entry.mimeType,
      driveFileId: entry.driveFileId,
      driveLink: entry.driveLink,
      driveFolderId: folderId,
      liveClassId: String(doc._id),
      uploadedBy: String(req.user.id),
      uploadedByName: req.user.name || '',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    res.status(201).json({
      success: true,
      material: entry,
      meeting: serializeMeeting(doc)
    });
  } catch (error) {
    console.error('POST /meetings/:id/materials error:', error);
    const code = error.code === 'MEET_DISABLED' || error.code === 'MEET_NOT_CONFIGURED' ? 503 : 500;
    res.status(code).json({
      success: false,
      message: error.message || 'Failed to upload session material'
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

// @route   POST /api/meetings/:id/intimate-absentees
router.post('/:id/intimate-absentees', async (req, res) => {
  try {
    const doc = await LiveClass.findById(req.params.id).lean().exec();
    if (!doc) return res.status(404).json({ success: false, message: 'Meeting not found' });
    if (!(await assertTeacherOrAdminOwns(req.user, doc))) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const absentees = await attendanceAnalytics.getSessionAbsentees(doc);
    if (!absentees.length) {
      return res.json({
        success: true,
        sent: 0,
        message: 'No absentees with email addresses for this session'
      });
    }

    const when = doc.scheduledStart
      ? new Date(doc.scheduledStart).toLocaleString('en-IN', { timeZone: doc.timezone || 'Asia/Kolkata' })
      : `${doc.scheduledDate || ''} ${doc.scheduledTime || ''}`;
    const frontend = process.env.FRONTEND_URL || 'https://dev.learnwithus.sbs';
    const subject = `Missed live class: ${doc.title}`;
    const message = [
      `Hi,`,
      ``,
      `You were marked absent for the live class "${doc.title}".`,
      ``,
      `When: ${when}`,
      `Trainer: ${doc.teacherName || doc.instructor || 'Your trainer'}`,
      ``,
      `Please join the next session from your LMS dashboard so attendance is recorded:`,
      frontend,
      ``,
      `Recordings (when available) appear in Classroom.`,
      ``,
      `— Sky States LMS`
    ].join('\n');

    await sendEmail({
      subject,
      message,
      studentEmails: absentees.map((a) => a.email),
      batchId: doc.batchId
    });

    await logActivity({
      action: 'ATTENDANCE_INTIMATE',
      userId: String(req.user.id),
      userName: req.user.name || '',
      userEmail: req.user.email || '',
      userRole: req.user.role,
      path: String(doc.batchId || ''),
      videoId: String(doc._id),
      videoTitle: doc.title,
      assessmentTitle: `Absentees emailed: ${absentees.length}`
    });

    res.json({
      success: true,
      sent: absentees.length,
      message: `Notice sent to ${absentees.length} absentee(s)`
    });
  } catch (error) {
    console.error('POST /intimate-absentees error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to email absentees'
    });
  }
});

// @route   GET /api/meetings/:id/attendance
router.get('/:id/attendance', async (req, res) => {
  try {
    const doc = await LiveClass.findById(req.params.id).lean().exec();
    if (!doc) return res.status(404).json({ success: false, message: 'Meeting not found' });
    if (!(await assertTeacherOrAdminOwns(req.user, doc))) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const roster = await getBatchRoster(doc.batchId);
    const byId = {};
    (doc.attendance || []).forEach((a) => {
      byId[String(a.studentId)] = a;
    });
    const rows = roster.map((s) => {
      const a = byId[s.studentId];
      return {
        studentId: s.studentId,
        studentName: s.studentName,
        enrollmentNumber: s.enrollmentNumber,
        status: a?.status || 'absent',
        source: a?.source || null,
        updatedAt: a?.updatedAt || null
      };
    });
    res.json({ success: true, attendance: rows, meeting: serializeMeeting(doc) });
  } catch (error) {
    console.error('GET /meetings/:id/attendance error:', error);
    res.status(500).json({ success: false, message: 'Failed to load attendance' });
  }
});

// @route   PATCH /api/meetings/:id/attendance
router.patch('/:id/attendance', async (req, res) => {
  try {
    const doc = await LiveClass.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Meeting not found' });
    if (!(await assertTeacherOrAdminOwns(req.user, doc))) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const updates = Array.isArray(req.body?.attendance) ? req.body.attendance : [];
    if (!updates.length) {
      return res.status(400).json({ success: false, message: 'attendance array required' });
    }

    const attendance = Array.isArray(doc.attendance) ? [...doc.attendance] : [];
    for (const u of updates) {
      const studentId = String(u.studentId || '');
      const status = String(u.status || '').toLowerCase();
      if (!studentId || !['present', 'absent', 'late'].includes(status)) continue;
      const idx = attendance.findIndex((a) => String(a.studentId) === studentId);
      const entry = {
        studentId,
        studentName: u.studentName || '',
        status,
        source: 'teacher',
        updatedAt: new Date()
      };
      if (idx >= 0) {
        entry.studentName = entry.studentName || attendance[idx].studentName;
        attendance[idx] = entry;
      } else {
        if (!entry.studentName) {
          const user = await User.findById(studentId).select('name').lean().exec();
          entry.studentName = user?.name || '';
        }
        attendance.push(entry);
      }
    }
    doc.attendance = attendance;
    doc.updatedAt = new Date();
    await doc.save();

    try {
      const certificateService = require('../services/certificateService');
      const batchId = String(doc.batchId || '');
      if (batchId) {
        for (const u of updates) {
          const sid = String(u.studentId || '');
          const st = String(u.status || '').toLowerCase();
          if (sid && (st === 'present' || st === 'late')) {
            await certificateService.maybeAutoIssue(sid, batchId);
          }
        }
      }
    } catch (certErr) {
      console.warn('[certificates] auto-issue after attendance:', certErr.message || certErr);
    }

    res.json({ success: true, meeting: serializeMeeting(doc) });
  } catch (error) {
    console.error('PATCH /meetings/:id/attendance error:', error);
    res.status(500).json({ success: false, message: 'Failed to update attendance' });
  }
});

// @route   POST /api/meetings/:id/recording
// @desc    Upload class recording to Google Drive + create Classroom lecture
router.post('/:id/recording', recordingUpload.single('recording'), async (req, res) => {
  let tempPath = req.file?.path;
  try {
    const doc = await LiveClass.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Meeting not found' });
    }
    if (!(await assertTeacherOrAdminOwns(req.user, doc))) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'recording file is required' });
    }

    const batch = await Batch.findById(doc.batchId).lean().exec();
    let folderId = batch?.driveFolderId || doc.driveFolderId || '';
    let folderLink = batch?.driveFolderLink || '';

    if (!folderId) {
      const ensured = await googleDriveService.ensureBatchFolder({
        batchId: doc.batchId,
        batchName: batch?.name || doc.course || 'Batch'
      });
      folderId = ensured.folderId;
      folderLink = ensured.folderLink;
      if (batch) {
        await Batch.updateOne(
          { _id: doc.batchId },
          { $set: { driveFolderId: folderId, driveFolderLink: folderLink, updatedAt: new Date() } }
        );
      }
    }

    const uploaded = await googleDriveService.uploadRecordingFile({
      batchId: doc.batchId,
      batchName: batch?.name || '',
      folderId,
      filePath: req.file.path,
      fileName: `${doc.title || 'class'}-${Date.now()}${path.extname(req.file.originalname) || '.mp4'}`,
      mimeType: req.file.mimetype,
      title: doc.title
    });

    doc.driveFolderId = uploaded.folderId;
    doc.driveFileId = uploaded.driveFileId;
    doc.driveLink = uploaded.driveLink;
    doc.recordingUploadedAt = new Date();
    doc.recordingPromptDismissedAt = new Date();
    doc.status = 'completed';
    doc.updatedAt = new Date();

    const order = await lessonPath.nextOrderForBatch(String(doc.batchId));

    const lecture = await Classroom.create({
      title: doc.title,
      instructor: doc.teacherName || doc.instructor || '',
      description: doc.description || `Recording for ${doc.title}`,
      course: doc.course || batch?.course || '',
      batchId: String(doc.batchId),
      batchName: batch?.name || '',
      duration: doc.duration || '',
      date: doc.scheduledDate || new Date().toISOString().slice(0, 10),
      videoSource: 'drive',
      driveId: uploaded.driveFileId,
      zoomUrl: uploaded.driveLink,
      order,
      unlockRule: 'open',
      uploadedBy: String(req.user.id),
      createdAt: new Date(),
      updatedAt: new Date()
    });

    doc.classroomLectureId = String(lecture._id);
    doc.sessionSummaryStatus = 'pending';
    await doc.save();

    // Fire-and-forget AI session summary (v1: text context)
    sessionSummary
      .generateAndStoreSummary(doc._id)
      .catch((err) => console.error('[sessionSummary] after recording:', err.message || err));

    res.json({
      success: true,
      message: 'Recording uploaded to Google Drive',
      meeting: serializeMeeting(doc),
      driveLink: uploaded.driveLink,
      driveFileId: uploaded.driveFileId,
      folderLink,
      lectureId: String(lecture._id)
    });
  } catch (error) {
    console.error('POST /meetings/:id/recording error:', error);
    const code = error.code === 'MEET_DISABLED' || error.code === 'MEET_NOT_CONFIGURED' ? 503 : 500;
    res.status(code).json({
      success: false,
      message: error.message || 'Failed to upload recording to Drive',
      code: error.code
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

// @route   POST /api/meetings/:id/generate-summary
// @desc    Generate AI session summary from metadata (+ optional teacher notes)
router.post('/:id/generate-summary', async (req, res) => {
  try {
    if (!isAdmin(req.user.role) && !isTeacherRole(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const doc = await LiveClass.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Meeting not found' });
    }
    if (!(await assertTeacherOrAdminOwns(req.user, doc))) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const teacherNotes = String(req.body?.teacherNotes || '').slice(0, 4000);
    const updated = await sessionSummary.generateAndStoreSummary(doc._id, { teacherNotes });
    res.json({
      success: true,
      message: 'Session summary ready',
      meeting: serializeMeeting(updated, { includeMeetLink: true })
    });
  } catch (error) {
    console.error('POST /generate-summary error:', error);
    const doc = await LiveClass.findById(req.params.id).catch(() => null);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate summary',
      meeting: doc ? serializeMeeting(doc, { includeMeetLink: true }) : null
    });
  }
});

module.exports = router;
