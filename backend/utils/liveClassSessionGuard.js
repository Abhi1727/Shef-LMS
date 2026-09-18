const LiveClass = require('../models/LiveClass');
const User = require('../models/User');
const zoomService = require('../services/zoomService');

/** After scheduled end + grace, auto-close forgotten live rows. */
const STALE_AFTER_END_MS = 10 * 60 * 1000;
/** Wait this long after class start before trusting Zoom "not live" (trainer may still be opening app). */
const ZOOM_RECONCILE_AFTER_START_MS = 90 * 1000;

function getSessionProvider(doc) {
  if (doc?.conferenceProvider === 'zoom' || doc?.conferenceProvider === 'meet') {
    return doc.conferenceProvider;
  }
  if (doc?.zoomMeetingId && !doc?.meetLink) return 'zoom';
  return 'meet';
}

/**
 * Mark other live sessions for this trainer as completed so only one class is active.
 * Deletes orphaned Zoom meetings (not PMI — same room is reused).
 */
async function closePreviousLiveSessionsForTeacher(
  teacherId,
  { exceptMeetingId = null, deleteZoomMeetings = true } = {}
) {
  if (!teacherId) return [];

  const query = {
    teacherId: String(teacherId),
    status: 'live'
  };
  if (exceptMeetingId) {
    query._id = { $ne: String(exceptMeetingId) };
  }

  const docs = await LiveClass.find(query).exec();
  const closed = [];

  for (const doc of docs) {
    doc.status = 'completed';
    doc.updatedAt = new Date();
    await doc.save();

    const provider = getSessionProvider(doc);
    const isPmr = Boolean(doc.zoomIsPmr);
    if (
      deleteZoomMeetings &&
      provider === 'zoom' &&
      doc.zoomMeetingId &&
      !isPmr &&
      zoomService.isConfigured()
    ) {
      try {
        await zoomService.deleteMeeting(doc.zoomMeetingId);
      } catch (err) {
        console.warn(
          '[liveClassSessionGuard] Zoom delete failed for',
          doc.zoomMeetingId,
          err.message || err
        );
      }
    }

    closed.push({
      id: String(doc._id),
      title: doc.title || 'Live class',
      batchId: doc.batchId || ''
    });
  }

  return closed;
}

/** Close live rows whose scheduled end passed long ago (trainer never hit End). */
async function cleanupStaleLiveSessions({ teacherId = null } = {}) {
  const query = { status: 'live' };
  if (teacherId) query.teacherId = String(teacherId);

  const docs = await LiveClass.find(query).exec();
  const now = Date.now();
  const closed = [];

  for (const doc of docs) {
    const endMs = doc.scheduledEnd
      ? new Date(doc.scheduledEnd).getTime()
      : doc.scheduledStart
        ? new Date(doc.scheduledStart).getTime() + 60 * 60 * 1000
        : 0;
    if (!endMs || now <= endMs + STALE_AFTER_END_MS) continue;

    doc.status = 'completed';
    if (!doc.actualEndedAt) {
      doc.actualEndedAt = new Date();
    }
    doc.updatedAt = new Date();
    await doc.save();
    closed.push({ id: String(doc._id), title: doc.title || 'Live class', reason: 'stale-live' });
  }

  return closed;
}

/** Close scheduled rows whose window passed without the trainer starting class. */
async function cleanupStaleScheduledSessions({ teacherId = null } = {}) {
  const query = { status: 'scheduled' };
  if (teacherId) query.teacherId = String(teacherId);

  const docs = await LiveClass.find(query).exec();
  const now = Date.now();
  const closed = [];

  for (const doc of docs) {
    const endMs = doc.scheduledEnd
      ? new Date(doc.scheduledEnd).getTime()
      : doc.scheduledStart
        ? new Date(doc.scheduledStart).getTime() + 60 * 60 * 1000
        : 0;
    if (!endMs || now <= endMs + STALE_AFTER_END_MS) continue;

    doc.status = 'completed';
    if (!doc.actualEndedAt) {
      doc.actualEndedAt = new Date();
    }
    doc.updatedAt = new Date();
    await doc.save();
    closed.push({
      id: String(doc._id),
      title: doc.title || 'Live class',
      reason: 'stale-scheduled'
    });
  }

  return closed;
}

async function cleanupStaleSessions(options = {}) {
  const live = await cleanupStaleLiveSessions(options);
  const scheduled = await cleanupStaleScheduledSessions(options);
  return [...live, ...scheduled];
}

/**
 * If trainer closed Zoom but did not tap End in LMS, mark live rows completed when Zoom
 * reports no in-progress meeting for that PMI / meeting id.
 */
async function reconcileZoomLiveSessions({ teacherId = null } = {}) {
  if (!zoomService.isConfigured()) return [];

  const query = {
    status: 'live',
    conferenceProvider: 'zoom',
    zoomMeetingId: { $nin: ['', null] }
  };
  if (teacherId) query.teacherId = String(teacherId);

  const docs = await LiveClass.find(query).exec();
  if (!docs.length) return [];

  const byTeacher = new Map();
  docs.forEach((doc) => {
    const tid = String(doc.teacherId || '');
    if (!tid) return;
    if (!byTeacher.has(tid)) byTeacher.set(tid, []);
    byTeacher.get(tid).push(doc);
  });

  const closed = [];
  const now = Date.now();

  for (const [tid, sessions] of byTeacher.entries()) {
    const teacher = await User.findById(tid).select('zoomUserId conferenceProvider').lean().exec();
    const zoomUserId = String(teacher?.zoomUserId || '').trim();
    if (!zoomUserId) continue;

    const liveOnZoom = await zoomService.listLiveMeetings(zoomUserId);
    if (!liveOnZoom.success) continue;

    const liveIds = new Set(
      (liveOnZoom.meetings || []).map((m) => String(m.id || '').replace(/\s/g, '')).filter(Boolean)
    );

    for (const doc of sessions) {
      const startMs = doc.scheduledStart ? new Date(doc.scheduledStart).getTime() : 0;
      if (!startMs || now < startMs + ZOOM_RECONCILE_AFTER_START_MS) continue;

      const meetingId = String(doc.zoomMeetingId || '').replace(/\s/g, '');
      if (!meetingId) continue;
      if (liveIds.has(meetingId)) continue;

      doc.status = 'completed';
      doc.updatedAt = new Date();
      await doc.save();
      closed.push({
        id: String(doc._id),
        title: doc.title || 'Live class',
        reason: 'zoom-not-live'
      });
    }
  }

  return closed;
}

module.exports = {
  closePreviousLiveSessionsForTeacher,
  cleanupStaleLiveSessions,
  cleanupStaleScheduledSessions,
  cleanupStaleSessions,
  reconcileZoomLiveSessions,
  STALE_AFTER_END_MS,
  ZOOM_RECONCILE_AFTER_START_MS
};
