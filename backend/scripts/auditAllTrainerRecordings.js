#!/usr/bin/env node
/**
 * Read-only audit: Zoom cloud recordings vs LMS sessions / Classroom for every trainer.
 *   node scripts/auditAllTrainerRecordings.js [--since=2026-07-01]
 */
require('dotenv').config({ path: process.env.ENV_PATH || '.env' });

const LiveClass = require('../models/LiveClass');
const Classroom = require('../models/Classroom');
const Batch = require('../models/Batch');
const User = require('../models/User');
const zoomService = require('../services/zoomService');
const { connectMongo } = require('../config/mongo');

const sinceArg = process.argv.find((a) => a.startsWith('--since='));
const SINCE = new Date(sinceArg ? sinceArg.split('=')[1] : '2026-07-01T00:00:00.000Z');
const MATCH_WINDOW_MIN = 90;
const FULL_MIN = 15;

const ist = (d) =>
  d ? new Date(new Date(d).getTime() + 330 * 60000).toISOString().slice(0, 16).replace('T', ' ') : '-';
const mins = (f) => Math.round((new Date(f.recordingEnd) - new Date(f.recordingStart)) / 60000);
const idOf = (x) => String(x._id || x.id || '');
const anchor = (l) => new Date(l.actualStartedAt || l.scheduledStart).getTime();

async function listRecordings(zoomUserId) {
  const out = [];
  let from = new Date(SINCE);
  const now = new Date();
  while (from < now) {
    const to = new Date(Math.min(from.getTime() + 29 * 86400000, now.getTime()));
    const r = await zoomService.listUserRecordings(
      zoomUserId,
      from.toISOString().slice(0, 10),
      to.toISOString().slice(0, 10)
    );
    out.push(...(r.recordings || []).filter((f) => f.fileType === 'MP4'));
    from = new Date(to.getTime() + 86400000);
  }
  const seen = new Set();
  return out.filter((f) => (seen.has(f.id) ? false : seen.add(f.id)));
}

(async () => {
  await connectMongo();
  const batches = new Map((await Batch.find({}).lean()).map((b) => [idOf(b), b.name]));
  const bn = (id) => batches.get(String(id)) || String(id);

  // Two filter keys: single-key facade queries are capped at 1000 docs.
  const lives = (
    await LiveClass.find({ scheduledStart: { $gte: SINCE }, zoomMeetingId: { $nin: ['', null] } }).lean()
  ).filter(
    (l) => l.status !== 'cancelled' || l.youtubeVideoId
  );
  const classrooms = await Classroom.find({}).lean();
  const clsByLive = new Map();
  for (const c of classrooms) {
    if (!c.liveClassId) continue;
    if (!clsByLive.has(c.liveClassId)) clsByLive.set(c.liveClassId, []);
    clsByLive.get(c.liveClassId).push(c);
  }

  const teacherIds = [...new Set(lives.map((l) => String(l.teacherId || '')).filter(Boolean))];
  const issues = [];
  const add = (trainer, type, detail) => issues.push({ trainer, type, ...detail });

  // Duplicate YouTube across batches (visible)
  const ytMap = new Map();
  for (const c of classrooms) {
    if (!c.youtubeVideoId || c.studentVisible === false) continue;
    if (!ytMap.has(c.youtubeVideoId)) ytMap.set(c.youtubeVideoId, []);
    ytMap.get(c.youtubeVideoId).push(c);
  }
  for (const [yt, rows] of ytMap) {
    const bs = new Set(rows.map((r) => String(r.batchId)));
    if (bs.size > 1)
      add('-', 'SAME_VIDEO_MULTIPLE_BATCHES', { yt, batches: [...bs].map(bn), titles: rows.map((r) => r.title) });
  }

  for (const tid of teacherIds) {
    let t = null;
    try {
      t = await User.findById(tid).lean();
    } catch {
      t = null;
    }
    const tname = t?.name || tid;
    const zid = t?.zoomUserId || t?.email;
    const mine = lives.filter((l) => String(l.teacherId) === tid && l.zoomMeetingId);
    if (!mine.length || !zid) continue;

    let recs = [];
    try {
      recs = await listRecordings(zid);
    } catch (e) {
      add(tname, 'ZOOM_LIST_FAILED', { error: e.response?.data?.message || e.message });
      continue;
    }
    const recById = new Map(recs.map((f) => [String(f.id), f]));

    // Expected owner per recording: closest session (same meeting id) whose anchor is within window
    const expected = new Map();
    for (const f of recs) {
      if (mins(f) < FULL_MIN) continue;
      const rs = new Date(f.recordingStart).getTime();
      const cands = mine
        .filter((l) => String(l.zoomMeetingId) === String(f.meetingId))
        .map((l) => ({ l, d: Math.abs(anchor(l) - rs) / 60000, before: anchor(l) <= rs + 5 * 60000 }))
        .filter((x) => x.d <= MATCH_WINDOW_MIN)
        .sort((a, b) => (a.before === b.before ? a.d - b.d : a.before ? -1 : 1));
      if (cands.length) expected.set(String(f.id), cands);
    }

    const usedBy = new Map();
    for (const l of mine) {
      if (!l.zoomRecordingId) continue;
      if (!usedBy.has(l.zoomRecordingId)) usedBy.set(l.zoomRecordingId, []);
      usedBy.get(l.zoomRecordingId).push(l);
    }

    // Same Zoom recording published in different batches
    for (const [rid, ls] of usedBy) {
      const vis = ls.filter((l) => (clsByLive.get(idOf(l)) || []).some((c) => c.studentVisible !== false));
      const bs = new Set(vis.map((l) => String(l.batchId)));
      if (bs.size > 1)
        add(tname, 'ZOOM_FILE_IN_MULTIPLE_BATCHES', {
          rec: rid.slice(0, 8),
          sessions: vis.map((l) => `${bn(l.batchId)} ${ist(anchor(l))} ${idOf(l).slice(0, 8)}`)
        });
    }

    for (const l of mine) {
      const lid = idOf(l);
      const cls = clsByLive.get(lid) || [];
      const visible = cls.filter((c) => c.studentVisible !== false && c.youtubeVideoId);
      const tag = `${bn(l.batchId)} ${ist(anchor(l))} ${lid.slice(0, 8)}`;

      for (const c of cls) {
        if (String(c.batchId) !== String(l.batchId))
          add(tname, 'CLASSROOM_BATCH_MISMATCH', { session: tag, classroomBatch: bn(c.batchId) });
      }

      if (l.zoomRecordingId) {
        const f = recById.get(String(l.zoomRecordingId));
        if (f && visible.length) {
          const off = Math.round((new Date(f.recordingStart).getTime() - anchor(l)) / 60000);
          const exp = expected.get(String(f.id));
          const owner = exp?.[0]?.l;
          if (owner && String(owner.batchId) !== String(l.batchId))
            add(tname, Math.abs(off) <= 20 ? 'AMBIGUOUS_SAME_TIME' : 'VIDEO_FROM_OTHER_BATCH', {
              session: tag,
              lecture: visible[0].title,
              lectureYt: visible[0].youtubeVideoId,
              manuallyReplaced: visible[0].youtubeVideoId !== l.youtubeVideoId,
              ownerYt: owner.youtubeVideoId || '-',
              rec: `${f.id.slice(0, 8)} ${ist(f.recordingStart)} ${mins(f)}m`,
              belongsTo: `${bn(owner.batchId)} ${ist(anchor(owner))} ${idOf(owner).slice(0, 8)}`
            });
          else if (Math.abs(off) > MATCH_WINDOW_MIN)
            add(tname, 'VIDEO_TIME_MISMATCH', {
              session: tag,
              lecture: visible[0].title,
              manuallyReplaced: visible[0].youtubeVideoId !== l.youtubeVideoId,
              rec: `${f.id.slice(0, 8)} ${ist(f.recordingStart)} ${mins(f)}m`,
              offsetMin: off
            });
        }
      }
    }

    // Full recordings not published anywhere visible
    for (const f of recs) {
      if (mins(f) < FULL_MIN) continue;
      const users = (usedBy.get(String(f.id)) || []).filter((l) =>
        (clsByLive.get(idOf(l)) || []).some((c) => c.studentVisible !== false && c.youtubeVideoId)
      );
      if (users.length) continue;
      const exp = expected.get(String(f.id));
      const owner = exp?.[0]?.l;
      let ownerHasVideo = false;
      if (owner) {
        ownerHasVideo = (clsByLive.get(idOf(owner)) || []).some(
          (c) => c.studentVisible !== false && c.youtubeVideoId
        );
      }
      add(tname, ownerHasVideo ? 'EXTRA_RECORDING_UNUSED' : 'RECORDING_NOT_PUBLISHED', {
        rec: `${f.id.slice(0, 8)} mtg ${f.meetingId} ${ist(f.recordingStart)} ${mins(f)}m ${Math.round(
          (f.fileSize || 0) / 1e6
        )}MB`,
        likelySession: owner
          ? `${bn(owner.batchId)} ${ist(anchor(owner))} ${idOf(owner).slice(0, 8)} yt=${owner.youtubeVideoId || '-'} skip=${!!owner.skipRecordingUpload} waste=${!!owner.wasteSessionFlagged}`
          : 'NO MATCHING SESSION'
      });
    }
  }

  const byType = {};
  for (const i of issues) byType[i.type] = (byType[i.type] || 0) + 1;
  console.log(`\nAudit since ${SINCE.toISOString().slice(0, 10)} — sessions=${lives.length} trainers=${teacherIds.length}`);
  console.log('Counts:', JSON.stringify(byType));
  for (const i of issues) console.log(JSON.stringify(i));
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
