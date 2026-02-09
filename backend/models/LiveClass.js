const mongoose = require('mongoose');

const liveClassSchema = new mongoose.Schema({
  zoomMeetingId: { type: String, index: true },
  title: { type: String },
  instructor: { type: String },
  courseId: { type: String },
  scheduledDate: { type: String },
});

module.exports = mongoose.model('LiveClass', liveClassSchema);
