/**
 * Backfill persistent SS_US_##### form numbers onto all students.
 * Usage:
 *   node scripts/backfillFormNumbers.js           # apply (full resequence from 11001)
 *   node scripts/backfillFormNumbers.js --dry-run
 *   node scripts/backfillFormNumbers.js --fill-gaps-only
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const { planFormNumberBackfill, SERIES_START } = require('../utils/reportFormNumber');

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const forceResequence = !process.argv.includes('--fill-gaps-only');

  const user = process.env.MONGODB_USERNAME;
  const pass = process.env.MONGODB_PASSWORD;
  const cluster = process.env.MONGODB_CLUSTER;
  const db = process.env.MONGODB_DATABASE || process.env.MONGO_DB_NAME || 'lms';
  const uri =
    process.env.MONGODB_URI ||
    `mongodb+srv://${user}:${encodeURIComponent(pass)}@${cluster}/${db}?retryWrites=true&w=majority`;

  console.log('DB:', db, '| dryRun:', dryRun, '| forceResequence:', forceResequence);
  await mongoose.connect(uri);

  const students = await User.find({ role: 'student' })
    .select('name email formNumber createdAt joiningDate')
    .lean();

  const { assignments, nextSeries } = planFormNumberBackfill(students, { forceResequence });
  const toWrite = assignments.filter((a) => !a.skipped);

  console.log('Total students:', students.length);
  console.log('To update:', toWrite.length);
  console.log('Skipped:', assignments.filter((a) => a.skipped).length);
  console.log('Series start:', SERIES_START, '| next after backfill:', nextSeries);
  console.log('Sample:');
  assignments.slice(0, 8).forEach((a) => {
    console.log(`  ${a.formNumber}  ${a.email}${a.skipped ? ' (keep)' : ''}`);
  });

  if (!dryRun) {
    for (const row of toWrite) {
      await User.findByIdAndUpdate(row.id, { $set: { formNumber: row.formNumber } });
    }
    console.log(`Applied ${toWrite.length} form number(s).`);
  } else {
    console.log('Dry run — no changes written.');
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
