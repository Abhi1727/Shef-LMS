const mongoose = require('mongoose');

const oneToOneSchema = new mongoose.Schema({
  className: {
    type: String,
    required: true,
    trim: true
  },
  course: {
    type: String,
    required: true,
    enum: ['Data Science & AI', 'Cyber Security & Ethical Hacking']
  },
  teacherId: {
    type: String,
    required: true
  },
  teacherName: {
    type: String,
    required: true
  },
  status: {
    type: String,
    default: 'active',
    enum: ['active', 'inactive', 'completed']
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Add virtual for teacher population
oneToOneSchema.virtual('teacher', {
  ref: 'Teacher',
  localField: 'teacherName',
  foreignField: 'teacherId'
});

// Add virtual for student population
oneToOneSchema.virtual('student', {
  ref: 'User',
  localField: 'studentName',
  foreignField: 'studentId'
});

module.exports = mongoose.model('OneToOne', oneToOneSchema);
