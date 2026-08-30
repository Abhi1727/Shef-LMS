const fs = require('fs');
const path = require('path');
const LiveClass = require('../models/LiveClass');
const Batch = require('../models/Batch');
const User = require('../models/User');
const zoomService = require('./zoomService');
const googleDriveService = require('./googleDriveService');
const youtubeService = require('./youtubeService');
const { ensureClassroomFromLiveClass } = require('./classroomFromLiveClass');
const { isZoomRecordingPipelineEnabled, getLiveClassSettings } = require('./liveClassSettings');

const TMP_DIR = path.join(__dirname, '../uploads/tmp-recordings');
const LOOKBACK_MS = 14 * 24 * 60 * 60 * 1000;

function ensureTmpDir() {
  if (!fs.existsSync(TMP_DIR)) {
    fs.mkdirSync(TMP_DIR, { recursive: true });
  }
}

function pickBestMp4(recordings = [], { sessionStart, sessionEnd, usedRecordingIds = new Set() } = {}) {
  const videos = (recordings || []).filter((f) => {
    const type = String(f.fileType || '').toUpperCase();
    const recType = String(f.recordingType || '').toLowerCase();
    if (type !== 'MP4') return false;
    if (recType === 'audio_only') return false;
    if (!f.downloadUrl) return false;
    if (f.id && usedRecordingIds.has(String(f.id))) return false;
    return true;
  });
  if (!videos.length) return null;

  const startMs = sessionStart ? new Date(sessionStart).getTime() : 0;
  const endMs = sessionEnd
    ? new Date(sessionEnd).getTime()
    : startMs
      ? startMs + 60 * 60 * 1000
      : 0;

  const inWindow = (f) => {
    if (!startMs || !f.recordingStart) return false;
    const recStart = new Date(f.recordingStart).getTime();
    const windowStart = startMs - 20 * 60 * 1000;
    const windowEnd = (endMs || startMs + 60 * 60 * 1000) + 3 * 60 * 60 * 1000;
    return recStart >= windowStart && recStart <= windowEnd;
  };

  const candidates = startMs ? videos.filter(inWindow) : videos;
  const pool = candidates.length ? candidates : videos;

  const preferred = pool.find((f) =>
    /shared_screen_with_speaker|shared_screen_with_gallery|active_speaker/i.test(
      String(f.recordingType || '')
    )
  );
  if (preferred) return preferred;
  return [...pool].sort((a, b) => Number(b.fileSize || 0) - Number(a.fileSize || 0))[0];
}

function sessionEnded(doc, now = Date.now()) {
  const end = doc.scheduledEnd
    ? new Date(doc.scheduledEnd).getTime()
    : doc.scheduledStart
      ? new Date(doc.scheduledStart).getTime() + 60 * 60 * 1000
      : 0;
  return end && end < now - 2 * 60 * 1000;
}

async function getUsedZoomRecordingIds(zoomMeetingId, exceptLiveClassId = '') {
  if (!zoomMeetingId) return new Set();
  const docs = await LiveClass.find({
    zoomMeetingId: String(zoomMeetingId),
    zoomRecordingId: { $nin: ['', null] }
  })
    .select('zoomRecordingId')
    .lean()
    .exec();
  return new Set(
    docs
      .filter((d) => String(d._id || d.id) !== String(exceptLiveClassId))
      .map((d) => String(d.zoomRecordingId))
      .filter(Boolean)
  );
}

async function findZoomSessionsNeedingSync({ meetingId = '' } = {}) {
  const since = new Date(Date.now() - LOOKBACK_MS);
  const query = {
    conferenceProvider: 'zoom',
    skipRecordingUpload: { $ne: true },
    batchId: { $nin: ['', null] },
    zoomMeetingId: { $nin: ['', null] },
    status: { $nin: ['cancelled'] },
    $or: [
      { youtubeVideoId: { $exists: false } },
      { youtubeVideoId: '' },
      { youtubeVideoId: null }
    ],
    scheduledStart: { $gte: since }
  };

  if (meetingId) {
    return LiveClass.find({
      _id: meetingId,
      conferenceProvider: 'zoom',
      skipRecordingUpload: { $ne: true },
      batchId: { $nin: ['', null] },
      zoomMeetingId: { $nin: ['', null] }
    })
      .lean()
      .exec();
  }

  const docs = await LiveClass.find(query).sort({ scheduledStart: -1 }).lean().exec();
  return docs.filter((d) => sessionEnded(d) || d.status === 'completed' || d.status === 'live');
}

async function syncOneZoomRecording(doc) {
  ensureTmpDir();
  const live = await LiveClass.findById(doc._id || doc.id);
  if (!live) return { skipped: true, reason: 'missing' };
  if (live.skipRecordingUpload || !live.batchId || !live.zoomMeetingId) {
    return { skipped: true, reason: 'not-eligible' };
  }
  if (live.youtubeVideoId) {
    return { skipped: true, reason: 'already-on-youtube' };
  }

  const settings = await getLiveClassSettings();
  if (!settings.youtubeConfigured) {
    live.recordingSyncError =
      'YouTube API not configured. Set YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN.';
    live.recordingSyncAt = new Date();
    live.recordingPipelineStatus = 'failed';
    await live.save();
    return { failed: true, reason: 'youtube-not-configured' };
  }
  if (!settings.driveConfigured) {
    live.recordingSyncError =
      'Google Drive not configured. Set GOOGLE_MEET_CLIENT_ID / SECRET / REFRESH_TOKEN with Drive scopes.';
    live.recordingSyncAt = new Date();
    live.recordingPipelineStatus = 'failed';
    await live.save();
    return { failed: true, reason: 'drive-not-configured' };
  }

  live.recordingPipelineStatus = 'pending';
  live.recordingSyncError = '';
  live.recordingSyncAt = new Date();
  await live.save();

  let result;
  try {
    result = await zoomService.getRecordings(live.zoomMeetingId);
  } catch (err) {
    const msg = err.message || 'Failed to fetch Zoom recordings';
    live.recordingSyncError = msg.slice(0, 400);
    live.recordingPipelineStatus = 'failed';
    live.recordingSyncAt = new Date();
    await live.save();
    return { pending: true, reason: 'zoom-api-error', error: msg };
  }

  const best = pickBestMp4(result.recordings || [], {
    sessionStart: live.scheduledStart,
    sessionEnd: live.scheduledEnd,
    usedRecordingIds: await getUsedZoomRecordingIds(live.zoomMeetingId, String(live._id || live.id))
  });
  if (!best) {
    live.recordingSyncError =
      'Zoom cloud recording not ready yet (or no MP4). Wait 15–60 minutes after class, then sync again.';
    live.recordingPipelineStatus = 'pending';
    live.recordingSyncAt = new Date();
    await live.save();
    return { pending: true, reason: 'recording-not-ready' };
  }

  const tmpPath = path.join(
    TMP_DIR,
    `zoom-${live.zoomMeetingId}-${best.id || Date.now()}.mp4`
  );

  try {
    live.recordingPipelineStatus = 'downloading';
    await live.save();
    await zoomService.downloadRecordingToFile(best.downloadUrl, tmpPath);

    const batch = await Batch.findById(live.batchId).lean().exec();
    let folderId = live.driveFolderId || batch?.driveFolderId || '';
    if (!folderId) {
      const ensured = await googleDriveService.ensureBatchFolder({
        batchId: live.batchId,
        batchName: batch?.name || live.course || 'Batch'
      });
      folderId = ensured.folderId;
      live.driveFolderId = folderId;
      if (batch) {
        await Batch.updateOne(
          { _id: live.batchId },
          {
            $set: {
              driveFolderId: ensured.folderId,
              driveFolderLink: ensured.folderLink,
              updatedAt: new Date()
            }
          }
        );
      }
    }

    const teacher = live.teacherId
      ? await User.findById(live.teacherId).select('email').lean().exec()
      : null;

    live.recordingPipelineStatus = 'drive';
    await live.save();

    const uploaded = await googleDriveService.uploadRecordingFile({
      batchId: live.batchId,
      batchName: batch?.name || '',
      folderId,
      filePath: tmpPath,
      fileName: `${live.title || 'zoom-class'}-${Date.now()}.mp4`,
      mimeType: 'video/mp4',
      title: live.title,
      shareWithEmails: [teacher?.email].filter(Boolean)
    });

    live.driveFileId = uploaded.driveFileId;
    live.driveLink = uploaded.driveLink;
    live.driveFolderId = uploaded.folderId;
    live.zoomRecordingId = String(best.id || '');
    live.recordingUploadedAt = new Date();
    await live.save();

    live.recordingPipelineStatus = 'youtube';
    await live.save();

    const yt = await youtubeService.uploadVideo(tmpPath, {
      title: live.title || result.topic || 'Live class recording',
      description: [
        live.description || '',
        `Sky States LMS recording`,
        live.batchId ? `Batch: ${batch?.name || live.batchId}` : '',
        live.scheduledDate ? `Date: ${live.scheduledDate}` : '',
        `Archive Drive: ${uploaded.driveLink || ''}`
      ]
        .filter(Boolean)
        .join('\n'),
      courseType: live.course || batch?.course || '',
      instructor: live.teacherName || live.instructor || '',
      privacyStatus: settings.youtubePrivacy || 'unlisted',
      tags: ['sky-states', 'lms', 'live-class', live.course].filter(Boolean)
    });

    live.youtubeVideoId = yt.videoId;
    live.youtubeVideoUrl = yt.videoUrl;
    live.youtubeEmbedUrl = yt.embedUrl;
    live.recordingPipelineStatus = 'ready';
    live.recordingSyncError = '';
    live.recordingSyncAt = new Date();
    live.recordingPromptDismissedAt = new Date();
    if (live.status !== 'cancelled') live.status = 'completed';
    live.updatedAt = new Date();
    await live.save();

    await ensureClassroomFromLiveClass(live, {
      videoSource: 'youtube-url',
      driveFileId: uploaded.driveFileId,
      driveLink: uploaded.driveLink,
      youtubeVideoId: yt.videoId,
      youtubeVideoUrl: yt.videoUrl,
      youtubeEmbedUrl: yt.embedUrl
    });

    return {
      synced: true,
      meetingId: String(live._id),
      youtubeVideoId: yt.videoId,
      driveFileId: uploaded.driveFileId
    };
  } catch (err) {
    const message = err.message || String(err);
    console.error(`[Zoom recording sync] ${live.title}:`, message);
    live.recordingSyncError = message.slice(0, 400);
    live.recordingPipelineStatus = 'failed';
    live.recordingSyncAt = new Date();
    await live.save();
    return { failed: true, reason: message };
  } finally {
    try {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    } catch (_) {
      /* ignore */
    }
  }
}

/**
 * Pull Zoom cloud recordings → Google Drive archive → YouTube (student/trainer player).
 */
async function syncZoomRecordings({ meetingId = '' } = {}) {
  const enabled = await isZoomRecordingPipelineEnabled();
  if (!enabled) {
    return { skipped: true, reason: 'zoom-recording-sync-disabled', checked: 0, synced: [], pending: [], errors: [] };
  }

  const docs = await findZoomSessionsNeedingSync({ meetingId });
  const result = { checked: docs.length, synced: [], pending: [], errors: [] };

  for (const doc of docs) {
    try {
      const out = await syncOneZoomRecording(doc);
      if (out.synced) result.synced.push(out);
      else if (out.pending) result.pending.push({ id: String(doc._id || doc.id), ...out });
      else if (out.failed) result.errors.push({ id: String(doc._id || doc.id), ...out });
    } catch (err) {
      const message = err.message || String(err);
      result.errors.push({ id: String(doc._id || doc.id), reason: message });
      try {
        await LiveClass.updateOne(
          { _id: doc._id || doc.id },
          {
            $set: {
              recordingSyncError: message.slice(0, 400),
              recordingSyncAt: new Date(),
              recordingPipelineStatus: 'failed'
            }
          }
        );
      } catch (_) {
        /* ignore */
      }
    }
  }

  console.log(
    `[Zoom recording sync] checked=${result.checked} synced=${result.synced.length} pending=${result.pending.length} errors=${result.errors.length}`
  );
  return result;
}

module.exports = {
  syncZoomRecordings,
  syncOneZoomRecording,
  pickBestMp4
};
