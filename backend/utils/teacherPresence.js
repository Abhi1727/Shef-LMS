const LiveClass = require('../models/LiveClass');

/** Drop forgotten "live" rows; do not use scheduled end — class can run long. */
const STALE_LIVE_MS = 12 * 60 * 60 * 1000;

function sessionStillLive(doc, now = Date.now()) {
  if (!doc || doc.status !== 'live' || !doc.meetLink) return false;
  const start = doc.scheduledStart ? new Date(doc.scheduledStart).getTime() : 0;
  const updated = doc.updatedAt ? new Date(doc.updatedAt).getTime() : 0;
  const anchor = Math.max(start, updated, 0);
  if (anchor && now > anchor + STALE_LIVE_MS) return false;
  return true;
}

function serializeLive(doc) {
  if (!doc) return null;
  return {
    id: String(doc._id || doc.id),
    title: doc.title || 'Live class',
    batchId: doc.batchId || '',
    scheduledStart: doc.scheduledStart || null,
    scheduledEnd: doc.scheduledEnd || null
  };
}

function attachPresence(teacher, liveDoc) {
  const live = sessionStillLive(liveDoc) ? liveDoc : null;
  const isAvailable = Boolean(teacher?.isAvailable);
  const presence = live ? 'in_class' : isAvailable ? 'available' : 'unavailable';
  const labels = {
    in_class: 'In class',
    available: 'Available',
    unavailable: 'Unavailable'
  };
  return {
    isAvailable,
    inClass: Boolean(live),
    presence,
    presenceLabel: labels[presence],
    liveClass: serializeLive(live),
    availabilityUpdatedAt: teacher?.availabilityUpdatedAt || null
  };
}

async function findLiveClassForTeacher(teacherId) {
  if (!teacherId) return null;
  const docs = await LiveClass.find({
    teacherId: String(teacherId),
    status: 'live'
  })
    .sort({ scheduledStart: -1 })
    .lean()
    .exec();
  return (docs || []).find((d) => sessionStillLive(d)) || null;
}

async function findLiveClassesForTeachers(teacherIds) {
  const ids = [...new Set((teacherIds || []).map(String).filter(Boolean))];
  const map = {};
  if (!ids.length) return map;
  const docs = await LiveClass.find({
    teacherId: { $in: ids },
    status: 'live'
  })
    .lean()
    .exec();
  for (const d of docs || []) {
    if (!sessionStillLive(d)) continue;
    const tid = String(d.teacherId);
    if (!map[tid]) map[tid] = d;
  }
  return map;
}

module.exports = {
  sessionStillLive,
  attachPresence,
  findLiveClassForTeacher,
  findLiveClassesForTeachers
};
