#!/usr/bin/env node
/**
 * Resend Zoom activation invites (or create licensed users) for LMS trainers,
 * then smoke-test PMI + host token for live classes.
 *
 *   ENV_PATH=.env node scripts/resendTrainerZoomInvites.js --file=scripts/trainers-zoom.prod.json
 *   ENV_PATH=.env node scripts/resendTrainerZoomInvites.js --file=scripts/trainers-zoom.prod.json --dry-run
 */
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const envPath = process.env.ENV_PATH
  ? path.resolve(process.cwd(), process.env.ENV_PATH)
  : path.resolve(__dirname, '../.env');
require('dotenv').config({ path: envPath });
if (!process.env.ZOOM_ENABLED) process.env.ZOOM_ENABLED = 'true';

const User = require('../models/User');
const zoomConfig = require('../config/zoom');
const zoomService = require('../services/zoomService');

const TYPE_LABEL = { 1: 'Basic', 2: 'Licensed', 3: 'On-prem' };

function argValue(flag) {
  const hit = process.argv.find((a) => a.startsWith(`${flag}=`));
  return hit ? hit.split('=').slice(1).join('=') : null;
}

const dryRun = process.argv.includes('--dry-run');

async function getZoomUser(email) {
  const token = await zoomService.getAccessToken();
  try {
    const res = await axios.get(
      `${zoomConfig.apiBaseUrl}/users/${encodeURIComponent(email)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return { ok: true, user: res.data };
  } catch (err) {
    if (err.response?.status === 404) return { ok: false, notFound: true };
    throw err;
  }
}

async function createLicensedUser({ email, firstName, lastName }) {
  const token = await zoomService.getAccessToken();
  const res = await axios.post(
    `${zoomConfig.apiBaseUrl}/users`,
    {
      action: 'create',
      user_info: {
        email,
        type: 2,
        first_name: firstName || 'Trainer',
        last_name: lastName || 'SkyStates'
      }
    },
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
  );
  return res.data;
}

async function deleteZoomUser(emailOrId) {
  const token = await zoomService.getAccessToken();
  await axios.delete(`${zoomConfig.apiBaseUrl}/users/${encodeURIComponent(emailOrId)}`, {
    headers: { Authorization: `Bearer ${token}` },
    params: { action: 'delete' }
  });
}

async function resendInviteByRecreate({ email, firstName, lastName }) {
  const existing = await getZoomUser(email);
    if (existing.ok) {
      const status = String(existing.user.status || '').toLowerCase();
      if (status === 'pending' || status === 'inactive') {
        try {
          const userId = existing.user.id || email;
          await deleteZoomUser(userId);
        } catch (delErr) {
          const msg = String(delErr.response?.data?.message || delErr.message || '');
          if (/does not exist|not found/i.test(msg)) {
            return { invited: false, pending: true, note: 'Activation email already sent — check @skystates.us inbox (and spam)' };
          }
          throw delErr;
        }
      } else {
        return { skipped: true, reason: 'already active' };
      }
    }
    try {
      await createLicensedUser({ email, firstName, lastName });
    } catch (createErr) {
      const msg = String(createErr.response?.data?.message || createErr.message || '');
      if (/already|exist/i.test(msg)) {
        return { invited: false, pending: true, note: 'User already invited — check @skystates.us inbox (and spam)' };
      }
      throw createErr;
    }
    return { invited: true };
}

async function ensureLicensed(email) {
  const token = await zoomService.getAccessToken();
  await axios.patch(
    `${zoomConfig.apiBaseUrl}/users/${encodeURIComponent(email)}`,
    { type: 2 },
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
  );
}

async function smokeTestHost(zoomUserId) {
  const checks = { user: false, licensed: false, pmi: false, zak: false };
  const got = await getZoomUser(zoomUserId);
  if (!got.ok) return { ...checks, error: 'user not found' };
  checks.user = true;
  checks.licensed = got.user.type === 2;
  checks.pmi = Boolean(got.user.pmi);
  try {
    await zoomService.getZakToken(zoomUserId);
    checks.zak = true;
  } catch (err) {
    checks.zakError = err.message;
  }
  return checks;
}

async function main() {
  const file = argValue('--file') || path.join(__dirname, 'trainers-zoom.prod.json');
  if (!fs.existsSync(file)) throw new Error(`File not found: ${file}`);
  if (!zoomService.isConfigured()) throw new Error('Zoom S2S not configured');

  await require('../config/dataStore').connectDataStore();

  const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
  const teachers = await User.find({ role: { $in: ['teacher', 'instructor', 'mentor'] } })
    .select('name email zoomUserId conferenceProvider')
    .exec();

  const report = [];

  for (const row of rows) {
    const lmsEmail = String(row.email || '').trim().toLowerCase();
    const zoomEmail = String(row.zoomUserId || row.zoomEmail || '').trim().toLowerCase();
    if (!zoomEmail) continue;

    const teacher = teachers.find((t) => String(t.email || '').trim().toLowerCase() === lmsEmail);
    const name = teacher?.name || lmsEmail;
    const parts = String(name).trim().split(/\s+/);
    const firstName = parts[0] || 'Trainer';
    const lastName = parts.slice(1).join(' ') || 'SkyStates';

    const entry = { lmsEmail, zoomEmail, name, action: '', status: '', hostReady: false };

    try {
      let zoomUser = await getZoomUser(zoomEmail);

      if (!zoomUser.ok) {
        if (dryRun) {
          entry.action = 'would-create-and-invite';
          entry.status = 'pending';
        } else {
          await createLicensedUser({ email: zoomEmail, firstName, lastName });
          entry.action = 'created+invited';
          entry.status = 'pending';
        }
      } else {
        const u = zoomUser.user;
        const zoomStatus = String(u.status || 'active').toLowerCase();
        entry.status = zoomStatus;
        entry.zoomType = TYPE_LABEL[u.type] || u.type;

        if (zoomStatus === 'pending' || zoomStatus === 'inactive') {
          if (dryRun) {
            entry.action = 'would-delete-and-reinvite';
          } else {
            const result = await resendInviteByRecreate({ email: zoomEmail, firstName, lastName });
            if (result.invited) {
              entry.action = 'reinvited';
              entry.status = 'pending';
            } else if (result.pending) {
              entry.action = 'pending-invite-exists';
              entry.status = 'pending';
              entry.note = result.note;
            } else {
              entry.action = result.skipped ? 'active-skip-recreate' : 'reinvited';
              entry.status = result.skipped ? zoomStatus : 'pending';
            }
          }
        } else if (u.type !== 2) {
          if (dryRun) {
            entry.action = 'would-upgrade-to-licensed';
          } else {
            await ensureLicensed(zoomEmail);
            entry.action = 'upgraded-to-licensed';
          }
        } else {
          entry.action = 'active-licensed';
        }
      }

      if (!dryRun && entry.status !== 'pending') {
        const smoke = await smokeTestHost(zoomEmail);
        entry.hostReady = smoke.user && smoke.licensed && smoke.pmi && smoke.zak;
        entry.smoke = smoke;
        if (!entry.hostReady && smoke.user && smoke.licensed && !smoke.pmi) {
          entry.note = 'PMI missing — trainer should open Zoom once after activation';
        }
        if (!entry.hostReady && smoke.zakError) {
          entry.note = (entry.note ? entry.note + '; ' : '') + `ZAK: ${smoke.zakError}`;
        }
      }

      if (teacher && !dryRun) {
        teacher.zoomUserId = zoomEmail;
        teacher.conferenceProvider = 'zoom';
        teacher.updatedAt = new Date();
        await teacher.save();
      }
    } catch (err) {
      entry.action = 'error';
      entry.error = err.response?.data?.message || err.message;
    }

    report.push(entry);
    const icon = entry.error ? '❌' : entry.hostReady ? '✅' : entry.action.includes('invite') ? '📧' : '⚠️';
    console.log(
      `${icon} ${name} (${lmsEmail}) → ${zoomEmail}: ${entry.action}${entry.error ? ' — ' + entry.error : ''}`
    );
  }

  console.log('\n' + JSON.stringify({ dryRun, report }, null, 2));
  const invited = report.filter((r) => /invite|created/.test(r.action)).length;
  const ready = report.filter((r) => r.hostReady).length;
  console.log(`\nSummary: ${invited} invite(s) sent/queued, ${ready}/${report.length} ready to host in LMS now.`);
  if (invited) {
    console.log('Trainers must open the Zoom email at their @skystates.us inbox (check spam) and activate.');
  }
}

main().catch((err) => {
  console.error('FATAL', err.response?.data || err);
  process.exit(1);
});
