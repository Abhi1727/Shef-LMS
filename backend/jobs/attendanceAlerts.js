const cron = require('node-cron');
const Batch = require('../models/Batch');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const attendanceAnalytics = require('../services/attendanceAnalytics');
const { sendTransactionalEmail } = require('../services/emailService');

async function getAdminEmails() {
  const fromEnv = String(process.env.ADMIN_ALERT_EMAILS || '')
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);
  if (fromEnv.length) return fromEnv;
  const admins = await User.find({ role: 'admin' }).select('email').lean().exec();
  return admins.map((a) => a.email).filter(Boolean);
}

async function alreadyAlerted(studentId, lastSessionId) {
  const existing = await ActivityLog.findOne({
    action: 'ATTENDANCE_STREAK_ALERT',
    userId: String(studentId),
    videoId: String(lastSessionId || '')
  })
    .lean()
    .exec();
  return Boolean(existing);
}

/**
 * Scan batches for consecutive no-join streaks and email admins.
 */
async function runAttendanceStreakAlerts() {
  const streakLimit = attendanceAnalytics.getStreakLimit();
  const adminEmails = await getAdminEmails();
  if (!adminEmails.length) {
    console.warn('[Attendance Alerts] No admin emails configured');
    return { scanned: 0, alerted: 0 };
  }

  const batches = await Batch.find({ status: { $ne: 'archived' } })
    .select('_id name')
    .lean()
    .exec();

  let scanned = 0;
  let alerted = 0;

  for (const batch of batches) {
    const batchId = String(batch._id);
    const summary = await attendanceAnalytics.getBatchAttendanceSummary(batchId);
    if (!summary.sessionsTotal) continue;

    const sessions = await attendanceAnalytics.getCountableSessions(batchId);
    const lastSession = sessions[sessions.length - 1];
    const lastSessionId = lastSession ? String(lastSession._id) : '';

    for (const student of summary.students) {
      scanned += 1;
      if (!student.streakAlert) continue;
      if (await alreadyAlerted(student.studentId, lastSessionId)) continue;

      const subject = `[Attendance] ${student.studentName} missed ${student.consecutiveAbsent} live classes`;
      const text = [
        `Attendance streak alert`,
        ``,
        `Student: ${student.studentName} (${student.email || 'no email'})`,
        `Enrollment: ${student.enrollmentNumber || '—'}`,
        `Batch: ${summary.batch?.name || batchId}`,
        `Engagement: ${student.engagement || '—'}`,
        `Consecutive absences: ${student.consecutiveAbsent} (threshold ${streakLimit})`,
        `Join rate: ${student.joinRate}% over ${student.sessionsTotal} session(s)`,
        ``,
        `Please follow up with the trainer / student.`,
        `— Sky States LMS`
      ].join('\n');

      for (const to of adminEmails) {
        try {
          await sendTransactionalEmail({ to, subject, text });
        } catch (err) {
          console.error(`[Attendance Alerts] Email to ${to} failed:`, err.message || err);
        }
      }

      await ActivityLog.create({
        action: 'ATTENDANCE_STREAK_ALERT',
        userId: String(student.studentId),
        userName: student.studentName || '',
        userEmail: student.email || '',
        userRole: 'student',
        timestamp: new Date(),
        videoId: lastSessionId,
        videoTitle: lastSession?.title || '',
        path: batchId,
        assessmentTitle: summary.batch?.name || '',
        score: student.consecutiveAbsent
      });

      alerted += 1;
      console.log(
        `[Attendance Alerts] Streak alert for ${student.studentName} batch=${summary.batch?.name}`
      );
    }
  }

  return { scanned, alerted };
}

/**
 * Weekly engagement digest for admins (Passive + Unengaged counts per batch).
 */
async function runEngagementDigest() {
  const adminEmails = await getAdminEmails();
  if (!adminEmails.length) {
    console.warn('[Engagement Digest] No admin emails configured');
    return { batches: 0 };
  }

  const batches = await Batch.find({ status: { $ne: 'archived' } })
    .select('_id name course')
    .lean()
    .exec();

  const lines = [
    'Weekly engagement digest — Sky States LMS',
    '',
    'Healthy / Passive / Unengaged by batch:',
    ''
  ];

  let totalPassive = 0;
  let totalUnengaged = 0;
  let counted = 0;

  for (const batch of batches) {
    const summary = await attendanceAnalytics.getBatchAttendanceSummary(String(batch._id));
    if (!summary.students?.length) continue;
    counted += 1;
    const c = summary.engagementCounts || { Healthy: 0, Passive: 0, Unengaged: 0 };
    totalPassive += c.Passive || 0;
    totalUnengaged += c.Unengaged || 0;
    lines.push(
      `• ${summary.batch?.name || batch.name}: Healthy ${c.Healthy}, Passive ${c.Passive}, Unengaged ${c.Unengaged} (avg join ${summary.batchJoinRateAvg}%)`
    );
  }

  lines.push('');
  lines.push(`Totals — Passive: ${totalPassive}, Unengaged: ${totalUnengaged}`);
  lines.push('');
  lines.push('Trainers can nudge Passive/Unengaged students from Attendance Hub.');
  lines.push('— Sky States LMS');

  const text = lines.join('\n');
  const subject = `[Engagement] Weekly digest — ${totalUnengaged} unengaged, ${totalPassive} passive`;

  for (const to of adminEmails) {
    try {
      await sendTransactionalEmail({ to, subject, text });
    } catch (err) {
      console.error(`[Engagement Digest] Email to ${to} failed:`, err.message || err);
    }
  }

  await ActivityLog.create({
    action: 'ENGAGEMENT_DIGEST',
    userId: 'system',
    userName: 'Engagement Digest',
    userRole: 'admin',
    timestamp: new Date(),
    videoTitle: subject,
    assessmentTitle: `${counted} batches`,
    score: totalUnengaged
  });

  console.log('[Engagement Digest] sent', { batches: counted, totalPassive, totalUnengaged });
  return { batches: counted, totalPassive, totalUnengaged };
}

function startAttendanceAlertJob() {
  // Every day at 09:00 Asia/Kolkata (03:30 UTC)
  cron.schedule(
    '30 3 * * *',
    async () => {
      try {
        const result = await runAttendanceStreakAlerts();
        console.log('[Attendance Alerts] run complete', result);
      } catch (err) {
        console.error('[Attendance Alerts] job failed:', err.message || err);
      }
    },
    { timezone: 'UTC' }
  );

  // Weekly Monday 09:15 IST (03:45 UTC)
  cron.schedule(
    '45 3 * * 1',
    async () => {
      try {
        const result = await runEngagementDigest();
        console.log('[Engagement Digest] run complete', result);
      } catch (err) {
        console.error('[Engagement Digest] job failed:', err.message || err);
      }
    },
    { timezone: 'UTC' }
  );

  console.log('[Attendance Alerts] cron scheduled (daily streak + weekly engagement digest)');
}

module.exports = {
  startAttendanceAlertJob,
  runAttendanceStreakAlerts,
  runEngagementDigest,
  getAdminEmails
};
