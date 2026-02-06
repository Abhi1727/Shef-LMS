const mongoose = require('mongoose');

const moduleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  description: {
    type: String,
    trim: true
  },
  duration: {
    type: String,
    trim: true
  },
  lessons: {
    type: Number,
    default: 0
  },
  order: {
    type: Number,
    default: 1
  },
  // New fields for file support
  contentType: {
    type: String,
    enum: ['pdf', 'word', 'link', 'text'],
    default: 'text'
  },
  content: {
    type: String,
    default: ''
  },
  // For file uploads
  fileUrl: {
    type: String,
    default: ''
  },
  fileName: {
    type: String,
    default: ''
  },
  fileSize: {
    type: Number,
    default: 0
  },
  // For external links
  externalLink: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'draft'],
    default: 'active'
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

moduleSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

moduleSchema.virtual('id').get(function() {
  return this._id.toHexString();
});

moduleSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Module', moduleSchema);
