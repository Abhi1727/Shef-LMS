#!/usr/bin/env node
/**
 * YouTube upload OAuth — reuses the same GCP OAuth client as Meet/Drive.
 *
 * Prerequisites:
 *   1) YouTube Data API v3 enabled on the GCP project
 *   2) GOOGLE_MEET_CLIENT_ID / SECRET already in .env.dev (same Desktop/Web client)
 *
 * Usage:
 *   ENV_PATH=.env.dev node scripts/setup-youtube-oauth.js
 *   ENV_PATH=.env.dev node scripts/setup-youtube-oauth.js --code=PASTE_CODE
 *
 * Sign in as the channel that should own LMS recordings (usually admin@lms.skystates.us).
 */

const path = require('path');
const fs = require('fs');
const { google } = require('googleapis');
const readline = require('readline');

const envPath = process.env.ENV_PATH
  ? path.resolve(process.cwd(), process.env.ENV_PATH)
  : path.resolve(__dirname, '../.env.dev');

if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
  console.log(`Loaded env: ${envPath}`);
} else {
  require('dotenv').config();
  console.log('Loaded default .env');
}

const CLIENT_ID =
  process.env.YOUTUBE_CLIENT_ID ||
  process.env.GOOGLE_MEET_CLIENT_ID ||
  process.env.GOOGLE_OAUTH_CLIENT_ID;
const CLIENT_SECRET =
  process.env.YOUTUBE_CLIENT_SECRET ||
  process.env.GOOGLE_MEET_CLIENT_SECRET ||
  process.env.GOOGLE_OAUTH_CLIENT_SECRET;
const REDIRECT_URI =
  process.env.YOUTUBE_REDIRECT_URI ||
  process.env.GOOGLE_MEET_REDIRECT_URI ||
  process.env.GOOGLE_OAUTH_REDIRECT_URI ||
  'http://localhost:5000/auth/google/callback';

const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly'
];

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Missing OAuth client. Set GOOGLE_MEET_CLIENT_ID/SECRET (or YOUTUBE_*) in .env.dev');
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES,
  prompt: 'consent',
  login_hint: process.env.GOOGLE_MEET_HOST_EMAIL || 'admin@lms.skystates.us'
});

function upsertEnv(key, value) {
  let text = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  const line = `${key}=${value}`;
  if (new RegExp(`^${key}=.*$`, 'm').test(text)) {
    text = text.replace(new RegExp(`^${key}=.*$`, 'm'), line);
  } else {
    text = `${text.trimEnd()}\n${line}\n`;
  }
  fs.writeFileSync(envPath, text);
}

async function exchangeCode(code) {
  const { tokens } = await oauth2Client.getToken(String(code).trim());
  if (!tokens.refresh_token) {
    console.error(
      'No refresh_token returned. Revoke app access at https://myaccount.google.com/permissions then retry.'
    );
    process.exit(1);
  }

  oauth2Client.setCredentials(tokens);
  const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
  let channelTitle = '(unknown)';
  try {
    const r = await youtube.channels.list({ part: 'snippet', mine: true });
    channelTitle = r.data.items?.[0]?.snippet?.title || channelTitle;
    console.log('YouTube API OK. Channel:', channelTitle);
  } catch (err) {
    console.warn('YouTube channel probe failed:', err.message);
  }

  upsertEnv('YOUTUBE_CLIENT_ID', CLIENT_ID);
  upsertEnv('YOUTUBE_CLIENT_SECRET', CLIENT_SECRET);
  upsertEnv('YOUTUBE_REDIRECT_URI', REDIRECT_URI);
  upsertEnv('YOUTUBE_REFRESH_TOKEN', tokens.refresh_token);
  upsertEnv('YOUTUBE_PRIVACY_STATUS', process.env.YOUTUBE_PRIVACY_STATUS || 'unlisted');

  console.log('\nWrote YouTube OAuth vars to', envPath);
  console.log('Uploads will go to channel:', channelTitle);
  console.log('\nRestart DEV backend:');
  console.log('  cd backend && docker compose -p shef-lms-dev -f docker-compose.dev.yml up -d --build\n');
}

async function main() {
  const args = process.argv.slice(2);
  const codeArg = args.find((a) => a.startsWith('--code='))?.slice(7) || args[0];

  console.log('\nYouTube OAuth (same GCP client as Meet/Drive)\n');
  console.log('Client ID:', CLIENT_ID);
  console.log('Redirect:', REDIRECT_URI);
  console.log('\n1) Open this URL and sign in as the upload account:\n');
  console.log(authUrl);
  console.log('\n2) After consent, copy the code (or ?code= from redirect URL).\n');

  if (codeArg && !String(codeArg).startsWith('--')) {
    await exchangeCode(codeArg);
    return;
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question('Paste authorization code here: ', async (code) => {
    rl.close();
    if (!code.trim()) {
      console.error('No code provided.');
      process.exit(1);
    }
    try {
      await exchangeCode(code);
    } catch (err) {
      console.error('Failed:', err.message);
      process.exit(1);
    }
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
