const jwt = require('jsonwebtoken');
const zoomConfig = require('../config/zoom');

function meetingSdkKey() {
  return String(
    process.env.ZOOM_MEETING_SDK_KEY ||
      process.env.ZOOM_SDK_KEY ||
      process.env.ZOOM_SDK_CLIENT_ID ||
      ''
  ).trim();
}

function meetingSdkSecret() {
  return String(
    process.env.ZOOM_MEETING_SDK_SECRET ||
      process.env.ZOOM_SDK_SECRET ||
      process.env.ZOOM_SDK_CLIENT_SECRET ||
      ''
  ).trim();
}

function isEmbeddedEnabled() {
  const flag = String(process.env.ZOOM_EMBEDDED_ENABLED || 'true').trim().toLowerCase();
  if (flag === '0' || flag === 'false' || flag === 'no') return false;
  return Boolean(meetingSdkKey() && meetingSdkSecret());
}

function isConfigured() {
  return Boolean(meetingSdkKey() && meetingSdkSecret());
}

/**
 * Meeting SDK JWT (Web). role: 0 = participant, 1 = host.
 */
function generateSignature({ meetingNumber, role = 0 }) {
  const sdkKey = meetingSdkKey();
  const sdkSecret = meetingSdkSecret();
  if (!sdkKey || !sdkSecret) {
    const err = new Error('Zoom Meeting SDK is not configured');
    err.code = 'ZOOM_SDK_NOT_CONFIGURED';
    throw err;
  }
  const mn = String(meetingNumber || '').replace(/\s/g, '');
  if (!mn) {
    const err = new Error('Zoom meeting number is required for SDK join');
    err.code = 'ZOOM_MEETING_REQUIRED';
    throw err;
  }

  const iat = Math.floor(Date.now() / 1000) - 30;
  const exp = iat + 60 * 60 * 2;
  const payload = {
    appKey: sdkKey,
    sdkKey,
    mn,
    role: Number(role) === 1 ? 1 : 0,
    iat,
    exp,
    tokenExp: exp
  };

  return jwt.sign(payload, sdkSecret, { algorithm: 'HS256' });
}

function getStatus() {
  const configured = isConfigured();
  const enabled = isEmbeddedEnabled();
  let hint = 'Add ZOOM_MEETING_SDK_KEY and ZOOM_MEETING_SDK_SECRET from Zoom Marketplace → Meeting SDK app.';
  if (configured && enabled) {
    hint = 'In-LMS Zoom classroom is enabled (Meeting SDK).';
  } else if (configured && !enabled) {
    hint = 'Meeting SDK credentials present but ZOOM_EMBEDDED_ENABLED=false.';
  }
  return {
    enabled,
    configured,
    sdkKeyPresent: Boolean(meetingSdkKey()),
    hint
  };
}

module.exports = {
  meetingSdkKey,
  meetingSdkSecret,
  isEmbeddedEnabled,
  isConfigured,
  generateSignature,
  getStatus
};
