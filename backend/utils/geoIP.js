/**
 * Server-side IP geolocation using ip-api.com (free, no API key).
 * Limit: 45 requests/minute for non-commercial use.
 */

const axios = require('axios');
const logger = require('./logger');

const GEO_API = 'http://ip-api.com/json';

/**
 * @param {string} ip - IPv4 or IPv6 address
 * @returns {Promise<{city:string, country:string, isp:string}>}
 */
async function getGeoFromIP(ip) {
  if (!ip || ip === 'Unknown' || ip === '::1' || ip === '127.0.0.1') {
    return { city: 'Local', country: 'Local', isp: 'Local' };
  }

  try {
    const res = await axios.get(`${GEO_API}/${encodeURIComponent(ip)}`, {
      params: { fields: 'status,city,country,isp' },
      timeout: 3000
    });
    if (res.data && res.data.status === 'success') {
      return {
        city: res.data.city || 'Unknown',
        country: res.data.country || 'Unknown',
        isp: res.data.isp || 'Unknown'
      };
    }
  } catch (err) {
    logger.warn('Geo lookup failed', { ip, error: err.message });
  }
  return { city: 'Unknown', country: 'Unknown', isp: 'Unknown' };
}

/**
 * Extract client IP from request.
 * Handles: Nginx proxy (X-Real-IP, X-Forwarded-For), Cloudflare (CF-Connecting-IP),
 * Akamai (True-Client-IP). Prefer proxy headers over connection.remoteAddress.
 * @param {object} req - Express request
 * @returns {string}
 */
function getClientIP(req) {
  const h = req.headers || {};
  const isLocal = (ip) => !ip || ip === '::1' || ip === '127.0.0.1' || ip === '::ffff:127.0.0.1';

  // 1. Cloudflare (when using Cloudflare proxy)
  const cf = h['cf-connecting-ip'];
  if (cf && cf.trim()) return cf.trim();

  // 2. Akamai / other CDNs
  const trueClient = h['true-client-ip'];
  if (trueClient && trueClient.trim()) return trueClient.trim();

  // 3. X-Forwarded-For: "client, proxy1, proxy2" – leftmost is original client
  const forwarded = h['x-forwarded-for'];
  if (forwarded) {
    const first = (typeof forwarded === 'string' ? forwarded : forwarded[0]).split(',')[0].trim();
    if (first && !isLocal(first)) return first;
  }

  // 4. X-Real-IP (Nginx)
  const realIp = h['x-real-ip'];
  if (realIp && realIp.trim() && !isLocal(realIp.trim())) return realIp.trim();

  const conn = req.connection?.remoteAddress || req.socket?.remoteAddress || req.ip;
  if (conn && !isLocal(conn)) return conn;
  // If we only got localhost, proxy headers may be missing - return Unknown so it's visible
  return 'Unknown';
}

module.exports = { getGeoFromIP, getClientIP };
