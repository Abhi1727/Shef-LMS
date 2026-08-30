const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/auth');
const LiveClass = require('../models/LiveClass');
const Batch = require('../models/Batch');
const User = require('../models/User');
const googleCalendarService = require('../services/googleCalendarService');
const zoomService = require('../services/zoomService');
const zoomConfig = require('../config/zoom');
const googleDriveService = require('../services/googleDriveService');
const attendanceAnalytics = require('../services/attendanceAnalytics');
const sessionSummary = require('../services/sessionSummary');
const { ensureClassroomFromLiveClass } = require('../services/classroomFromLiveClass');
const { syncMeetRecordings } = require('../services/meetRecordingSync');
const { syncZoomRecordings } = require('../services/zoomRecordingSync');
const {
  getLiveClassSettings,
  isMeetLiveEnabled
} = require('../services/liveClassSettings');
const zoomMeetingSdk = require('../services/zoomMeetingSdk');
const { sendEmail } = require('../services/emailService');
const { logActivity } = require('../utils/activityLogger');
const {
  closePreviousLiveSessionsForTeacher,
  cleanupStaleSessions,
  reconcileZoomLiveSessions
} = require('../utils/liveClassSessionGuard');

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
  if (duration === null || duration === undefined || duration === '') {
    return null;
  }
  if (typeof duration === 'number' && Number.isFinite(duration)) {
    return Math.max(15, Math.min(480, Math.round(duration)));
  }
  const raw = String(duration || '').trim().toLowerCase();
  if (!raw) return null;
  const match = raw.match(/(\d+)/);
  const mins = match ? parseInt(match[1], 10) : null;
  if (!mins) return null;
  return Math.max(15, Math.min(480, mins));
}

/** Join window for scheduled classes — not shown as session length; class ends when trainer ends it. */
const SCHEDULED_JOIN_WINDOW_MINUTES = 480;

function formatSessionDuration(minutes) {
  const m = Math.max(1, Math.round(minutes));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h ${rem}m` : `${h}h`;
}

function getSessionProvider(o) {
  if (o?.conferenceProvider === 'zoom' || o?.conferenceProvider === 'meet') {
    return o.conferenceProvider;
  }
  if (o?.zoomMeetingId && !o?.meetLink) return 'zoom';
  return 'meet';
}

async function resolveConferenceForTeacher(teacherId) {
  const teacher = await User.findById(teacherId)
    .select('conferenceProvider zoomUserId name email role')
    .lean()
    .exec();
  if (!teacher) {
    return { provider: 'zoom', zoomUserId: '', teacher: null };
  }
  const settings = await getLiveClassSettings();
  let provider = teacher.conferenceProvider === 'zoom' ? 'zoom' : 'meet';
  // When Meet is off (env/admin), all live sessions use Zoom
  if (!settings.googleMeetEnabled) {
    provider = 'zoom';
  }
  const trainerZoomId = String(teacher.zoomUserId || '').trim();
  const zoomUserId =
    trainerZoomId || (provider === 'zoom' ? zoomConfig.defaultUserId() : '');
  return {
    provider,
    zoomUserId,
    teacher
  };
}

function getSessionJoinLink(doc, { host = false } = {}) {
  const o = doc?.toObject ? doc.toObject() : doc || {};
  const provider = getSessionProvider(o);
  if (provider === 'zoom') {
    let url = host ? o.zoomStartUrl || o.zoomLink || '' : o.zoomLink || '';
    if (url && o.zoomPassword && !String(url).includes('pwd=')) {
      url += `${String(url).includes('?') ? '&' : '?'}pwd=${encodeURIComponent(o.zoomPassword)}`;
    }
    return url;
  }
  return withMeetJoinDefaults(o.meetLink || '', { host });
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

  const conferenceProvider = getSessionProvider(o);
  const skipRecordingUpload = Boolean(o.skipRecordingUpload) || !o.batchId;
  const now = Date.now();
  const endMs = end ? end.getTime() : null;
  const hasJoinLink = Boolean(o.meetLink || o.zoomLink);
  const hasPlayableRecording = Boolean(o.youtubeVideoId || o.driveFileId);
  const needsRecording =
    !skipRecordingUpload &&
    hasJoinLink &&
    o.status !== 'cancelled' &&
    !o.recordingPromptDismissedAt &&
    !hasPlayableRecording &&
    endMs !== null &&
    endMs < now;

  const attendance = Array.isArray(o.attendance) ? o.attendance : [];
  const attendanceCount = attendance.filter(
    (a) => String(a.status || '').toLowerCase() === 'present' || String(a.status || '').toLowerCase() === 'late'
  ).length;
  const attendanceAbsent = attendance.filter(
    (a) => String(a.status || '').toLowerCase() === 'absent'
  ).length;

  const meetLink = o.meetLink || '';
  const zoomLink = o.zoomLink || '';
  const publicJoinLink =
    conferenceProvider === 'zoom' ? zoomLink : meetLink;

  return {
    id,
    title: o.title,
    description: o.description || '',
    batchId: o.batchId || '',
    unassigned: !o.batchId,
    skipRecordingUpload,
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
    duration: o.duration || '',
    status: o.status || 'scheduled',
    conferenceProvider,
    hasJoinLink,
    hasMeetLink: conferenceProvider === 'meet' ? Boolean(meetLink) : Boolean(zoomLink),
    meetLink: includeMeetLink && conferenceProvider === 'meet' ? meetLink : '',
    calendarEventId: includeMeetLink && conferenceProvider === 'meet' ? o.calendarEventId || '' : '',
    meetSpaceId: includeMeetLink && conferenceProvider === 'meet' ? o.meetSpaceId || '' : '',
    zoomMeetingId: includeMeetLink && conferenceProvider === 'zoom' ? o.zoomMeetingId || '' : '',
    zoomLink: includeMeetLink && conferenceProvider === 'zoom' ? zoomLink : '',
    zoomStartUrl: includeMeetLink && conferenceProvider === 'zoom' ? o.zoomStartUrl || '' : '',
    zoomPassword: includeMeetLink && conferenceProvider === 'zoom' ? o.zoomPassword || '' : '',
    joinLink: includeMeetLink ? publicJoinLink : '',
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
    recordingSyncAt: o.recordingSyncAt || null,
    recordingSyncError: o.recordingSyncError || '',
    recordingPipelineStatus: o.recordingPipelineStatus || '',
    zoomRecordingId: o.zoomRecordingId || '',
    youtubeVideoId: o.youtubeVideoId || '',
    youtubeVideoUrl: o.youtubeVideoUrl || '',
    youtubeEmbedUrl: o.youtubeEmbedUrl || '',
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
    .select('name enrollmentNumber email')
    .lean()
    .exec();
  return users.map((u) => ({
    studentId: String(u._id),
    studentName: u.name || '',
    enrollmentNumber: u.enrollmentNumber || '',
    email: u.email || ''
  }));
}

function withMeetJoinDefaults(link, { host = false } = {}) {
  if (!link) return '';
  try {
    const url = new URL(String(link).trim());
    if (!url.searchParams.has('audioMuted')) url.searchParams.set('audioMuted', 'true');
    if (!url.searchParams.has('videoMuted')) url.searchParams.set('videoMuted', 'true');
    if (host && !url.searchParams.has('hs')) url.searchParams.set('hs', '122');
    return url.toString();
  } catch {
    return String(link);
  }
}

async function findBatchForTeacher(batchId, teacherId) {
  const batch = await Batch.findById(batchId).lean().exec();
  if (!batch) return null;
  if (String(batch.teacherId) !== String(teacherId)) return null;
  return batch;
}

async function studentCanAccessBatch(userId, batchId) {
  if (!batchId) return false;
  const { resolveStudentBatchIds } = require('../utils/studentEnrollment');
  const ids = await resolveStudentBatchIds(userId);
  return ids.includes(String(batchId));
}

async function assertCanViewMeeting(user, meeting) {
  if (isAdmin(user.role)) return true;
  if (isTeacherRole(user.role) && String(meeting.teacherId) === String(user.id)) return true;
  if (isStudentRole(user.role)) {
    return studentCanAccessBatch(user.id, meeting.batchId);
  }
  return false;
}

/** Build Meeting SDK join payload for in-LMS Zoom classroom. */
async function buildZoomSdkPayload(doc, user, { wantHost = false } = {}) {
  if (getSessionProvider(doc) !== 'zoom' || !zoomMeetingSdk.isEmbeddedEnabled() || !doc.zoomMeetingId) {
    let sdkError = '';
    if (getSessionProvider(doc) === 'zoom' && !zoomMeetingSdk.isEmbeddedEnabled()) {
      sdkError = 'Zoom Meeting SDK is not configured on the server.';
    } else if (getSessionProvider(doc) === 'zoom' && !doc.zoomMeetingId) {
      sdkError = 'This Zoom class is missing a meeting ID.';
    }
    return { sdk: null, sdkError, embedded: false };
  }

  try {
    const role = wantHost ? 1 : 0;
    let signature = zoomMeetingSdk.generateSignature({
      meetingNumber: doc.zoomMeetingId,
      role
    });
    let zak = '';
    let zakError = '';
    if (role === 1) {
      try {
        const conf = await resolveConferenceForTeacher(doc.teacherId || user.id);
        zak = await zoomService.getZakToken(conf.zoomUserId || zoomConfig.defaultUserId());
      } catch (zakErr) {
        zakError = zakErr.message || 'Failed to get Zoom host token (ZAK)';
        console.warn('[meetings] ZAK token failed (continuing without host token):', zakError);
      }
    }
    const sdk = {
      sdkKey: zoomMeetingSdk.meetingSdkKey(),
      signature,
      meetingNumber: String(doc.zoomMeetingId).replace(/\s/g, ''),
      password: doc.zoomPassword || '',
      userName: user.name || (wantHost ? 'Trainer' : 'Student'),
      userEmail: user.email || '',
      role,
      zak: zak || undefined,
      zakMissing: role === 1 && !zak,
      zakError: zakError || undefined
    };
    let sdkError = '';
    if (sdk.zakMissing) {
      sdkError =
        'Host controls limited — reconnecting as participant. Ensure Zoom S2S scope user:read:token:admin is enabled.';
      sdk.role = 0;
      sdk.signature = zoomMeetingSdk.generateSignature({
        meetingNumber: doc.zoomMeetingId,
        role: 0
      });
    }
    return { sdk, sdkError, embedded: true };
  } catch (sdkErr) {
    const sdkError = sdkErr.message || 'Failed to build Zoom SDK join payload';
    console.warn('[meetings] SDK join payload failed:', sdkError);
    return { sdk: null, sdkError, embedded: false };
  }
}

// @route   GET /api/meetings/status
router.get('/status', async (req, res) => {
  try {
    const liveSettings = await getLiveClassSettings();
    const meetStatus = googleCalendarService.getMeetStatus();
    const sdkStatus = zoomMeetingSdk.getStatus();
    res.json({
      success: true,
      ...meetStatus,
      // Admin/env override — authoritative for whether Meet sessions are offered
      enabled: liveSettings.googleMeetEnabled,
      envEnabled: liveSettings.envGoogleMeetEnabled,
      adminOverride: liveSettings.adminOverride,
      defaultConferenceProvider: liveSettings.defaultConferenceProvider,
      drive: {
        configured: liveSettings.driveConfigured
      },
      youtube: {
        configured: liveSettings.youtubeConfigured,
        privacy: liveSettings.youtubePrivacy
      },
      zoom: {
        ...zoomService.getStatus(),
        recordingSyncEnabled: liveSettings.zoomRecordingSyncEnabled,
        embedded: sdkStatus.enabled,
        meetingSdk: sdkStatus
      },
      liveClass: liveSettings
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to read live class status' });
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
      $or: [{ meetLink: { $ne: '' } }, { zoomLink: { $ne: '' } }],
      recordingPromptDismissedAt: null,
      $and: [
        { $or: [{ driveFileId: { $exists: false } }, { driveFileId: '' }, { driveFileId: null }] }
      ],
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

// @route   POST /api/meetings/sync-recordings
// @desc    Sync Zoom (→ Drive → YouTube) and/or Meet recordings into Classroom
router.post('/sync-recordings', async (req, res) => {
  try {
    if (!isAdmin(req.user.role) && !isTeacherRole(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const meetingId = String(req.body?.meetingId || '').trim();

    if (meetingId) {
      const doc = await LiveClass.findById(meetingId).lean().exec();
      if (!doc) {
        return res.status(404).json({ success: false, message: 'Meeting not found' });
      }
      if (!(await assertTeacherOrAdminOwns(req.user, doc))) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
      if (!doc.batchId || doc.skipRecordingUpload) {
        return res.json({
          success: true,
          message: 'This meeting is not assigned to a batch, so recordings are not imported.',
          checked: 0,
          synced: []
        });
      }

      if (getSessionProvider(doc) === 'zoom') {
        const result = await syncZoomRecordings({ meetingId });
        const n = (result.synced || []).length;
        return res.json({
          success: true,
          pipeline: 'zoom',
          message: n
            ? `Synced ${n} Zoom recording${n === 1 ? '' : 's'} to YouTube.`
            : result.errors?.[0]?.reason ||
              'No new Zoom recording yet. Cloud processing usually finishes 15–60 minutes after class.',
          ...result
        });
      }

      if (!(await isMeetLiveEnabled())) {
        return res.status(400).json({
          success: false,
          message:
            'Google Meet recording sync is disabled. Enable Meet in Admin → Live platforms, or use Zoom.'
        });
      }
      const result = await syncMeetRecordings({ meetingId });
      const n = (result.synced || []).length;
      return res.json({
        success: true,
        pipeline: 'meet',
        message: n
          ? `Synced ${n} Meet recording${n === 1 ? '' : 's'} into the assigned batch.`
          : 'No new Meet recordings yet. Meet usually finishes processing 15–60 minutes after class.',
        ...result
      });
    }

    // Bulk: Zoom first (primary), Meet only when enabled
    const zoomResult = await syncZoomRecordings();
    let meetResult = { skipped: true, synced: [], checked: 0 };
    if (await isMeetLiveEnabled()) {
      meetResult = await syncMeetRecordings();
    }
    const n =
      (zoomResult.synced || []).length + (meetResult.synced || []).length;
    res.json({
      success: true,
      message: n
        ? `Synced ${n} recording${n === 1 ? '' : 's'}.`
        : 'No new recordings yet.',
      zoom: zoomResult,
      meet: meetResult,
      synced: [...(zoomResult.synced || []), ...(meetResult.synced || [])]
    });
  } catch (error) {
    console.error('POST /sync-recordings error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to sync recordings'
    });
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
      await cleanupStaleSessions({ teacherId: userId });
      await reconcileZoomLiveSessions({ teacherId: userId });
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
      timezone,
      startNow,
      unassigned: unassignedRaw
    } = req.body || {};

    const wantsStartNow = startNow === true || startNow === 'true' || startNow === 1;
    const unassigned =
      unassignedRaw === true ||
      unassignedRaw === 'true' ||
      unassignedRaw === 1 ||
      (wantsStartNow && !batchId);

    if (!title || !String(title).trim()) {
      return res.status(400).json({ success: false, message: 'title is required' });
    }
    if (!unassigned && !batchId) {
      return res.status(400).json({ success: false, message: 'title and batchId are required' });
    }
    if (unassigned && !wantsStartNow) {
      return res.status(400).json({
        success: false,
        message: 'Unassigned meetings are instant-only. Use startNow without a batch.'
      });
    }

    let batch = null;
    if (!unassigned) {
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
    }

    const tz = timezone || 'Asia/Kolkata';
    let start;
    if (wantsStartNow) {
      start = new Date();
    } else if (scheduledStart) {
      start = new Date(scheduledStart);
    } else if (scheduledDate && scheduledTime) {
      // Interpret as local IST wall time when no offset provided
      start = new Date(`${scheduledDate}T${scheduledTime}:00+05:30`);
    } else {
      return res.status(400).json({
        success: false,
        message: 'Provide startNow, scheduledStart (ISO), or scheduledDate + scheduledTime'
      });
    }

    if (Number.isNaN(start.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid start date/time' });
    }

    const parsedMins = parseDurationMinutes(durationMinutes ?? duration);
    const mins = parsedMins ?? SCHEDULED_JOIN_WINDOW_MINUTES;
    const end = new Date(start.getTime() + mins * 60 * 1000);

    const teacherId = unassigned ? String(req.user.id) : String(batch.teacherId);
    let teacherName = unassigned ? req.user.name || 'Trainer' : batch.teacherName || '';
    if (!teacherName) {
      const teacher = await User.findById(teacherId).select('name').lean().exec();
      teacherName = teacher?.name || req.user.name || 'Trainer';
    }

    let calendarEventId = '';
    let meetLink = '';
    let meetSpaceId = '';
    let zoomMeetingId = '';
    let zoomLink = '';
    let zoomStartUrl = '';
    let zoomPassword = '';
    let conferenceProvider = 'meet';

    const conf = await resolveConferenceForTeacher(teacherId);
    const requestedProvider =
      req.body?.conferenceProvider === 'zoom' || req.body?.conferenceProvider === 'meet'
        ? req.body.conferenceProvider
        : null;
    const effectiveProvider =
      requestedProvider && requestedProvider === conf.provider ? requestedProvider : conf.provider;
    const classDescription =
      description ||
      (unassigned
        ? 'Ad-hoc live class (not assigned to a batch).'
        : `Live class for batch ${batch.name || batchId}`);

    let closedPreviousSessions = [];
    if (wantsStartNow) {
      await cleanupStaleSessions({ teacherId });
      closedPreviousSessions = await closePreviousLiveSessionsForTeacher(teacherId);
    }

    let zoomIsPmr = false;

    if (effectiveProvider === 'zoom') {
      if (!zoomService.isConfigured()) {
        return res.status(503).json({
          success: false,
          message: 'Zoom is selected for this trainer but Zoom API credentials are not configured on the server.',
          code: 'ZOOM_NOT_CONFIGURED'
        });
      }
      if (!conf.zoomUserId) {
        return res.status(400).json({
          success: false,
          message:
            'This trainer is set to use Zoom but no Zoom user ID is configured. Set ZOOM_DEFAULT_USER_ID in env or add one in Admin → Teachers.',
          code: 'ZOOM_USER_REQUIRED'
        });
      }
      try {
        // Always use the trainer PMI so students join the same Zoom room every class.
        const usePMR = true;
        const created = await zoomService.createMeeting({
          zoomUserId: conf.zoomUserId,
          topic: String(title).trim(),
          agenda: classDescription,
          startTime: start,
          duration: mins,
          timezone: tz,
          instant: false,
          usePMR
        });
        zoomMeetingId = String(created.meeting.meetingId || created.meeting.id || '');
        zoomLink = created.meeting.joinUrl || '';
        zoomPassword = created.meeting.password || '';
        zoomIsPmr = Boolean(created.meeting.isPMR);
        zoomStartUrl = await zoomService.getHostStartUrl(conf.zoomUserId, zoomMeetingId, {
          password: zoomPassword
        });
        conferenceProvider = 'zoom';
      } catch (zoomErr) {
        console.error('Zoom createMeeting failed:', zoomErr?.message || zoomErr);
        return res.status(502).json({
          success: false,
          message: zoomErr.message || 'Failed to create Zoom meeting',
          code: zoomErr.code || 'ZOOM_CREATE_FAILED'
        });
      }
      if (!zoomLink) {
        return res.status(502).json({
          success: false,
          message: 'Zoom meeting created but no join link was returned.'
        });
      }
    } else {
      if (!(await isMeetLiveEnabled())) {
        return res.status(503).json({
          success: false,
          message:
            'Google Meet is disabled. Enable it in Admin → Live platforms, or set this trainer to Zoom.',
          code: 'MEET_DISABLED'
        });
      }
      try {
        const created = await googleCalendarService.createMeetEvent({
          title: String(title).trim(),
          description: classDescription,
          start,
          end,
          timezone: tz
        });
        calendarEventId = created.calendarEventId || '';
        meetLink = created.meetLink || '';
        meetSpaceId = created.meetSpaceId || '';
      } catch (calErr) {
        console.error('Google Calendar createMeetEvent failed:', calErr?.message || calErr);
        const quota = googleCalendarService.isCalendarQuotaError(calErr);
        const code = calErr.code === 'MEET_DISABLED' || calErr.code === 'MEET_NOT_CONFIGURED' ? 503 : 502;
        return res.status(code).json({
          success: false,
          message: quota
            ? googleCalendarService.calendarQuotaMessage()
            : calErr.message || 'Failed to create Google Meet event',
          code: quota ? 'CALENDAR_QUOTA_EXCEEDED' : calErr.code || 'MEET_CREATE_FAILED'
        });
      }

      if (!meetLink) {
        if (calendarEventId) {
          try {
            await googleCalendarService.cancelMeetEvent(calendarEventId);
          } catch (_) {
            /* ignore */
          }
        }
        return res.status(502).json({
          success: false,
          message:
            'Calendar event created but no Meet link was returned. Check Workspace Meet licensing for the host user.'
        });
      }
      conferenceProvider = 'meet';
    }

    const roster = unassigned ? [] : await getBatchRoster(String(batchId));
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
      batchId: unassigned ? '' : String(batchId),
      teacherId,
      teacherName,
      instructor: teacherName,
      course: unassigned ? '' : batch.course || '',
      courseId: unassigned ? '' : batch.courseId ? String(batch.courseId) : '',
      scheduledStart: start,
      scheduledEnd: end,
      timezone: tz,
      duration: parsedMins ? `${parsedMins} mins` : '',
      scheduledDate: start.toLocaleDateString('en-CA', { timeZone: tz }),
      scheduledTime: start.toLocaleTimeString('en-GB', {
        timeZone: tz,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }),
      conferenceProvider,
      calendarEventId,
      meetLink,
      meetSpaceId,
      zoomMeetingId,
      zoomLink,
      zoomStartUrl,
      zoomPassword,
      zoomIsPmr,
      status: wantsStartNow ? 'live' : 'scheduled',
      attendance: seededAttendance,
      skipRecordingUpload: Boolean(unassigned),
      recordingPromptDismissedAt: unassigned ? new Date() : null,
      createdBy: String(req.user.id),
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const serialized = serializeMeeting(liveClass);
    const hostJoin = getSessionJoinLink(liveClass, { host: true });
    const platformLabel = conferenceProvider === 'zoom' ? 'Zoom' : 'Google Meet';
    const sdkBundle =
      conferenceProvider === 'zoom' && wantsStartNow
        ? await buildZoomSdkPayload(liveClass, req.user, { wantHost: true })
        : { sdk: null, sdkError: '', embedded: false };
    res.status(201).json({
      success: true,
      message: unassigned
        ? `Instant ${platformLabel} class created (no batch).`
        : liveClass.status === 'live'
          ? `Instant ${platformLabel} room created. Students join from the LMS dashboard.`
          : `${platformLabel} class scheduled`,
      meeting: serialized,
      meetLink: hostJoin,
      startUrl: hostJoin,
      joinUrl: hostJoin,
      conferenceProvider,
      embedded: sdkBundle.embedded,
      sdk: sdkBundle.sdk,
      sdkError: sdkBundle.sdkError || undefined,
      closedPreviousSessions
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

    if (getSessionProvider(doc) === 'meet' && doc.calendarEventId) {
      try {
        await googleCalendarService.cancelMeetEvent(doc.calendarEventId);
      } catch (calErr) {
        console.error('cancelMeetEvent failed:', calErr?.message || calErr);
        if (calErr.code !== 'MEET_DISABLED' && calErr.code !== 'MEET_NOT_CONFIGURED') {
          return res.status(502).json({
            success: false,
            message: calErr.message || 'Failed to cancel Calendar event'
          });
        }
      }
    }

  // PMI is the trainer's permanent room — never delete it when cancelling an LMS session.
    if (getSessionProvider(doc) === 'zoom' && doc.zoomMeetingId && !doc.zoomIsPmr) {
      try {
        await zoomService.deleteMeeting(doc.zoomMeetingId);
      } catch (zoomErr) {
        console.error('deleteMeeting failed:', zoomErr?.message || zoomErr);
        if (zoomErr.code !== 'ZOOM_NOT_CONFIGURED') {
          return res.status(502).json({
            success: false,
            message: zoomErr.message || 'Failed to cancel Zoom meeting'
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
    if (!doc.meetLink && !doc.zoomLink) {
      if (getSessionProvider(doc) === 'zoom') {
        const conf = await resolveConferenceForTeacher(doc.teacherId);
        if (!conf.zoomUserId) {
          return res.status(400).json({ success: false, message: 'No Zoom user configured for this trainer' });
        }
        const pmr = await zoomService.createMeeting({
          zoomUserId: conf.zoomUserId,
          topic: doc.title || 'Live Class',
          startTime: doc.scheduledStart || new Date(),
          duration: parseDurationMinutes(doc.duration) || SCHEDULED_JOIN_WINDOW_MINUTES,
          timezone: doc.timezone || 'Asia/Kolkata',
          usePMR: true
        });
        doc.zoomMeetingId = String(pmr.meeting.meetingId || pmr.meeting.id || '');
        doc.zoomLink = pmr.meeting.joinUrl || '';
        doc.zoomPassword = pmr.meeting.password || '';
        doc.zoomIsPmr = true;
        doc.zoomStartUrl = await zoomService.getHostStartUrl(conf.zoomUserId, doc.zoomMeetingId, {
          password: doc.zoomPassword || ''
        });
        doc.conferenceProvider = 'zoom';
        await doc.save();
      } else {
        return res.status(400).json({ success: false, message: 'No live class link available' });
      }
    }
    const teacherIdForGuard = isTeacherRole(req.user.role) ? String(req.user.id) : String(doc.teacherId);
    await cleanupStaleSessions({ teacherId: teacherIdForGuard });
    const closedPreviousSessions = await closePreviousLiveSessionsForTeacher(teacherIdForGuard, {
      exceptMeetingId: doc._id
    });
    if (isTeacherRole(req.user.role)) {
      doc.teacherId = String(req.user.id);
      if (req.user.name) doc.teacherName = req.user.name;
    }
    if (doc.status === 'scheduled' || doc.status === 'live') {
      const now = new Date();
      const scheduledStart = doc.scheduledStart ? new Date(doc.scheduledStart) : null;
      const windowMins = parseDurationMinutes(doc.duration) || SCHEDULED_JOIN_WINDOW_MINUTES;
      if (scheduledStart && scheduledStart > now) {
        const earlyEnd = new Date(now.getTime() + windowMins * 60 * 1000);
        const plannedEnd = doc.scheduledEnd
          ? new Date(doc.scheduledEnd)
          : new Date(scheduledStart.getTime() + windowMins * 60 * 1000);
        doc.scheduledEnd = earlyEnd > plannedEnd ? earlyEnd : plannedEnd;
      }
      doc.status = 'live';
      doc.updatedAt = new Date();
      if (getSessionProvider(doc) === 'zoom') {
        const conf = await resolveConferenceForTeacher(doc.teacherId);
        if (conf.zoomUserId) {
          const pmr = await zoomService.createMeeting({
            zoomUserId: conf.zoomUserId,
            topic: doc.title || 'Live Class',
            startTime: doc.scheduledStart || new Date(),
            duration: parseDurationMinutes(doc.duration) || SCHEDULED_JOIN_WINDOW_MINUTES,
            timezone: doc.timezone || 'Asia/Kolkata',
            usePMR: true
          });
          doc.zoomMeetingId = String(pmr.meeting.meetingId || pmr.meeting.id || doc.zoomMeetingId || '');
          doc.zoomLink = pmr.meeting.joinUrl || doc.zoomLink || '';
          doc.zoomPassword = pmr.meeting.password || doc.zoomPassword || '';
          doc.zoomIsPmr = true;
          doc.zoomStartUrl = await zoomService.getHostStartUrl(conf.zoomUserId, doc.zoomMeetingId, {
            password: doc.zoomPassword || ''
          });
        }
      }
      await doc.save();
    }

    try {
      if (!doc.skipRecordingUpload && doc.batchId) {
        await ensureClassroomFromLiveClass(doc);
      }
    } catch (pubErr) {
      console.warn('[meetings] classroom publish on start:', pubErr.message || pubErr);
    }

    if (getSessionProvider(doc) === 'meet' && doc.meetSpaceId) {
      try {
        await googleCalendarService.configureMeetSpaceOpen(doc.meetSpaceId);
      } catch (_) {
        /* optional */
      }
    }

    const hostJoin = getSessionJoinLink(doc, { host: true });
    const provider = getSessionProvider(doc);
    const sdkBundle =
      provider === 'zoom'
        ? await buildZoomSdkPayload(doc, req.user, { wantHost: true })
        : { sdk: null, sdkError: '', embedded: false };
    res.json({
      success: true,
      meeting: serializeMeeting(doc),
      startUrl: hostJoin,
      meetLink: hostJoin,
      joinUrl: hostJoin,
      conferenceProvider: provider,
      embedded: sdkBundle.embedded,
      sdk: sdkBundle.sdk,
      sdkError: sdkBundle.sdkError || undefined,
      joinDefaults:
        provider === 'meet'
          ? { audioMuted: true, videoMuted: true, autoRecordRequested: true }
          : { zoomHost: true },
      message:
        provider === 'zoom'
          ? 'Class started. Opening Zoom Workspace as host.'
          : 'Class started. Join opens with mic/camera muted. Start Meet recording if it does not begin automatically.',
      closedPreviousSessions
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
    if (!doc.meetLink && !doc.zoomLink) {
      return res.status(400).json({ success: false, message: 'No live class link available' });
    }
    if (isStudentRole(req.user.role) && (!doc.batchId || doc.skipRecordingUpload)) {
      return res.status(403).json({
        success: false,
        message: 'This is an internal Meet and is not assigned to a class batch.'
      });
    }

    const allowed = await assertCanViewMeeting(req.user, doc);
    if (!allowed) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    let markedPresent = false;
    if (isStudentRole(req.user.role)) {
      const studentId = String(req.user.id);
      const user = await User.findById(studentId).select('name').lean().exec();
      markStudentPresent(doc, {
        studentId,
        studentName: user?.name || req.user.name || ''
      });
      markedPresent = true;
      try {
        const certificateService = require('../services/certificateService');
        if (doc.batchId) {
          await certificateService.maybeAutoIssue(studentId, String(doc.batchId));
        }
      } catch (certErr) {
        console.warn('[certificates] auto-issue after join:', certErr.message || certErr);
      }
    }
    if (isTeacherRole(req.user.role)) {
      doc.teacherId = String(req.user.id);
      if (req.user.name) doc.teacherName = req.user.name;
    }
    if (doc.status === 'scheduled' || isStudentRole(req.user.role) || isTeacherRole(req.user.role)) {
      if (doc.status === 'scheduled') doc.status = 'live';
      doc.updatedAt = new Date();
      await doc.save();
    }

    const joinLink = getSessionJoinLink(doc, {
      host: isTeacherRole(req.user.role) || isAdmin(req.user.role)
    });
    const provider = getSessionProvider(doc);
    const wantHost = Boolean(
      req.body?.host || isTeacherRole(req.user.role) || isAdmin(req.user.role)
    );

    const { sdk, sdkError, embedded: sdkEmbedded } = await buildZoomSdkPayload(doc, req.user, {
      wantHost
    });

    res.json({
      success: true,
      meetLink: joinLink,
      joinUrl: joinLink,
      conferenceProvider: provider,
      embedded: sdkEmbedded && Boolean(sdk),
      sdk,
      sdkError: sdkError || undefined,
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
    const now = new Date();
    doc.status = 'completed';
    if (doc.scheduledStart) {
      const start = new Date(doc.scheduledStart);
      if (!Number.isNaN(start.getTime())) {
        const elapsedMins = Math.max(1, Math.round((now.getTime() - start.getTime()) / 60000));
        doc.scheduledEnd = now;
        doc.duration = formatSessionDuration(elapsedMins);
      }
    } else {
      doc.scheduledEnd = now;
    }
    if (dismissPrompt) doc.recordingPromptDismissedAt = new Date();
    doc.updatedAt = new Date();
    await doc.save();

    try {
      if (!doc.skipRecordingUpload && doc.batchId) {
        await ensureClassroomFromLiveClass(doc);
      }
    } catch (pubErr) {
      console.warn('[meetings] classroom publish on complete:', pubErr.message || pubErr);
    }

    if (!doc.skipRecordingUpload && doc.batchId) {
      if (getSessionProvider(doc) === 'zoom') {
        syncZoomRecordings({ meetingId: String(doc._id) }).catch((err) =>
          console.warn('[meetings] zoom recording sync on complete:', err.message || err)
        );
      } else {
        syncMeetRecordings({ meetingId: String(doc._id) }).catch((err) =>
          console.warn('[meetings] recording sync on complete:', err.message || err)
        );
      }
    }

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
    if (doc.skipRecordingUpload || !doc.batchId) {
      return res.status(400).json({
        success: false,
        message: 'This meeting is not assigned to a batch, so files are not uploaded to Drive.'
      });
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

    const teacher = doc.teacherId
      ? await User.findById(doc.teacherId).select('email').lean().exec()
      : null;
    const shareEmails = [teacher?.email, req.user?.email].filter(Boolean);

    const uploaded = await googleDriveService.uploadBatchFile({
      batchId: doc.batchId,
      batchName: batch?.name || '',
      folderId,
      filePath: req.file.path,
      fileName: req.file.originalname || `session-material-${Date.now()}`,
      mimeType: req.file.mimetype,
      title: req.body?.name || doc.title,
      shareWithEmails: shareEmails
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
    const Classroom = require('../models/Classroom');
    const linkedLecture = await Classroom.findOne({ liveClassId: String(doc._id) })
      .select('_id')
      .lean()
      .exec();
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
      classroomLectureId: linkedLecture ? String(linkedLecture._id) : '',
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
    if (doc.skipRecordingUpload || !doc.batchId) {
      return res.status(400).json({
        success: false,
        message: 'This meeting is not assigned to a batch. Recordings are not uploaded to Drive or Classroom.'
      });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'recording file is required' });
    }
    if (Number(req.file.size || 0) < googleDriveService.MIN_PLAYABLE_VIDEO_BYTES) {
      return res.status(400).json({
        success: false,
        message: 'That file is too small to be a class recording. Upload the real Meet video (mp4).'
      });
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

    const teacher = doc.teacherId
      ? await User.findById(doc.teacherId).select('email').lean().exec()
      : null;
    const shareEmails = [teacher?.email, req.user?.email].filter(Boolean);

    const uploaded = await googleDriveService.uploadRecordingFile({
      batchId: doc.batchId,
      batchName: batch?.name || '',
      folderId,
      filePath: req.file.path,
      fileName: `${doc.title || 'class'}-${Date.now()}${path.extname(req.file.originalname) || '.mp4'}`,
      mimeType: req.file.mimetype,
      title: doc.title,
      shareWithEmails: shareEmails
    });

    doc.driveFolderId = uploaded.folderId;
    doc.driveFileId = uploaded.driveFileId;
    doc.driveLink = uploaded.driveLink;
    doc.recordingUploadedAt = new Date();
    doc.recordingPromptDismissedAt = new Date();
    doc.status = 'completed';
    doc.updatedAt = new Date();
    await doc.save();

    const lecture = await ensureClassroomFromLiveClass(doc, {
      videoSource: 'drive',
      driveFileId: uploaded.driveFileId,
      driveLink: uploaded.driveLink
    });

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
      lectureId: lecture ? String(lecture._id) : doc.classroomLectureId
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
