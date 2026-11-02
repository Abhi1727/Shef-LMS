const LiveClass = require('../models/LiveClass');
const User = require('../models/User');
const zoomService = require('../services/zoomService');

/** After scheduled end + grace, auto-close forgotten live rows.
 * Keep this generous — real classes often overrun; Zoom reconcile closes sooner when the room is empty. */
const STALE_AFTER_END_MS = 3 * 60 * 60 * 1000;
/** Wait after LMS start before treating “Zoom not live” as ended (covers power/internet drops + reopen). */
const ZOOM_RECONCILE_AFTER_START_MS = 5 * 60 * 1000;

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

  // Combined-batch rows share the kept session's room; closing them would end that class.
  let keptGroupId = '';
  if (exceptMeetingId) {
    const kept = await LiveClass.findById(String(exceptMeetingId)).select('jointLeadId').lean().exec();
    keptGroupId = kept ? String(kept.jointLeadId || exceptMeetingId) : '';
  }

  for (const doc of docs) {
    if (keptGroupId && (String(doc._id) === keptGroupId || String(doc.jointLeadId || '') === keptGroupId)) {
      continue;
    }
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

function scheduledEndMs(doc) {
  if (doc.scheduledEnd) return new Date(doc.scheduledEnd).getTime();
  if (doc.scheduledStart) return new Date(doc.scheduledStart).getTime() + 60 * 60 * 1000;
  return 0;
}

/**
 * Best guess at when a forgotten live class really ended: its last activity (joins bump updatedAt)
 * or its scheduled end, whichever is later — never the moment the sweep happened to notice it.
 */
function inferEndedAt(doc, now = Date.now()) {
  const candidates = [doc.updatedAt, doc.actualStartedAt]
    .map((t) => (t ? new Date(t).getTime() : 0))
    .concat(scheduledEndMs(doc));
  return new Date(Math.min(now, Math.max(...candidates)));
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

    if (!doc.actualEndedAt) {
      doc.actualEndedAt = inferEndedAt(doc, now);
    }
    doc.status = 'completed';
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
async function reconcileZoomLiveSessions({ teacherId = null, onlyPastScheduledEnd = false } = {}) {
  if (!zoomService.isConfigured()) return [];

  const query = {
    status: 'live',
    conferenceProvider: 'zoom',
    zoomMeetingId: { $nin: ['', null] }
  };
  if (teacherId) query.teacherId = String(teacherId);

  let docs = await LiveClass.find(query).exec();
  // The background sweep leaves in-slot classes alone so a trainer's brief Zoom drop never ends them.
  if (onlyPastScheduledEnd) {
    const nowMs = Date.now();
    docs = docs.filter((doc) => {
      const endMs = scheduledEndMs(doc);
      return endMs && nowMs > endMs;
    });
  }
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
      const startMs = doc.actualStartedAt
        ? new Date(doc.actualStartedAt).getTime()
        : doc.scheduledStart
          ? new Date(doc.scheduledStart).getTime()
          : 0;
      if (!startMs || now < startMs + ZOOM_RECONCILE_AFTER_START_MS) continue;

      const meetingId = String(doc.zoomMeetingId || '').replace(/\s/g, '');
      if (!meetingId) continue;
      if (liveIds.has(meetingId)) continue;

      if (onlyPastScheduledEnd && !doc.actualEndedAt) {
        doc.actualEndedAt = inferEndedAt(doc, now);
      }
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
  inferEndedAt,
  STALE_AFTER_END_MS,
  ZOOM_RECONCILE_AFTER_START_MS
};
