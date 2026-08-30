const AppSetting = require('../models/AppSetting');
const { getAuthMode } = require('./googleAuth');
const youtubeService = require('./youtubeService');
const zoomConfig = require('../config/zoom');

const SETTINGS_ID = 'live-class';
const CACHE_MS = 15 * 1000;

let cache = { at: 0, value: null };

function envFlag(name, defaultTrue = false) {
  const raw = String(process.env[name] ?? '').trim().toLowerCase();
  if (!raw) return defaultTrue;
  return raw === '1' || raw === 'true' || raw === 'yes';
}

function envMeetEnabled() {
  return envFlag('GOOGLE_MEET_ENABLED', false);
}

function envZoomRecordingSyncEnabled() {
  // Default on whenever Zoom live is enabled
  if (String(process.env.ZOOM_RECORDING_SYNC_ENABLED || '').trim() === '') {
    return zoomConfig.isEnabled();
  }
  return envFlag('ZOOM_RECORDING_SYNC_ENABLED', true);
}

function invalidateLiveClassSettingsCache() {
  cache = { at: 0, value: null };
}

async function loadSettingsDoc() {
  try {
    const doc = await AppSetting.findById(SETTINGS_ID).lean().exec();
    return doc || null;
  } catch (err) {
    console.warn('[liveClassSettings] load failed:', err.message || err);
    return null;
  }
}

/**
 * Resolved live-class platform settings.
 * Admin override (Firestore/Mongo) wins over env when set as boolean.
 */
async function getLiveClassSettings() {
  if (cache.value && Date.now() - cache.at < CACHE_MS) {
    return cache.value;
  }

  const doc = await loadSettingsDoc();
  const envMeet = envMeetEnabled();
  const hasOverride = doc && typeof doc.googleMeetEnabled === 'boolean';
  const googleMeetEnabled = hasOverride ? Boolean(doc.googleMeetEnabled) : envMeet;

  const value = {
    googleMeetEnabled,
    envGoogleMeetEnabled: envMeet,
    adminOverride: hasOverride,
    zoomEnabled: zoomConfig.isEnabled(),
    zoomConfigured: zoomConfig.isConfigured(),
    zoomRecordingSyncEnabled: envZoomRecordingSyncEnabled() && zoomConfig.isConfigured(),
    driveConfigured: getAuthMode() !== 'none',
    youtubeConfigured: youtubeService.isConfigured(),
    youtubePrivacy: String(process.env.YOUTUBE_PRIVACY_STATUS || 'unlisted').toLowerCase(),
    defaultConferenceProvider: googleMeetEnabled ? 'meet' : 'zoom',
    updatedAt: doc?.updatedAt || null,
    updatedBy: doc?.updatedBy || ''
  };

  cache = { at: Date.now(), value };
  return value;
}

async function isMeetLiveEnabled() {
  const s = await getLiveClassSettings();
  return Boolean(s.googleMeetEnabled);
}

async function isZoomRecordingPipelineEnabled() {
  const s = await getLiveClassSettings();
  return Boolean(s.zoomRecordingSyncEnabled);
}

async function setGoogleMeetEnabled(enabled, user = {}) {
  const next = Boolean(enabled);
  let doc = await AppSetting.findById(SETTINGS_ID).exec();
  const payload = {
    key: SETTINGS_ID,
    googleMeetEnabled: next,
    updatedBy: String(user.email || user.id || ''),
    updatedAt: new Date()
  };

  if (doc) {
    doc.googleMeetEnabled = next;
    doc.updatedBy = payload.updatedBy;
    doc.updatedAt = payload.updatedAt;
    await doc.save();
  } else {
    // Firestore facades accept create with explicit id via _id
    doc = await AppSetting.create({ _id: SETTINGS_ID, ...payload });
  }

  invalidateLiveClassSettingsCache();
  return getLiveClassSettings();
}

module.exports = {
  SETTINGS_ID,
  envMeetEnabled,
  getLiveClassSettings,
  isMeetLiveEnabled,
  isZoomRecordingPipelineEnabled,
  setGoogleMeetEnabled,
  invalidateLiveClassSettingsCache
};
