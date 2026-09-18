#!/usr/bin/env node
/**
 * 1) Publish hidden real YouTube lectures
 * 2) Reassign Zoom recordings stuck on wrong live/batch (shared PMI)
 * 3) Force-sync remaining free Zoom MP4s onto best-matching pending lives
 *
 *   node scripts/repairAllTrainersRecordings.js
 *   node scripts/repairAllTrainersRecordings.js --dry-run
 */
require('dotenv').config({ path: process.env.ENV_PATH || '.env' });

const LiveClass = require('../models/LiveClass');
const Classroom = require('../models/Classroom');
const Batch = require('../models/Batch');
const User = require('../models/User');
const zoomService = require('../services/zoomService');
const { syncOneZoomRecording } = require('../services/zoomRecordingSync');
const { ensureClassroomFromLiveClass } = require('../services/classroomFromLiveClass');

const dryRun = process.argv.includes('--dry-run');
const SINCE = '2026-08-01';
const ZOOM_FROM = '2026-08-20';
const ZOOM_TO = '2026-09-05';
const MIN_PUBLISH_MINUTES = 15;
const MATCH_WINDOW_MS = 50 * 60 * 1000;
const MIN_MP4_BYTES = 20 * 1024 * 1024;
const WRONG_ATTACH_RATIO = 2; // current owner delta must be >= 2x better candidate

function parseDur(d) {
  if (d == null || d === '') return null;
  if (typeof d === 'number' && Number.isFinite(d)) return d;
  const raw = String(d).toLowerCase();
  const sec = raw.match(/(\d+)\s*s/);
  if (sec) return Number(sec[1]) / 60;
  const h = raw.match(/(\d+)\s*h/);
  const m = raw.match(/(\d+)\s*m/);
  if (h) return Number(h[1]) * 60 + (m ? Number(m[1]) : 0);
  if (m) return Number(m[1]);
  const n = raw.match(/(\d+)/);
  return n ? Number(n[1]) : null;
}

function isTestLike(title) {
  return /^(test|demo|trial|upii|testing|sample)\b/i.test(String(title || '').trim());
}

function isGenericLiveTitle(title) {
  return /—\s*Live class\s*$/i.test(String(title || ''));
}

function scoreLiveForMatch(live, recStartMs) {
  const start = new Date(live.scheduledStart).getTime();
  const delta = Math.abs(start - recStartMs);
  let score = delta;
  if (isGenericLiveTitle(live.title)) score += 5 * 60 * 1000;
  if (isTestLike(live.title) || /testing/i.test(live.batchName || '')) score += 45 * 60 * 1000;
  if (live.wasteSessionFlagged && !live.wasteSessionDismissedAt) score += 30 * 60 * 1000;
  if (live.status === 'cancelled' || live.skipRecordingUpload) score += 60 * 60 * 1000;
  return score;
}

async function publishLecture(lectureId, visible = true) {
  const lec = await Classroom.findById(lectureId);
  if (!lec) return false;
  if (Boolean(lec.studentVisible !== false) === visible && lec.studentVisible !== false && visible) {
    // already visible
    if (visible && lec.studentVisible !== false) return false;
  }
  if (!visible && lec.studentVisible === false) return false;
  if (visible && lec.studentVisible !== false) return false;
  if (dryRun) {
    console.log('  [dry] publish', String(lectureId), visible);
    return true;
  }
  lec.studentVisible = visible;
  lec.updatedAt = new Date();
  await lec.save();
  return true;
}

async function publishHiddenReals() {
  console.log('\n=== Publish hidden real YouTube lectures ===');
  const batches = await Batch.find({}).lean();
  let published = 0;
  let skipped = 0;

  for (const b of batches) {
    if (/^upii/i.test(b.name || '')) continue;
    const lecs = await Classroom.find({ batchId: String(b._id), studentVisible: false }).lean();
    for (const l of lecs) {
      if (!l.youtubeVideoId) {
        skipped++;
        continue;
      }
      if (!l.date || l.date < SINCE) continue;
      const dur = parseDur(l.duration);
      if (isTestLike(l.title)) {
        console.log('  SKIP test-like', b.name, l.date, l.title);
        skipped++;
        continue;
      }
      if (dur != null && dur < MIN_PUBLISH_MINUTES) {
        console.log('  SKIP short', b.name, l.date, l.title, l.duration);
        skipped++;
        continue;
      }
      const ok = await publishLecture(l._id, true);
      if (ok) {
        published++;
        console.log('  PUBLISH', b.name, l.date, (l.title || '').slice(0, 45), l.youtubeVideoId);
      }
    }
  }
  console.log(`Published ${published}, skipped ${skipped}`);
  return published;
}

async function clearLiveRecording(liveDoc, reason) {
  liveDoc.youtubeVideoId = '';
  liveDoc.youtubeVideoUrl = '';
  liveDoc.youtubeEmbedUrl = '';
  liveDoc.zoomRecordingId = '';
  liveDoc.driveFileId = liveDoc.driveFileId || '';
  liveDoc.recordingPipelineStatus = 'pending';
  liveDoc.recordingSyncError = reason;
  liveDoc.updatedAt = new Date();
  await liveDoc.save();
  if (liveDoc.classroomLectureId) {
    const lec = await Classroom.findById(liveDoc.classroomLectureId);
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
}

async function applyYoutubeToLive(liveDoc, { yt, ytUrl, ytEmbed, zoomRec, driveFileId, driveLink, duration }) {
  liveDoc.youtubeVideoId = yt;
  liveDoc.youtubeVideoUrl = ytUrl;
  liveDoc.youtubeEmbedUrl = ytEmbed;
  liveDoc.zoomRecordingId = zoomRec || '';
  if (driveFileId) liveDoc.driveFileId = driveFileId;
  if (driveLink) liveDoc.driveLink = driveLink;
  if (duration) liveDoc.duration = duration;
  liveDoc.recordingPipelineStatus = 'ready';
  liveDoc.recordingSyncError = '';
  liveDoc.wasteSessionFlagged = false;
  liveDoc.wasteSessionDismissedAt = new Date();
  liveDoc.skipRecordingUpload = false;
  if (liveDoc.status === 'cancelled') liveDoc.status = 'completed';
  liveDoc.updatedAt = new Date();
  await liveDoc.save();

  await ensureClassroomFromLiveClass(liveDoc, {
    videoSource: 'youtube-url',
    youtubeVideoId: yt,
    youtubeVideoUrl: ytUrl,
    youtubeEmbedUrl: ytEmbed,
    driveFileId: liveDoc.driveFileId || '',
    driveLink: liveDoc.driveLink || '',
    durationLabel: duration || ''
  });
  const refreshed = await LiveClass.findById(liveDoc._id);
  if (refreshed?.classroomLectureId) {
    await publishLecture(refreshed.classroomLectureId, true);
  }
}

async function moveYoutube(fromId, toId, label) {
  const from = await LiveClass.findById(fromId);
  const to = await LiveClass.findById(toId);
  if (!from?.youtubeVideoId) return { skipped: true, reason: 'no-source-yt' };
  if (to.youtubeVideoId) return { skipped: true, reason: 'target-has-yt' };

  const payload = {
    yt: from.youtubeVideoId,
    ytUrl: from.youtubeVideoUrl || `https://www.youtube.com/watch?v=${from.youtubeVideoId}`,
    ytEmbed: from.youtubeEmbedUrl || `https://www.youtube.com/embed/${from.youtubeVideoId}`,
    zoomRec: from.zoomRecordingId || '',
    driveFileId: from.driveFileId || '',
    driveLink: from.driveLink || '',
    duration: from.duration || ''
  };

  if (dryRun) {
    console.log('  [dry] MOVE', label, payload.yt);
    return { dry: true };
  }

  await clearLiveRecording(from, 'Recording reassigned to correct batch/session');
  await applyYoutubeToLive(to, payload);
  console.log('  MOVE', label, payload.yt);
  return { moved: true };
}

async function cancelOrHideLive(live, reason) {
  if (dryRun) {
    console.log('  [dry] cancel/hide', String(live._id), reason);
    return;
  }
  const doc = await LiveClass.findById(live._id || live.id);
  if (!doc) return;
  if (doc.status !== 'live') doc.status = 'cancelled';
  doc.skipRecordingUpload = true;
  doc.wasteSessionFlagged = true;
  doc.recordingPipelineStatus = 'failed';
  doc.recordingSyncError = reason;
  doc.updatedAt = new Date();
  await doc.save();
  if (doc.classroomLectureId) await publishLecture(doc.classroomLectureId, false);
}

async function forceSyncLive(liveId, zoomRecordingId, label) {
  const live = await LiveClass.findById(liveId);
  if (!live) return { failed: true, reason: 'missing' };
  if (live.youtubeVideoId) return { skipped: true, reason: 'already-on-youtube' };

  if (dryRun) {
    console.log('  [dry] sync', label, zoomRecordingId);
    return { dry: true };
  }

  live.wasteSessionFlagged = false;
  live.wasteSessionDismissedAt = new Date();
  live.skipRecordingUpload = false;
  live.recordingPipelineStatus = 'pending';
  live.recordingSyncError = '';
  live.updatedAt = new Date();
  await live.save();

  const out = await syncOneZoomRecording(live, { forceZoomRecordingId: zoomRecordingId });
  const refreshed = await LiveClass.findById(liveId);
  if (refreshed?.youtubeVideoId) {
    if (refreshed.classroomLectureId) {
      await publishLecture(refreshed.classroomLectureId, true);
    } else {
      await ensureClassroomFromLiveClass(refreshed, {
        videoSource: 'youtube-url',
        youtubeVideoId: refreshed.youtubeVideoId,
        youtubeVideoUrl: refreshed.youtubeVideoUrl,
        youtubeEmbedUrl: refreshed.youtubeEmbedUrl
      });
      const again = await LiveClass.findById(liveId);
      if (again?.classroomLectureId) await publishLecture(again.classroomLectureId, true);
    }
  }
  console.log('  SYNC', label, JSON.stringify(out));
  return out;
}

function hideBurstDuplicates(pending, winner, assignedLiveIds) {
  return pending.filter((s) => {
    if (String(s._id) === String(winner._id)) return false;
    if (String(s.batchId) !== String(winner.batchId)) return false;
    if (assignedLiveIds.has(String(s._id))) return false;
    const d = Math.abs(new Date(s.scheduledStart).getTime() - new Date(winner.scheduledStart).getTime());
    return d <= 20 * 60 * 1000;
  });
}

async function repairZoomForTrainer(teacher, batches) {
  const teacherBatches = batches.filter((b) => String(b.teacherId) === String(teacher._id));
  if (!teacherBatches.length || !teacher.zoomUserId) return { moved: 0, synced: 0 };

  let list = [];
  try {
    const listed = await zoomService.listUserRecordings(teacher.zoomUserId, ZOOM_FROM, ZOOM_TO);
    list = listed?.meetings || listed || [];
  } catch (e) {
    console.log('  Zoom list fail', teacher.name, e.message);
    return { moved: 0, synced: 0 };
  }

  const mp4s = [];
  for (const r of list) {
    for (const f of r.recording_files || []) {
      if (String(f.file_type || '').toUpperCase() !== 'MP4') continue;
      if ((f.file_size || 0) < MIN_MP4_BYTES) continue;
      const startMs = new Date(f.recording_start || r.start_time).getTime();
      if (!startMs) continue;
      mp4s.push({
        id: String(f.id),
        startMs,
        sizeMB: Math.round((f.file_size || 0) / 1e6),
        dur: r.duration
      });
    }
  }

  const teacherLives = [];
  for (const b of teacherBatches) {
    if (/^upii/i.test(b.name || '')) continue;
    const lives = await LiveClass.find({
      batchId: String(b._id),
      scheduledStart: { $gte: new Date(SINCE) }
    }).lean();
    for (const s of lives) teacherLives.push({ ...s, batchName: b.name });
  }

  console.log(`\n## ${teacher.name || teacher.email} | MP4s ${mp4s.length} lives ${teacherLives.length}`);

  let moved = 0;
  let synced = 0;
  const claimedRecIds = new Set();
  const assignedLiveIds = new Set();

  // Pass 1: reassign wrongly attached recordings
  for (const rec of mp4s.sort((a, b) => b.sizeMB - a.sizeMB)) {
    const candidates = teacherLives
      .filter((s) => s.status !== 'cancelled' || s.youtubeVideoId)
      .map((s) => ({
        s,
        delta: Math.abs(new Date(s.scheduledStart).getTime() - rec.startMs),
        score: scoreLiveForMatch(s, rec.startMs)
      }))
      .filter((c) => c.delta <= MATCH_WINDOW_MS)
      .sort((a, b) => a.score - b.score);

    if (!candidates.length) continue;
    const best = candidates[0];

    // Cross-batch ambiguity: two different batches nearly equal → skip auto
    const rival = candidates.find(
      (c) =>
        String(c.s._id) !== String(best.s._id) &&
        String(c.s.batchId) !== String(best.s.batchId) &&
        Math.abs(c.delta - best.delta) < 5 * 60 * 1000
    );
    if (rival) {
      console.log(
        '  AMBIGUOUS',
        new Date(rec.startMs).toISOString().slice(0, 16),
        rec.sizeMB + 'MB',
        best.s.batchName,
        'vs',
        rival.s.batchName
      );
      continue;
    }

    const owner = teacherLives.find((s) => String(s.zoomRecordingId) === rec.id && s.youtubeVideoId);
    if (owner && String(owner._id) === String(best.s._id)) {
      claimedRecIds.add(rec.id);
      assignedLiveIds.add(String(best.s._id));
      continue;
    }

    if (owner && String(owner._id) !== String(best.s._id)) {
      const ownerDelta = Math.abs(new Date(owner.scheduledStart).getTime() - rec.startMs);
      const ownerIsTest =
        isTestLike(owner.title) || /testing/i.test(owner.batchName || '');
      const crossBatch = String(owner.batchId) !== String(best.s.batchId);
      const clearlyWrongOwner = ownerDelta >= 3 * 60 * 60 * 1000;
      const muchBetterTarget =
        best.delta < 15 * 60 * 1000 && ownerDelta > best.delta + 25 * 60 * 1000;
      const stealFromGeneric =
        crossBatch &&
        isGenericLiveTitle(owner.title) &&
        best.delta < 12 * 60 * 1000 &&
        ownerDelta > 90 * 60 * 1000;

      // Protect delayed-but-correct same-class Zoom files (e.g. LMS start early, Zoom file ~2h later).
      if (
        crossBatch &&
        owner.youtubeVideoId &&
        !ownerIsTest &&
        !isGenericLiveTitle(owner.title) &&
        ownerDelta < 3 * 60 * 60 * 1000
      ) {
        claimedRecIds.add(rec.id);
        assignedLiveIds.add(String(owner._id));
        continue;
      }

      const safeToMove =
        !best.s.youtubeVideoId &&
        (ownerIsTest || clearlyWrongOwner || (!crossBatch && muchBetterTarget) || stealFromGeneric);

      if (!safeToMove) {
        claimedRecIds.add(rec.id);
        assignedLiveIds.add(String(owner._id));
        continue;
      }
      const label = `${owner.batchName} → ${best.s.batchName} ${new Date(best.s.scheduledStart).toISOString().slice(0, 16)} (${rec.sizeMB}MB)`;
      const out = await moveYoutube(String(owner._id), String(best.s._id), label);
      if (out.moved || out.dry) {
        moved++;
        claimedRecIds.add(rec.id);
        assignedLiveIds.add(String(best.s._id));
        owner.youtubeVideoId = '';
        owner.zoomRecordingId = '';
        best.s.youtubeVideoId = 'pending-move';
        for (const dup of hideBurstDuplicates(teacherLives, best.s, assignedLiveIds)) {
          assignedLiveIds.add(String(dup._id));
          await cancelOrHideLive(dup, 'Duplicate start — recording on sibling session');
          console.log('  HIDE dup', dup.batchName, new Date(dup.scheduledStart).toISOString().slice(0, 16));
        }
      }
      continue;
    }

    // Free recording → sync onto best if it needs video
    if (!best.s.youtubeVideoId && best.s.status !== 'cancelled' && !best.s.skipRecordingUpload && best.s.status !== 'live') {
      if (assignedLiveIds.has(String(best.s._id)) || claimedRecIds.has(rec.id)) continue;
      const when = new Date(best.s.scheduledStart).toISOString().slice(0, 16);
      const label = `${best.s.batchName} ${when} ${(best.s.title || '').slice(0, 30)} ← ${rec.sizeMB}MB`;
      const out = await forceSyncLive(String(best.s._id), rec.id, label);
      if (out?.synced || out?.dry) {
        synced++;
        claimedRecIds.add(rec.id);
        assignedLiveIds.add(String(best.s._id));
        best.s.youtubeVideoId = 'pending-sync';
        for (const dup of hideBurstDuplicates(teacherLives, best.s, assignedLiveIds)) {
          assignedLiveIds.add(String(dup._id));
          await cancelOrHideLive(dup, 'Duplicate start — recording on sibling session');
          console.log('  HIDE dup', dup.batchName, new Date(dup.scheduledStart).toISOString().slice(0, 16));
        }
      }
    }
  }

  return { moved, synced };
}

async function main() {
  console.log(dryRun ? 'DRY RUN' : 'LIVE REPAIR');
  await publishHiddenReals();

  console.log('\n=== Reassign + force-sync Zoom recordings ===');
  const teachers = await User.find({ role: 'teacher' }).lean();
  const batches = await Batch.find({}).lean();
  let totalMoved = 0;
  let totalSynced = 0;

  for (const t of teachers) {
    if (!t.zoomUserId) continue;
    const { moved, synced } = await repairZoomForTrainer(t, batches);
    totalMoved += moved;
    totalSynced += synced;
  }

  console.log(`\nDONE moved=${totalMoved} synced=${totalSynced}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
