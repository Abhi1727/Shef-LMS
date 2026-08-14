#!/usr/bin/env node
/**
 * Re-authorize Firestore REST OAuth (fixes invalid_rapt / invalid_grant).
 *
 *   ENV_PATH=.env node scripts/setup-firestore-oauth.js --auth
 *   ENV_PATH=.env node scripts/setup-firestore-oauth.js --code=PASTE
 *
 * Writes FIRESTORE_OAUTH_* into the env file (keeps other keys).
 * Uses Meet OAuth client by default (same redirect URI).
 */
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const envPath = process.env.ENV_PATH
  ? path.resolve(process.cwd(), process.env.ENV_PATH)
  : path.resolve(__dirname, '../.env');

if (!fs.existsSync(envPath)) {
  console.error('Env file not found:', envPath);
  process.exit(1);
}
require('dotenv').config({ path: envPath });

const CLIENT_ID = process.env.GOOGLE_MEET_CLIENT_ID || process.env.FIRESTORE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_MEET_CLIENT_SECRET || process.env.FIRESTORE_OAUTH_CLIENT_SECRET;
const REDIRECT_URI =
  process.env.GOOGLE_MEET_REDIRECT_URI ||
  process.env.FIRESTORE_OAUTH_REDIRECT_URI ||
  'http://localhost:5000/auth/google/callback';

const SCOPES = [
  'https://www.googleapis.com/auth/datastore',
  'https://www.googleapis.com/auth/cloud-platform'
];

function parseArgs(argv) {
  const out = { auth: false, code: null };
  for (const a of argv) {
    if (a === '--auth') out.auth = true;
    else if (a.startsWith('--code=')) out.code = a.slice('--code='.length);
  }
  return out;
}

function upsertEnv(file, updates) {
  let text = fs.readFileSync(file, 'utf8');
  for (const [k, v] of Object.entries(updates)) {
    const line = `${k}=${v}`;
    const re = new RegExp(`^${k}=.*$`, 'm');
    if (re.test(text)) text = text.replace(re, line);
    else text = text.replace(/\s*$/, `\n${line}\n`);
  }
  fs.writeFileSync(file, text);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error('Missing GOOGLE_MEET_CLIENT_ID/SECRET (or FIRESTORE_OAUTH_*)');
    process.exit(1);
  }
  const oauth2 = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

  if (args.auth || !args.code) {
    const url = oauth2.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent',
      login_hint: process.env.GOOGLE_MEET_HOST_EMAIL || 'admin@lms.skystates.us'
    });
    console.log('\n1) Open this URL as the Workspace admin / Firestore identity:\n');
    console.log(url);
    console.log('\n2) After redirect to localhost:5000, copy the code= value, then run:\n');
    console.log(`   ENV_PATH=${path.basename(envPath)} node scripts/setup-firestore-oauth.js --code=PASTE_HERE\n`);
    if (!args.code) return;
  }

  const { tokens } = await oauth2.getToken(String(args.code).trim());
  if (!tokens.refresh_token) {
    console.error('No refresh_token returned. Revoke app access at https://myaccount.google.com/permissions and retry --auth.');
    process.exit(1);
  }

  upsertEnv(envPath, {
    USE_FIRESTORE: 'true',
    FIRESTORE_PROJECT: process.env.FIRESTORE_PROJECT || 'skystateslms',
    FIRESTORE_DATABASE: process.env.FIRESTORE_DATABASE || 'lms-prod',
    FIRESTORE_OAUTH_CLIENT_ID: CLIENT_ID,
    FIRESTORE_OAUTH_CLIENT_SECRET: CLIENT_SECRET,
    FIRESTORE_OAUTH_REFRESH_TOKEN: tokens.refresh_token
  });

  // Probe Firestore
  oauth2.setCredentials(tokens);
  const { google: g } = require('googleapis');
  // REST ping via token
  const https = require('https');
  const access = tokens.access_token;
  const db = process.env.FIRESTORE_DATABASE || 'lms-prod';
  const project = process.env.FIRESTORE_PROJECT || 'skystateslms';
  await new Promise((resolve, reject) => {
    https
      .get(
        `https://firestore.googleapis.com/v1/projects/${project}/databases/${db}/documents/users?pageSize=1`,
        { headers: { Authorization: `Bearer ${access}` } },
        (res) => {
          console.log(`Firestore probe ${db}: HTTP ${res.statusCode}`);
          res.resume();
          res.on('end', resolve);
        }
      )
      .on('error', reject);
  });

  console.log(`\nUpdated ${envPath} with fresh FIRESTORE_OAUTH_REFRESH_TOKEN.`);
  console.log('Recreate the backend container next.\n');
}

main().catch((e) => {
  console.error('Failed:', e.message || e);
  process.exit(1);
});
