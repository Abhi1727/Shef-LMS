const mongoose = require('mongoose');

const oneToOneBatchSchema = new mongoose.Schema({
    name: { type: String, required: true },
    course: { type: String, required: true }, // "Data Science & AI" or "Cyber Security & Ethical Hacking"
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    studentName: { type: String, default: 'To be assigned' },
    studentEmail: { type: String, default: 'To be assigned' },
    teacherId: { type: String, required: true },
    teacherName: { type: String },
    startDate: { type: Date },
    endDate: { type: Date },
    status: { type: String, default: 'active', enum: ['active', 'inactive', 'completed'] },
    videos: [{
        title: { type: String, required: true },
        url: { type: String, required: true },
        description: { type: String },
        duration: { type: String },
        thumbnail: { type: String },
        order: { type: Number, default: 0 },
        classDate: { type: String }, // dd-mm-yyyy format
        classTime: { type: String }, // e.g., 7:00 PM
        addedAt: { type: Date, default: Date.now }
    }],
    schedule: { type: mongoose.Schema.Types.Mixed },
    notes: { type: String },
    progress: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Indexes for performance optimization
oneToOneBatchSchema.index({ studentId: 1, course: 1 });
oneToOneBatchSchema.index({ teacherId: 1 });
oneToOneBatchSchema.index({ status: 1 });

module.exports = mongoose.model('OneToOneBatch', oneToOneBatchSchema);
