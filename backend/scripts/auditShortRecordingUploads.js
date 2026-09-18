#!/usr/bin/env node
/**
 * Find short Zoom stubs uploaded to Classroom / YouTube when a full class exists.
 *
 *   node scripts/auditShortRecordingUploads.js --since=2026-08-01
 *   node scripts/auditShortRecordingUploads.js --since=2026-08-01 --fix
 */
require('dotenv').config({ path: process.env.ENV_PATH || '.env' });

const LiveClass = require('../models/LiveClass');
const Classroom = require('../models/Classroom');
const Batch = require('../models/Batch');
const User = require('../models/User');
const { parseDurationToMinutes } = require('../utils/wasteSessionDetection');
const { fetchZoomRecordingsForSession } = require('../services/zoomRecordingSync');

const dryRun = !process.argv.includes('--fix');
const sinceArg = process.argv.find((a) => a.startsWith('--since='));
const sinceDate = sinceArg
  ? new Date(`${sinceArg.split('=')[1]}T00:00:00.000Z`)
  : new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);

const MAX_SHORT_MIN = 10;
const MIN_FULL_MIN = 30;

function zoomMins(f) {
  const s = f.recordingStart || f.recording_start;
  const e = f.recordingEnd || f.recording_end;
  if (s && e) return (new Date(e) - new Date(s)) / 60000;
  return null;
}

async function hideStub({ live, lecture, reason }) {
  console.log(`  FIX ${reason}: ${live?.title || lecture?.title}`);
  if (dryRun) return;

  if (live) {
    live.status = live.status === 'completed' ? 'cancelled' : live.status;
    live.skipRecordingUpload = true;
    live.wasteSessionFlagged = true;
    live.wasteSessionReasons = ['short_recording', 'duplicate_burst'];
    live.updatedAt = new Date();
    await live.save();
  }

  if (lecture) {
    lecture.studentVisible = false;
    lecture.updatedAt = new Date();
    await lecture.save();
  } else if (live?.classroomLectureId) {
    const lec = await Classroom.findById(live.classroomLectureId).exec();
    if (lec) {
      lec.studentVisible = false;
      lec.updatedAt = new Date();
      await lec.save();
    }
  }
}

(async () => {
  const users = await User.find({}).lean();
  const userById = new Map(users.map((u) => [String(u._id), u]));
  const batches = await Batch.find({}).lean();
  const batchById = new Map(batches.map((b) => [String(b._id), b]));

  const sessions = await LiveClass.find({
    conferenceProvider: 'zoom',
    batchId: { $nin: ['', null] },
    zoomMeetingId: { $nin: ['', null] },
    scheduledStart: { $gte: sinceDate },
    status: { $nin: ['cancelled'] },
    youtubeVideoId: { $nin: ['', null] }
  })
    .sort({ scheduledStart: 1 })
    .lean();

  const stubs = [];
  for (const s of sessions) {
    let zoomMinsVal = null;
    if (s.zoomRecordingId) {
      try {
        const r = await fetchZoomRecordingsForSession(s);
        const f = (r.recordings || []).find((x) => String(x.id) === String(s.zoomRecordingId));
        zoomMinsVal = f ? zoomMins(f) : null;
      } catch {
        zoomMinsVal = null;
      }
    }
    const labelMins = parseDurationToMinutes(s.duration);
    const short =
      zoomMinsVal !== null
        ? zoomMinsVal < MAX_SHORT_MIN
        : labelMins !== null && labelMins < MAX_SHORT_MIN;
    if (!short) continue;

    const day = new Date(s.scheduledStart).toISOString().slice(0, 10);
    const teacher = userById.get(String(s.teacherId));
    const batch = batchById.get(String(s.batchId));
    const lecture = s.classroomLectureId
      ? await Classroom.findById(s.classroomLectureId).lean()
      : null;

    const sameBatchDay = await LiveClass.find({
      batchId: s.batchId,
      scheduledStart: {
        $gte: new Date(`${day}T00:00:00.000Z`),
        $lt: new Date(`${day}T23:59:59.999Z`)
      },
      status: { $nin: ['cancelled'] },
      _id: { $ne: s._id }
    }).lean();

    const hasFullSibling = sameBatchDay.some((other) => {
      const m = parseDurationToMinutes(other.duration);
      return other.youtubeVideoId && m !== null && m >= MIN_FULL_MIN;
    });

    stubs.push({
      live: s,
      lecture,
      zoomMinsVal,
      labelMins,
      teacher: teacher?.name || teacher?.email,
      batch: batch?.name,
      hasFullSibling,
      testTitle: /^test\b/i.test(String(s.title || ''))
    });
  }

  console.log(`Short uploads since ${sinceDate.toISOString().slice(0, 10)}: ${stubs.length}${dryRun ? ' [DRY RUN]' : ''}`);
  let fixed = 0;
  for (const row of stubs) {
    const { live, lecture, zoomMinsVal, labelMins, teacher, batch, hasFullSibling, testTitle } = row;
    console.log(
      `\n- ${new Date(live.scheduledStart).toISOString().slice(0, 16)} | ${teacher} | ${batch}`
    );
    console.log(`  ${live.title} | zoom=${zoomMinsVal != null ? Math.round(zoomMinsVal) + 'm' : '?'} label=${labelMins ?? '?'}m yt=${live.youtubeVideoId}`);
    console.log(`  visible=${lecture?.studentVisible !== false} fullSibling=${hasFullSibling} test=${testTitle}`);

    const shouldHide =
      testTitle ||
      hasFullSibling ||
      (zoomMinsVal !== null
        ? zoomMinsVal < MAX_SHORT_MIN
        : labelMins !== null && labelMins < MAX_SHORT_MIN);

    if (shouldHide && (lecture?.studentVisible !== false || !live.wasteSessionFlagged)) {
      await hideStub({
        live: await LiveClass.findById(live._id).exec(),
        lecture: lecture ? await Classroom.findById(lecture._id).exec() : null,
        reason: hasFullSibling ? 'short-stub-with-full-class-same-day' : 'short-stub'
      });
      fixed += 1;
    }
  }

  // Visible classroom rows under 10 min (even without live class link)
  const lecs = await Classroom.find({
    studentVisible: true,
    youtubeVideoId: { $nin: ['', null] },
    date: { $gte: sinceDate.toISOString().slice(0, 10) }
  }).lean();

  for (const lec of lecs) {
    const m = parseDurationToMinutes(lec.duration);
    if (m === null || m >= MAX_SHORT_MIN) continue;
    const batch = batchById.get(String(lec.batchId));
    console.log(`\n- visible short lecture ${lec.date} | ${batch?.name} | ${lec.title} | ${lec.duration}`);
    if (!dryRun) {
      const doc = await Classroom.findById(lec._id).exec();
      if (doc) {
        doc.studentVisible = false;
        doc.updatedAt = new Date();
        await doc.save();
        fixed += 1;
      }
    }
  }

  console.log(`\n${dryRun ? 'Would fix' : 'Fixed'}: ${fixed}`);
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
