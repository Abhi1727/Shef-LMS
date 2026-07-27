/**
 * Normalize API origin for the LMS frontend.
 * Never include a trailing `/api` — callers append `/api/...` themselves.
 *
 * On deployed LMS hosts, always use same-origin so nginx can proxy /api
 * to the correct backend (prod :5000 vs DEV :5001). This avoids shipping
 * a build that points DEV UI at production APIs.
 */
export function getApiBaseUrl() {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (
      host === 'dev.learnwithus.sbs' ||
      host === 'learnwithus.sbs' ||
      host === 'www.learnwithus.sbs'
    ) {
      return '';
    }
  }

  const env = (process.env.REACT_APP_API_URL || '').trim();
  if (env) {
    return env.replace(/\/$/, '').replace(/\/api$/i, '');
  }

  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  if (host === 'localhost' || host === '127.0.0.1') {
    return process.env.REACT_APP_LOCAL_API_URL || 'http://localhost:5001';
  }

  // Same-origin fallback (nginx proxies /api)
  return '';
}

export default getApiBaseUrl;
