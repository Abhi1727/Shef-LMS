#!/usr/bin/env node
/**
 * Migrate trainer emails @lms.skystates.us → @skystates.us
 *
 * Usage:
 *   ENV_PATH=.env.dev FIRESTORE_DATABASE=lms-dev node scripts/migrateTrainerEmails.js
 *   ENV_PATH=.env FIRESTORE_DATABASE=lms-prod node scripts/migrateTrainerEmails.js
 *   node scripts/migrateTrainerEmails.js --both
 */
const path = require('path');
const dotenv = require('dotenv');

const OLD_DOMAIN = '@lms.skystates.us';
const NEW_DOMAIN = '@skystates.us';

function loadUserModel(database) {
  process.env.USE_FIRESTORE = 'true';
  process.env.FIRESTORE_DATABASE = database;
  delete require.cache[require.resolve('../services/firestoreDb')];
  require('../services/firestoreDb');
  delete require.cache[require.resolve('../models/User')];
  return require('../models/User');
}

function newEmail(email) {
  const e = String(email || '').trim().toLowerCase();
  if (!e.endsWith(OLD_DOMAIN)) return null;
  return e.slice(0, -OLD_DOMAIN.length) + NEW_DOMAIN;
}

async function migrateDatabase(label, database) {
  const User = loadUserModel(database);
  await new Promise((r) => setTimeout(r, 2500));

  const teachers = await User.find({ role: 'teacher' }).exec();
  let updated = 0;
  let skipped = 0;

  for (const teacher of teachers) {
    const next = newEmail(teacher.email);
    if (!next) {
      skipped++;
      continue;
    }

    const clash = await User.findOne({ email: next }).lean().exec();
    if (clash && String(clash._id || clash.id) !== String(teacher._id || teacher.id)) {
      console.warn(`⚠️  ${label}: skip ${teacher.email} → ${next} (email taken)`);
      skipped++;
      continue;
    }

    teacher.email = next;
    teacher.updatedAt = new Date();
    await teacher.save();
    console.log(`✅ ${label}: ${teacher.name} → ${next}`);
    updated++;
  }

  console.log(`${label} done: updated ${updated}, skipped ${skipped}`);
  return { updated, skipped };
}

async function main() {
  const both = process.argv.includes('--both');
  const envPath = process.env.ENV_PATH || '.env';
  dotenv.config({ path: path.join(__dirname, '..', envPath) });

  if (both) {
    await migrateDatabase('lms-prod', 'lms-prod');
    await migrateDatabase('lms-dev', 'lms-dev');
  } else {
    const db = process.env.FIRESTORE_DATABASE || 'lms-dev';
    await migrateDatabase(db, db);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
