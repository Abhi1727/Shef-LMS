const { parseSlot } = require('./jointBatchSessions');

/** "120 mins", "45 min", "2h", "2h 26m" → minutes. */
function durationMinutes(duration) {
  if (typeof duration === 'number' && Number.isFinite(duration)) return duration > 0 ? duration : null;
  const raw = String(duration || '').trim().toLowerCase();
  const hm = raw.match(/^(\d+)\s*h(?:\s*(\d+)\s*m)?$/);
  if (hm) return Number(hm[1]) * 60 + Number(hm[2] || 0);
  const m = raw.match(/^(\d+)\s*min/);
  return m ? Number(m[1]) : null;
}

/**
 * End time to show students. scheduledEnd is often just the 8-hour join window (no duration was set
 * and the trainer ended the class in Zoom), so prefer the real end, then the planned duration,
 * then the batch's weekly slot length. Null when none is known.
 */
function displayEnd(doc, batchSchedule) {
  if (doc.actualEndedAt) {
    const ended = new Date(doc.actualEndedAt);
    if (!Number.isNaN(ended.getTime())) return ended;
  }
  const start = doc.scheduledStart ? new Date(doc.scheduledStart) : null;
  if (!start || Number.isNaN(start.getTime())) return null;
  const planned = durationMinutes(doc.duration);
  if (planned) return new Date(start.getTime() + planned * 60 * 1000);
  const slot = parseSlot(batchSchedule);
  if (slot) return new Date(start.getTime() + (slot.end - slot.start) * 60 * 1000);
  return null;
}

module.exports = { displayEnd };
