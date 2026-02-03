const mongoose = require('mongoose');

const batchSchema = new mongoose.Schema({
    name: { type: String, required: true },
    course: { type: String, required: true }, // Course name as string
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' }, // Optional reference
    startDate: { type: Date },
    endDate: { type: Date },
    teacherId: { type: String, required: true },
    teacherName: { type: String },
    status: { type: String, default: 'active', enum: ['active', 'inactive', 'completed'] },
    students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Batch', batchSchema);