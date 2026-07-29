#!/usr/bin/env node
/**
 * Backfill SKY_{MM}_{YYYY}_{series} enrollment numbers for all students.
 *
 * Usage:
 *   ENV_PATH=.env node scripts/backfillEnrollmentNumbers.js --dry-run
 *   ENV_PATH=.env node scripts/backfillEnrollmentNumbers.js --apply
 *   ENV_PATH=.env.dev MONGO_DB_NAME=shef-lms-dev node scripts/backfillEnrollmentNumbers.js --apply
 */

const path = require('path');
process.chdir(path.join(__dirname, '..'));

const { connectMongo, mongoose } = require('../config/mongo');
const User = require('../models/User');
const { planBackfill } = require('../utils/enrollmentNumber');

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || !args.includes('--apply');

  await connectMongo();
  const students = await User.find({ role: 'student' })
    .select('name email enrollmentNumber createdAt joiningDate')
    .lean();

  const { assignments, conflicts, nextSeries } = planBackfill(students);
  const toWrite = assignments.filter((a) => !a.skipped);

  console.log('=== Sky States enrollment backfill ===');
  console.log('Database:', process.env.MONGO_DB_NAME || process.env.MONGODB_DATABASE || '(default)');
  console.log('Mode:', dryRun ? 'DRY RUN (no writes)' : 'APPLY');
  console.log('Total students:', students.length);
  console.log('Would update / update:', toWrite.length);
  console.log('Already matching (skip):', assignments.filter((a) => a.skipped).length);
  console.log('Conflicts:', conflicts.length);
  console.log('Next series after backfill:', nextSeries);

  if (conflicts.length) {
    console.log('\n--- Conflicts (legacy numbers being replaced) ---');
    for (const c of conflicts) {
      console.log(`  ${c.email}: "${c.previousEnrollmentNumber}" -> "${c.newEnrollmentNumber}" (${c.reason})`);
    }
  }

  console.log('\n--- Sample assignments ---');
  for (const row of toWrite.slice(0, 8)) {
    console.log(`  ${row.enrollmentNumber}  ${row.email}`);
  }
  if (toWrite.length > 8) console.log(`  ... +${toWrite.length - 8} more`);

  if (!dryRun) {
    let updated = 0;
    for (const row of toWrite) {
      await User.findByIdAndUpdate(row.id, {
        $set: {
          enrollmentNumber: row.enrollmentNumber,
          joiningDate: row.joinDate ? new Date(row.joinDate) : undefined,
        },
      });
      updated += 1;
    }
    console.log(`\nUpdated ${updated} student(s).`);
  } else {
    console.log('\nRe-run with --apply to write changes.');
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
