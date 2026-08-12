const { google } = require('googleapis');
const fs = require('fs');

const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

const ALL_SCOPES = [CALENDAR_SCOPE, DRIVE_SCOPE];

function getOAuthCredentials() {
  const clientId = process.env.GOOGLE_MEET_CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_MEET_CLIENT_SECRET || process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_MEET_REFRESH_TOKEN || process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) return null;
  return { clientId, clientSecret, refreshToken };
}

function normalizePrivateKey(key) {
  if (!key) return '';
  return String(key).replace(/\\n/g, '\n').trim();
}

function getServiceAccountCredentials() {
  const jsonPath = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (jsonPath && fs.existsSync(jsonPath)) {
    const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    return { clientEmail: raw.client_email, privateKey: raw.private_key };
  }
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = normalizePrivateKey(process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY);
  if (!clientEmail || !privateKey) return null;
  return { clientEmail, privateKey };
}

function isMeetEnabled() {
  return String(process.env.GOOGLE_MEET_ENABLED || '').toLowerCase() === 'true';
}

function getAuthMode() {
  if (getOAuthCredentials()) return 'oauth';
  if (getServiceAccountCredentials() && process.env.GOOGLE_WORKSPACE_IMPERSONATE) {
    return 'service_account';
  }
  return 'none';
}

/**
 * Shared Google auth for Calendar + Drive (OAuth refresh token preferred).
 */
async function getGoogleAuth(extraScopes = []) {
  const mode = getAuthMode();
  if (mode === 'none') {
    const err = new Error(
      'Google is not configured. Set GOOGLE_MEET_CLIENT_ID, SECRET, REFRESH_TOKEN (re-run setup-meet-oauth.js with Drive scope).'
    );
    err.code = 'MEET_NOT_CONFIGURED';
    throw err;
  }

  const scopes = [...new Set([...ALL_SCOPES, ...extraScopes])];

  if (mode === 'oauth') {
    const { clientId, clientSecret, refreshToken } = getOAuthCredentials();
    const redirectUri =
      process.env.GOOGLE_MEET_REDIRECT_URI ||
      process.env.GOOGLE_OAUTH_REDIRECT_URI ||
      'http://localhost:5000/auth/google/callback';
    const auth = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    auth.setCredentials({ refresh_token: refreshToken });
    return auth;
  }

  const creds = getServiceAccountCredentials();
  const auth = new google.auth.JWT({
    email: creds.clientEmail,
    key: creds.privateKey,
    scopes,
    subject: process.env.GOOGLE_WORKSPACE_IMPERSONATE
  });
  await auth.authorize();
  return auth;
}

module.exports = {
  CALENDAR_SCOPE,
  DRIVE_SCOPE,
  ALL_SCOPES,
  isMeetEnabled,
  getAuthMode,
  getOAuthCredentials,
  getServiceAccountCredentials,
  getGoogleAuth
};
