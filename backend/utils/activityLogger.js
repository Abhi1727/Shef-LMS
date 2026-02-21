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

async function logActivity(data) {
  try {
    const entry = {
      action: data.action || 'login',
      userId: data.userId || '',
      userName: data.userName || '',
      userEmail: data.userEmail || '',
      userRole: data.userRole || 'student',
      timestamp: data.timestamp || new Date(),
      ipAddress: data.ipAddress,
      city: data.city,
      country: data.country,
      isp: data.isp,
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
