#!/usr/bin/env node
/**
 * Repair Zoom recording attachments on shared PMI rooms.
 * Clears wrong assignments and re-syncs oldest-first with tightened time matching.
 *
 * Usage (prod container):
 *   node scripts/repairZoomRecordings.js --dry-run
 *   node scripts/repairZoomRecordings.js --since=2026-08-20
 *   node scripts/repairZoomRecordings.js --since=2026-08-20 --force-all
 */
require('dotenv').config({ path: process.env.ENV_PATH || '.env' });

const LiveClass = require('../models/LiveClass');
const Classroom = require('../models/Classroom');
const zoomService = require('../services/zoomService');
const {
  pickBestMp4,
  sessionAnchorTimes,
  syncZoomRecordings,
  fetchZoomRecordingsForSession
} = require('../services/zoomRecordingSync');
const { ensureClassroomFromLiveClass } = require('../services/classroomFromLiveClass');

function arg(name, fallback = '') {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : fallback;
}

const dryRun = process.argv.includes('--dry-run');
const forceAll = process.argv.includes('--force-all');
const since = arg('since', '2026-08-20');
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

function pickFile(pick) {
  if (!pick || pick.ambiguous) return null;
  return pick.file || null;
}

async function findSessionsToRepair() {
  const sessions = await LiveClass.find({
    conferenceProvider: 'zoom',
    skipRecordingUpload: { $ne: true },
    batchId: { $nin: ['', null] },
    zoomMeetingId: { $nin: ['', null] },
    scheduledStart: { $gte: sinceDate }
  })
    .sort({ scheduledStart: 1 })
    .lean()
    .exec();

  const byPmi = new Map();
  for (const s of sessions) {
    const pmi = String(s.zoomMeetingId);
    if (!byPmi.has(pmi)) byPmi.set(pmi, []);
    byPmi.get(pmi).push(s);
  }

  const toRepair = new Map();
  const reasons = new Map();

  const mark = (id, reason) => {
    toRepair.set(String(id), true);
    const prev = reasons.get(String(id)) || [];
    if (!prev.includes(reason)) prev.push(reason);
    reasons.set(String(id), prev);
  };

  for (const [, group] of byPmi) {
    if (group.length < 2 && !forceAll) continue;

    const recIdCounts = new Map();
    for (const s of group) {
      if (s.zoomRecordingId) {
        const k = String(s.zoomRecordingId);
        recIdCounts.set(k, (recIdCounts.get(k) || 0) + 1);
      }
    }
    for (const s of group) {
      if (s.zoomRecordingId && recIdCounts.get(String(s.zoomRecordingId)) > 1) {
        mark(s._id, 'duplicate-zoomRecordingId');
      }
    }

    let recordings = [];
    try {
      const result = await fetchZoomRecordingsForSession(group[0], { since: sinceDate });
      recordings = result.recordings || [];
    } catch (err) {
      for (const s of group) {
        if (s.youtubeVideoId || s.zoomRecordingId) {
          mark(s._id, `zoom-api-error:${err.message || err}`);
        }
      }
      continue;
    }

    const used = new Set();
    for (const s of group) {
      if (!s.youtubeVideoId && !s.zoomRecordingId) continue;

      const { start, end } = sessionAnchorTimes(s);
      const pick = pickBestMp4(recordings, {
        sessionStart: start,
        sessionEnd: end,
        usedRecordingIds: used
      });
      const file = pickFile(pick);

      if (pick?.ambiguous) {
        mark(s._id, 'ambiguous-match');
      } else if (!file) {
        if (s.zoomRecordingId) mark(s._id, 'no-recording-in-window');
      } else if (String(s.zoomRecordingId || '') !== String(file.id || '')) {
        mark(s._id, `wrong-recording:${s.zoomRecordingId}->${file.id}`);
      }

      if (file?.id) used.add(String(file.id));
    }
  }

  if (forceAll) {
    for (const s of sessions) {
      if (s.youtubeVideoId || s.zoomRecordingId) {
        mark(s._id, 'force-all');
      }
    }
  }

  return {
    sessions,
    repairIds: [...toRepair.keys()],
    reasons
  };
}

(async () => {
  console.log(`Zoom recording repair since ${since}${dryRun ? ' [DRY RUN]' : ''}${forceAll ? ' [FORCE ALL]' : ''}`);

  const { sessions, repairIds, reasons } = await findSessionsToRepair();
  console.log(`Sessions scanned: ${sessions.length}`);
  console.log(`To repair: ${repairIds.length}`);

  if (!repairIds.length) {
    console.log('No repairs needed.');
    process.exit(0);
  }

  for (const id of repairIds) {
    const s = sessions.find((x) => String(x._id) === String(id));
    console.log(`- ${id} | ${s?.title || '?'} | ${(reasons.get(id) || []).join(', ')}`);
  }

  if (dryRun) {
    console.log('\nDry run complete. Re-run without --dry-run to apply.');
    process.exit(0);
  }

  let cleared = 0;
  for (const id of repairIds) {
    const live = await LiveClass.findById(id).exec();
    if (!live) continue;
    await clearRecordingFields(live);
    cleared += 1;
  }
  console.log(`\nCleared ${cleared} sessions. Re-syncing...`);

  const result = await syncZoomRecordings();
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
