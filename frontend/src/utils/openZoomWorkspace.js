/**
 * Open a Zoom meeting in Zoom Workspace (desktop app) when possible.
 * Browser Meeting SDK cannot do remote screen control; the desktop app can.
 */

export function extractZoomMeetingNumber(urlOrId) {
  if (!urlOrId) return '';
  const raw = String(urlOrId).trim();
  if (/^\d{9,13}$/.test(raw)) return raw;
  const fromPath = raw.match(/\/(?:j|s|wc\/join)\/(\d{9,13})/i);
  if (fromPath) return fromPath[1];
  const fromQuery = raw.match(/[?&](?:confno|meetingNumber)=(\d{9,13})/i);
  return fromQuery ? fromQuery[1] : '';
}

export function extractZoomPassword(url) {
  if (!url) return '';
  const match = String(url).match(/[?&]pwd=([^&]+)/i);
  if (!match) return '';
  try {
    return decodeURIComponent(match[1]);
  } catch (_) {
    return match[1];
  }
}

/**
 * Prefer zoommtg:// deep link so Zoom Workspace opens.
 * Host start URLs (zak / /s/) stay as https — Zoom's handler launches the app as host.
 */
export function toZoomWorkspaceUrl(httpsOrDeepUrl, { userName = '', meetingNumber = '', password = '' } = {}) {
  const url = String(httpsOrDeepUrl || '').trim();
  if (!url && !meetingNumber) return '';
  if (/^zoommtg:/i.test(url) || /^zoomus:/i.test(url)) return url;

  const isHostStart =
    /[?&]zak=/i.test(url) ||
    /\/s\/\d+/i.test(url) ||
    /\/start/i.test(url);
  if (isHostStart && url) return url;

  const confno = meetingNumber || extractZoomMeetingNumber(url);
  if (!confno) return url;

  const pwd = password || extractZoomPassword(url);
  const params = new URLSearchParams({ action: 'join', confno: String(confno) });
  if (pwd) params.set('pwd', pwd);
  if (userName) params.set('uname', String(userName).slice(0, 64));
  return `zoommtg://zoom.us/join?${params.toString()}`;
}

/**
 * Opens Zoom Workspace (or Zoom web join as last resort).
 * @returns {{ opened: boolean, mode: 'deep-link'|'https'|'none', url: string }}
 */
export function openZoomWorkspace(joinOrStartUrl, options = {}) {
  const deepOrHttps = toZoomWorkspaceUrl(joinOrStartUrl, options);
  if (!deepOrHttps) return { opened: false, mode: 'none', url: '' };

  if (/^https?:/i.test(deepOrHttps)) {
    window.open(deepOrHttps, '_blank', 'noopener,noreferrer');
    return { opened: true, mode: 'https', url: deepOrHttps };
  }

  // Custom protocol: trigger without navigating the LMS SPA away
  try {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = deepOrHttps;
    document.body.appendChild(iframe);
    window.setTimeout(() => {
      try {
        document.body.removeChild(iframe);
      } catch (_) {
        /* ignore */
      }
    }, 2000);
  } catch (_) {
    const a = document.createElement('a');
    a.href = deepOrHttps;
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // Fallback: if app isn't installed, also offer https join after a beat
  const httpsFallback =
    options.httpsFallback ||
    (String(joinOrStartUrl || '').startsWith('http') ? joinOrStartUrl : '');
  if (httpsFallback && options.openHttpsFallback !== false) {
    window.setTimeout(() => {
      try {
        window.open(httpsFallback, '_blank', 'noopener,noreferrer');
      } catch (_) {
        /* ignore */
      }
    }, 1200);
  }

  return { opened: true, mode: 'deep-link', url: deepOrHttps };
}

export default openZoomWorkspace;
