const cron = require('node-cron');
const LiveClass = require('../models/LiveClass');
const Batch = require('../models/Batch');
const User = require('../models/User');
const { sendEmail } = require('../services/emailService');

const FRONTEND_URL = () =>
  process.env.FRONTEND_URL || process.env.DEV_FRONTEND_URL || 'https://dev.learnwithus.sbs';

function formatIst(date, timezone = 'Asia/Kolkata') {
  if (!date) return '';
  const d = new Date(date);
  const day = d.toLocaleDateString('en-CA', { timeZone: timezone });
  const time = d.toLocaleTimeString('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  return `${day} ${time} IST`;
}

async function getBatchStudentEmails(batchId) {
  const batch = await Batch.findById(batchId).select('students name').lean().exec();
  if (!batch) return { emails: [], batchName: '' };
  const ids = (batch.students || []).map((s) => String(s));
  if (!ids.length) {
    // Also pick students who have batchId set
    const byField = await User.find({
      role: 'student',
      $or: [{ batchId: String(batchId) }, { oneToOneBatchId: String(batchId) }]
    })
      .select('email')
      .lean()
      .exec();
    return {
      emails: byField.map((u) => u.email).filter(Boolean),
      batchName: batch.name || ''
    };
  }
  const users = await User.find({ _id: { $in: ids }, role: 'student' })
    .select('email')
    .lean()
    .exec();
  return {
    emails: users.map((u) => u.email).filter(Boolean),
    batchName: batch.name || ''
  };
}

/**
 * Send T-15 reminders for upcoming Meet classes.
 */
async function sendMeetReminders() {
  const now = Date.now();
  const windowStart = new Date(now + 15 * 60 * 1000);
  const windowEnd = new Date(now + 20 * 60 * 1000);

  const classes = await LiveClass.find({
    status: { $in: ['scheduled', 'live'] },
    meetLink: { $ne: '' },
    reminderSentAt: null,
    scheduledStart: { $gte: windowStart, $lte: windowEnd }
  })
    .lean()
    .exec();

  if (!classes.length) {
    return { sent: 0, skipped: 0 };
  }

  let sent = 0;
  let skipped = 0;

  for (const cls of classes) {
    try {
      const { emails, batchName } = await getBatchStudentEmails(cls.batchId);
      if (!emails.length) {
        await LiveClass.updateOne(
          { _id: cls._id },
          { $set: { reminderSentAt: new Date(), updatedAt: new Date() } }
        );
        skipped += 1;
        continue;
      }

      const when = formatIst(cls.scheduledStart, cls.timezone || 'Asia/Kolkata');
      const subject = `Reminder: ${cls.title} starts soon`;
      const message = [
        `Hi,`,
        ``,
        `Your live class "${cls.title}" starts soon.`,
        ``,
        `Batch: ${batchName || cls.batchId}`,
        `When: ${when}`,
        `Trainer: ${cls.teacherName || cls.instructor || 'Your trainer'}`,
        ``,
        `Join from your LMS dashboard (Classroom / Live class):`,
        FRONTEND_URL(),
        ``,
        `See you in class,`,
        `Sky States LMS`
      ].join('\n');

      await sendEmail({
        subject,
        message,
        studentEmails: emails,
        batchId: cls.batchId
      });

      await LiveClass.updateOne(
        { _id: cls._id },
        { $set: { reminderSentAt: new Date(), updatedAt: new Date() } }
      );
      sent += 1;
      console.log(`[Meet Reminders] Sent for "${cls.title}" to ${emails.length} students`);
    } catch (err) {
      console.error(`[Meet Reminders] Failed for ${cls._id}:`, err.message || err);
    }
  }

  return { sent, skipped };
}

function startMeetReminderJob() {
  // Every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      const result = await sendMeetReminders();
      if (result.sent || result.skipped) {
        console.log(`[Meet Reminders] tick sent=${result.sent} skipped=${result.skipped}`);
      }
    } catch (err) {
      console.error('[Meet Reminders] cron error:', err.message || err);
    }
  });
  console.log('[Meet Reminders] cron scheduled (every 5 minutes)');
}

module.exports = {
  sendMeetReminders,
  startMeetReminderJob,
  getBatchStudentEmails,
  formatIst
};
