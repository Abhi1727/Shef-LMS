const CACHE_PREFIX = 'lms-live-join:';
const TTL_MS = 2 * 60 * 1000;

function cacheKey(meetingId) {
  return `${CACHE_PREFIX}${meetingId}`;
}

/** Store a fresh join API response for the classroom page (avoids duplicate join calls). */
export function stashLiveJoinPayload(meetingId, payload) {
  if (!meetingId || !payload) return;
  try {
    sessionStorage.setItem(
      cacheKey(meetingId),
      JSON.stringify({ savedAt: Date.now(), payload })
    );
  } catch (_) {
    /* ignore quota / private mode */
  }
}

/** Read cached join payload if still fresh; removes it from storage. */
export function consumeLiveJoinPayload(meetingId) {
  if (!meetingId) return null;
  try {
    const raw = sessionStorage.getItem(cacheKey(meetingId));
    if (!raw) return null;
    sessionStorage.removeItem(cacheKey(meetingId));
    const parsed = JSON.parse(raw);
    if (!parsed?.payload || Date.now() - (parsed.savedAt || 0) > TTL_MS) return null;
    return parsed.payload;
  } catch (_) {
    return null;
  }
}

export default { stashLiveJoinPayload, consumeLiveJoinPayload };
