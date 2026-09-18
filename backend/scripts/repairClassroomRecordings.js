#!/usr/bin/env node
/**
 * Repair classroom recordings: publish playable lectures, fix batch mismatches,
 * and re-number order fields chronologically per batch.
 *
 *   node scripts/repairClassroomRecordings.js --dry-run
 */
require('dotenv').config({ path: process.env.ENV_PATH || '.env' });

const LiveClass = require('../models/LiveClass');
const Classroom = require('../models/Classroom');
const { sortLessons } = require('../services/lessonPath');

const dryRun = process.argv.includes('--dry-run');

function isPlayable(lec) {
  return Boolean(
    lec.youtubeVideoId ||
      lec.youtubeEmbedUrl ||
      lec.youtubeVideoUrl ||
      lec.driveId
  );
}

(async () => {
  console.log(`Classroom recording repair${dryRun ? ' [DRY RUN]' : ''}`);

  const playableHidden = await Classroom.find({
    studentVisible: false,
    $or: [
      { youtubeVideoId: { $nin: ['', null] } },
      { driveId: { $nin: ['', null] } }
    ]
  }).exec();

  let published = 0;
  for (const lec of playableHidden) {
    if (!isPlayable(lec)) continue;
    console.log(`Publish: ${lec.title} (${String(lec._id).slice(-6)})`);
    if (!dryRun) {
      lec.studentVisible = true;
      lec.updatedAt = new Date();
      await lec.save();
    }
    published += 1;
  }

  const withLive = await Classroom.find({
    liveClassId: { $nin: ['', null] },
    youtubeVideoId: { $nin: ['', null] }
  }).exec();

  let batchFixed = 0;
  for (const lec of withLive) {
    const live = await LiveClass.findById(lec.liveClassId).select('batchId title').lean().exec();
    if (!live?.batchId || String(live.batchId) === String(lec.batchId)) continue;
    console.log(`Fix batch: ${lec.title} | ${lec.batchId} -> ${live.batchId}`);
    if (!dryRun) {
      lec.batchId = String(live.batchId);
      lec.updatedAt = new Date();
      await lec.save();
    }
    batchFixed += 1;
  }

  const batchIds = await Classroom.distinct('batchId', {
    batchId: { $nin: ['', null] }
  });

  let reordered = 0;
  for (const batchId of batchIds) {
    const lectures = await Classroom.find({ batchId: String(batchId) }).exec();
    if (lectures.length < 2) continue;

    const sorted = sortLessons(lectures);
    let changed = false;
    sorted.forEach((lec, idx) => {
      const nextOrder = idx + 1;
      if (Number(lec.order) !== nextOrder) changed = true;
    });
    if (!changed) continue;

    console.log(`Reorder batch ${batchId}: ${lectures.length} lectures`);
    if (!dryRun) {
      for (let idx = 0; idx < sorted.length; idx++) {
        sorted[idx].order = idx + 1;
        sorted[idx].updatedAt = new Date();
        await sorted[idx].save();
      }
    }
    reordered += 1;
  }

  console.log('\n=== Summary ===');
  console.log(`Published hidden playable lectures: ${published}`);
  console.log(`Fixed batch mismatches: ${batchFixed}`);
  console.log(`Batches reordered by class date: ${reordered}`);
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
