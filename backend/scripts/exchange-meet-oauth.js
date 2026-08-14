#!/usr/bin/env node
/**
 * Print Meet OAuth URL (Calendar + Drive + Meet Spaces) and optionally exchange a code.
 *
 * Usage:
 *   ENV_PATH=.env node scripts/exchange-meet-oauth.js
 *   ENV_PATH=.env CODE='4/...' node scripts/exchange-meet-oauth.js
 *
 * After success, copy GOOGLE_MEET_REFRESH_TOKEN into backend/.env and .env.dev,
 * then recreate backend containers.
 */
const path = require('path');
const fs = require('fs');
const { google } = require('googleapis');

const envPath = process.env.ENV_PATH
  ? path.resolve(process.cwd(), process.env.ENV_PATH)
  : path.resolve(__dirname, '../.env');

if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else {
  require('dotenv').config();
}

const CLIENT_ID = process.env.GOOGLE_MEET_CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_MEET_CLIENT_SECRET || process.env.GOOGLE_OAUTH_CLIENT_SECRET;
const REDIRECT_URI =
  process.env.GOOGLE_MEET_REDIRECT_URI ||
  process.env.GOOGLE_OAUTH_REDIRECT_URI ||
  'http://localhost:5000/auth/google/callback';

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/meetings.space.created',
  'https://www.googleapis.com/auth/meetings.space.readonly'
];

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Missing GOOGLE_MEET_CLIENT_ID / SECRET');
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES,
  prompt: 'consent'
});

async function main() {
  const code = process.env.CODE || process.argv[2];
  if (!code) {
    console.log('Sign in as admin@lms.skystates.us (Meet host) and approve ALL scopes.\n');
    console.log(authUrl);
    console.log('\nThen run:');
    console.log(`  ENV_PATH=${path.basename(envPath)} CODE='PASTE_CODE_HERE' node scripts/exchange-meet-oauth.js\n`);
    return;
  }

  const { tokens } = await oauth2Client.getToken(String(code).trim());
  if (!tokens.refresh_token) {
    console.error('No refresh_token. Revoke app access at https://myaccount.google.com/permissions and retry.');
    process.exit(1);
  }

  console.log('\nSuccess. Update GOOGLE_MEET_REFRESH_TOKEN in .env and .env.dev:\n');
  console.log(tokens.refresh_token);
  console.log('\nGranted scopes:', tokens.scope || '(check tokeninfo after refresh)');

  oauth2Client.setCredentials(tokens);
  const drive = google.drive({ version: 'v3', auth: oauth2Client });
  await drive.files.list({ pageSize: 1, fields: 'files(id)' });
  console.log('Drive API OK.');

  try {
    const meet = google.meet({ version: 'v2', auth: oauth2Client });
    const space = await meet.spaces.create({
      requestBody: { config: { accessType: 'OPEN', entryPointAccess: 'ALL' } }
    });
    console.log('Meet Spaces API OK:', space.data?.meetingUri || space.data?.name);
  } catch (err) {
    console.warn('Meet Spaces API not ready yet:', err.message);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
