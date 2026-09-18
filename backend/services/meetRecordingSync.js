const { google } = require('googleapis');
const LiveClass = require('../models/LiveClass');
const Batch = require('../models/Batch');
const User = require('../models/User');
const { getGoogleAuth, isMeetEnabled } = require('./googleAuth');
const googleDriveService = require('./googleDriveService');
const { ensureClassroomFromLiveClass } = require('./classroomFromLiveClass');

function meetingCodeFromLink(meetLink) {
  const m = String(meetLink || '').match(/meet\.google\.com\/([a-z0-9-]+)/i);
  return m ? m[1].toLowerCase() : '';
}

function spaceNameFromDoc(doc) {
  const raw = String(doc.meetSpaceId || '').trim();
  if (raw.startsWith('spaces/')) return raw;
  if (/^[a-z0-9-]{8,}$/i.test(raw) && raw.includes('-')) return `spaces/${raw}`;
  return '';
}

function extractDriveIdFromRecording(recording) {
  const dest = recording?.driveDestination || {};
  return (
    googleDriveService.extractDriveFileId(dest.file) ||
    googleDriveService.extractDriveFileId(dest.exportUri) ||
    googleDriveService.extractDriveFileId(recording?.driveFileId)
  );
}

function titleTokens(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3);
}

function namesLookRelated(fileName, classTitle) {
  const file = String(fileName || '').toLowerCase();
  const title = String(classTitle || '').toLowerCase();
  if (!file || !title) return false;
  if (file.includes(title.slice(0, 24))) return true;
  const tokens = titleTokens(title);
  if (!tokens.length) return false;
  const hits = tokens.filter((t) => file.includes(t)).length;
  return hits >= Math.min(2, tokens.length);
}

async function getMeetClient() {
  const auth = await getGoogleAuth();
  return google.meet({ version: 'v2', auth });
}

async function listConferenceRecords(meet, doc) {
  const filters = [];
  const spaceName = spaceNameFromDoc(doc);
  const code = meetingCodeFromLink(doc.meetLink);
  if (spaceName) {
    filters.push(`space.name = "${spaceName}"`);
    filters.push(`space.name="${spaceName}"`);
  }
  if (code) {
    filters.push(`space.meeting_code = "${code}"`);
    filters.push(`space.meeting_code="${code}"`);
  }

  for (const filter of filters) {
    try {
      const res = await meet.conferenceRecords.list({ filter, pageSize: 20 });
      const rows = res.data.conferenceRecords || [];
      if (rows.length) return rows;
    } catch (err) {
      console.warn('[Meet recording sync] conferenceRecords.list:', filter, err?.message || err);
    }
  }
  return [];
}

async function firstGeneratedRecording(meet, conferenceRecords, doc = null) {
  const ordered = pickConferencesNearSchedule(conferenceRecords, doc);
  for (const record of ordered) {
    const parent = record.name;
    if (!parent) continue;
    try {
      const res = await meet.conferenceRecords.recordings.list({ parent, pageSize: 10 });
      const recordings = res.data.recordings || [];
      const ready = recordings.find(
        (r) =>
          String(r.state || '').toUpperCase() === 'FILE_GENERATED' && extractDriveIdFromRecording(r)
      );
      if (ready) return { record, recording: ready };
    } catch (err) {
      console.warn('[Meet recording sync] recordings.list:', parent, err?.message || err);
    }
  }
  return null;
}

function pickConferencesNearSchedule(records, doc) {
  const rows = [...(records || [])];
  const start = doc?.scheduledStart ? new Date(doc.scheduledStart).getTime() : 0;
  if (!start) return rows;
  return rows.sort((a, b) => {
    const aStart = a.startTime ? new Date(a.startTime).getTime() : 0;
    const bStart = b.startTime ? new Date(b.startTime).getTime() : 0;
    return Math.abs(aStart - start) - Math.abs(bStart - start);
  });
}

async function findDriveFallback(doc) {
  const start = doc.scheduledStart ? new Date(doc.scheduledStart) : null;
  const end = doc.scheduledEnd ? new Date(doc.scheduledEnd) : start;
  if (!start) return null;
  const after = new Date(start.getTime() - 30 * 60 * 1000);
  // Narrow window: Meet usually finishes processing within a few hours of class end.
  const before = new Date((end || start).getTime() + 6 * 60 * 60 * 1000);
  let files = [];
  try {
    files = await googleDriveService.listRecentHostVideos({ after, before, pageSize: 50 });
  } catch (err) {
    console.warn('[Meet recording sync] Drive list failed (need drive.readonly):', err?.message || err);
    return null;
  }
  files = (files || []).filter((f) => Number(f.size || 0) >= googleDriveService.MIN_PLAYABLE_VIDEO_BYTES);
  const code = meetingCodeFromLink(doc.meetLink);
  if (code) {
    const byCode = files.find((f) => String(f.name || '').toLowerCase().includes(code));
    if (byCode) return byCode;
  }
  const related = files.filter((f) => namesLookRelated(f.name, doc.title));
  if (related.length === 1) return related[0];
  // Never attach "the only video in a wide window" — that caused wrong-batch recordings.
  return null;
}

async function ensureBatchDriveFolder(doc) {
  const batch = doc.batchId ? await Batch.findById(doc.batchId).lean().exec() : null;
  // Always resolve folder from the meeting's batch — never reuse another meeting's folder id.
  let folderId = batch?.driveFolderId || '';
  let folderLink = batch?.driveFolderLink || '';
  if (doc.batchId) {
    const ensured = await googleDriveService.ensureBatchFolder({
      batchId: doc.batchId,
      batchName: batch?.name || doc.course || 'Batch'
    });
    folderId = ensured.folderId;
    folderLink = ensured.folderLink;
    if (batch && batch.driveFolderId !== folderId) {
      await Batch.updateOne(
        { _id: doc.batchId },
        { $set: { driveFolderId: folderId, driveFolderLink: folderLink, updatedAt: new Date() } }
      );
    }
  }
  return { batch, folderId, folderLink };
}

async function shareTrainerEmails(doc) {
  const teacher = doc.teacherId
    ? await User.findById(doc.teacherId).select('email').lean().exec()
    : null;
  return [teacher?.email].filter(Boolean);
}

async function attachSourceFile(doc, { sourceFileId, meetRecordingId, driveName }) {
  if (!sourceFileId) return { pending: true, reason: 'no-source-file' };
  let sourceMeta = null;
  try {
    sourceMeta = await googleDriveService.getFileMeta(sourceFileId);
    if (!googleDriveService.isPlayableVideoFile(sourceMeta)) {
      return {
        pending: true,
        reason: `source-not-playable size=${sourceMeta?.size || 0} mime=${sourceMeta?.mimeType || ''}`
      };
    }
  } catch (err) {
    console.warn('[Meet recording sync] source meta:', err?.message || err);
    return { pending: true, reason: 'source-unreadable' };
  }
  const { batch, folderId } = await ensureBatchDriveFolder(doc);
  const shareEmails = await shareTrainerEmails(doc);
  const stamp = lectureDateStamp(doc);
  const safeTitle = String(doc.title || 'class').replace(/[\\/:*?"<>|]/g, ' ').slice(0, 80);
  let uploaded;
  try {
    uploaded = await googleDriveService.copyFileToBatchFolder({
      sourceFileId,
      batchId: doc.batchId,
      batchName: batch?.name || '',
      folderId,
      fileName: `${safeTitle} ${stamp}.mp4`,
      shareWithEmails: shareEmails
    });
    if (!googleDriveService.isPlayableVideoFile(uploaded)) {
      return {
        pending: true,
        reason: `copied-file-too-small size=${uploaded.size || 0}`
      };
    }
  } catch (err) {
    console.warn('[Meet recording sync] copy failed, linking original file:', err?.message || err);
    uploaded = {
      folderId,
      driveFileId: sourceFileId,
      driveLink: `https://drive.google.com/file/d/${sourceFileId}/view`,
      driveName: driveName || safeTitle,
      durationLabel: sourceMeta?.durationLabel || '',
      durationMillis: sourceMeta?.durationMillis || 0
    };
    try {
      const drive = await googleDriveService.getDriveClient();
      await googleDriveService.makeFileReadableWithLink(drive, sourceFileId);
    } catch (shareErr) {
      console.warn('[Meet recording sync] could not share original recording:', shareErr?.message || shareErr);
    }
  }

  const durationLabel =
    uploaded.durationLabel ||
    sourceMeta?.durationLabel ||
    (uploaded.durationMillis
      ? googleDriveService.formatVideoDurationLabel(uploaded.durationMillis)
      : '') ||
    doc.duration ||
    '';

  const live = await LiveClass.findById(doc._id || doc.id);
  if (!live) return null;
  live.driveFolderId = uploaded.folderId || live.driveFolderId || '';
  live.driveFileId = uploaded.driveFileId;
  live.driveLink = uploaded.driveLink;
  live.recordingUploadedAt = new Date();
  live.recordingPromptDismissedAt = new Date();
  live.meetRecordingId = meetRecordingId || sourceFileId;
  live.recordingSyncAt = new Date();
  live.recordingSyncError = '';
  if (durationLabel) live.duration = durationLabel;
  live.status = live.status === 'cancelled' ? live.status : 'completed';
  live.updatedAt = new Date();
  await live.save();

  await ensureClassroomFromLiveClass(live, {
    videoSource: 'drive',
    driveFileId: uploaded.driveFileId,
    driveLink: uploaded.driveLink,
    durationLabel
  });

  return {
    meetingId: String(live._id),
    title: live.title,
    driveFileId: uploaded.driveFileId,
    driveLink: uploaded.driveLink
  };
}

function lectureDateStamp(doc) {
  const tz = doc.timezone || 'Asia/Kolkata';
  if (doc.scheduledStart) {
    return new Date(doc.scheduledStart).toLocaleDateString('en-CA', { timeZone: tz });
  }
  return new Date().toLocaleDateString('en-CA', { timeZone: tz });
}

async function syncOneLiveClass(doc) {
  if (doc.driveFileId) return { skipped: true, reason: 'already-has-recording' };
  const meet = await getMeetClient();
  const records = await listConferenceRecords(meet, doc);
  const found = await firstGeneratedRecording(meet, records, doc);
  if (found) {
    const sourceFileId = extractDriveIdFromRecording(found.recording);
    return attachSourceFile(doc, {
      sourceFileId,
      meetRecordingId: found.recording.name || sourceFileId,
      driveName: doc.title
    });
  }
  // Never guess from Drive when this meeting has its own Meet space — that caused wrong-batch videos.
  if (spaceNameFromDoc(doc) || meetingCodeFromLink(doc.meetLink)) {
    return { pending: true, reason: 'recording-not-ready' };
  }
  const driveFile = await findDriveFallback(doc);
  if (driveFile?.id) {
    return attachSourceFile(doc, {
      sourceFileId: driveFile.id,
      meetRecordingId: driveFile.id,
      driveName: driveFile.name
    });
  }
  return { pending: true, reason: 'recording-not-ready' };
}

function isEligible(doc, now = Date.now()) {
  if (doc.skipRecordingUpload || !doc.batchId) return false;
  if (doc.wasteSessionFlagged && !doc.wasteSessionDismissedAt) return false;
  if (doc.status === 'cancelled') return false;
  if (!doc.meetLink && !doc.meetSpaceId) return false;
  const end = doc.scheduledEnd ? new Date(doc.scheduledEnd).getTime() : 0;
  const start = doc.scheduledStart ? new Date(doc.scheduledStart).getTime() : 0;
  const finishedAt = end || start;
  if (!finishedAt) return false;
  if (finishedAt > now - 2 * 60 * 1000) return false;
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  if (finishedAt < weekAgo) return false;
  return true;
}

async function clearUnplayableRecording(doc) {
  if (!doc.driveFileId) return false;
  let playable = false;
  try {
    const meta = await googleDriveService.getFileMeta(doc.driveFileId);
    playable = googleDriveService.isPlayableVideoFile(meta);
  } catch (_) {
    playable = false;
  }
  if (playable) return false;

  const live = await LiveClass.findById(doc._id || doc.id);
  if (live) {
    live.driveFileId = '';
    live.driveLink = '';
    live.recordingSyncError = 'Recording file was empty or still processing. Upload the real Meet video.';
    live.updatedAt = new Date();
    await live.save();
    try {
      await ensureClassroomFromLiveClass(live, {
        videoSource: 'meet-session',
        driveFileId: '',
        driveLink: live.meetLink || ''
      });
    } catch (err) {
      console.warn('[Meet recording sync] clear classroom stub:', err.message || err);
    }
  }
  return true;
}

async function driveFileSize(fileId) {
  if (!fileId) return 0;
  try {
    const meta = await googleDriveService.getFileMeta(fileId);
    return Number(meta.size || 0);
  } catch (_) {
    return 0;
  }
}

/** Clear when LMS attached a different file than Meet API says belongs to this room. */
async function clearMismatchedRecording(doc) {
  if (!doc.driveFileId || (!doc.meetLink && !doc.meetSpaceId)) return false;
  try {
    const meet = await getMeetClient();
    const records = await listConferenceRecords(meet, doc);
    const found = await firstGeneratedRecording(meet, records, doc);
    if (!found) return false;
    const expectedId = extractDriveIdFromRecording(found.recording);
    if (!expectedId) return false;
    const [attachedSize, expectedSize] = await Promise.all([
      driveFileSize(doc.driveFileId),
      driveFileSize(expectedId)
    ]);
    if (!attachedSize || !expectedSize || attachedSize === expectedSize) return false;

    const live = await LiveClass.findById(doc._id || doc.id);
    if (!live) return false;
    live.driveFileId = '';
    live.driveLink = '';
    live.recordingSyncError = 'Recording was linked to the wrong video. Re-syncing from Meet.';
    live.updatedAt = new Date();
    await live.save();
    console.warn(
      `[Meet recording sync] cleared mismatched recording ${doc.title}: attached=${attachedSize} expected=${expectedSize}`
    );
    return true;
  } catch (err) {
    console.warn('[Meet recording sync] mismatch check:', err?.message || err);
    return false;
  }
}

/**
 * Pull Meet recordings for recent live classes and attach them to the assigned batch Classroom.
 */
async function syncMeetRecordings({ meetingId } = {}) {
  if (!isMeetEnabled()) {
    return { ok: false, skipped: true, message: 'Google Meet is disabled' };
  }

  let candidates = [];
  if (meetingId) {
    const one = await LiveClass.findById(meetingId).lean().exec();
    if (one && isEligible(one)) candidates = [one];
  } else {
    const docs = await LiveClass.find({
      status: { $in: ['scheduled', 'live', 'completed'] }
    })
      .lean()
      .exec();
    candidates = (docs || []).filter((d) => isEligible(d));
  }

  const result = { ok: true, checked: candidates.length, synced: [], pending: [], errors: [] };

  for (const doc of candidates) {
    try {
      if (doc.driveFileId) {
        let cleared = await clearUnplayableRecording(doc);
        if (!cleared) cleared = await clearMismatchedRecording(doc);
        if (!cleared) continue;
        doc.driveFileId = '';
        doc.driveLink = '';
      }
      const out = await syncOneLiveClass(doc);
      if (out?.driveFileId) result.synced.push(out);
      else if (out?.pending) result.pending.push({ id: String(doc._id), title: doc.title, reason: out.reason });
      else if (!out?.skipped) result.pending.push({ id: String(doc._id), title: doc.title });
    } catch (err) {
      const message = err?.message || String(err);
      result.errors.push({ id: String(doc._id), title: doc.title, message });
      try {
        await LiveClass.updateOne(
          { _id: doc._id },
          { $set: { recordingSyncError: message.slice(0, 400), recordingSyncAt: new Date() } }
        );
      } catch (_) {
        /* ignore */
      }
      console.error(`[Meet recording sync] ${doc.title}:`, message);
    }
  }

  if (result.synced.length || result.errors.length) {
    console.log(
      `[Meet recording sync] checked=${result.checked} synced=${result.synced.length} pending=${result.pending.length} errors=${result.errors.length}`
    );
  }
  return result;
}

module.exports = {
  syncMeetRecordings,
  syncOneLiveClass,
  isEligible
};
