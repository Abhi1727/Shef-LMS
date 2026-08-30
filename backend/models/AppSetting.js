const mongoose = require('mongoose');

const appSettingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    googleMeetEnabled: { type: Boolean, default: undefined },
    updatedBy: { type: String, default: '' },
    updatedAt: { type: Date, default: Date.now }
  },
  { collection: 'appsettings' }
);

const __mongo = mongoose.models.AppSetting || mongoose.model('AppSetting', appSettingSchema);
module.exports =
  String(process.env.USE_FIRESTORE || '').toLowerCase() === 'true'
    ? require('../firestore/models').AppSetting
    : __mongo;
