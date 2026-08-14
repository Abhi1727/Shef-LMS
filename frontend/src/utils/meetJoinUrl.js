/**
 * Build a Meet join URL with preferred defaults (mic/cam off when supported).
 * Google Meet opens a pre-join screen; these hints nudge muted entry where clients honor them.
 */
export function meetJoinUrl(rawLink, { host = false } = {}) {
  if (!rawLink) return '';
  try {
    const url = new URL(String(rawLink).trim());
    // Pre-join muted hints used by some Meet / Chromium clients
    if (!url.searchParams.has('audioMuted')) url.searchParams.set('audioMuted', 'true');
    if (!url.searchParams.has('videoMuted')) url.searchParams.set('videoMuted', 'true');
    if (host && !url.searchParams.has('hs')) url.searchParams.set('hs', '122');
    return url.toString();
  } catch {
    return String(rawLink);
  }
}
