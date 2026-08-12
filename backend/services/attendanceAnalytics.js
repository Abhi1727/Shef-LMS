const LiveClass = require('../models/LiveClass');
const Batch = require('../models/Batch');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');

function getThreshold() {
  const n = parseInt(process.env.ATTENDANCE_ALERT_THRESHOLD || '70', 10);
  return Number.isFinite(n) ? Math.min(100, Math.max(1, n)) : 70;
}

function getStreakLimit() {
  const n = parseInt(process.env.ATTENDANCE_STREAK_ALERT || '3', 10);
  return Number.isFinite(n) ? Math.min(20, Math.max(2, n)) : 3;
}

function getEngagementInactiveDays() {
  const n = parseInt(process.env.ENGAGEMENT_INACTIVE_DAYS || '14', 10);
  return Number.isFinite(n) ? Math.min(90, Math.max(3, n)) : 14;
}

function getPassiveJoinFloor() {
  const n = parseInt(process.env.ENGAGEMENT_PASSIVE_JOIN_FLOOR || '40', 10);
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 40;
}

function isPresentStatus(status) {
  const s = String(status || '').toLowerCase();
  return s === 'present' || s === 'late';
}

/**
 * Healthy | Passive | Unengaged
 */
function scoreEngagement({ joinRate, consecutiveAbsent, recentlyActive, threshold, streakLimit, passiveFloor }) {
  if (consecutiveAbsent >= streakLimit || joinRate < passiveFloor) {
    return 'Unengaged';
  }
  if (joinRate >= threshold && recentlyActive) {
    return 'Healthy';
  }
  // Join rate OK but inactive, or mid-range join rate
  return 'Passive';
}

async function getBatchRoster(batchId) {
  const batch = await Batch.findById(batchId).select('students name course teacherId teacherName').lean().exec();
  if (!batch) return { batch: null, roster: [] };
  const ids = (batch.students || []).map((s) => String(s));
  const extra = await User.find({
    role: 'student',
    $or: [{ batchId: String(batchId) }, { oneToOneBatchId: String(batchId) }]
  })
    .select('name email enrollmentNumber')
    .lean()
    .exec();
  const allIds = [...new Set([...ids, ...extra.map((u) => String(u._id))])];
  if (!allIds.length) return { batch, roster: [] };
  const users = await User.find({ _id: { $in: allIds }, role: 'student' })
    .select('name email enrollmentNumber')
    .lean()
    .exec();
  return {
    batch,
    roster: users.map((u) => ({
      studentId: String(u._id),
      studentName: u.name || '',
      email: u.email || '',
      enrollmentNumber: u.enrollmentNumber || ''
    }))
  };
}

/**
 * Completed / ended Meet sessions for a batch (attendance-relevant).
 */
async function getCountableSessions(batchId) {
  const now = new Date();
  const docs = await LiveClass.find({
    batchId: String(batchId),
    status: { $ne: 'cancelled' },
    meetLink: { $ne: '' },
    $or: [{ status: 'completed' }, { status: 'live' }, { scheduledEnd: { $lt: now } }]
  })
    .sort({ scheduledStart: 1 })
    .lean()
    .exec();
  return docs;
}

function studentStatusForSession(session, studentId) {
  const row = (session.attendance || []).find((a) => String(a.studentId) === String(studentId));
  if (!row) return 'absent';
  return String(row.status || 'absent').toLowerCase();
}

/**
 * Recent activity: Meet join or classroom video_view within inactiveDays.
 */
async function getRecentActivityMap(studentIds, sessions, inactiveDays) {
  const since = new Date(Date.now() - inactiveDays * 24 * 60 * 60 * 1000);
  const map = {};
  studentIds.forEach((id) => {
    map[id] = { recentlyActive: false, lastActivityAt: null };
  });
  if (!studentIds.length) return map;

  // Meet join = present/late with updatedAt
  for (const sess of sessions) {
    for (const a of sess.attendance || []) {
      const sid = String(a.studentId);
      if (!map[sid]) continue;
      if (!isPresentStatus(a.status)) continue;
      const at = a.updatedAt ? new Date(a.updatedAt) : sess.scheduledStart ? new Date(sess.scheduledStart) : null;
      if (!at || Number.isNaN(at.getTime())) continue;
      if (at >= since) {
        map[sid].recentlyActive = true;
        if (!map[sid].lastActivityAt || at > map[sid].lastActivityAt) {
          map[sid].lastActivityAt = at;
        }
      }
    }
  }

  const logs = await ActivityLog.find({
    userId: { $in: studentIds },
    action: { $in: ['video_view', 'VIDEO_VIEW', 'login', 'LOGIN'] },
    timestamp: { $gte: since }
  })
    .select('userId timestamp action')
    .lean()
    .exec();

  for (const log of logs) {
    const sid = String(log.userId);
    if (!map[sid]) continue;
    const at = log.timestamp ? new Date(log.timestamp) : null;
    if (!at || Number.isNaN(at.getTime())) continue;
    map[sid].recentlyActive = true;
    if (!map[sid].lastActivityAt || at > map[sid].lastActivityAt) {
      map[sid].lastActivityAt = at;
    }
  }

  return map;
}

/**
 * Per-student join stats + engagement segment for a batch.
 */
async function getBatchAttendanceSummary(batchId) {
  const threshold = getThreshold();
  const streakLimit = getStreakLimit();
  const inactiveDays = getEngagementInactiveDays();
  const passiveFloor = getPassiveJoinFloor();
  const { batch, roster } = await getBatchRoster(batchId);
  if (!batch) {
    return {
      batch: null,
      threshold,
      streakLimit,
      inactiveDays,
      passiveFloor,
      sessionsTotal: 0,
      students: [],
      engagementCounts: { Healthy: 0, Passive: 0, Unengaged: 0 }
    };
  }

  const sessions = await getCountableSessions(batchId);
  const sessionsTotal = sessions.length;
  const activityMap = await getRecentActivityMap(
    roster.map((s) => s.studentId),
    sessions,
    inactiveDays
  );

  const students = roster.map((s) => {
    let presentCount = 0;
    let absentCount = 0;
    let lateCount = 0;
    let consecutiveAbsent = 0;
    const newestFirst = [...sessions].reverse();
    for (const sess of newestFirst) {
      const st = studentStatusForSession(sess, s.studentId);
      if (st === 'absent') consecutiveAbsent += 1;
      else break;
    }
    for (const sess of sessions) {
      const st = studentStatusForSession(sess, s.studentId);
      if (st === 'present') presentCount += 1;
      else if (st === 'late') {
        lateCount += 1;
        presentCount += 1;
      } else absentCount += 1;
    }
    const joinRate = sessionsTotal > 0 ? Math.round((presentCount / sessionsTotal) * 100) : 100;
    const activity = activityMap[s.studentId] || { recentlyActive: false, lastActivityAt: null };
    const recentlyActive = Boolean(activity.recentlyActive);
    const engagement = scoreEngagement({
      joinRate,
      consecutiveAbsent,
      recentlyActive,
      threshold,
      streakLimit,
      passiveFloor
    });

    return {
      ...s,
      sessionsTotal,
      presentCount,
      absentCount,
      lateCount,
      joinRate,
      consecutiveAbsent,
      belowThreshold: sessionsTotal > 0 && joinRate < threshold,
      streakAlert: consecutiveAbsent >= streakLimit,
      recentlyActive,
      lastActivityAt: activity.lastActivityAt || null,
      engagement
    };
  });

  students.sort((a, b) => {
    const order = { Unengaged: 0, Passive: 1, Healthy: 2 };
    const ea = order[a.engagement] ?? 3;
    const eb = order[b.engagement] ?? 3;
    if (ea !== eb) return ea - eb;
    return a.joinRate - b.joinRate || b.consecutiveAbsent - a.consecutiveAbsent;
  });

  const presentAvg =
    students.length && sessionsTotal
      ? Math.round(students.reduce((sum, s) => sum + s.joinRate, 0) / students.length)
      : 0;

  const engagementCounts = {
    Healthy: students.filter((s) => s.engagement === 'Healthy').length,
    Passive: students.filter((s) => s.engagement === 'Passive').length,
    Unengaged: students.filter((s) => s.engagement === 'Unengaged').length
  };

  return {
    batch: {
      id: String(batch._id),
      name: batch.name || '',
      course: batch.course || '',
      teacherId: batch.teacherId ? String(batch.teacherId) : '',
      teacherName: batch.teacherName || ''
    },
    threshold,
    streakLimit,
    inactiveDays,
    passiveFloor,
    sessionsTotal,
    batchJoinRateAvg: presentAvg,
    belowThresholdCount: students.filter((s) => s.belowThreshold).length,
    streakAlertCount: students.filter((s) => s.streakAlert).length,
    engagementCounts,
    students
  };
}

/**
 * Absentee emails for a single session.
 */
async function getSessionAbsentees(meetingDoc) {
  const batchId = String(meetingDoc.batchId || '');
  const { roster } = await getBatchRoster(batchId);
  const byId = {};
  (meetingDoc.attendance || []).forEach((a) => {
    byId[String(a.studentId)] = a;
  });
  return roster
    .filter((s) => {
      const st = String(byId[s.studentId]?.status || 'absent').toLowerCase();
      return st === 'absent';
    })
    .filter((s) => s.email);
}

module.exports = {
  getThreshold,
  getStreakLimit,
  getEngagementInactiveDays,
  getPassiveJoinFloor,
  scoreEngagement,
  getBatchRoster,
  getCountableSessions,
  getBatchAttendanceSummary,
  getSessionAbsentees,
  isPresentStatus,
  studentStatusForSession
};
