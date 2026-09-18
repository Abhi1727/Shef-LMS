#!/usr/bin/env node
/**
 * One-off: fix Megha shared-PMI wrong-batch Zoom attachments + publish GB lecture.
 * Usage: node scripts/repairMeghaShubhamVideos.js
 */
require('dotenv').config({ path: process.env.ENV_PATH || '.env' });

const LiveClass = require('../models/LiveClass');
const Classroom = require('../models/Classroom');
const { syncOneZoomRecording } = require('../services/zoomRecordingSync');
const { ensureClassroomFromLiveClass } = require('../services/classroomFromLiveClass');
const googleDriveService = require('../services/googleDriveService');

async function publishLecture(lectureId, { visible = true } = {}) {
  const lec = await Classroom.findById(lectureId);
  if (!lec) return;
  lec.studentVisible = visible;
  lec.updatedAt = new Date();
  await lec.save();
}

async function moveYoutube({ fromLiveId, toLiveId, label }) {
  const from = await LiveClass.findById(fromLiveId);
  const to = await LiveClass.findById(toLiveId);
  if (!from || !to) throw new Error(`missing live ${label}`);
  if (!from.youtubeVideoId) throw new Error(`no yt on source ${label}`);
  if (to.youtubeVideoId) {
    console.log('SKIP move', label, 'target already has', to.youtubeVideoId);
    return;
  }
  const yt = from.youtubeVideoId;
  const ytUrl = from.youtubeVideoUrl || `https://www.youtube.com/watch?v=${yt}`;
  const ytEmbed = from.youtubeEmbedUrl || `https://www.youtube.com/embed/${yt}`;
  const zoomRec = from.zoomRecordingId || '';
  const driveFileId = from.driveFileId || '';
  const driveLink = from.driveLink || '';
  const duration = from.duration || '';

  from.youtubeVideoId = '';
  from.youtubeVideoUrl = '';
  from.youtubeEmbedUrl = '';
  from.zoomRecordingId = '';
  from.driveFileId = '';
  from.driveLink = '';
  from.recordingPipelineStatus = 'pending';
  from.recordingSyncError = 'Recording reassigned to correct batch';
  from.updatedAt = new Date();
  await from.save();
  if (from.classroomLectureId) {
    const lec = await Classroom.findById(from.classroomLectureId);
    if (lec) {
      lec.youtubeVideoId = '';
      lec.youtubeVideoUrl = '';
      lec.youtubeEmbedUrl = '';
      lec.driveId = '';
      lec.videoSource = 'pending';
      lec.studentVisible = false;
      lec.updatedAt = new Date();
      await lec.save();
    }
  }

  to.youtubeVideoId = yt;
  to.youtubeVideoUrl = ytUrl;
  to.youtubeEmbedUrl = ytEmbed;
  to.zoomRecordingId = zoomRec;
  if (driveFileId) to.driveFileId = driveFileId;
  if (driveLink) to.driveLink = driveLink;
  if (duration) to.duration = duration;
  to.recordingPipelineStatus = 'ready';
  to.recordingSyncError = '';
  to.wasteSessionFlagged = false;
  to.wasteSessionDismissedAt = new Date();
  to.updatedAt = new Date();
  await to.save();

  await ensureClassroomFromLiveClass(to, {
    videoSource: 'youtube-url',
    youtubeVideoId: yt,
    youtubeVideoUrl: ytUrl,
    youtubeEmbedUrl: ytEmbed,
    driveFileId: to.driveFileId || '',
    driveLink: to.driveLink || '',
    durationLabel: duration
  });
  if (to.classroomLectureId) {
    await publishLecture(to.classroomLectureId, { visible: true });
  }
  console.log('MOVED', label, yt, '->', toLiveId);
}

async function main() {
  await moveYoutube({
    fromLiveId: 'ac2ffa49e42d613884dfc39a',
    toLiveId: '29dfbad1a2cd64901211d0ad',
    label: 'Aug29 21:30 content CSEH->BATCH260'
  });

  await moveYoutube({
    fromLiveId: '563db41efbd45b81ed90454c',
    toLiveId: '2e13550a696a37dc568d9b2b',
    label: 'Aug30 21:39 content BATCH180->BATCH260'
  });

  for (const id of ['a42b78abf968e103da122b2f', '7ef146f83553970dfd12ff5c']) {
    const live = await LiveClass.findById(id);
    if (!live) continue;
    live.status = 'cancelled';
    live.skipRecordingUpload = true;
    live.wasteSessionFlagged = true;
    live.recordingPipelineStatus = 'failed';
    live.recordingSyncError = 'Duplicate / accidental start — cancelled';
    live.updatedAt = new Date();
    await live.save();
    if (live.classroomLectureId) {
      await publishLecture(live.classroomLectureId, { visible: false });
    }
    console.log('CANCELLED duplicate', id);
  }

  {
    const live = await LiveClass.findById('b307f99bc4f43d3879f349e8');
    if (live) {
      live.skipRecordingUpload = true;
      live.wasteSessionFlagged = true;
      live.recordingPipelineStatus = 'failed';
      live.recordingSyncError = 'Accidental short start — skipped';
      await live.save();
    }
    await publishLecture('697f470bedeb0aef3eb3640f', { visible: false });
    console.log('HID waste BATCH-180 Aug29 stub');
  }

  {
    const live = await LiveClass.findById('ac2ffa49e42d613884dfc39a');
    live.wasteSessionDismissedAt = new Date();
    live.wasteSessionFlagged = false;
    live.skipRecordingUpload = false;
    live.youtubeVideoId = '';
    live.recordingPipelineStatus = 'pending';
    live.recordingSyncError = '';
    await live.save();
    console.log('Force sync CSEH Aug29...');
    const out = await syncOneZoomRecording(live, {
      forceZoomRecordingId: 'e7f74093-0c84-4d97-b498-33e5c4bfe799'
    });
    console.log('CSEH Aug29 sync', JSON.stringify(out));
    const refreshed = await LiveClass.findById(live._id);
    if (refreshed?.classroomLectureId) {
      await publishLecture(refreshed.classroomLectureId, { visible: true });
    }
  }

  {
    const live = await LiveClass.findById('6fde11fddeab11a8bbaeeaa0');
    live.youtubeVideoId = '';
    live.youtubeVideoUrl = '';
    live.youtubeEmbedUrl = '';
    live.zoomRecordingId = '';
    live.driveFileId = '';
    live.driveLink = '';
    live.wasteSessionFlagged = false;
    live.wasteSessionDismissedAt = new Date();
    live.skipRecordingUpload = false;
    live.recordingPipelineStatus = 'pending';
    live.recordingSyncError = '';
    await live.save();
    if (live.classroomLectureId) {
      const lec = await Classroom.findById(live.classroomLectureId);
      if (lec) {
        lec.youtubeVideoId = '';
        lec.youtubeVideoUrl = '';
        lec.youtubeEmbedUrl = '';
        lec.driveId = '';
        lec.videoSource = 'pending';
        await lec.save();
      }
    }
    console.log('Force sync PROJECT OVERVIEW...');
    const out = await syncOneZoomRecording(live, {
      forceZoomRecordingId: '69d1a729-1ab5-4c64-bc00-c9433f1c64b9'
    });
    console.log('PROJECT OVERVIEW sync', JSON.stringify(out));
    const refreshed = await LiveClass.findById(live._id);
    if (refreshed?.classroomLectureId) {
      await publishLecture(refreshed.classroomLectureId, { visible: true });
    }
  }

  await publishLecture('bfd036e90744292af688aa35', { visible: true });
  console.log('Published Batch project GB Sep4');

  for (const fileId of [
    '1r5fEAGKsSB0te_W7p6kV_DR-dxCXcyIV',
    '1iSSiwS8_8VW-LCNhaXCzfbLAe906FbGs'
  ]) {
    try {
      const drive = await googleDriveService.getDriveClient();
      await googleDriveService.makeFileReadableWithLink(drive, fileId);
      console.log('Shared Drive file', fileId);
    } catch (e) {
      console.log('Share fail', fileId, e.message);
    }
  }

  {
    const live = await LiveClass.findById('107e5677166861acd4c8428f');
    if (live) {
      live.wasteSessionFlagged = false;
      live.wasteSessionDismissedAt = new Date();
      live.wasteSessionReasons = [];
      live.skipRecordingUpload = false;
      live.updatedAt = new Date();
      await live.save();
      console.log('Dismissed waste on today live CSEH-O-12067008');
    }
    for (const id of [
      'f04488f467dd8a3b6728438f',
      'bafa03caf57276aa53e410e5',
      '9802cc7f80820e050347f063'
    ]) {
      const s = await LiveClass.findById(id);
      if (!s) continue;
      s.wasteSessionFlagged = true;
      s.skipRecordingUpload = true;
      if (s.status === 'live') s.status = 'cancelled';
      await s.save();
    }
  }

  console.log('DONE');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
