// Zoom API Configuration
require('dotenv').config();

function defaultUserId() {
  return String(
    process.env.ZOOM_DEFAULT_USER_ID ||
      process.env.GOOGLE_MEET_HOST_EMAIL ||
      'admin@lms.skystates.us'
  ).trim();
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
  isEmbeddedEnabled
};
