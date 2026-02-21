const mongoose = require('mongoose');

/**
 * Centralized activity log for all user actions.
 * Supports: login, video_view, assessment_submit, etc.
 */
const ActivityLogSchema = new mongoose.Schema({
  action: {
    type: String,
    required: true,
    default: 'login'
    // Common: login, video_view, assessment_submit, page_view, logout
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  userName: { type: String, default: '' },
  userEmail: { type: String, default: '' },
  userRole: { type: String, default: 'student' },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  // Flexible metadata per action type
  ipAddress: { type: String },
  city: { type: String },
  country: { type: String },
  isp: { type: String },
  // For video_view
  videoId: { type: String },
  videoTitle: { type: String },
  // For assessment_submit
  assessmentId: { type: String },
  assessmentTitle: { type: String },
  score: { type: Number },
  // For page_view
  path: { type: String },
  userAgent: { type: String }
}, { timestamps: true });

// Compound index for efficient admin queries
ActivityLogSchema.index({ timestamp: -1 });
ActivityLogSchema.index({ userId: 1, timestamp: -1 });
ActivityLogSchema.index({ action: 1, timestamp: -1 });

module.exports = mongoose.model('ActivityLog', ActivityLogSchema);
