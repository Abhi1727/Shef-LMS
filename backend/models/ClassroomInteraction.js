const mongoose = require('mongoose');

const studentQuestionSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  classroomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom', required: true, index: true },
  status: { type: String, enum: ['open', 'resolved'], default: 'open' },
  messages: [{
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    senderName: { type: String },
    role: { type: String, enum: ['student', 'teacher', 'admin'], required: true },
    text: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const studentNoteSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  classroomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom', required: true, index: true },
  noteText: { type: String, required: true },
  videoTimestamp: { type: Number, default: 0 }, // in seconds
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const studentBookmarkSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  classroomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom', required: true, index: true },
  topicName: { type: String },
  notes: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = {
  StudentQuestion: mongoose.model('StudentQuestion', studentQuestionSchema),
  StudentNote: mongoose.model('StudentNote', studentNoteSchema),
  StudentBookmark: mongoose.model('StudentBookmark', studentBookmarkSchema)
};
