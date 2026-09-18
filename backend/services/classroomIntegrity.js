/**
 * Classroom pipeline integrity helpers.
 * Keeps LiveClass ↔ Classroom batch alignment and student visibility healthy.
 */
const LiveClass = require('../models/LiveClass');
const Classroom = require('../models/Classroom');
const { ensureClassroomFromLiveClass } = require('./classroomFromLiveClass');
const logger = require('../utils/logger');

function isPlayable(lec) {
  return Boolean(
    lec?.youtubeVideoId || lec?.youtubeEmbedUrl || lec?.youtubeVideoUrl || lec?.driveId
  );
}

function liveHasMedia(live) {
  return Boolean(live?.youtubeVideoId || live?.driveFileId);
}

function isTestLike(title) {
  return /^(test|demo|trial|upii|testing|sample)\b/i.test(String(title || '').trim());
}

/**
 * Publish playable lectures that are incorrectly hidden from students.
 */
async function publishHiddenPlayable({ skipTestTitles = true, limit = 200 } = {}) {
  const hidden = await Classroom.find({
    studentVisible: false,
    $or: [
      { youtubeVideoId: { $nin: ['', null] } },
      { driveId: { $nin: ['', null] } },
      { youtubeEmbedUrl: { $nin: ['', null] } },
      { youtubeVideoUrl: { $nin: ['', null] } }
    ]
  })
    .limit(limit)
    .exec();

  let published = 0;
  for (const lec of hidden) {
    if (!isPlayable(lec)) continue;
    if (skipTestTitles && isTestLike(lec.title)) continue;
    lec.studentVisible = true;
    lec.updatedAt = new Date();
    await lec.save();
    published += 1;
  }
  return { scanned: hidden.length, published };
}

/**
 * Align Classroom.batchId with linked LiveClass.batchId when they diverge.
 */
async function fixClassroomBatchMismatches({ limit = 300 } = {}) {
  const withLive = await Classroom.find({
    liveClassId: { $nin: ['', null] }
  })
    .limit(limit)
    .exec();

  let fixed = 0;
  for (const lec of withLive) {
    const live = await LiveClass.findById(lec.liveClassId)
      .select('batchId batchName title')
      .lean()
      .exec();
    if (!live?.batchId) continue;
    if (String(live.batchId) === String(lec.batchId || '')) continue;

    lec.batchId = String(live.batchId);
    if (live.batchName) lec.batchName = live.batchName;
    if (isPlayable(lec)) lec.studentVisible = true;
    lec.updatedAt = new Date();
    await lec.save();
    fixed += 1;
  }
  return { scanned: withLive.length, fixed };
}

/**
 * Ensure live sessions that already have media also have a classroom lecture.
 */
async function attachMissingClassrooms({ sinceDays = 45, limit = 120 } = {}) {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
  const lives = await LiveClass.find({
    scheduledStart: { $gte: since },
    batchId: { $nin: ['', null] },
    skipRecordingUpload: { $ne: true },
    status: { $nin: ['cancelled'] },
    $or: [
      { youtubeVideoId: { $nin: ['', null] } },
      { driveFileId: { $nin: ['', null] } }
    ]
  })
    .sort({ scheduledStart: -1 })
    .limit(limit)
    .exec();

  let attached = 0;
  let skipped = 0;
  for (const live of lives) {
    if (live.wasteSessionFlagged && !live.wasteSessionDismissedAt) {
      skipped += 1;
      continue;
    }
    if (!liveHasMedia(live)) {
      skipped += 1;
      continue;
    }

    let existing = null;
    if (live.classroomLectureId) {
      existing = await Classroom.findById(live.classroomLectureId).lean().exec();
    }
    if (!existing) {
      existing = await Classroom.findOne({ liveClassId: String(live._id) }).lean().exec();
    }

    const needsAttach =
      !existing ||
      !isPlayable(existing) ||
      String(existing.batchId || '') !== String(live.batchId) ||
      existing.studentVisible === false;

    if (!needsAttach) {
      skipped += 1;
      continue;
    }

    const room = await ensureClassroomFromLiveClass(live, {
      videoSource: live.youtubeVideoId ? 'youtube-url' : 'drive'
    });
    if (room) attached += 1;
    else skipped += 1;
  }
  return { scanned: lives.length, attached, skipped };
}

/**
 * Full integrity sweep used by cron + manual scripts.
 */
async function runClassroomIntegritySweep(opts = {}) {
  const started = Date.now();
  const published = await publishHiddenPlayable(opts.publish || {});
  const batches = await fixClassroomBatchMismatches(opts.batches || {});
  const attached = await attachMissingClassrooms(opts.attach || {});
  const result = {
    published,
    batches,
    attached,
    durationMs: Date.now() - started
  };
  logger.info('Classroom integrity sweep complete', result);
  return result;
}

module.exports = {
  isPlayable,
  liveHasMedia,
  publishHiddenPlayable,
  fixClassroomBatchMismatches,
  attachMissingClassrooms,
  runClassroomIntegritySweep
};
