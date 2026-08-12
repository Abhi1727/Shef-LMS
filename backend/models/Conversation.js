const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    senderId: { type: String, required: true },
    senderRole: { type: String, enum: ['student', 'teacher', 'admin', 'mentor', 'instructor'], required: true },
    text: { type: String, required: true, maxlength: 2000 },
    createdAt: { type: Date, default: Date.now },
    readAt: { type: Date, default: null }
  },
  { _id: true }
);

const conversationSchema = new mongoose.Schema({
  studentId: { type: String, required: true, index: true },
  teacherId: { type: String, required: true, index: true },
  batchId: { type: String, default: '' },
  messages: { type: [messageSchema], default: [] },
  lastMessageAt: { type: Date, default: Date.now },
  studentUnread: { type: Number, default: 0 },
  teacherUnread: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

conversationSchema.index({ studentId: 1, teacherId: 1 }, { unique: true });

const __mongoConversation = mongoose.models.Conversation || mongoose.model('Conversation', conversationSchema);
module.exports = String(process.env.USE_FIRESTORE || '').toLowerCase() === 'true'
  ? require('../firestore/models').Conversation
  : __mongoConversation;
