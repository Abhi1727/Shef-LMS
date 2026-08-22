#!/usr/bin/env node
/**
 * Diagnose Meet recording mis-attachments for a batch / date range.
 * Usage (prod container):
 *   node scripts/diagnoseRecordingMismatch.js --batch=DSAI-O-01057040 --date=2026-08-21
 */
require('dotenv').config({ path: process.env.ENV_PATH || '.env' });

const User = require('../models/User');
const Batch = require('../models/Batch');
const LiveClass = require('../models/LiveClass');
const Classroom = require('../models/Classroom');

function arg(name, fallback = '') {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : fallback;
}

function briefLive(d) {
  return {
    id: String(d._id),
    title: d.title,
    teacherId: d.teacherId,
    teacherName: d.teacherName,
    batchId: d.batchId,
    scheduledStart: d.scheduledStart,
    driveFileId: d.driveFileId || '',
    classroomLectureId: d.classroomLectureId || '',
    recordingSyncError: d.recordingSyncError || '',
    status: d.status
  };
}

function briefLec(d) {
  return {
    id: String(d._id),
    title: d.title,
    instructor: d.instructor,
    date: d.date,
    batchId: d.batchId,
    liveClassId: d.liveClassId || '',
    driveId: d.driveId || '',
    videoSource: d.videoSource
  };
}

(async () => {
  const batchKey = arg('batch', 'DSAI-O-01057040');
  const date = arg('date', '2026-08-21');

  const allTeachers = await User.find({ role: 'teacher' }).lean().exec();
  const trainers = (allTeachers || []).filter((t) =>
    /ankit|ravi/i.test(String(t.name || '') + String(t.email || ''))
  );

  console.log('=== TRAINERS ===');
  console.log(JSON.stringify(trainers.map((t) => ({ id: String(t._id), name: t.name, email: t.email })), null, 2));

  const student = await User.findOne({ formNumber: batchKey }).lean().exec();
  const ashton = student || (await User.find({}).lean().exec()).find((u) =>
    /ashton/i.test(String(u.name || ''))
  );

  console.log('\n=== STUDENT ===');
  console.log(JSON.stringify(ashton ? {
    id: String(ashton._id),
    name: ashton.name,
    formNumber: ashton.formNumber,
    batchId: ashton.batchId,
    enrollments: ashton.enrollments
  } : null, null, 2));

  const batchIds = new Set();
  if (ashton?.batchId) batchIds.add(String(ashton.batchId));
  for (const e of ashton?.enrollments || []) {
    if (e?.batchId) batchIds.add(String(e.batchId));
  }

  let batches = [];
  if (batchIds.size) {
    batches = await Batch.find({ _id: { $in: [...batchIds] } }).lean().exec();
  }
  if (!batches.length) {
    const allBatches = await Batch.find({}).lean().exec();
    batches = (allBatches || []).filter((b) =>
      /ashton|01057040/i.test(String(b.name || ''))
    );
  }

  console.log('\n=== BATCHES ===');
  console.log(JSON.stringify(batches.map((b) => ({
    id: String(b._id),
    name: b.name,
    batchType: b.batchType,
    teacherId: b.teacherId,
    teacherName: b.teacherName,
    driveFolderId: b.driveFolderId || ''
  })), null, 2));

  const resolvedBatchIds = batches.map((b) => String(b._id));
  if (!resolvedBatchIds.length) {
    console.log('\nNo batch found for key:', batchKey);
    process.exit(1);
  }

  const lectures = await Classroom.find({ batchId: { $in: resolvedBatchIds } })
    .sort({ date: -1, createdAt: -1 })
    .lean()
    .exec();

  console.log('\n=== CLASSROOM LECTURES (batch) ===');
  console.log(JSON.stringify(lectures.map(briefLec), null, 2));

  const dayStart = new Date(`${date}T00:00:00+05:30`);
  const dayEnd = new Date(`${date}T23:59:59+05:30`);

  const batchMeetings = await LiveClass.find({ batchId: { $in: resolvedBatchIds } })
    .sort({ scheduledStart: -1 })
    .lean()
    .exec();

  console.log('\n=== LIVE CLASSES (batch, all time) ===');
  console.log(JSON.stringify(batchMeetings.map(briefLive), null, 2));

  const trainerIds = trainers.map((t) => String(t._id));
  const allDayMeetings = await LiveClass.find({
    scheduledStart: { $gte: dayStart, $lte: dayEnd }
  })
    .sort({ scheduledStart: 1 })
    .lean()
    .exec()
    .catch(async () => {
      const all = await LiveClass.find({}).lean().exec();
      return (all || []).filter((m) => {
        const t = m.scheduledStart ? new Date(m.scheduledStart).getTime() : 0;
        return t >= dayStart.getTime() && t <= dayEnd.getTime();
      });
    });

  const yesterdayMeetings = (allDayMeetings || []).filter((m) =>
    trainerIds.includes(String(m.teacherId))
  );

  console.log(`\n=== LIVE CLASSES (Ankit+Ravi on ${date}) ===`);
  console.log(JSON.stringify(yesterdayMeetings.map(briefLive), null, 2));

  const driveMap = new Map();
  for (const m of yesterdayMeetings) {
    if (!m.driveFileId) continue;
    const list = driveMap.get(m.driveFileId) || [];
    list.push({ id: String(m._id), title: m.title, batchId: m.batchId, teacherName: m.teacherName });
    driveMap.set(m.driveFileId, list);
  }
  const dupes = [...driveMap.entries()].filter(([, rows]) => rows.length > 1);
  console.log('\n=== DUPLICATE driveFileId across meetings (same day) ===');
  console.log(JSON.stringify(Object.fromEntries(dupes), null, 2));

  const pending = yesterdayMeetings.filter((m) => !m.driveFileId);
  console.log(`\n=== PENDING (no driveFileId) count=${pending.length} ===`);
  console.log(JSON.stringify(pending.map((m) => ({
    id: String(m._id),
    title: m.title,
    teacherName: m.teacherName,
    batchId: m.batchId,
    error: m.recordingSyncError || ''
  })), null, 2));

  const wrongTrainer = batchMeetings.filter((m) => {
    const batch = batches.find((b) => String(b._id) === String(m.batchId));
    return batch?.teacherId && m.teacherId && String(batch.teacherId) !== String(m.teacherId);
  });
  console.log('\n=== MEETINGS ON BATCH WITH WRONG teacherId vs batch.teacherId ===');
  console.log(JSON.stringify(wrongTrainer.map(briefLive), null, 2));

  const lecDriveMap = new Map();
  for (const lec of lectures) {
    if (!lec.driveId) continue;
    const list = lecDriveMap.get(lec.driveId) || [];
    list.push({ id: String(lec._id), title: lec.title, batchId: lec.batchId, instructor: lec.instructor });
    lecDriveMap.set(lec.driveId, list);
  }
  for (const m of yesterdayMeetings) {
    if (!m.driveFileId) continue;
    const lecHits = lectures.filter((l) => l.driveId === m.driveFileId);
    if (lecHits.length && !resolvedBatchIds.includes(String(lecHits[0].batchId))) {
      console.log('\n=== CROSS-BATCH DRIVE LEAK ===');
      console.log(JSON.stringify({ meeting: briefLive(m), lectures: lecHits.map(briefLec) }, null, 2));
    }
  }

  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
