const mongoose = require('mongoose');

const resourceCategorySchema = new mongoose.Schema({
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    description: { type: String },
    course: { 
        type: String, 
        enum: ['data-science-ai', 'cyber-security', 'both'], 
        required: true 
    },
    icon: { type: String, default: 'book' }, // Icon identifier string
    driveFolderUrl: { type: String }, // Link to Google Drive folder for this category/module
    displayOrder: { type: Number, default: 0 },
    visibility: { type: String, enum: ['published', 'hidden'], default: 'published' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ResourceCategory', resourceCategorySchema);
