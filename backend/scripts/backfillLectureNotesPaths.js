/**
 * Repair classroom lecture notes paths when files exist on disk under a different name.
 * Optionally uploads matched files to Google Drive and stores notesDriveId.
 *
 * Usage:
 *   ENV_PATH=.env node scripts/backfillLectureNotesPaths.js
 *   ENV_PATH=.env node scripts/backfillLectureNotesPaths.js --teacher=surendra@skystates.us
 *   ENV_PATH=.env node scripts/backfillLectureNotesPaths.js --dry-run
 */
const dotenv = require('dotenv');
dotenv.config({ path: process.env.ENV_PATH || '.env' });

const path = require('path');
const Classroom = require('../models/Classroom');
const Batch = require('../models/Batch');
const User = require('../models/User');
const { findLocalNotesFile, resolveNotesAbsolutePath } = require('../utils/notesDownload');
const { persistNotesToDrive } = require('../services/notesStorage');

const dryRun = process.argv.includes('--dry-run');
const teacherArg = process.argv.find((a) => a.startsWith('--teacher='));
const teacherEmail = teacherArg ? teacherArg.split('=')[1] : '';

function toUploadPath(absPath) {
  const rel = path.relative(path.join(__dirname, '..'), absPath).replace(/\\/g, '/');
  return `/${rel}`;
}

async function main() {
  await require('../config/dataStore').connectDataStore();

  let batchIds = null;
  if (teacherEmail) {
    const teacher = await User.findOne({ email: teacherEmail }).lean().exec();
    if (!teacher) throw new Error(`Teacher not found: ${teacherEmail}`);
    const batches = await Batch.find({ teacherId: String(teacher._id) }).lean().exec();
    batchIds = batches.map((b) => String(b._id));
    console.log(`Teacher ${teacher.name}: ${batches.length} batches`);
  }

  const query = { notesAvailable: true };
  if (batchIds) query.batchId = { $in: batchIds };
  const lectures = await Classroom.find(query).lean().exec();

  const usedFiles = new Set();
  let fixed = 0;
  let driveUploaded = 0;
  let alreadyOk = 0;
  let missing = 0;

  for (const lecture of lectures) {
    const exact = lecture.notesFilePath ? resolveNotesAbsolutePath(lecture.notesFilePath) : null;
    if (exact && !exact.error) {
      alreadyOk += 1;
      usedFiles.add(exact.path);
      continue;
    }

    const found = findLocalNotesFile({
      notesFilePath: lecture.notesFilePath,
      notesFileName: lecture.notesFileName,
      title: lecture.title
    });
    if (found.error || usedFiles.has(found.path)) {
      missing += 1;
      continue;
    }

    const newPath = toUploadPath(found.path);
    usedFiles.add(found.path);
    console.log(`FIX ${lecture.title}`);
    console.log(`  was: ${lecture.notesFilePath}`);
    console.log(`  now: ${newPath} (score ${found.score || 'exact'})`);

    let drivePatch = {};
    if (!lecture.notesDriveId) {
      if (!dryRun) {
        drivePatch = await persistNotesToDrive({
          file: { path: found.path, originalname: lecture.notesFileName || path.basename(found.path) },
          batchId: lecture.batchId,
          lectureTitle: lecture.title
        });
        if (drivePatch.notesDriveId) {
          driveUploaded += 1;
          console.log(`  drive: ${drivePatch.notesDriveId}`);
        }
      } else {
        console.log('  drive: (dry-run skip upload)');
      }
    }

    if (!dryRun) {
      await Classroom.findByIdAndUpdate(lecture._id, {
        notesFilePath: newPath,
        notesAvailable: true,
        ...drivePatch,
        updatedAt: new Date()
      }).exec();
    }
    fixed += 1;
  }

  console.log('\nSummary');
  console.log(`  lectures checked: ${lectures.length}`);
  console.log(`  already ok:       ${alreadyOk}`);
  console.log(`  paths repaired:   ${fixed}`);
  console.log(`  drive uploaded:   ${driveUploaded}`);
  console.log(`  still missing:    ${missing}`);
  if (dryRun) console.log('(dry-run — no database changes made)');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
