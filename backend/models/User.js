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

module.exports = mongoose.model('User', UserSchema);
