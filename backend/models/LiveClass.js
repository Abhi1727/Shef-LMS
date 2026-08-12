const mongoose = require('mongoose');

const attendanceEntrySchema = new mongoose.Schema(
  {
    studentId: { type: String, required: true },
    studentName: { type: String, default: '' },
    status: {
      type: String,
      enum: ['present', 'absent', 'late'],
      default: 'present'
    },
    source: {
      type: String,
      enum: ['join', 'teacher'],
      default: 'join'
    },
    updatedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const liveClassSchema = new mongoose.Schema({
  // Legacy Zoom fields (kept for older docs)
  zoomMeetingId: { type: String, index: true },
  zoomLink: { type: String },

  title: { type: String, required: true },
  description: { type: String, default: '' },
  instructor: { type: String, default: '' },
  courseId: { type: String, default: '' },
  course: { type: String, default: '' },
  scheduledDate: { type: String },
  scheduledTime: { type: String },
  duration: { type: String, default: '60 mins' },

  // Google Meet / scheduled class
  batchId: { type: String, index: true, default: '' },
  teacherId: { type: String, index: true, default: '' },
  teacherName: { type: String, default: '' },
  scheduledStart: { type: Date, index: true },
  scheduledEnd: { type: Date },
  timezone: { type: String, default: 'Asia/Kolkata' },
  calendarEventId: { type: String, index: true },
  meetLink: { type: String, default: '' },
  meetSpaceId: { type: String, default: '' },
  status: {
    type: String,
    enum: ['scheduled', 'live', 'completed', 'cancelled'],
    default: 'scheduled',
    index: true
  },
  createdBy: { type: String, default: '' },

  // Reminders + attendance + recording prompt
  reminderSentAt: { type: Date, default: null },
  attendance: { type: [attendanceEntrySchema], default: [] },
  recordingPromptDismissedAt: { type: Date, default: null },
  // Google Drive recording
  driveFileId: { type: String, default: '' },
  driveLink: { type: String, default: '' },
  driveFolderId: { type: String, default: '' },
  recordingUploadedAt: { type: Date, default: null },
  classroomLectureId: { type: String, default: '' },

  // Session handouts / materials (Google Drive)
  materials: {
    type: [
      {
        driveFileId: { type: String, default: '' },
        driveLink: { type: String, default: '' },
        name: { type: String, default: '' },
        mimeType: { type: String, default: '' },
        uploadedBy: { type: String, default: '' },
        uploadedAt: { type: Date, default: Date.now }
      }
    ],
    default: []
  },

  // AI session summary (Gemini text context v1)
  sessionSummary: { type: String, default: '' },
  sessionSummaryStatus: {
    type: String,
    enum: ['', 'pending', 'ready', 'failed'],
    default: ''
  },
  sessionSummaryGeneratedAt: { type: Date, default: null },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

liveClassSchema.index({ batchId: 1, scheduledStart: 1 });
liveClassSchema.index({ teacherId: 1, scheduledStart: 1 });
liveClassSchema.index({ reminderSentAt: 1, scheduledStart: 1, status: 1 });

const __mongoLiveClass = mongoose.models.LiveClass || mongoose.model('LiveClass', liveClassSchema);
module.exports = String(process.env.USE_FIRESTORE || '').toLowerCase() === 'true'
  ? require('../firestore/models').LiveClass
  : __mongoLiveClass;
