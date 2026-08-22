#!/usr/bin/env node
/**
 * Re-attach Meet recordings when LMS has the wrong Drive file (size mismatch vs Meet API source).
 *
 * Usage:
 *   node scripts/repairMeetRecordings.js --dry-run
 *   node scripts/repairMeetRecordings.js --since=2026-08-20
 *   node scripts/repairMeetRecordings.js --meeting=ffb421e96706d11bf2c0fdad
 */
require('dotenv').config({ path: process.env.ENV_PATH || '.env' });

const { google } = require('googleapis');
const LiveClass = require('../models/LiveClass');
const { getGoogleAuth } = require('../services/googleAuth');
const googleDriveService = require('../services/googleDriveService');
const { syncOneLiveClass } = require('../services/meetRecordingSync');

function arg(name, fallback = '') {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : fallback;
}

const dryRun = process.argv.includes('--dry-run');
const meetingId = arg('meeting');
const since = arg('since', '2026-08-20');

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
    } catch (_) {
      /* try next filter */
    }
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
    } catch (_) {
      /* next record */
    }
  }
  return '';
}

async function fileSize(id) {
  if (!id) return 0;
  try {
    const meta = await googleDriveService.getFileMeta(id);
    return Number(meta.size || 0);
  } catch (_) {
    return 0;
  }
}

(async () => {
  const auth = await getGoogleAuth();
  const meet = google.meet({ version: 'v2', auth });
  const sinceDate = new Date(`${since}T00:00:00+05:30`);

  let docs = [];
  if (meetingId) {
    const one = await LiveClass.findById(meetingId).lean().exec();
    if (one) docs = [one];
  } else {
    const all = await LiveClass.find({ status: { $ne: 'cancelled' } })
      .lean()
      .exec();
    docs = (all || []).filter((d) => {
      if (!d.batchId || d.skipRecordingUpload) return false;
      const t = d.scheduledStart ? new Date(d.scheduledStart).getTime() : 0;
      return t >= sinceDate.getTime();
    });
  }

  const actions = [];
  for (const doc of docs) {
    const expectedId = await expectedMeetSource(meet, doc);
    if (!expectedId) continue;
    const expectedSize = await fileSize(expectedId);
    if (!expectedSize) continue;

    if (!doc.driveFileId) {
      actions.push({ doc, kind: 'missing', expectedId, expectedSize });
      continue;
    }

    const attachedSize = await fileSize(doc.driveFileId);
    if (attachedSize !== expectedSize) {
      actions.push({
        doc,
        kind: 'mismatch',
        expectedId,
        expectedSize,
        attached: doc.driveFileId,
        attachedSize
      });
    }
  }

  console.log(`${dryRun ? '[DRY RUN] ' : ''}Found ${actions.length} sessions to repair`);
  for (const a of actions) {
    console.log(
      JSON.stringify({
        kind: a.kind,
        id: String(a.doc._id),
        teacher: a.doc.teacherName,
        title: a.doc.title,
        batchId: a.doc.batchId,
        attached: a.attached || '',
        attachedSize: a.attachedSize || 0,
        expectedId: a.expectedId,
        expectedSize: a.expectedSize
      })
    );

    if (dryRun) continue;

    const live = await LiveClass.findById(a.doc._id);
    if (!live) continue;
    live.driveFileId = '';
    live.driveLink = '';
    live.recordingSyncError = '';
    live.updatedAt = new Date();
    await live.save();

    const out = await syncOneLiveClass(live.toObject ? live.toObject() : live);
    console.log('  ->', JSON.stringify(out));
  }

  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
