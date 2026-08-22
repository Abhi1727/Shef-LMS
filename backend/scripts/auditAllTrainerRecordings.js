#!/usr/bin/env node
/**
 * Audit Meet recording sync across all trainers (recent sessions).
 * Usage: node scripts/auditAllTrainerRecordings.js --since=2026-08-18
 */
require('dotenv').config({ path: process.env.ENV_PATH || '.env' });

const { google } = require('googleapis');
const LiveClass = require('../models/LiveClass');
const User = require('../models/User');
const { getGoogleAuth } = require('../services/googleAuth');
const googleDriveService = require('../services/googleDriveService');

function arg(name, fallback = '') {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : fallback;
}

const since = arg('since', '2026-08-18');
const sinceDate = new Date(`${since}T00:00:00+05:30`);

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

async function expectedMeetSource(meet, doc) {
  const space = spaceNameFromDoc(doc);
  const code = meetingCodeFromLink(doc.meetLink);
  let records = [];
  for (const filter of [space && `space.name = "${space}"`, code && `space.meeting_code = "${code}"`].filter(Boolean)) {
    try {
      const res = await meet.conferenceRecords.list({ filter, pageSize: 20 });
      records = res.data.conferenceRecords || [];
      if (records.length) break;
    } catch (_) {}
  }
  const start = doc.scheduledStart ? new Date(doc.scheduledStart).getTime() : 0;
  records.sort(
    (a, b) =>
      Math.abs(new Date(a.startTime).getTime() - start) - Math.abs(new Date(b.startTime).getTime() - start)
  );
  for (const record of records) {
    try {
      const recRes = await meet.conferenceRecords.recordings.list({ parent: record.name, pageSize: 10 });
      const ready = (recRes.data.recordings || []).find(
        (r) => String(r.state || '').toUpperCase() === 'FILE_GENERATED' && extractDriveIdFromRecording(r)
      );
      if (ready) return extractDriveIdFromRecording(ready);
    } catch (_) {}
  }
  return '';
}

async function fileSize(id) {
  if (!id) return 0;
  try {
    return Number((await googleDriveService.getFileMeta(id)).size || 0);
  } catch (_) {
    return 0;
  }
}

(async () => {
  const auth = await getGoogleAuth();
  const meet = google.meet({ version: 'v2', auth });
  const teachers = await User.find({ role: 'teacher' }).lean().exec();
  const teacherMap = new Map((teachers || []).map((t) => [String(t._id), t.name?.trim() || t.email]));

  const all = await LiveClass.find({ status: { $ne: 'cancelled' } }).lean().exec();
  const recent = (all || []).filter((d) => {
    if (!d.batchId || d.skipRecordingUpload) return false;
    const t = d.scheduledStart ? new Date(d.scheduledStart).getTime() : 0;
    return t >= sinceDate.getTime();
  });

  const byTrainer = {};
  const summary = { total: recent.length, ok: 0, mismatch: 0, missingReady: 0, pendingMeet: 0, noMeet: 0 };

  for (const doc of recent) {
    const trainer = teacherMap.get(String(doc.teacherId)) || doc.teacherName?.trim() || 'Unknown';
    if (!byTrainer[trainer]) {
      byTrainer[trainer] = { ok: [], mismatch: [], missingReady: [], pendingMeet: [], noMeet: [] };
    }

    if (!doc.meetLink && !doc.meetSpaceId) {
      summary.noMeet += 1;
      byTrainer[trainer].noMeet.push({ title: doc.title, start: doc.scheduledStart });
      continue;
    }

    const expectedId = await expectedMeetSource(meet, doc);
    if (!expectedId) {
      if (doc.driveFileId) {
        summary.ok += 1;
        byTrainer[trainer].ok.push({ title: doc.title, note: 'attached-no-meet-api' });
      } else {
        summary.pendingMeet += 1;
        byTrainer[trainer].pendingMeet.push({ title: doc.title, start: doc.scheduledStart, err: doc.recordingSyncError || '' });
      }
      continue;
    }

    const expectedSize = await fileSize(expectedId);
    if (!doc.driveFileId) {
      summary.missingReady += 1;
      byTrainer[trainer].missingReady.push({
        id: String(doc._id),
        title: doc.title,
        start: doc.scheduledStart,
        expectedSize
      });
      continue;
    }

    const attachedSize = await fileSize(doc.driveFileId);
    if (attachedSize && expectedSize && attachedSize !== expectedSize) {
      summary.mismatch += 1;
      byTrainer[trainer].mismatch.push({
        id: String(doc._id),
        title: doc.title,
        attachedSize,
        expectedSize
      });
    } else {
      summary.ok += 1;
      byTrainer[trainer].ok.push({ title: doc.title });
    }
  }

  console.log('=== SUMMARY since', since, '===');
  console.log(JSON.stringify(summary, null, 2));

  console.log('\n=== BY TRAINER (issues only) ===');
  for (const [trainer, buckets] of Object.entries(byTrainer).sort((a, b) => a[0].localeCompare(b[0]))) {
    const issueCount =
      buckets.mismatch.length + buckets.missingReady.length + buckets.pendingMeet.length;
    if (!issueCount) continue;
    console.log('\n---', trainer, '---');
    if (buckets.mismatch.length) console.log('MISMATCH', JSON.stringify(buckets.mismatch, null, 2));
    if (buckets.missingReady.length) console.log('MISSING (Meet ready)', JSON.stringify(buckets.missingReady, null, 2));
    if (buckets.pendingMeet.length) console.log('PENDING (Meet not ready)', JSON.stringify(buckets.pendingMeet.slice(0, 10), null, 2));
  }

  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
