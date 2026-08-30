#!/usr/bin/env node
/**
 * List Zoom account users and sync LMS trainer zoomUserId / conferenceProvider=zoom.
 * Creates missing Zoom users when --create is passed (requires user:write:admin).
 *
 *   ENV_PATH=.env ZOOM_ENABLED=true node scripts/syncTrainerZoomUsers.js --dry-run
 *   ENV_PATH=.env ZOOM_ENABLED=true node scripts/syncTrainerZoomUsers.js --create
 *   ENV_PATH=.env ZOOM_ENABLED=true node scripts/syncTrainerZoomUsers.js --create --apply
 */
const path = require('path');
const axios = require('axios');

const envPath = process.env.ENV_PATH
  ? path.resolve(process.cwd(), process.env.ENV_PATH)
  : path.resolve(__dirname, '../.env');
require('dotenv').config({ path: envPath });
// Force Zoom on for this script even if .env not yet updated
if (!process.env.ZOOM_ENABLED) process.env.ZOOM_ENABLED = 'true';

const User = require('../models/User');
const zoomConfig = require('../config/zoom');
const zoomService = require('../services/zoomService');

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

/** LMS email → Zoom account emails (@skystates.us licensed accounts). */
const ALIAS_BY_LMS_EMAIL = {
  'abhishek@skystates.us': ['abhishekparihar@skystates.us', 'admin@lms.skystates.us', 'abhishek@skystates.us'],
  'akash@skystates.us': ['akashdhara@skystates.us', 'akashdhara@shefusa.com', 'akash@skystates.us'],
  'ankit@skystates.us': ['ankit@skystates.us', 'ankit@shefusa.com'],
  'ravi@skystates.us': ['ravikumar@skystates.us', 'ravi@shefusa.com', 'ravi@skystates.us'],
  'shubham@skystates.us': ['shubham_kumar@skystates.us', 'shubh@shefusa.com', 'shubham@skystates.us'],
  'megha@skystates.us': ['megha@skystates.us', 'megha@shefusa.com'],
  'diksha@skystates.us': ['diksha@skystates.us', 'diksha@shefusa.com'],
  'surendra@skystates.us': ['surendra@skystates.us', 'surendra@shefusa.com'],
  'noble@skystates.us': ['noble@skystates.us', 'noble@shefusa.com'],
  'kaif@skystates.us': ['admin@lms.skystates.us', 'kaif@shefusa.com', 'kaif@skystates.us'],
  'anshumbanga@skystates.us': ['anshumbanga@skystates.us'],
  'sanskar@skystates.us': ['sanskar@skystates.us', 'sanskar@shefusa.com'],
  'aditya@skystates.us': ['adityavats@skystates.us', 'aditya@shefusa.com', 'aditya@skystates.us'],
  'upendra@skystates.us': ['upendra@skystates.us', 'support@skystates.us']
};

async function listAllZoomUsers() {
  const token = await zoomService.getAccessToken();
  const users = [];
  let nextPageToken = '';
  do {
    const res = await axios.get(`${zoomConfig.apiBaseUrl}/users`, {
      headers: { Authorization: `Bearer ${token}` },
      params: {
        page_size: 100,
        status: 'active',
        next_page_token: nextPageToken || undefined
      }
    });
    users.push(...(res.data.users || []));
    nextPageToken = res.data.next_page_token || '';
  } while (nextPageToken);
  return users;
}

async function createZoomUser({ email, firstName, lastName }) {
  const token = await zoomService.getAccessToken();
  const res = await axios.post(
    `${zoomConfig.apiBaseUrl}/users`,
    {
        action: 'create',
        user_info: {
          email,
          type: 2, // Licensed — required for cloud recording + pause/stop
          first_name: firstName || 'Trainer',
          last_name: lastName || 'SkyStates'
        }
    },
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
  );
  return res.data;
}

function findZoomMatch(teacher, zoomByEmail) {
  const lmsEmail = String(teacher.email || '').trim().toLowerCase();
  const aliases = ALIAS_BY_LMS_EMAIL[lmsEmail] || [lmsEmail];
  for (const a of aliases) {
    const hit = zoomByEmail.get(String(a).toLowerCase());
    if (hit) return hit;
  }
  // also try matching display name loosely
  const name = String(teacher.name || '').trim().toLowerCase();
  if (!name) return null;
  for (const u of zoomByEmail.values()) {
    const zn = `${u.first_name || ''} ${u.last_name || ''}`.trim().toLowerCase();
    if (zn && (zn === name || name.includes(zn) || zn.includes(name))) return u;
  }
  return null;
}

async function main() {
  const dryRun = !hasFlag('apply');
  const doCreate = hasFlag('create');

  console.log(
    JSON.stringify(
      {
        envPath,
        firestoreDb: process.env.FIRESTORE_DATABASE,
        zoomConfigured: zoomService.isConfigured(),
        defaultUserId: zoomConfig.defaultUserId(),
        dryRun,
        doCreate
      },
      null,
      2
    )
  );

  if (!zoomService.isConfigured()) {
    throw new Error('Zoom not configured — need ZOOM_ENABLED + S2S credentials');
  }

  const zoomUsers = await listAllZoomUsers();
  const zoomByEmail = new Map();
  for (const u of zoomUsers) {
    const em = String(u.email || '').trim().toLowerCase();
    if (em) zoomByEmail.set(em, u);
  }
  console.log(`Zoom active users: ${zoomUsers.length}`);

  const teachers = await User.find({
    role: { $in: ['teacher', 'instructor', 'mentor'] }
  })
    .select('name email conferenceProvider zoomUserId')
    .exec();

  const report = [];
  let updated = 0;
  let created = 0;
  let skipped = 0;

  for (const t of teachers) {
    const lmsEmail = String(t.email || '').trim().toLowerCase();
    let match = findZoomMatch(t, zoomByEmail);
    let action = 'none';

    if (!match && doCreate && lmsEmail) {
      const parts = String(t.name || 'Trainer').trim().split(/\s+/);
      const firstName = parts[0] || 'Trainer';
      const lastName = parts.slice(1).join(' ') || 'SkyStates';
      if (dryRun) {
        action = 'would-create';
        report.push({
          name: t.name,
          email: lmsEmail,
          action,
          zoomUserId: lmsEmail
        });
        continue;
      }
      try {
        const createdUser = await createZoomUser({
          email: lmsEmail,
          firstName,
          lastName
        });
        match = {
          id: createdUser.id || createdUser.email || lmsEmail,
          email: createdUser.email || lmsEmail,
          first_name: firstName,
          last_name: lastName
        };
        zoomByEmail.set(lmsEmail, match);
        created += 1;
        action = 'created';
      } catch (err) {
        const msg = err.response?.data?.message || err.message;
        // already exists
        if (/already|exist/i.test(String(msg))) {
          try {
            const token = await zoomService.getAccessToken();
            const got = await axios.get(
              `${zoomConfig.apiBaseUrl}/users/${encodeURIComponent(lmsEmail)}`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            match = got.data;
            zoomByEmail.set(lmsEmail, match);
            action = 'found-existing';
          } catch (e2) {
            report.push({
              name: t.name,
              email: lmsEmail,
              action: 'create-failed',
              error: msg
            });
            skipped += 1;
            continue;
          }
        } else {
          report.push({
            name: t.name,
            email: lmsEmail,
            action: 'create-failed',
            error: msg
          });
          skipped += 1;
          continue;
        }
      }
    }

    if (!match) {
      report.push({
        name: t.name,
        email: lmsEmail,
        action: 'missing-in-zoom',
        currentZoomUserId: t.zoomUserId || ''
      });
      skipped += 1;
      continue;
    }

    // Prefer email as zoomUserId (Zoom accepts email in user paths); keep existing if already set to a working id
    const zoomUserId = String(match.email || match.id || '').trim();
    const already =
      String(t.zoomUserId || '').trim().toLowerCase() === zoomUserId.toLowerCase() &&
      t.conferenceProvider === 'zoom';

    if (already) {
      report.push({
        name: t.name,
        email: lmsEmail,
        action: 'ok',
        zoomUserId
      });
      continue;
    }

    if (dryRun) {
      report.push({
        name: t.name,
        email: lmsEmail,
        action: action === 'created' ? 'created+would-apply' : 'would-apply',
        zoomUserId,
        previous: t.zoomUserId || ''
      });
      continue;
    }

    t.zoomUserId = zoomUserId;
    t.conferenceProvider = 'zoom';
    t.updatedAt = new Date();
    await t.save();
    updated += 1;
    report.push({
      name: t.name,
      email: lmsEmail,
      action: action === 'created' ? 'created+applied' : 'applied',
      zoomUserId
    });
  }

  console.log(JSON.stringify({ updated, created, skipped, dryRun, report }, null, 2));
  if (dryRun) {
    console.log('\nDry run only. Re-run with --apply (and --create if you want Zoom user invites).');
  }
}

main().catch((e) => {
  console.error('FATAL', e.response?.data || e);
  process.exit(1);
});
