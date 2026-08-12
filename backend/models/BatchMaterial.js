const mongoose = require('mongoose');

const KIND_ENUM = [
  'project',
  'handout',
  'notes',
  'writing',
  'video',
  'other'
];

const batchMaterialSchema = new mongoose.Schema(
  {
    batchId: { type: String, required: true, index: true },
    kind: {
      type: String,
      enum: KIND_ENUM,
      default: 'handout'
    },
    name: { type: String, required: true },
    mimeType: { type: String, default: '' },
    driveFileId: { type: String, default: '' },
    driveLink: { type: String, default: '' },
    driveFolderId: { type: String, default: '' },
    liveClassId: { type: String, default: '', index: true },
    classroomLectureId: { type: String, default: '' },
    uploadedBy: { type: String, default: '' },
    uploadedByName: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  },
  { collection: 'batch_materials' }
);

batchMaterialSchema.index({ batchId: 1, createdAt: -1 });

const __mongoBatchMaterial =
  mongoose.models.BatchMaterial || mongoose.model('BatchMaterial', batchMaterialSchema);
module.exports =
  String(process.env.USE_FIRESTORE || '').toLowerCase() === 'true'
    ? require('../firestore/models').BatchMaterial
    : __mongoBatchMaterial;
module.exports.KIND_ENUM = KIND_ENUM;
