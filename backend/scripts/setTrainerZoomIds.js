#!/usr/bin/env node
/**
 * Set per-trainer Zoom user IDs and conference provider in Firestore/Mongo.
 *
 * Usage:
 *   ENV_PATH=.env.dev node scripts/setTrainerZoomIds.js --file=trainers-zoom.json
 *   ENV_PATH=.env node scripts/setTrainerZoomIds.js --file=trainers-zoom.json
 *
 * JSON format (array):
 * [
 *   { "email": "trainer@skystates.us", "zoomUserId": "abc123XYZ", "conferenceProvider": "zoom" },
 *   { "name": "Ravi Kumar", "zoomUserId": "def456", "conferenceProvider": "zoom" }
 * ]
 */
const fs = require('fs');
const path = require('path');

const envPath = process.env.ENV_PATH || '.env';
require('dotenv').config({ path: path.join(__dirname, '..', envPath) });

const User = require('../models/User');

function argValue(flag) {
  const hit = process.argv.find((a) => a.startsWith(`${flag}=`));
  return hit ? hit.split('=').slice(1).join('=') : null;
}

async function main() {
  const file = argValue('--file');
  if (!file || !fs.existsSync(file)) {
    console.error('Usage: node scripts/setTrainerZoomIds.js --file=trainers-zoom.json');
    process.exit(1);
  }

  await require('../config/dataStore').connectDataStore();

  const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(rows)) {
    console.error('JSON file must be an array of { email|name, zoomUserId, conferenceProvider? }');
    process.exit(1);
  }

  const teachers = await User.find({
    role: { $in: ['teacher', 'instructor', 'mentor'] }
  })
    .select('name email conferenceProvider zoomUserId role')
    .exec();

  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const email = String(row.email || '').trim().toLowerCase();
    const name = String(row.name || '').trim().toLowerCase();
    const zoomUserId = String(row.zoomUserId || '').trim();
    const provider = row.conferenceProvider === 'meet' ? 'meet' : 'zoom';

    if (!zoomUserId && provider === 'zoom') {
      console.warn('⚠️  Skipping row without zoomUserId:', row);
      skipped += 1;
      continue;
    }

    const match = teachers.find((t) => {
      const tEmail = String(t.email || '').trim().toLowerCase();
      const tName = String(t.name || '').trim().toLowerCase();
      if (email && tEmail === email) return true;
      if (name && tName === name) return true;
      return false;
    });

    if (!match) {
      console.warn('⚠️  No teacher matched:', row);
      skipped += 1;
      continue;
    }

    match.conferenceProvider = provider;
    match.zoomUserId = zoomUserId;
    match.updatedAt = new Date();
    await match.save();
    updated += 1;
    console.log(`✅ ${match.name} (${match.email}) → ${provider}${zoomUserId ? ` · ${zoomUserId}` : ''}`);
  }

  console.log(`\nDone. Updated ${updated}, skipped ${skipped}. DB=${process.env.FIRESTORE_DATABASE || 'mongo'}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
