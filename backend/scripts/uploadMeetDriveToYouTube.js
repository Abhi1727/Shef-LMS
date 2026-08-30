#!/usr/bin/env node
/**
 * PROD: Upload existing Meet recordings from Google Drive → YouTube (unlisted),
 * then write youtubeVideoId back to LiveClass + Classroom so trainers/students
 * play via YouTube.
 *
 * Usage:
 *   ENV_PATH=.env node scripts/uploadMeetDriveToYouTube.js --dry-run
 *   ENV_PATH=.env node scripts/uploadMeetDriveToYouTube.js --limit=1
 *   ENV_PATH=.env node scripts/uploadMeetDriveToYouTube.js
 *   ENV_PATH=.env node scripts/uploadMeetDriveToYouTube.js --only=LIVECLASS_ID
 *
 * Resume-safe: skips sessions that already have youtubeVideoId.
 * State file: scripts/prod-meet-youtube-upload-state.json
 */
const path = require('path');
const fs = require('fs');
const os = require('os');

const envPath = process.env.ENV_PATH
  ? path.resolve(process.cwd(), process.env.ENV_PATH)
  : path.resolve(__dirname, '../.env');
require('dotenv').config({ path: envPath });

// If PROD env has Meet/Drive but no YouTube refresh token, fill missing keys from .env.dev
// (same GCP OAuth client — used for this migration only; does not rewrite .env files).
if (!String(process.env.YOUTUBE_REFRESH_TOKEN || '').trim()) {
  const devEnv = path.resolve(__dirname, '../.env.dev');
  if (fs.existsSync(devEnv)) {
    require('dotenv').config({ path: devEnv, override: false });
  }
}

const LiveClass = require('../models/LiveClass');
const Classroom = require('../models/Classroom');
const Batch = require('../models/Batch');
const googleDriveService = require('../services/googleDriveService');
const youtubeService = require('../services/youtubeService');
const { ensureClassroomFromLiveClass } = require('../services/classroomFromLiveClass');

const STATE_PATH = path.join(__dirname, 'prod-meet-youtube-upload-state.json');
const TMP_DIR = path.join(os.tmpdir(), 'shef-lms-meet-yt');

function argVal(name, fallback = '') {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}
function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function isMeetSession(m) {
  const provider = m.conferenceProvider || (m.zoomMeetingId && !m.meetLink ? 'zoom' : 'meet');
  return provider === 'meet' || Boolean(m.meetLink);
}

function loadState() {
  try {
    if (fs.existsSync(STATE_PATH)) return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
  } catch (_) {
    /* ignore */
  }
  return { startedAt: new Date().toISOString(), results: {} };
}

function saveState(state) {
  state.updatedAt = new Date().toISOString();
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
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
  const stat = fs.statSync(destPath);
  if (!stat.size) throw new Error('Downloaded file is empty');
  return stat.size;
}

async function main() {
  const dryRun = hasFlag('dry-run');
  const limit = Number(argVal('limit', '0')) || 0;
  const onlyId = String(argVal('only', '')).trim();

  console.log(
    JSON.stringify(
      {
        envPath,
        firestoreDb: process.env.FIRESTORE_DATABASE,
        dryRun,
        limit: limit || 'all',
        onlyId: onlyId || null,
        youtubeConfigured: youtubeService.isConfigured(),
        youtubeCreds: youtubeService.getCredentialSource(),
        privacy: process.env.YOUTUBE_PRIVACY_STATUS || 'unlisted'
      },
      null,
      2
    )
  );

  if (!youtubeService.isConfigured()) {
    throw new Error(
      'YouTube is not configured (need YOUTUBE_REFRESH_TOKEN). Run setup-youtube-oauth.js or ensure .env.dev has the token.'
    );
  }

  // Confirm channel once
  await youtubeService.ensureFreshCredentials();
  const { google } = require('googleapis');
  const youtube = google.youtube({ version: 'v3', auth: youtubeService.oauth2Client });
  const ch = await youtube.channels.list({ part: ['snippet'], mine: true });
  const channel = (ch.data.items || [])[0];
  console.log(
    'YouTube channel:',
    channel ? `${channel.snippet.title} (${channel.id})` : '(none — check OAuth account)'
  );
  if (!channel) throw new Error('No YouTube channel for this OAuth token');

  fs.mkdirSync(TMP_DIR, { recursive: true });

  const meetings = (await LiveClass.find({}).lean().exec()).filter(isMeetSession);
  const batchIds = [...new Set(meetings.map((m) => String(m.batchId || '')).filter(Boolean))];
  const batches = batchIds.length
    ? await Batch.find({ _id: { $in: batchIds } }).select('name course').lean().exec()
    : [];
  const batchMap = new Map(batches.map((b) => [String(b._id || b.id), b]));
  const classrooms = batchIds.length
    ? await Classroom.find({ batchId: { $in: batchIds } }).lean().exec()
    : [];
  const classById = new Map(classrooms.map((c) => [String(c._id || c.id), c]));

  const candidates = [];
  for (const m of meetings) {
    if (m.status === 'cancelled') continue;
    const bid = String(m.batchId || '');
    if (!bid || m.skipRecordingUpload) continue;
    const id = String(m._id || m.id);
    if (onlyId && id !== onlyId) continue;

    const room = m.classroomLectureId ? classById.get(String(m.classroomLectureId)) : null;
    const driveId =
      googleDriveService.extractDriveFileId(m.driveFileId) ||
      googleDriveService.extractDriveFileId(m.driveLink) ||
      googleDriveService.extractDriveFileId(room?.driveId) ||
      googleDriveService.extractDriveFileId(room?.driveFileId) ||
      '';
    if (!driveId) continue;

    const existingYt = m.youtubeVideoId || room?.youtubeVideoId || '';
    candidates.push({
      liveClassId: id,
      title: m.title || 'Live class',
      batchId: bid,
      batchName: batchMap.get(bid)?.name || '',
      course: m.course || batchMap.get(bid)?.course || '',
      teacherName: m.teacherName || m.instructor || '',
      driveFileId: driveId,
      classroomLectureId: m.classroomLectureId || '',
      alreadyYouTube: Boolean(existingYt),
      youtubeVideoId: existingYt || ''
    });
  }

  const pending = candidates.filter((c) => !c.alreadyYouTube);
  console.log(
    `Candidates with Drive: ${candidates.length} · already on YouTube: ${candidates.length - pending.length} · pending: ${pending.length}`
  );

  const state = loadState();
  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const item of pending) {
    if (limit && uploaded >= limit) break;

    const prev = state.results[item.liveClassId];
    if (prev?.status === 'ok' && prev.youtubeVideoId) {
      console.log(`skip(state) ${item.title}`);
      skipped += 1;
      continue;
    }

    console.log(`\n→ ${item.title} · ${item.batchName} · drive=${item.driveFileId}`);

    if (dryRun) {
      state.results[item.liveClassId] = { status: 'dry-run', ...item };
      saveState(state);
      uploaded += 1;
      continue;
    }

    const tmpPath = path.join(TMP_DIR, `${item.liveClassId}.mp4`);
    try {
      // Fresh doc for writes
      const live = await LiveClass.findById(item.liveClassId).exec();
      if (!live) throw new Error('LiveClass not found');
      if (live.youtubeVideoId) {
        console.log('  already has youtube on doc, skip');
        skipped += 1;
        continue;
      }

      console.log('  downloading from Drive…');
      const size = await downloadDriveToFile(item.driveFileId, tmpPath);
      console.log(`  downloaded ${(size / (1024 * 1024)).toFixed(1)} MB`);

      console.log('  uploading to YouTube…');
      const yt = await youtubeService.uploadVideo(tmpPath, {
        title: String(item.title).slice(0, 100),
        description: [
          item.title,
          `Sky States LMS · Meet recording`,
          item.batchName ? `Batch: ${item.batchName}` : '',
          item.teacherName ? `Trainer: ${item.teacherName}` : '',
          `Drive archive: https://drive.google.com/file/d/${item.driveFileId}/view`
        ]
          .filter(Boolean)
          .join('\n'),
        courseType: item.course,
        instructor: item.teacherName,
        privacyStatus: process.env.YOUTUBE_PRIVACY_STATUS || 'unlisted',
        tags: ['sky-states', 'lms', 'meet-recording', item.course, item.batchName].filter(Boolean)
      });

      live.youtubeVideoId = yt.videoId;
      live.youtubeVideoUrl = yt.videoUrl;
      live.youtubeEmbedUrl = yt.embedUrl;
      live.driveFileId = live.driveFileId || item.driveFileId;
      if (!live.driveLink) {
        live.driveLink = `https://drive.google.com/file/d/${item.driveFileId}/view`;
      }
      live.recordingPipelineStatus = 'ready';
      live.recordingSyncError = '';
      live.recordingSyncAt = new Date();
      live.updatedAt = new Date();
      await live.save();

      await ensureClassroomFromLiveClass(live, {
        videoSource: 'youtube-url',
        driveFileId: item.driveFileId,
        driveLink: live.driveLink,
        youtubeVideoId: yt.videoId,
        youtubeVideoUrl: yt.videoUrl,
        youtubeEmbedUrl: yt.embedUrl
      });

      state.results[item.liveClassId] = {
        status: 'ok',
        title: item.title,
        batchName: item.batchName,
        driveFileId: item.driveFileId,
        youtubeVideoId: yt.videoId,
        youtubeVideoUrl: yt.videoUrl,
        at: new Date().toISOString()
      };
      saveState(state);
      uploaded += 1;
      console.log(`  ✅ ${yt.videoUrl}`);
    } catch (err) {
      failed += 1;
      const message = err.message || String(err);
      console.error(`  ❌ ${message}`);
      state.results[item.liveClassId] = {
        status: 'failed',
        title: item.title,
        batchName: item.batchName,
        driveFileId: item.driveFileId,
        error: message.slice(0, 500),
        at: new Date().toISOString()
      };
      saveState(state);

      // Stop early on quota — resume later
      if (/quota|rateLimitExceeded|uploadLimitExceeded|dailyLimitExceeded/i.test(message)) {
        console.error('\nStopping: YouTube quota/limit hit. Re-run this script later to resume.');
        break;
      }
    } finally {
      try {
        if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
      } catch (_) {
        /* ignore */
      }
    }
  }

  const okCount = Object.values(state.results).filter((r) => r.status === 'ok').length;
  console.log(
    JSON.stringify(
      {
        done: true,
        thisRun: { uploaded, skipped, failed },
        stateOkTotal: okCount,
        statePath: STATE_PATH
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
