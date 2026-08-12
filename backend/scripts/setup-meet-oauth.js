#!/usr/bin/env node
/**
 * Google Meet / Calendar + Drive OAuth setup (no service account keys).
 *
 * Use this when org policy iam.disableServiceAccountKeyCreation blocks SA JSON keys.
 *
 * Steps:
 * 1) GCP → enable Google Calendar API and Google Drive API
 * 2) Credentials → Create OAuth client ID (Desktop app, or Web with redirect below)
 * 3) Put client id/secret in backend/.env.dev
 * 4) Run: ENV_PATH=.env.dev node scripts/setup-meet-oauth.js
 * 5) Open the URL, sign in as the Workspace host (Meet events + Drive recordings)
 * 6) Paste the code; copy GOOGLE_MEET_REFRESH_TOKEN into .env.dev
 * 7) Set GOOGLE_MEET_ENABLED=true and rebuild DEV backend
 *
 * Re-run whenever scopes change (e.g. after adding drive.file).
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
  console.log('Loaded default .env (ENV_PATH file not found)');
}

const CLIENT_ID = process.env.GOOGLE_MEET_CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_MEET_CLIENT_SECRET || process.env.GOOGLE_OAUTH_CLIENT_SECRET;
const REDIRECT_URI =
  process.env.GOOGLE_MEET_REDIRECT_URI ||
  process.env.GOOGLE_OAUTH_REDIRECT_URI ||
  'urn:ietf:wg:oauth:2.0:oob';

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/drive.file'
];

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Set GOOGLE_MEET_CLIENT_ID and GOOGLE_MEET_CLIENT_SECRET in .env.dev first.');
  console.error('GCP → APIs & Services → Credentials → Create OAuth client ID (Desktop).');
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES,
  prompt: 'consent'
});

async function exchangeCode(code) {
  const { tokens } = await oauth2Client.getToken(code.trim());
  if (!tokens.refresh_token) {
    console.error('No refresh_token returned. Revoke prior access at https://myaccount.google.com/permissions and retry with prompt=consent.');
    process.exit(1);
  }

  console.log('\nSuccess. Add these to backend/.env.dev:\n');
  console.log(`GOOGLE_MEET_ENABLED=true`);
  console.log(`GOOGLE_MEET_CLIENT_ID=${CLIENT_ID}`);
  console.log(`GOOGLE_MEET_CLIENT_SECRET=${CLIENT_SECRET}`);
  console.log(`GOOGLE_MEET_REDIRECT_URI=${REDIRECT_URI}`);
  console.log(`GOOGLE_MEET_REFRESH_TOKEN=${tokens.refresh_token}`);
  console.log(`GOOGLE_CALENDAR_ID=primary`);
  console.log('\nThen: docker compose -p shef-lms-dev -f docker-compose.dev.yml up -d --build\n');

  oauth2Client.setCredentials(tokens);
  // calendar.events scope can create/list events but NOT calendarList.get (needs calendar.readonly).
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  const drive = google.drive({ version: 'v3', auth: oauth2Client });
  try {
    const start = new Date(Date.now() + 60 * 60 * 1000);
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    const created = await calendar.events.insert({
      calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
      conferenceDataVersion: 1,
      requestBody: {
        summary: 'LMS OAuth smoke (safe to ignore)',
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
        conferenceData: {
          createRequest: {
            requestId: `oauth-smoke-${Date.now()}`,
            conferenceSolutionKey: { type: 'hangoutsMeet' }
          }
        }
      }
    });
    const meet =
      created.data.hangoutLink ||
      created.data.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')?.uri ||
      '';
    console.log('Calendar/Meet API test OK.', meet || created.data.id);
    await calendar.events.delete({
      calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
      eventId: created.data.id
    });
  } catch (err) {
    console.warn('Calendar/Meet API test failed:', err.message);
  }
  try {
    await drive.files.list({ pageSize: 1, fields: 'files(id,name)' });
    console.log('Drive API test OK (drive.file scope).');
  } catch (err) {
    console.warn('Drive API test failed:', err.message);
  }

  // Persist refresh token into the env file when present
  if (fs.existsSync(envPath)) {
    let envText = fs.readFileSync(envPath, 'utf8');
    const line = `GOOGLE_MEET_REFRESH_TOKEN=${tokens.refresh_token}`;
    if (/^GOOGLE_MEET_REFRESH_TOKEN=.*/m.test(envText)) {
      envText = envText.replace(/^GOOGLE_MEET_REFRESH_TOKEN=.*/m, line);
    } else {
      envText = `${envText.trimEnd()}\n${line}\n`;
    }
    if (!/^GOOGLE_MEET_ENABLED=/m.test(envText)) {
      envText += 'GOOGLE_MEET_ENABLED=true\n';
    } else {
      envText = envText.replace(/^GOOGLE_MEET_ENABLED=.*/m, 'GOOGLE_MEET_ENABLED=true');
    }
    fs.writeFileSync(envPath, envText);
    console.log(`\nWrote refresh token to ${envPath}`);
  }
}

async function main() {
  const codeArg = process.argv[2];
  console.log('\nGoogle Meet OAuth setup (avoids service account keys)\n');
  console.log('1) Open this URL and sign in as the host mailbox (e.g. classes@yourdomain.com):\n');
  console.log(authUrl);
  console.log('\n2) After consent, copy the authorization code.\n');

  if (codeArg) {
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
