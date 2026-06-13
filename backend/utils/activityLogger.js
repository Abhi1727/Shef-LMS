/**
 * Helper to log user activity to ActivityLog.
 * Use this from routes that want to record video views, assessment submits, etc.
 *
 * Example:
 *   const { logActivity } = require('../utils/activityLogger');
 *   await logActivity({ action: 'video_view', userId, userName, userEmail, userRole, videoId, videoTitle });
 */
const ActivityLog = require('../models/ActivityLog');
const logger = require('./logger');
const { getClientIP, getGeoFromIP } = require('./geoIP');

async function logActivity(data) {
  try {
    const req = data.req;
    const shouldResolveLocation = req && !data.ipAddress && !data.city && !data.country && !data.isp;
    const ipAddress = data.ipAddress || (req ? getClientIP(req) : undefined);
    const geo = shouldResolveLocation ? await getGeoFromIP(ipAddress) : null;

    const entry = {
      action: data.action || 'login',
      userId: data.userId || '',
      userName: data.userName || '',
      userEmail: data.userEmail || '',
      userRole: data.userRole || 'student',
      timestamp: data.timestamp || new Date(),
      ipAddress,
      city: data.city || geo?.city,
      country: data.country || geo?.country,
      isp: data.isp || geo?.isp,
      videoId: data.videoId,
      videoTitle: data.videoTitle,
      assessmentId: data.assessmentId,
      assessmentTitle: data.assessmentTitle,
      score: data.score,
      path: data.path,
      userAgent: data.userAgent
    };
    await ActivityLog.create(entry);
  } catch (err) {
    logger.warn('ActivityLog insert failed', { action: data?.action, error: err.message });
  }
}

module.exports = { logActivity };
