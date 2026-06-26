const mongoose = require('mongoose');

const batchSchema = new mongoose.Schema({
    name: { type: String, required: true },
    course: { type: String, required: true }, // Course name as string (e.g. "Data Science & AI", "Cyber Security & Ethical Hacking")
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' }, // Optional reference
    startDate: { type: Date },
    endDate: { type: Date },
    teacherId: { type: String, required: true },
    teacherName: { type: String },
    status: { type: String, default: 'active', enum: ['active', 'inactive', 'completed'] },
    students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    recordings: [{
        _id: { type: mongoose.Schema.Types.ObjectId, required: true },
        topic: { type: String, required: true },
        url: { type: String, required: true },
        password: { type: String, default: '' },
        date: { type: Date, default: Date.now },
        createdAt: { type: Date, default: Date.now }
    }],
    schedule: { type: mongoose.Schema.Types.Mixed }, // e.g. { days: 'Mon,Wed,Fri' or [], time: '10:00 AM - 11:00 AM IST' }
    resourcesEnabled: { type: Boolean, default: false },
    resourceUniverse: { type: String, default: 'data-science-ai', enum: ['data-science-ai', 'cyber-security', 'both'] },
    notesFile: {
        fileName: { type: String },
        filePath: { type: String },
        uploadedBy: { type: String }, // Teacher ID
        uploadedAt: { type: Date, default: Date.now }
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Batch', batchSchema);