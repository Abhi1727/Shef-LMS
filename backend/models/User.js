const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  // Original Firestore document ID (used during migration period)
  firestoreId: {
    type: String,
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['student', 'instructor', 'teacher', 'mentor', 'admin'],
    default: 'student'
  },
  status: {
    type: String,
    default: 'active'
  },
  course: {
    type: String,
  },
  enrollmentNumber: {
    type: String,
    trim: true,
  },
  // Persistent report Form No. — SS_US_11001+ (one per student, like enrollment)
  formNumber: {
    type: String,
    trim: true,
  },
  // Official join date used for SKY_{MM}_{YYYY}_{series} (falls back to createdAt)
  joiningDate: {
    type: Date,
  },
  phone: {
    type: String,
    trim: true,
  },
  address: {
    type: String,
    trim: true,
  },
  batchId: {
    type: String,
  },
  // One-to-one batch (1:1 personalized; separate from regular batchId)
  oneToOneBatchId: {
    type: String,
  },
  domain: {
    type: String,
  },
  enrolledCourse: {
    type: String,
    enum: ['data-science-ai', 'cyber-security', 'both'],
    default: 'data-science-ai'
  },
  assignedCourses: [{
    type: String
  }],
  // Trainer presence for student chat / admin visibility
  isAvailable: {
    type: Boolean,
    default: false
  },
  availabilityUpdatedAt: {
    type: Date,
    default: null
  },
  // Weekly teaching windows (0=Sun … 6=Sat)
  weeklyAvailability: {
    type: [
      {
        day: { type: Number, min: 0, max: 6, required: true },
        startTime: { type: String, default: '10:00' },
        endTime: { type: String, default: '18:00' },
        timezone: { type: String, default: 'Asia/Kolkata' }
      }
    ],
    default: []
  },
  title: {
    type: String,
  },
  company: {
    type: String,
  },
  enrolledCourses: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course'
  }],
  // IP Address tracking fields
  lastLoginIP: {
    type: String,
    default: null
  },
  lastLoginTimestamp: {
    type: Date,
    default: null
  },
  lastLogin: {
    timestamp: String,
    ipAddress: String,
    city: String,
    country: String,
    isp: String
  },
  loginHistory: [{
    timestamp: Date,
    ipAddress: String,
    city: String,
    country: String,
    isp: String
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Unique when present — allows empty during migration
UserSchema.index(
  { enrollmentNumber: 1 },
  {
    unique: true,
    sparse: true,
    partialFilterExpression: {
      enrollmentNumber: { $type: 'string', $gt: '' },
    },
  }
);

UserSchema.index(
  { formNumber: 1 },
  {
    unique: true,
    sparse: true,
    partialFilterExpression: {
      formNumber: { $type: 'string', $gt: '' },
    },
  }
);

const __mongoUser = mongoose.models.User || mongoose.model('User', UserSchema);
module.exports = String(process.env.USE_FIRESTORE || '').toLowerCase() === 'true'
  ? require('../firestore/models').User
  : __mongoUser;
