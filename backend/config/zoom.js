// Zoom API Configuration
require('dotenv').config();

function defaultUserId() {
  return String(process.env.ZOOM_DEFAULT_USER_ID || '').trim();
}

function isEnabled() {
  const flag = String(process.env.ZOOM_ENABLED || '').trim().toLowerCase();
  return flag === '1' || flag === 'true' || flag === 'yes';
}

function isConfigured() {
  return (
    isEnabled() &&
    Boolean(
      process.env.ZOOM_ACCOUNT_ID &&
        process.env.ZOOM_CLIENT_ID &&
        process.env.ZOOM_CLIENT_SECRET
    )
  );
}

function meetingSdkKey() {
  return String(
    process.env.ZOOM_MEETING_SDK_KEY || process.env.ZOOM_SDK_KEY || ''
  ).trim();
}

function meetingSdkSecret() {
  return String(
    process.env.ZOOM_MEETING_SDK_SECRET || process.env.ZOOM_SDK_SECRET || ''
  ).trim();
}

function isMeetingSdkConfigured() {
  return Boolean(meetingSdkKey() && meetingSdkSecret());
}

function isEmbeddedEnabled() {
  const flag = String(process.env.ZOOM_EMBEDDED_ENABLED ?? 'true').trim().toLowerCase();
  if (flag === '0' || flag === 'false' || flag === 'no') return false;
  return isMeetingSdkConfigured();
}

/**
 * Shared PMI puts every batch's cloud recordings under one Zoom meeting id,
 * which caused cross-batch / short-stub mis-attaches. Default is unique
 * scheduled meetings per live class. Set ZOOM_USE_PMR=true only if you
 * explicitly want the old single-room behaviour.
 */
function shouldUsePmr() {
  const flag = String(process.env.ZOOM_USE_PMR || '').trim().toLowerCase();
  return flag === '1' || flag === 'true' || flag === 'yes';
}

module.exports = {
  accountId: process.env.ZOOM_ACCOUNT_ID,
  clientId: process.env.ZOOM_CLIENT_ID,
  clientSecret: process.env.ZOOM_CLIENT_SECRET,
  defaultUserId,
  apiBaseUrl: 'https://api.zoom.us/v2',
  oauthUrl: 'https://zoom.us/oauth/token',
  isEnabled,
  isConfigured,
  meetingSdkKey,
  meetingSdkSecret,
  isMeetingSdkConfigured,
  isEmbeddedEnabled,
  shouldUsePmr
};
