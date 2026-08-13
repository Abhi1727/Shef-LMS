#!/usr/bin/env node
/**
 * Create Google Workspace accounts for LMS trainers (@lms.skystates.us)
 * and verify LMS user emails match.
 *
 * Requires Admin Directory write scope. One-time OAuth as admin@lms.skystates.us:
 *   ENV_PATH=.env.dev node scripts/createTrainerWorkspaceAccounts.js --auth
 * Open the printed URL, sign in as admin@lms.skystates.us, paste the code:
 *   ENV_PATH=.env.dev node scripts/createTrainerWorkspaceAccounts.js --code=XXXX
 *
 * Then create accounts:
 *   ENV_PATH=.env.dev node scripts/createTrainerWorkspaceAccounts.js --create
 *
 * Skips: Anshum, Ishika, Upendra (by policy).
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const { google } = require('googleapis');
const mongoose = require('mongoose');

const envPath = process.env.ENV_PATH
  ? path.resolve(process.cwd(), process.env.ENV_PATH)
  : path.resolve(__dirname, '../.env.dev');
if (fs.existsSync(envPath)) require('dotenv').config({ path: envPath });
else require('dotenv').config();

const CLIENT_ID = process.env.GOOGLE_MEET_CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_MEET_CLIENT_SECRET || process.env.GOOGLE_OAUTH_CLIENT_SECRET;
const REDIRECT_URI =
  process.env.GOOGLE_MEET_REDIRECT_URI ||
  process.env.GOOGLE_OAUTH_REDIRECT_URI ||
  'urn:ietf:wg:oauth:2.0:oob';
const TOKEN_FILE = path.resolve(__dirname, '../secrets/workspace-admin-oauth.json');
const PASSWORD_FILE = path.resolve(__dirname, '../secrets/trainer-workspace-temp-passwords.txt');

const SCOPES = [
  'https://www.googleapis.com/auth/admin.directory.user',
  'https://www.googleapis.com/auth/admin.directory.user.readonly'
];

const SKIP_LOCALS = new Set(['anshum', 'ishika', 'upendra']);

const TRAINERS = [
  { full: 'Abhishek Parihar', given: 'Abhishek', family: 'Parihar', local: 'abhishek' },
  { full: 'Aditya', given: 'Aditya', family: 'Trainer', local: 'aditya' },
  { full: 'Ankit Agrawal', given: 'Ankit', family: 'Agrawal', local: 'ankit' },
  { full: 'Diksha Papney', given: 'Diksha', family: 'Papney', local: 'diksha' },
  { full: 'Kaif Ahmed', given: 'Kaif', family: 'Ahmed', local: 'kaif' },
  { full: 'Megha Bhoity', given: 'Megha', family: 'Bhoity', local: 'megha' },
  { full: 'Noble Xavier', given: 'Noble', family: 'Xavier', local: 'noble' },
  { full: 'Ravi Kumar Singh', given: 'Ravi', family: 'Singh', local: 'ravi' },
  { full: 'Sanskar', given: 'Sanskar', family: 'Trainer', local: 'sanskar' },
  { full: 'Shubham', given: 'Shubham', family: 'Kumar', local: 'shubham' },
  { full: 'Surendra Prabhakar', given: 'Surendra', family: 'Prabhakar', local: 'surendra' },
  { full: 'Akash Dhara', given: 'Akash', family: 'Dhara', local: 'akash' }
];

function parseArgs(argv) {
  const out = { auth: false, create: false, code: null, verify: false };
  for (const a of argv) {
    if (a === '--auth') out.auth = true;
    else if (a === '--create') out.create = true;
    else if (a === '--verify') out.verify = true;
    else if (a.startsWith('--code=')) out.code = a.slice('--code='.length);
  }
  if (!out.auth && !out.create && !out.code && !out.verify) out.create = true;
  return out;
}

function genPassword() {
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
  for (;;) {
    const p = Array.from({ length: 14 }, () => alphabet[crypto.randomInt(alphabet.length)]).join('');
    if (/[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p) && /[!@#$%]/.test(p)) return p;
  }
}

function oauthClient() {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('Missing GOOGLE_MEET_CLIENT_ID / GOOGLE_MEET_CLIENT_SECRET in env');
  }
  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
}

function saveTokens(tokens) {
  fs.mkdirSync(path.dirname(TOKEN_FILE), { recursive: true });
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2), { mode: 0o600 });
  console.log(`Saved admin OAuth token → ${TOKEN_FILE}`);
}

function loadTokens() {
  if (process.env.WORKSPACE_ADMIN_REFRESH_TOKEN) {
    return {
      refresh_token: process.env.WORKSPACE_ADMIN_REFRESH_TOKEN,
      access_token: process.env.WORKSPACE_ADMIN_ACCESS_TOKEN
    };
  }
  if (fs.existsSync(TOKEN_FILE)) return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
  return null;
}

async function getAuthedClient() {
  const client = oauthClient();
  const tokens = loadTokens();
  if (!tokens?.refresh_token && !tokens?.access_token) {
    throw new Error('No admin OAuth token. Run with --auth then --code=...');
  }
  client.setCredentials(tokens);
  client.on('tokens', (t) => {
    const merged = { ...tokens, ...t };
    saveTokens(merged);
  });
  return client;
}

function printAuthUrl() {
  const client = oauthClient();
  const url = client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    login_hint: 'admin@lms.skystates.us'
  });
  console.log('\n1) Open this URL as admin@lms.skystates.us:\n');
  console.log(url);
  console.log('\n2) After consent, paste the code:\n');
  console.log(`   ENV_PATH=${path.basename(envPath)} node scripts/createTrainerWorkspaceAccounts.js --code=PASTE_HERE`);
  console.log('\n3) Then create accounts:\n');
  console.log(`   ENV_PATH=${path.basename(envPath)} node scripts/createTrainerWorkspaceAccounts.js --create\n`);
}

async function exchangeCode(code) {
  const client = oauthClient();
  const { tokens } = await client.getToken(code.trim());
  if (!tokens.refresh_token && !loadTokens()?.refresh_token) {
    console.warn('No refresh_token returned. If create fails later, revoke app access and re-run --auth with prompt=consent.');
  }
  const merged = { ...(loadTokens() || {}), ...tokens };
  saveTokens(merged);
  console.log('OAuth OK. Run --create next.');
}

async function createAccounts() {
  const auth = await getAuthedClient();
  const directory = google.admin({ version: 'directory_v1', auth });
  const created = [];
  const results = [];

  for (const t of TRAINERS) {
    const email = `${t.local}@lms.skystates.us`;
    if (SKIP_LOCALS.has(t.local)) {
      results.push({ email, full: t.full, status: 'SKIPPED' });
      continue;
    }
    try {
      const existing = await directory.users.get({ userKey: email }).catch((e) => {
        if (e.code === 404) return null;
        throw e;
      });
      if (existing?.data) {
        if (existing.data.suspended) {
          await directory.users.update({
            userKey: email,
            requestBody: { suspended: false }
          });
        }
        await directory.users.update({
          userKey: email,
          requestBody: {
            name: { givenName: t.given, familyName: t.family }
          }
        });
        results.push({ email, full: t.full, status: 'EXISTS' });
        continue;
      }
    } catch (e) {
      if (e.code !== 404) {
        results.push({ email, full: t.full, status: `FAIL get: ${e.message}` });
        continue;
      }
    }

    const password = genPassword();
    try {
      await directory.users.insert({
        requestBody: {
          primaryEmail: email,
          name: { givenName: t.given, familyName: t.family },
          password,
          changePasswordAtNextLogin: true,
          orgUnitPath: '/'
        }
      });
      created.push({ full: t.full, email, password });
      results.push({ email, full: t.full, status: 'CREATED' });
    } catch (e) {
      const msg = e.errors?.[0]?.message || e.message;
      results.push({ email, full: t.full, status: `FAIL: ${msg}` });
    }
  }

  if (created.length) {
    fs.mkdirSync(path.dirname(PASSWORD_FILE), { recursive: true });
    const lines = [
      '# TEMP Workspace passwords (changePasswordAtNextLogin=true)',
      `# ${new Date().toISOString()}`,
      '',
      ...created.map((c) => `${c.full} | ${c.email} | ${c.password}`),
      ''
    ];
    fs.writeFileSync(PASSWORD_FILE, lines.join('\n'), { mode: 0o600 });
  }

  console.log('\n=== Workspace results ===');
  for (const r of results) console.log(`${r.status.padEnd(10)} | ${r.full.padEnd(24)} | ${r.email}`);
  if (created.length) console.log(`\nTemp passwords written to ${PASSWORD_FILE}`);
  return results;
}

function buildUri(env, dbName) {
  if (env.MONGODB_URI_STANDARD) {
    const u = new URL(env.MONGODB_URI_STANDARD);
    u.pathname = '/' + dbName;
    return u.toString();
  }
  const user = encodeURIComponent(env.MONGODB_USERNAME);
  const pass = encodeURIComponent(env.MONGODB_PASSWORD);
  return `mongodb+srv://${user}:${pass}@${env.MONGODB_CLUSTER}/${dbName}?retryWrites=true&w=majority`;
}

async function verifyLmsEmails() {
  const wanted = new Map(
    TRAINERS.filter((t) => !SKIP_LOCALS.has(t.local)).map((t) => [
      t.full.toLowerCase(),
      `${t.local}@lms.skystates.us`
    ])
  );
  // Also match by first-name key variants already in DB
  const byLocal = new Map(TRAINERS.map((t) => [t.local, `${t.local}@lms.skystates.us`]));

  async function checkMongo(label, envFile, dbName) {
    const env = require('dotenv').parse(fs.readFileSync(path.resolve(__dirname, '..', envFile), 'utf8'));
    await mongoose.connect(buildUri(env, dbName));
    const users = await mongoose.connection.db
      .collection('users')
      .find({ role: { $in: ['teacher', 'trainer', 'mentor'] } })
      .toArray();
    console.log(`\n=== LMS Mongo ${label} ===`);
    for (const u of users) {
      const name = (u.name || '').trim();
      const key = name.toLowerCase();
      if (key.startsWith('anshum') || key.startsWith('ishika') || key.startsWith('upendra')) {
        console.log(`SKIP  | ${name} | ${u.email}`);
        continue;
      }
      const local = name.split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g, '');
      const expected = wanted.get(key) || byLocal.get(local);
      if (!expected) {
        console.log(`OTHER | ${name} | ${u.email}`);
        continue;
      }
      const ok = (u.email || '').toLowerCase() === expected;
      console.log(`${ok ? 'OK   ' : 'MISMATCH'} | ${name} | ${u.email}${ok ? '' : ` (want ${expected})`}`);
      if (!ok) {
        await mongoose.connection.db.collection('users').updateOne({ _id: u._id }, { $set: { email: expected } });
        console.log(`       fixed → ${expected}`);
      }
    }
    await mongoose.disconnect();
  }

  async function checkFirestore(database) {
    const token = await new Promise((resolve, reject) => {
      const { execSync } = require('child_process');
      try {
        resolve(execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim());
      } catch (e) {
        reject(e);
      }
    });
    const docs = [];
    let page =
      `https://firestore.googleapis.com/v1/projects/skystateslms/databases/${database}/documents/users?pageSize=300`;
    while (page) {
      const body = await new Promise((resolve, reject) => {
        https
          .get(page, { headers: { Authorization: `Bearer ${token}` } }, (res) => {
            const chunks = [];
            res.on('data', (c) => chunks.push(c));
            res.on('end', () => resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')));
          })
          .on('error', reject);
      });
      docs.push(...(body.documents || []));
      page = body.nextPageToken
        ? `https://firestore.googleapis.com/v1/projects/skystateslms/databases/${database}/documents/users?pageSize=300&pageToken=${body.nextPageToken}`
        : null;
    }
    console.log(`\n=== LMS Firestore ${database} ===`);
    for (const d of docs) {
      const f = d.fields || {};
      const role = f.role?.stringValue;
      if (!['teacher', 'trainer', 'mentor'].includes(role)) continue;
      const name = (f.name?.stringValue || '').trim();
      const email = f.email?.stringValue || '';
      const key = name.toLowerCase();
      if (key.startsWith('anshum') || key.startsWith('ishika') || key.startsWith('upendra')) {
        console.log(`SKIP  | ${name} | ${email}`);
        continue;
      }
      const local = name.split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g, '');
      const expected = wanted.get(key) || byLocal.get(local);
      if (!expected) {
        console.log(`OTHER | ${name} | ${email}`);
        continue;
      }
      const ok = email.toLowerCase() === expected;
      console.log(`${ok ? 'OK   ' : 'MISMATCH'} | ${name} | ${email}${ok ? '' : ` (want ${expected})`}`);
      if (!ok) {
        const docId = d.name.split('/').pop();
        const url = `https://firestore.googleapis.com/v1/projects/skystateslms/databases/${database}/documents/users/${docId}?updateMask.fieldPaths=email`;
        await new Promise((resolve, reject) => {
          const payload = JSON.stringify({ fields: { email: { stringValue: expected } } });
          const req = https.request(
            url,
            {
              method: 'PATCH',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
              }
            },
            (res) => {
              res.on('data', () => {});
              res.on('end', () => resolve());
            }
          );
          req.on('error', reject);
          req.write(payload);
          req.end();
        });
        console.log(`       fixed → ${expected}`);
      }
    }
  }

  await checkMongo('dev', '.env.dev', 'shef-lms-dev');
  await checkMongo('prod', '.env', 'lms');
  await checkFirestore('lms-dev');
  await checkFirestore('lms-prod');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.auth) {
    printAuthUrl();
    return;
  }
  if (args.code) {
    await exchangeCode(args.code);
    return;
  }
  if (args.create) {
    await createAccounts();
  }
  if (args.verify || args.create) {
    await verifyLmsEmails();
  }
}

main().catch((err) => {
  console.error('Failed:', err.message || err);
  if (/insufficient|scope|403/i.test(String(err.message || err))) {
    console.error('\nNeed Admin Directory write consent. Run --auth and complete the URL as admin@lms.skystates.us');
  }
  process.exit(1);
});
