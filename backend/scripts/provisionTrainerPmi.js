#!/usr/bin/env node
/**
 * Enable PMI (Personal Meeting Room) for licensed Zoom trainers via API.
 * Falls back to a stable type-3 recurring room when PMI settings scope is missing.
 *
 *   ENV_PATH=.env node scripts/provisionTrainerPmi.js --file=scripts/trainers-zoom.prod.json
 *   ENV_PATH=.env node scripts/provisionTrainerPmi.js --file=scripts/trainers-zoom.prod.json --dry-run
 */
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const envPath = process.env.ENV_PATH
  ? path.resolve(process.cwd(), process.env.ENV_PATH)
  : path.resolve(__dirname, '../.env');
require('dotenv').config({ path: envPath });
if (!process.env.ZOOM_ENABLED) process.env.ZOOM_ENABLED = 'true';

const zoomConfig = require('../config/zoom');
const zoomService = require('../services/zoomService');

const dryRun = process.argv.includes('--dry-run');

function argValue(flag) {
  const hit = process.argv.find((a) => a.startsWith(`${flag}=`));
  return hit ? hit.split('=').slice(1).join('=') : null;
}

function pmiPassword() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function missingSettingsScope(err) {
  const msg = String(err.response?.data?.message || err.message || '');
  return /user:update:settings/i.test(msg);
}

async function getZoomUser(email) {
  const token = await zoomService.getAccessToken();
  const res = await axios.get(`${zoomConfig.apiBaseUrl}/users/${encodeURIComponent(email)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data;
}

async function enablePmiSettings(zoomUserId, password) {
  const token = await zoomService.getAccessToken();
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  await axios.patch(
    `${zoomConfig.apiBaseUrl}/users/${encodeURIComponent(zoomUserId)}/settings`,
    {
      schedule_meeting: {
        personal_meeting: true,
        use_pmi_for_instant_meetings: true,
        use_pmi_for_scheduled_meetings: false,
        require_password_for_pmi_meetings: 'all'
      }
    },
    { headers }
  );

  await axios.patch(
    `${zoomConfig.apiBaseUrl}/users/${encodeURIComponent(zoomUserId)}/settings`,
    { meeting_security: { password_for_pmi: password } },
    { headers, params: { option: 'meeting_security' } }
  );
}

async function wakePmi(zoomUserId) {
  const token = await zoomService.getAccessToken();
  await axios.post(
    `${zoomConfig.apiBaseUrl}/users/${encodeURIComponent(zoomUserId)}/meetings`,
    {
      topic: 'Sky States LMS — PMI setup',
      type: 1,
      duration: 15,
      settings: {
        join_before_host: true,
        waiting_room: false,
        auto_recording: 'none'
      }
    },
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
  );
}

async function provisionFixedRoom(zoomUserId) {
  if (dryRun) {
    const existing = await zoomService.listFixedMeetingRooms(zoomUserId);
    if (existing[0]?.id) {
      return { success: true, mode: 'fixed-room', pmi: existing[0].id, dryRun: true };
    }
    return { dryRun: true, mode: 'fixed-room', wouldCreate: true };
  }

  const room = await zoomService.ensureFixedMeetingRoom(zoomUserId);
  return {
    success: true,
    mode: 'fixed-room',
    pmi: room.id,
    password: room.password || '',
    note: 'Stable type-3 recurring room (PMI settings scope not available on S2S app)'
  };
}

async function provisionPmi(zoomUserId) {
  const before = await getZoomUser(zoomUserId);
  if (String(before.status || '').toLowerCase() !== 'active') {
    return { skipped: true, reason: `status=${before.status || 'unknown'}` };
  }
  if (before.type !== 2) {
    return { skipped: true, reason: `type=${before.type} (not licensed)` };
  }
  if (before.pmi) {
    return { skipped: true, reason: 'already has PMI', pmi: before.pmi, mode: 'native-pmi' };
  }

  const password = pmiPassword();
  if (dryRun) {
    return { dryRun: true, wouldSetPassword: password };
  }

  try {
    await enablePmiSettings(zoomUserId, password);
    try {
      await wakePmi(zoomUserId);
    } catch (err) {
      console.warn(`  instant PMI wake failed for ${zoomUserId}:`, err.response?.data?.message || err.message);
    }

    const after = await getZoomUser(zoomUserId);
    if (after.pmi) {
      return { success: true, mode: 'native-pmi', pmi: after.pmi, password: after.pmi_password || password };
    }

    return {
      partial: true,
      mode: 'native-pmi',
      note: 'PMI settings enabled; number may appear after trainer signs in to zoom.us once',
      password
    };
  } catch (err) {
    if (!missingSettingsScope(err)) {
      throw err;
    }
    return provisionFixedRoom(zoomUserId);
  }
}

async function main() {
  const file = argValue('--file') || path.join(__dirname, 'trainers-zoom.prod.json');
  if (!fs.existsSync(file)) throw new Error(`File not found: ${file}`);
  if (!zoomService.isConfigured()) throw new Error('Zoom S2S not configured');

  const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
  const report = [];

  for (const row of rows) {
    const zoomUserId = String(row.zoomUserId || row.zoomEmail || '').trim();
    const lmsEmail = String(row.email || '').trim();
    if (!zoomUserId) continue;

    process.stdout.write(`→ ${lmsEmail} (${zoomUserId}) ... `);
    try {
      const result = await provisionPmi(zoomUserId);
      report.push({ lmsEmail, zoomUserId, ...result });
      if (result.skipped) console.log(`skip: ${result.reason}`);
      else if (result.success) console.log(`${result.mode || 'pmi'} ${result.pmi}`);
      else if (result.partial) console.log(`settings ok, PMI pending login`);
      else if (result.dryRun) console.log('dry-run');
      else console.log(JSON.stringify(result));
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      report.push({ lmsEmail, zoomUserId, error: msg });
      console.log(`error: ${msg}`);
    }
  }

  console.log('\n' + JSON.stringify({ dryRun, report }, null, 2));
}

main().catch((err) => {
  console.error('FATAL', err.response?.data || err);
  process.exit(1);
});
