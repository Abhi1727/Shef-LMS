const mongoose = require('mongoose');

const certificateSchema = new mongoose.Schema({
  studentId: { type: String, required: true, index: true },
  studentName: { type: String, default: '' },
  studentEmail: { type: String, default: '' },
  batchId: { type: String, required: true, index: true },
  batchName: { type: String, default: '' },
  course: { type: String, default: '' },
  code: { type: String, required: true, unique: true, index: true },
  issuedAt: { type: Date, default: Date.now },
  issuedBy: { type: String, default: '' },
  issuedByName: { type: String, default: '' },
  source: { type: String, enum: ['manual', 'auto'], default: 'manual' },
  criteriaSnapshot: {
    joinRate: { type: Number, default: null },
    joinThreshold: { type: Number, default: null },
    assessmentsRequired: { type: Number, default: 0 },
    assessmentsPassed: { type: Number, default: 0 },
    sessionsTotal: { type: Number, default: 0 }
  }
});

certificateSchema.index({ studentId: 1, batchId: 1 }, { unique: true });

const __mongoCertificate = mongoose.models.Certificate || mongoose.model('Certificate', certificateSchema);
module.exports = String(process.env.USE_FIRESTORE || '').toLowerCase() === 'true'
  ? require('../firestore/models').Certificate
  : __mongoCertificate;
