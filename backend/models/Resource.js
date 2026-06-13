const mongoose = require('mongoose');

const resourceSchema = new mongoose.Schema({
    title: { type: String, required: true, index: true },
    slug: { type: String, required: true, unique: true, index: true },
    course: {
        type: String,
        enum: ['data-science-ai', 'cyber-security', 'both'],
        required: true,
        index: true
    },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'ResourceCategory', index: true },
    categorySlug: { type: String },
    resourceType: {
        type: String,
        enum: [
            'notes', 'video', 'notebook', 'pdf', 'cheat-sheet',
            'dataset', 'tool', 'external-link', 'project',
            'wordlist', 'vm-image', 'config-file', 'script', 'lab'
        ],
        required: true,
        index: true
    },
    description: { type: String },
    difficulty: {
        type: String,
        enum: ['beginner', 'intermediate', 'advanced'],
        index: true
    },
    estimatedMinutes: { type: Number, default: 0 },
    tags: [{ type: String, index: true }],
    
    // Type-specific details (embedded)
    content: {
        richText: { type: String }, // For notes
        videoUrl: { type: String }, // For video
        thumbnailUrl: { type: String },
        chapters: [{
            timestampSeconds: Number,
            label: String
        }],
        transcriptUrl: { type: String },
        
        fileUrl: { type: String }, // PDFs, Notebooks, datasets, wordlists, config-files
        fileName: { type: String },
        fileSizeBytes: { type: Number },
        fileFormat: { type: String },
        colabUrl: { type: String }, // Notebook-specific

        // Tool specific (Cyber Security)
        officialUrl: { type: String },
        githubUrl: { type: String },
        platforms: [{ type: String }], // linux, windows, macos, web
        installationGuide: {
            linux: String,
            windows: String,
            macos: String,
            docker: String
        },
        commands: [{
            command: String,
            description: String,
            flags: [{
                flag: String,
                description: String
            }],
            example: String,
            exampleOutput: String,
            useCase: String,
            difficulty: String
        }],
        relatedToolIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Resource' }],
        
        // Dataset specific
        schema: [{
            columnName: String,
            dataType: String,
            description: String
        }],
        rowCount: Number,
        sampleDataUrl: String,
        
        // Wordlist specific
        wordCount: Number,
        sourceAttribution: String,
        
        // VM Image specific
        osName: String,
        osVersion: String,
        sha256Checksum: String,
        downloadUrls: [{
            label: String,
            url: String,
            isPrimary: Boolean
        }],

        // External Link specific
        externalUrl: { type: String },
        sourcePlatform: { type: String }, // YouTube, Github, arXiv, Medium
        adminSummary: { type: String }
    },

    assignedBatches: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Batch', index: true }],
    assignedOneToOneBatches: [{ type: String, index: true }], // Stores OneToOneBatch IDs/Strings

    status: {
        type: String,
        enum: ['draft', 'published', 'archived'],
        default: 'published',
        index: true
    },
    views: { type: Number, default: 0 },
    downloads: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Resource', resourceSchema);
