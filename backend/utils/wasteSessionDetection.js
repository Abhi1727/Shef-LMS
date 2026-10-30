/**
 * Detect trainer test / incomplete sessions (accidental starts, 1–3 min recordings, etc.)
 */

/** Real classes are expected to be at least this long. */
const MIN_REAL_CLASS_MINUTES = 5;
const DUPLICATE_BURST_MS = 20 * 60 * 1000;
const STALE_LIVE_GRACE_MS = 15 * 60 * 1000;

const REASON_LABELS = {
  short_session: 'Session lasted under 5 minutes',
  short_recording: 'Recording is under 5 minutes',
  never_started: 'Class was never started from LMS',
  not_properly_ended: 'Class was not ended properly (auto-closed)',
  stale_live: 'Left live without ending class',
  duplicate_burst: 'Another class started within 20 minutes on the same batch',
  test_like_title: 'Looks like a test / practice session'
};

function parseDurationToMinutes(duration) {
  if (duration === null || duration === undefined || duration === '') return null;
  if (typeof duration === 'number' && Number.isFinite(duration)) return duration;
  const raw = String(duration || '').trim().toLowerCase();
  if (!raw) return null;

  // Prefer combined forms first so "2h 2m" is not read as 2 minutes.
  const hm = raw.match(/(\d+)\s*h(?:ours?)?\s*(\d+)\s*m(?:in(?:ute)?s?)?/);
  if (hm) return Number(hm[1]) * 60 + Number(hm[2]);
  const hOnly = raw.match(/(\d+)\s*h(?:ours?)?(?!\s*\d+\s*m)/);
  if (hOnly && !/\d+\s*m/.test(raw)) return Number(hOnly[1]) * 60;
  if (hOnly) {
    const rem = raw.match(/(\d+)\s*m(?:in(?:ute)?s?)?/);
    return Number(hOnly[1]) * 60 + (rem ? Number(rem[1]) : 0);
  }

  const secMatch = raw.match(/(\d+)\s*s(?:ec(?:ond)?s?)?\b/);
  if (secMatch && !/\d+\s*m/.test(raw) && !/\d+\s*h/.test(raw)) {
    return Number(secMatch[1]) / 60;
  }
  const minMatch = raw.match(/(\d+)\s*m(?:in(?:ute)?s?)?\b/);
  if (minMatch) return Number(minMatch[1]);
  const num = raw.match(/(\d+)/);
  return num ? Number(num[1]) : null;
}

function getActualDurationMinutes(doc) {
  const start = doc.actualStartedAt ? new Date(doc.actualStartedAt).getTime() : 0;
  const end = doc.actualEndedAt ? new Date(doc.actualEndedAt).getTime() : 0;
  if (start && end && end > start) {
    return (end - start) / 60000;
  }
  return parseDurationToMinutes(doc.duration);
}

function isTestLikeTitle(title) {
  return /^(test|demo|trial|upii|testing|sample)\b/i.test(String(title || '').trim());
}

function isDismissed(doc) {
  return Boolean(doc.wasteSessionDismissedAt);
}

/**
 * @param {object} doc LiveClass row
 * @param {{ siblings?: object[] }} context Other sessions same teacher+batch on same day
 */
function analyzeWasteSession(doc, { siblings = [] } = {}) {
  if (isDismissed(doc)) {
    return { isWaste: false, reasons: [], labels: [], dismissed: true, score: 0 };
  }

  const reasons = [];
  const now = Date.now();
  const status = String(doc.status || '');

  if (status === 'live') {
    const endMs = doc.scheduledEnd
      ? new Date(doc.scheduledEnd).getTime()
      : doc.scheduledStart
        ? new Date(doc.scheduledStart).getTime() + 60 * 60 * 1000
        : 0;
    if (endMs && now > endMs + STALE_LIVE_GRACE_MS) {
      reasons.push('stale_live');
    }
    // Do NOT flag short_session while still live — every real class is <5 min right after Start,
    // and that was incorrectly setting skipRecordingUpload and blocking student joins.
  }

  if (status === 'completed') {
    const mins = getActualDurationMinutes(doc);
    const labelMins = parseDurationToMinutes(doc.duration);

    if (mins !== null && mins < MIN_REAL_CLASS_MINUTES) {
      reasons.push('short_session');
    }
    if (labelMins !== null && labelMins < MIN_REAL_CLASS_MINUTES) {
      reasons.push('short_recording');
    }

    // Trainer never tapped Start — only suspicious when the session was also very short.
    if (!doc.actualStartedAt && (reasons.includes('short_session') || reasons.includes('short_recording'))) {
      reasons.push('never_started');
    }

    if (
      status === 'completed' &&
      !doc.actualEndedAt &&
      (reasons.includes('short_session') || reasons.includes('never_started'))
    ) {
      reasons.push('not_properly_ended');
    }
  }

  const selfStart = doc.scheduledStart ? new Date(doc.scheduledStart).getTime() : 0;
  const selfId = String(doc._id || doc.id || '');
  if (selfStart && siblings.length && reasons.length) {
    const burst = siblings.some((other) => {
      const oid = String(other._id || other.id || '');
      if (!oid || oid === selfId) return false;
      const otherStart = other.scheduledStart ? new Date(other.scheduledStart).getTime() : 0;
      if (!otherStart) return false;
      return Math.abs(otherStart - selfStart) <= DUPLICATE_BURST_MS;
    });
    if (burst) reasons.push('duplicate_burst');
  }

  if (isTestLikeTitle(doc.title) && reasons.length) {
    reasons.push('test_like_title');
  }

  const unique = [...new Set(reasons)];
  return {
    isWaste: unique.length > 0,
    reasons: unique,
    labels: unique.map((r) => REASON_LABELS[r] || r),
    dismissed: false,
    score: unique.length
  };
}

async function applyWasteSessionFlags(doc, { save = true, siblings = [] } = {}) {
  if (!doc || isDismissed(doc)) return doc;

  const analysis = analyzeWasteSession(doc, { siblings });
  doc.wasteSessionFlagged = analysis.isWaste;
  doc.wasteSessionReasons = analysis.reasons;
  doc.wasteSessionDetectedAt = analysis.isWaste ? new Date() : doc.wasteSessionDetectedAt || null;

  // A class running past its expected end is still a real class; only completed-session signals block uploads.
  const blocksRecording = analysis.reasons.some((r) => r !== 'stale_live');
  if (blocksRecording && doc.batchId && !doc.skipRecordingUpload) {
    doc.skipRecordingUpload = true;
  }

  if (save && typeof doc.save === 'function') {
    doc.updatedAt = new Date();
    await doc.save();
  }
  return doc;
}

function groupSiblingsByTeacherBatch(docs) {
  const groups = new Map();
  for (const doc of docs) {
    if (!doc.batchId || !doc.teacherId) continue;
    const day = doc.scheduledStart
      ? new Date(doc.scheduledStart).toISOString().slice(0, 10)
      : 'unknown';
    const key = `${doc.teacherId}:${doc.batchId}:${day}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(doc);
  }
  return groups;
}

function serializeWasteSession(doc) {
  const analysis = analyzeWasteSession(doc);
  return {
    flagged: Boolean(doc.wasteSessionFlagged) || analysis.isWaste,
    reasons: doc.wasteSessionReasons?.length ? doc.wasteSessionReasons : analysis.reasons,
    labels: analysis.labels,
    dismissed: isDismissed(doc),
    detectedAt: doc.wasteSessionDetectedAt || null
  };
}

module.exports = {
  MIN_REAL_CLASS_MINUTES,
  REASON_LABELS,
  parseDurationToMinutes,
  getActualDurationMinutes,
  analyzeWasteSession,
  applyWasteSessionFlags,
  groupSiblingsByTeacherBatch,
  serializeWasteSession,
  isDismissed
};
