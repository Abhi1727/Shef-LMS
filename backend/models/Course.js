const mongoose = require('mongoose');

const CourseSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  instructor: {
    type: String,
    required: true
  },
  duration: {
    type: String,
    required: true
  },
  modules: {
    type: Number,
    default: 0
  },
  progress: {
    type: Number,
    default: 0
  },
  thumbnail: {
    type: String,
    default: ''
  },
  enrolled: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const __mongoCourse = mongoose.models.Course || mongoose.model('Course', CourseSchema);
module.exports = String(process.env.USE_FIRESTORE || '').toLowerCase() === 'true'
  ? require('../firestore/models').Course
  : __mongoCourse;
