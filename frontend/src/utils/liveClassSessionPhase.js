const STUDENT_JOIN_LEAD_MINUTES = 15;
const STUDENT_JOIN_GRACE_MINUTES = 30;
const DEFAULT_SESSION_MINUTES = 60;

function meetingStartMs(meeting) {
  if (meeting?.scheduledStart) return new Date(meeting.scheduledStart).getTime();
  const date = String(meeting?.scheduledDate || '').trim();
  const time = String(meeting?.scheduledTime || '00:00').trim();
  if (!date) return NaN;
  return new Date(`${date}T${time}`).getTime();
}

function meetingEndMs(meeting, startMs) {
  if (meeting?.scheduledEnd) return new Date(meeting.scheduledEnd).getTime();
  if (Number.isNaN(startMs)) return NaN;
  return startMs + DEFAULT_SESSION_MINUTES * 60 * 1000;
}

function hasJoinLink(meeting) {
  return Boolean(meeting?.hasJoinLink || meeting?.hasMeetLink || meeting?.meetLink || meeting?.zoomLink);
}

/**
 * @param {object} meeting
 * @param {number} [now]
 * @param {{ forTrainer?: boolean }} [options]
 */
export function getLiveClassSessionPhase(meeting, now = Date.now(), options = {}) {
  const forTrainer = Boolean(options.forTrainer);

  if (meeting?.status === 'completed' || meeting?.status === 'cancelled') {
    return { phase: 'ended', minsUntil: null, canJoin: false, canStart: false };
  }

  if (meeting?.status === 'live') {
    return { phase: 'live', minsUntil: 0, canJoin: true, canStart: true };
  }

  const start = meetingStartMs(meeting);
  const end = meetingEndMs(meeting, start);
  if (Number.isNaN(start)) {
    return { phase: 'unknown', minsUntil: null, canJoin: false, canStart: false };
  }

  const minsUntil = Math.round((start - now) / 60000);
  const linked = hasJoinLink(meeting);
  const canStart =
    forTrainer &&
    meeting?.status === 'scheduled' &&
    meeting?.status !== 'completed' &&
    meeting?.status !== 'cancelled';

  if (meeting?.needsRecording) {
    return { phase: 'needsRecording', minsUntil, canJoin: false, canStart: false };
  }

  if (
    end < now &&
    meeting?.status !== 'completed' &&
    meeting?.status !== 'cancelled' &&
    !meeting?.skipRecordingUpload &&
    meeting?.batchId
  ) {
    return { phase: 'needsRecording', minsUntil, canJoin: false, canStart: false };
  }

  const studentWindowOpen =
    now >= start - STUDENT_JOIN_LEAD_MINUTES * 60 * 1000 && now <= end + STUDENT_JOIN_GRACE_MINUTES * 60 * 1000;
  const canJoin = meeting?.status === 'live' || studentWindowOpen;

  if (now > end + STUDENT_JOIN_GRACE_MINUTES * 1000) {
    return { phase: 'ended', minsUntil, canJoin: false, canStart: false };
  }

  if (minsUntil <= 0 && now <= end) {
    return { phase: 'live', minsUntil, canJoin, canStart: forTrainer && linked };
  }

  if (minsUntil > 0 && minsUntil <= STUDENT_JOIN_LEAD_MINUTES) {
    return { phase: 'soon', minsUntil, canJoin, canStart };
  }

  if (minsUntil > STUDENT_JOIN_LEAD_MINUTES) {
    return { phase: 'scheduled', minsUntil, canJoin: false, canStart };
  }

  return { phase: 'live', minsUntil, canJoin, canStart: forTrainer && linked };
}

export function formatLiveClassCountdown(minsUntil, phase, { forTrainer = false } = {}) {
  if (phase === 'needsRecording') return 'Session ended — upload recording';
  if (phase === 'ended') return 'Session ended';
  if (minsUntil === null || minsUntil === undefined) return '';
  if (phase === 'live' || minsUntil <= 0) {
    return forTrainer ? 'Ready — start or open class' : 'Class is in session — join now to be marked present';
  }
  if (forTrainer && phase === 'scheduled') {
    if (minsUntil < 60) return `Starts in ${minsUntil} min · you can start anytime`;
    const h = Math.floor(minsUntil / 60);
    const m = minsUntil % 60;
    return `Starts in ${h}h ${m}m · you can start anytime`;
  }
  if (minsUntil < 60) return `Starts in ${minsUntil} min`;
  const h = Math.floor(minsUntil / 60);
  const m = minsUntil % 60;
  return `Starts in ${h}h ${m}m`;
}
