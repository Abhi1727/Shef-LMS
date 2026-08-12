const mongoose = require('mongoose');

/**
 * Student → teacher file shares for a batch (enabled per batch by trainer).
 */
const studentShareSchema = new mongoose.Schema(
  {
    batchId: { type: String, required: true, index: true },
    studentId: { type: String, required: true, index: true },
    studentName: { type: String, default: '' },
    title: { type: String, required: true },
    note: { type: String, default: '' },
    kind: {
      type: String,
      enum: ['assignment', 'project', 'writing', 'video', 'other'],
      default: 'assignment'
    },
    mimeType: { type: String, default: '' },
    driveFileId: { type: String, default: '' },
    driveLink: { type: String, default: '' },
    status: {
      type: String,
      enum: ['submitted', 'reviewed', 'returned'],
      default: 'submitted',
      index: true
    },
    teacherFeedback: { type: String, default: '' },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  },
  { collection: 'student_shares' }
);

studentShareSchema.index({ batchId: 1, createdAt: -1 });
studentShareSchema.index({ studentId: 1, createdAt: -1 });

const __mongoStudentShare =
  mongoose.models.StudentShare || mongoose.model('StudentShare', studentShareSchema);
module.exports =
  String(process.env.USE_FIRESTORE || '').toLowerCase() === 'true'
    ? require('../firestore/models').StudentShare
    : __mongoStudentShare;
