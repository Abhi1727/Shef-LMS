#!/usr/bin/env node
/**
 * Copy Firestore collections lms-prod → lms-dev (same project skystateslms).
 *
 * Default: essential LMS data only (no activity logs, sent emails, OTPs, etc.)
 *
 * Usage:
 *   ENV_PATH=.env node scripts/cloneFirestoreProdToDev.js --yes
 *   ENV_PATH=.env node scripts/cloneFirestoreProdToDev.js --all --yes
 *   ENV_PATH=.env node scripts/cloneFirestoreProdToDev.js --collections=users,batches --yes
 */
const path = require('path');
const dotenv = require('dotenv');

const envPath = process.env.ENV_PATH || '.env';
dotenv.config({ path: path.join(__dirname, '..', envPath) });

/** Core data needed to run and test LMS on DEV */
const ESSENTIAL_COLLECTIONS = [
  'users',
  'batches',
  'classrooms',
  'liveclasses',
  'courses',
  'modules',
  'lessons',
  'assessments',
  'questions',
  'assessmentattempts',
  'certificates',
  'batch_materials',
  'student_shares',
  'onetoonebatches',
  'onetoones',
  'projects',
  'jobs',
  'conversations',
  'resources',
  'resourcecategories',
  'userProgress',
  'counters',
  'content'
];

/** Skipped by default — high volume or not needed for DEV testing */
const OPTIONAL_COLLECTIONS = [
  'activitylogs',
  'sentemails',
  'passwordotps',
  'generatednotes',
  'knowledgesources',
  'knowledgechunks',
  'studentquestions',
  'studentnotes',
  'studentbookmarks'
];

const ALL_COLLECTIONS = [...ESSENTIAL_COLLECTIONS, ...OPTIONAL_COLLECTIONS];

function loadFsDb(database) {
  process.env.FIRESTORE_DATABASE = database;
  delete require.cache[require.resolve('../services/firestoreDb')];
  return require('../services/firestoreDb');
}

function parseArgs() {
  const yes = process.argv.includes('--yes');
  const all = process.argv.includes('--all');
  const colArg = process.argv.find((a) => a.startsWith('--collections='));
  let collections;
  if (colArg) {
    collections = colArg.split('=')[1].split(',').map((s) => s.trim()).filter(Boolean);
  } else if (all) {
    collections = ALL_COLLECTIONS;
  } else {
    collections = ESSENTIAL_COLLECTIONS;
  }
  return { yes, all, collections };
}

async function copyCollection(prodDb, devDb, name) {
  const docs = await prodDb.listCollection(name);
  let written = 0;
  for (const doc of docs) {
    const id = String(doc._mongoId || doc._id || doc.id || '').trim();
    if (!id) continue;
    const plain = { ...doc };
    delete plain._id;
    delete plain.id;
    plain._mongoId = id;
    plain._clonedFrom = 'lms-prod';
    plain._clonedAt = new Date();
    await devDb.setDoc(name, id, plain);
    written++;
    if (written % 50 === 0) process.stdout.write(`  ${name}: ${written}/${docs.length}\r`);
  }
  if (docs.length) process.stdout.write('\n');
  return { name, count: written };
}

async function main() {
  const { yes, all, collections } = parseArgs();
  if (!yes) {
    console.error('Refusing to overwrite lms-dev without --yes');
    process.exit(1);
  }

  const prodDb = loadFsDb('lms-prod');
  const devDb = loadFsDb('lms-dev');

  console.log('Cloning Firestore lms-prod → lms-dev');
  console.log(`Mode: ${all ? 'ALL collections' : 'essential only (no activity logs)'}`);
  if (!all) {
    console.log('Skipped:', OPTIONAL_COLLECTIONS.join(', '));
  }
  console.log('Copying:', collections.join(', '));

  const summary = [];
  for (const name of collections) {
    try {
      const result = await copyCollection(prodDb, devDb, name);
      console.log(`✅ ${result.name}: ${result.count} docs`);
      summary.push(result);
    } catch (err) {
      console.error(`❌ ${name}:`, err.message || err);
      summary.push({ name, error: err.message || String(err) });
    }
  }

  const total = summary.reduce((n, s) => n + (s.count || 0), 0);
  console.log(`\nDone. ${summary.filter((s) => s.count).length} collections, ${total} docs copied`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
