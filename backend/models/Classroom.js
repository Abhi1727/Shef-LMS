const mongoose = require('mongoose');

const classroomSchema = new mongoose.Schema({
  title: { type: String, required: true },
  instructor: { type: String },
  description: { type: String },
  courseId: { type: String },
  course: { type: String },
  batchId: { type: String },
  batchName: { type: String },
  domain: { type: String },
  duration: { type: String },
  courseType: { type: String },
  type: { type: String, default: 'Lecture' },
  date: { type: String },
  videoSource: { type: String },
  // Zoom
  zoomUrl: { type: String },
  zoomPasscode: { type: String },
  // Drive
  driveId: { type: String },
  // YouTube
  youtubeVideoId: { type: String },
  youtubeVideoUrl: { type: String },
  youtubeEmbedUrl: { type: String },
  // Firebase storage (if needed later)
  storagePath: { type: String },
  // Notes / resources attached to this lecture
  notesAvailable: { type: Boolean, default: false },
  notesFileName: { type: String },
  notesFilePath: { type: String },
  // Lesson learning path
  order: { type: Number, default: 0, index: true },
  linkedAssessmentId: { type: String, default: '' },
  unlockRule: { type: String, enum: ['open', 'afterPrevious'], default: 'open' },
  uploadedBy: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

classroomSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

const __mongoClassroom = mongoose.models.Classroom || mongoose.model('Classroom', classroomSchema);
module.exports = String(process.env.USE_FIRESTORE || '').toLowerCase() === 'true'
  ? require('../firestore/models').Classroom
  : __mongoClassroom;
