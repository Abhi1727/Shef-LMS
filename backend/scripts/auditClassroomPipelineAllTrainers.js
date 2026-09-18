#!/usr/bin/env node
/**
 * All-trainer classroom pipeline audit (Zoom + Meet).
 * Checks: media without classroom, wrong batch, playable-hidden, ended gaps.
 *
 *   ENV_PATH=.env node scripts/auditClassroomPipelineAllTrainers.js
 *   ENV_PATH=.env node scripts/auditClassroomPipelineAllTrainers.js --since=2026-08-01
 */
require('dotenv').config({ path: process.env.ENV_PATH || '.env' });

const fs = require('fs');
const path = require('path');
const LiveClass = require('../models/LiveClass');
const Classroom = require('../models/Classroom');
const Batch = require('../models/Batch');
const User = require('../models/User');

function arg(name, fallback = '') {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : fallback;
}

const sinceStr = arg('since', '2026-08-01');
const SINCE = new Date(`${sinceStr}T00:00:00+05:30`);
const OUT = path.join(__dirname, `classroom-pipeline-audit-${sinceStr}.json`);

function playable(lec) {
  return Boolean(lec.youtubeVideoId || lec.youtubeEmbedUrl || lec.youtubeVideoUrl || lec.driveId);
}
function liveHasMedia(l) {
  return Boolean(l.youtubeVideoId || l.driveFileId);
}

(async () => {
  const teachers = await User.find({
    role: { $in: ['teacher', 'instructor', 'mentor'] },
    status: { $ne: 'inactive' }
  })
    .select('name email role conferenceProvider status')
    .lean();
  const batches = await Batch.find({}).select('name teacherId course status').lean();
  const batchById = new Map(batches.map((b) => [String(b._id), b]));
  const teacherById = new Map(teachers.map((t) => [String(t._id), t]));

  const lives = await LiveClass.find({
    scheduledStart: { $gte: SINCE },
    batchId: { $nin: ['', null] }
  }).lean();

  const classrooms = await Classroom.find({
    $or: [
      { date: { $gte: sinceStr } },
      { createdAt: { $gte: SINCE } },
      { liveClassId: { $nin: ['', null] } }
    ]
  }).lean();

  const classByLive = new Map();
  for (const c of classrooms) {
    if (c.liveClassId) classByLive.set(String(c.liveClassId), c);
  }

  const issues = {
    liveHasMediaNoClassroom: [],
    liveClassroomWrongBatch: [],
    classroomWrongBatchVsLive: [],
    playableHidden: [],
    endedNoMedia: [],
    wasteBlocked: [],
    stubUnplayable: []
  };

  const now = Date.now();
  const liveById = new Map(lives.map((l) => [String(l._id), l]));

  for (const live of lives) {
    const id = String(live._id);
    const batch = batchById.get(String(live.batchId));
    const teacher = teacherById.get(String(live.teacherId)) || null;
    const room =
      classByLive.get(id) ||
      (live.classroomLectureId
        ? classrooms.find((c) => String(c._id) === String(live.classroomLectureId))
        : null);
    const ended =
      live.status === 'completed' ||
      live.status === 'ended' ||
      (live.scheduledEnd && new Date(live.scheduledEnd).getTime() < now - 15 * 60 * 1000) ||
      (live.scheduledStart && new Date(live.scheduledStart).getTime() < now - 3 * 60 * 60 * 1000);
    const waste = live.wasteSessionFlagged && !live.wasteSessionDismissedAt;
    const skip = live.skipRecordingUpload || waste;
    const base = {
      liveId: id,
      title: live.title || '',
      date: live.scheduledStart ? new Date(live.scheduledStart).toISOString().slice(0, 10) : '',
      batchId: String(live.batchId || ''),
      batchName: batch?.name || live.batchName || '',
      teacher: teacher?.name || live.teacherName || '',
      teacherEmail: teacher?.email || '',
      provider: live.conferenceProvider || '',
      status: live.status || '',
      yt: live.youtubeVideoId || '',
      drive: live.driveFileId || '',
      skip: Boolean(skip),
      waste: Boolean(waste)
    };

    if (skip && ended && !liveHasMedia(live)) issues.wasteBlocked.push(base);

    if (
      ended &&
      !skip &&
      !liveHasMedia(live) &&
      live.status !== 'cancelled' &&
      live.status !== 'scheduled' &&
      live.scheduledStart &&
      new Date(live.scheduledStart).getTime() < now - 2 * 60 * 60 * 1000
    ) {
      issues.endedNoMedia.push(base);
    }

    if (liveHasMedia(live) && !skip) {
      if (!room) {
        issues.liveHasMediaNoClassroom.push(base);
      } else if (String(room.batchId) !== String(live.batchId)) {
        issues.liveClassroomWrongBatch.push({
          ...base,
          classroomId: String(room._id),
          classroomBatchId: String(room.batchId),
          classroomBatchName: batchById.get(String(room.batchId))?.name || ''
        });
      }
    }
  }

  for (const c of classrooms) {
    if (!playable(c)) {
      if (
        ['pending', 'meet-session'].includes(String(c.videoSource || '')) ||
        (!c.youtubeVideoId && !c.driveId)
      ) {
        if (c.liveClassId || String(c.date || '') >= sinceStr) {
          issues.stubUnplayable.push({
            classroomId: String(c._id),
            title: c.title,
            date: c.date,
            batchId: String(c.batchId || ''),
            batchName: batchById.get(String(c.batchId))?.name || c.batchName || '',
            videoSource: c.videoSource || '',
            studentVisible: c.studentVisible !== false,
            liveClassId: c.liveClassId || ''
          });
        }
      }
      continue;
    }
    if (c.studentVisible === false) {
      issues.playableHidden.push({
        classroomId: String(c._id),
        title: c.title,
        date: c.date,
        batchId: String(c.batchId || ''),
        batchName: batchById.get(String(c.batchId))?.name || c.batchName || '',
        yt: c.youtubeVideoId || '',
        drive: c.driveId || ''
      });
    }
    if (c.liveClassId) {
      const live = liveById.get(String(c.liveClassId));
      if (live && String(live.batchId) !== String(c.batchId)) {
        issues.classroomWrongBatchVsLive.push({
          classroomId: String(c._id),
          title: c.title,
          date: c.date,
          classroomBatch: batchById.get(String(c.batchId))?.name || c.batchId,
          liveBatch: batchById.get(String(live.batchId))?.name || live.batchId,
          liveTitle: live.title
        });
      }
    }
  }

  const byTeacher = {};
  for (const live of lives) {
    if (live.status === 'cancelled') continue;
    const tid = String(live.teacherId || 'unknown');
    const t = teacherById.get(tid);
    if (!byTeacher[tid]) {
      byTeacher[tid] = {
        name: t?.name || live.teacherName || tid,
        email: t?.email || '',
        provider: t?.conferenceProvider || live.conferenceProvider || '',
        ended: 0,
        ok: 0,
        missingMedia: 0,
        missingClassroom: 0,
        hidden: 0,
        waste: 0,
        wrongBatch: 0
      };
    }
    const ended =
      live.status === 'completed' ||
      live.status === 'ended' ||
      (live.scheduledStart && new Date(live.scheduledStart).getTime() < now - 3 * 60 * 60 * 1000);
    if (!ended) continue;
    byTeacher[tid].ended += 1;
    const waste = live.wasteSessionFlagged && !live.wasteSessionDismissedAt;
    if (waste || live.skipRecordingUpload) {
      byTeacher[tid].waste += 1;
      continue;
    }
    const room =
      classByLive.get(String(live._id)) ||
      (live.classroomLectureId
        ? classrooms.find((c) => String(c._id) === String(live.classroomLectureId))
        : null);
    if (
      liveHasMedia(live) &&
      room &&
      playable(room) &&
      room.studentVisible !== false &&
      String(room.batchId) === String(live.batchId)
    ) {
      byTeacher[tid].ok += 1;
    } else if (liveHasMedia(live) && room && String(room.batchId) !== String(live.batchId)) {
      byTeacher[tid].wrongBatch += 1;
    } else if (liveHasMedia(live) && room && room.studentVisible === false) {
      byTeacher[tid].hidden += 1;
    } else if (liveHasMedia(live) && !room) {
      byTeacher[tid].missingClassroom += 1;
    } else {
      byTeacher[tid].missingMedia += 1;
    }
  }

  const summary = {
    since: sinceStr,
    teachers: teachers.length,
    batches: batches.length,
    lives: lives.length,
    classroomsScanned: classrooms.length,
    issueCounts: Object.fromEntries(Object.entries(issues).map(([k, v]) => [k, v.length])),
    trainerCoverage: Object.values(byTeacher)
      .sort((a, b) => b.ended - b.ok - (a.ended - a.ok) || b.ended - a.ended)
      .map((t) => ({ ...t, gap: t.ended - t.ok - t.waste }))
  };

  const capped = {};
  for (const [k, arr] of Object.entries(issues)) {
    capped[k] = arr.slice(0, 80);
  }

  const out = { summary, issues: capped, generatedAt: new Date().toISOString() };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));

  console.log(JSON.stringify(summary, null, 2));
  console.log('\n--- TRAINERS WITH GAPS ---');
  summary.trainerCoverage
    .filter((t) => t.gap > 0 || t.wrongBatch || t.hidden || t.missingClassroom)
    .forEach((t) => {
      console.log(
        `${t.name} (${t.provider}) | ended=${t.ended} ok=${t.ok} gap=${t.gap} missMedia=${t.missingMedia} missClass=${t.missingClassroom} hidden=${t.hidden} wrongBatch=${t.wrongBatch} waste=${t.waste}`
      );
    });
  console.log('\n--- ISSUE SAMPLES ---');
  for (const [k, arr] of Object.entries(capped)) {
    if (!arr.length) continue;
    console.log(`\n[${k}] total=${issues[k].length}`);
    arr.slice(0, 10).forEach((x) => console.log(' ', JSON.stringify(x)));
  }
  console.log(`\nWrote ${OUT}`);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
