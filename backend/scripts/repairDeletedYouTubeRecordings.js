#!/usr/bin/env node
/**
 * Re-upload recordings when YouTube videos were manually deleted but Drive archive remains.
 *
 *   node scripts/repairDeletedYouTubeRecordings.js --dry-run
 *   node scripts/repairDeletedYouTubeRecordings.js --since=2026-08-01
 */
require('dotenv').config({ path: process.env.ENV_PATH || '.env' });

const fs = require('fs');
const os = require('os');
const path = require('path');
const { google } = require('googleapis');
const LiveClass = require('../models/LiveClass');
const Batch = require('../models/Batch');
const Classroom = require('../models/Classroom');
const googleDriveService = require('../services/googleDriveService');
const youtubeService = require('../services/youtubeService');
const { syncOneZoomRecording } = require('../services/zoomRecordingSync');
const { ensureClassroomFromLiveClass } = require('../services/classroomFromLiveClass');
const { getLiveClassSettings } = require('../services/liveClassSettings');

const dryRun = process.argv.includes('--dry-run');
const sinceArg = process.argv.find((a) => a.startsWith('--since='));
const sinceDate = sinceArg
  ? new Date(`${sinceArg.split('=')[1]}T00:00:00.000Z`)
  : new Date('2026-08-01T00:00:00.000Z');
const TMP_DIR = path.join(os.tmpdir(), 'shef-lms-yt-repair');

async function youtubeVideoExists(videoId) {
  const id = String(videoId || '').trim();
  if (!id) return false;
  const yt = google.youtube({ version: 'v3', auth: youtubeService.oauth2Client });
  const res = await yt.videos.list({ part: ['status'], id: [id] });
  return Boolean(res.data.items?.length);
}

async function downloadDriveToFile(fileId, destPath) {
  const drive = await googleDriveService.getDriveClient();
  const media = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'stream' }
  );
  await new Promise((resolve, reject) => {
    const out = fs.createWriteStream(destPath);
    media.data.on('error', reject);
    out.on('error', reject);
    out.on('finish', resolve);
    media.data.pipe(out);
  });
  return fs.statSync(destPath).size;
}

async function reuploadFromDrive(live) {
  const batch = live.batchId
    ? await Batch.findById(live.batchId).select('name course').lean().exec()
    : null;
  const batchLabel = batch?.name || live.course || 'Batch';
  const settings = await getLiveClassSettings();

  if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
  const tmpPath = path.join(TMP_DIR, `repair-${live._id}-${Date.now()}.mp4`);

  try {
    await downloadDriveToFile(live.driveFileId, tmpPath);
    const yt = await youtubeService.uploadVideo(tmpPath, {
      title: `${batchLabel} · ${live.title || 'Live class recording'}`,
      description: [
        live.description || '',
        'Sky States LMS recording (re-uploaded after YouTube deletion)',
        `Batch: ${batchLabel}`,
        `Live class ID: ${String(live._id)}`,
        live.driveLink ? `Archive Drive: ${live.driveLink}` : ''
      ]
        .filter(Boolean)
        .join('\n'),
      courseType: live.course || batch?.course || '',
      instructor: live.teacherName || live.instructor || '',
      privacyStatus: settings.youtubePrivacy || 'unlisted',
      tags: ['sky-states', 'lms', 'live-class', live.course, batchLabel].filter(Boolean)
    });

    live.youtubeVideoId = yt.videoId;
    live.youtubeVideoUrl = yt.videoUrl;
    live.youtubeEmbedUrl = yt.embedUrl;
    live.recordingPipelineStatus = 'ready';
    live.recordingSyncError = '';
    live.recordingSyncAt = new Date();
    await live.save();

    await ensureClassroomFromLiveClass(live, {
      videoSource: 'youtube-url',
      driveFileId: live.driveFileId,
      driveLink: live.driveLink,
      youtubeVideoId: yt.videoId,
      youtubeVideoUrl: yt.videoUrl,
      youtubeEmbedUrl: yt.embedUrl
    });

    return { synced: true, youtubeVideoId: yt.videoId };
  } finally {
    try {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    } catch (_) {
      /* ignore */
    }
  }
}

(async () => {
  console.log(`Repair deleted YouTube recordings since ${sinceDate.toISOString().slice(0, 10)}${dryRun ? ' [DRY RUN]' : ''}`);

  const rows = await LiveClass.find({
    batchId: { $nin: ['', null] },
    scheduledStart: { $gte: sinceDate },
    youtubeVideoId: { $nin: ['', null] }
  })
    .sort({ scheduledStart: 1 })
    .exec();

  const broken = [];
  for (const live of rows) {
    const id = String(live.youtubeVideoId || '').trim();
    if (!id) continue;
    const exists = await youtubeVideoExists(id);
    if (!exists) broken.push(live);
  }

  console.log(`Checked ${rows.length} linked sessions — ${broken.length} deleted on YouTube`);

  const result = { driveReupload: [], zoomResync: [], skipped: [] };

  for (const live of broken) {
    const label = `${live.title} (${String(live._id).slice(-6)})`;
    if (live.driveFileId) {
      console.log(`- ${label}: re-upload from Drive`);
      if (!dryRun) {
        try {
          const out = await reuploadFromDrive(live);
          result.driveReupload.push({ id: String(live._id), ...out });
          console.log(`  OK → ${out.youtubeVideoId}`);
        } catch (err) {
          result.skipped.push({ id: String(live._id), reason: err.message });
          console.error(`  ERR: ${err.message}`);
        }
      }
    } else if (live.zoomRecordingId && live.zoomMeetingId) {
      console.log(`- ${label}: clear + re-sync from Zoom cloud`);
      if (!dryRun) {
        live.youtubeVideoId = '';
        live.youtubeVideoUrl = '';
        live.youtubeEmbedUrl = '';
        live.recordingPipelineStatus = 'pending';
        live.recordingSyncError = '';
        await live.save();
        const out = await syncOneZoomRecording(live);
        if (out.synced) {
          result.zoomResync.push({ id: String(live._id), ...out });
          console.log(`  OK → ${out.youtubeVideoId}`);
        } else {
          result.skipped.push({ id: String(live._id), reason: out.reason || 'sync-failed' });
          console.log(`  PENDING: ${out.reason || 'sync-failed'}`);
        }
      }
    } else {
      console.log(`- ${label}: no Drive/Zoom backup — manual upload needed`);
      result.skipped.push({ id: String(live._id), reason: 'no-backup' });
      if (!dryRun) {
        live.youtubeVideoId = '';
        live.youtubeVideoUrl = '';
        live.youtubeEmbedUrl = '';
        live.recordingSyncError =
          'YouTube video was removed. Upload recording manually or restore from Zoom cloud.';
        live.recordingPipelineStatus = 'failed';
        await live.save();
        if (live.classroomLectureId) {
          const lecture = await Classroom.findById(live.classroomLectureId).exec();
          if (lecture) {
            lecture.youtubeVideoId = '';
            lecture.youtubeVideoUrl = '';
            lecture.youtubeEmbedUrl = '';
            lecture.videoSource = 'pending';
            await lecture.save();
          }
        }
      }
    }
  }

  console.log('\n=== Summary ===');
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
