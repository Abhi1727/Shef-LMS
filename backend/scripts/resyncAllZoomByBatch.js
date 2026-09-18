#!/usr/bin/env node
/**
 * Full PMI-group resync: clear all Zoom recording fields for batch sessions,
 * then re-attach cloud recordings oldest-first with batch-aware matching.
 *
 * Usage (prod container):
 *   node scripts/resyncAllZoomByBatch.js --dry-run
 *   node scripts/resyncAllZoomByBatch.js --since=2026-08-01
 */
require('dotenv').config({ path: process.env.ENV_PATH || '.env' });

const LiveClass = require('../models/LiveClass');
const Classroom = require('../models/Classroom');
const zoomService = require('../services/zoomService');
const { syncOneZoomRecording, fetchZoomRecordingsForSession } = require('../services/zoomRecordingSync');
const { ensureClassroomFromLiveClass } = require('../services/classroomFromLiveClass');

function arg(name, fallback = '') {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : fallback;
}

const dryRun = process.argv.includes('--dry-run');
const since = arg('since', '2026-08-01');
const sinceDate = new Date(`${since}T00:00:00.000Z`);

async function clearRecordingFields(live) {
  live.zoomRecordingId = '';
  live.youtubeVideoId = '';
  live.youtubeVideoUrl = '';
  live.youtubeEmbedUrl = '';
  live.driveFileId = '';
  live.driveLink = '';
  live.recordingPipelineStatus = '';
  live.recordingSyncError = '';
  live.recordingUploadedAt = null;
  live.recordingSyncAt = null;
  live.updatedAt = new Date();
  await live.save();

  if (live.classroomLectureId) {
    const lecture = await Classroom.findById(live.classroomLectureId).exec();
    if (lecture) {
      lecture.youtubeVideoId = '';
      lecture.youtubeVideoUrl = '';
      lecture.youtubeEmbedUrl = '';
      lecture.driveId = '';
      lecture.zoomUrl = '';
      lecture.videoSource = 'pending';
      lecture.updatedAt = new Date();
      await lecture.save();
    }
  }

  await ensureClassroomFromLiveClass(live, { videoSource: 'pending' });
}

(async () => {
  console.log(`Full Zoom batch resync since ${since}${dryRun ? ' [DRY RUN]' : ''}`);

  const sessions = await LiveClass.find({
    conferenceProvider: 'zoom',
    skipRecordingUpload: { $ne: true },
    batchId: { $nin: ['', null] },
    zoomMeetingId: { $nin: ['', null] },
    status: { $nin: ['cancelled'] },
    scheduledStart: { $gte: sinceDate }
  })
    .sort({ scheduledStart: 1 })
    .exec();

  const byPmi = new Map();
  for (const s of sessions) {
    const pmi = String(s.zoomMeetingId);
    if (!byPmi.has(pmi)) byPmi.set(pmi, []);
    byPmi.get(pmi).push(s);
  }

  const pmiWithRecordings = [];
  for (const [pmi, group] of byPmi) {
    try {
      const sample = group[0];
      const result = await fetchZoomRecordingsForSession(sample, { since: sinceDate });
      const mp4s = (result.recordings || []).filter(
        (f) => String(f.fileType || '').toUpperCase() === 'MP4' && f.downloadUrl
      );
      if (mp4s.length) {
        pmiWithRecordings.push({ pmi, group, mp4Count: mp4s.length });
      }
    } catch (_) {
      /* PMI has no cloud recordings API access */
    }
  }

  const toClear = new Set();
  for (const { group } of pmiWithRecordings) {
    for (const s of group) {
      if (s.status === 'completed' || s.status === 'live' || s.youtubeVideoId || s.zoomRecordingId) {
        toClear.add(String(s._id));
      }
    }
  }

  console.log(`Sessions scanned: ${sessions.length}`);
  console.log(`PMI rooms with cloud recordings: ${pmiWithRecordings.length}`);
  console.log(`Sessions to clear and re-sync: ${toClear.size}`);

  if (!toClear.size) {
    console.log('Nothing to resync.');
    process.exit(0);
  }

  if (dryRun) {
    for (const { pmi, group, mp4Count } of pmiWithRecordings) {
      const eligible = group.filter((s) => toClear.has(String(s._id)));
      console.log(`- PMI ${pmi}: ${eligible.length} sessions, ${mp4Count} MP4s in Zoom cloud`);
    }
    console.log('\nDry run complete. Re-run without --dry-run to apply.');
    process.exit(0);
  }

  let cleared = 0;
  for (const id of toClear) {
    const live = await LiveClass.findById(id).exec();
    if (!live) continue;
    await clearRecordingFields(live);
    cleared += 1;
  }
  console.log(`Cleared ${cleared} sessions. Uploading oldest-first...`);

  const toSync = sessions
    .filter((s) => toClear.has(String(s._id)))
    .sort((a, b) => new Date(a.scheduledStart) - new Date(b.scheduledStart));

  const result = { synced: [], pending: [], errors: [] };
  for (const doc of toSync) {
    try {
      const out = await syncOneZoomRecording(doc);
      const row = { id: String(doc._id), title: doc.title, batchId: doc.batchId, ...out };
      if (out.synced) result.synced.push(row);
      else if (out.pending) result.pending.push(row);
      else if (out.failed) result.errors.push(row);
      else if (out.skipped) result.pending.push({ ...row, reason: out.reason || 'skipped' });
      console.log(
        `[${out.synced ? 'OK' : out.pending ? 'PENDING' : 'SKIP'}] ${doc.title} (${String(doc._id).slice(-6)})`
      );
    } catch (err) {
      const message = err.message || String(err);
      result.errors.push({ id: String(doc._id), reason: message });
      console.error(`[ERR] ${doc.title}: ${message}`);
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Synced: ${result.synced.length}`);
  console.log(`Pending/skipped: ${result.pending.length}`);
  console.log(`Errors: ${result.errors.length}`);
  process.exit(result.errors.length ? 1 : 0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
