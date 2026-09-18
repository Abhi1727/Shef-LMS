#!/usr/bin/env node
/**
 * Repair generic "— Live class" classroom rows since a date.
 *
 * - Merge playable generics onto empty titled classrooms (same batch+date)
 * - Rename unambiguous orphan generics using the best same-day LiveClass title
 * - Hide empty unplayable generics
 * - Skips test batches and ambiguous multi-title days
 *
 *   ENV_PATH=.env node scripts/repairGenericLiveClassTitles.js
 *   ENV_PATH=.env node scripts/repairGenericLiveClassTitles.js --dry
 *   ENV_PATH=.env node scripts/repairGenericLiveClassTitles.js --since=2026-08-01
 */
require('dotenv').config({ path: process.env.ENV_PATH || '.env' });

const Classroom = require('../models/Classroom');
const LiveClass = require('../models/LiveClass');
const Batch = require('../models/Batch');

function arg(name, fallback = '') {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : fallback;
}

const SINCE = arg('since', '2026-08-01');
const DRY = process.argv.includes('--dry');
const ORPHANS_ONLY = process.argv.includes('--orphans-only');
const MERGES_ONLY = process.argv.includes('--merges-only');

function playable(c) {
  return Boolean(c?.youtubeVideoId || c?.youtubeEmbedUrl || c?.youtubeVideoUrl || c?.driveId);
}
function isGeneric(title) {
  const t = String(title || '').trim();
  return /—\s*Live class\s*$/i.test(t) || /\bLive class\s*$/i.test(t);
}
function isWeakTitle(title) {
  const t = String(title || '').trim();
  if (!t) return true;
  if (isGeneric(t)) return true;
  // e.g. BATCH-06069103DS&AI · 05/09/2026
  if (/^[A-Z0-9&_-]+ · \d{2}\/\d{2}\/\d{4}$/i.test(t)) return true;
  if (/\b·\s*\d{2}\/\d{2}\/\d{4}$/.test(t) && t.length < 40) return true;
  if (/^(test|demo|trial|upi+|upii|testing|sample|pauthn|tuhsna|dsss)\b/i.test(t)) return true;
  if (t.length < 4) return true;
  return false;
}
function isTestBatch(name) {
  return /upii|test batch|upi test/i.test(String(name || ''));
}
function ytFields(src) {
  const id = src.youtubeVideoId || '';
  return {
    youtubeVideoId: id,
    youtubeVideoUrl: src.youtubeVideoUrl || (id ? `https://www.youtube.com/watch?v=${id}` : ''),
    youtubeEmbedUrl: src.youtubeEmbedUrl || (id ? `https://www.youtube.com/embed/${id}` : ''),
    driveId: src.driveId || src.driveFileId || '',
    videoSource: src.videoSource || 'zoom-recording',
    duration: src.duration || ''
  };
}

(async () => {
  const classrooms = await Classroom.find({
    $or: [{ date: { $gte: SINCE } }, { createdAt: { $gte: new Date(`${SINCE}T00:00:00+05:30`) } }]
  }).exec();

  const batchIds = [...new Set(classrooms.map((c) => String(c.batchId || '')).filter(Boolean))];
  const batches = await Batch.find({ _id: { $in: batchIds } }).select('name teacherName').lean();
  const batchMap = new Map(batches.map((b) => [String(b._id), b]));

  const groups = new Map();
  for (const c of classrooms) {
    const batchId = String(c.batchId || '');
    const date = String(c.date || '').slice(0, 10);
    if (!batchId || !date || date < SINCE) continue;
    const key = `${batchId}||${date}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }

  const report = {
    mergedToExisting: [],
    renamedOrphan: [],
    hidEmptyGeneric: [],
    skippedAmbiguous: [],
    skippedTest: []
  };

  for (const [key, rows] of groups) {
    const [batchId, date] = key.split('||');
    const batch = batchMap.get(batchId);
    if (isTestBatch(batch?.name)) {
      report.skippedTest.push({ batch: batch?.name, date });
      continue;
    }

    const genericsPlayable = rows.filter(
      (r) => isGeneric(r.title) && playable(r) && r.studentVisible !== false
    );
    const titledEmpty = rows.filter(
      (r) => !isGeneric(r.title) && !playable(r) && !isWeakTitle(r.title)
    );

    if (!ORPHANS_ONLY && genericsPlayable.length && titledEmpty.length) {
      const src = genericsPlayable.sort((a, b) => String(b.updatedAt) - String(a.updatedAt))[0];
      const dest = titledEmpty.sort((a, b) => String(b.title).length - String(a.title).length)[0];
      const media = ytFields(src);

      if (!DRY) {
        Object.assign(dest, media);
        dest.studentVisible = true;
        dest.updatedAt = new Date();
        await dest.save();

        src.studentVisible = false;
        src.youtubeVideoId = '';
        src.youtubeVideoUrl = '';
        src.youtubeEmbedUrl = '';
        src.driveId = '';
        src.updatedAt = new Date();
        await src.save();

        for (const g of genericsPlayable) {
          if (String(g._id) === String(src._id)) continue;
          if (g.studentVisible === false) continue;
          g.studentVisible = false;
          g.updatedAt = new Date();
          await g.save();
        }

        if (dest.liveClassId) {
          const live = await LiveClass.findById(dest.liveClassId).exec();
          if (live) {
            live.youtubeVideoId = media.youtubeVideoId;
            live.youtubeVideoUrl = media.youtubeVideoUrl;
            live.youtubeEmbedUrl = media.youtubeEmbedUrl;
            live.driveFileId = media.driveId || live.driveFileId || '';
            live.classroomId = String(dest._id);
            live.updatedAt = new Date();
            await live.save();
          }
        }
      }

      report.mergedToExisting.push({
        batch: batch?.name,
        teacher: batch?.teacherName,
        date,
        from: src.title,
        to: dest.title,
        yt: media.youtubeVideoId
      });
      continue;
    }

    if (MERGES_ONLY || !genericsPlayable.length) continue;

    // Orphan rename — only when exactly one strong unique title that day
    const dayStart = new Date(`${date}T00:00:00+05:30`);
    const dayEnd = new Date(`${date}T23:59:59.999+05:30`);
    const lives = await LiveClass.find({
      batchId,
      scheduledStart: { $gte: dayStart, $lte: dayEnd }
    })
      .select('title youtubeVideoId driveFileId')
      .lean();

    const candidates = lives
      .filter((l) => !isWeakTitle(l.title) && !isGeneric(l.title))
      .sort((a, b) => {
        const am = a.youtubeVideoId || a.driveFileId ? 1 : 0;
        const bm = b.youtubeVideoId || b.driveFileId ? 1 : 0;
        if (am !== bm) return am - bm;
        return String(b.title).length - String(a.title).length;
      });

    const uniqueTitles = [...new Set(candidates.map((c) => c.title.trim()))];
    if (uniqueTitles.length !== 1) {
      report.skippedAmbiguous.push({
        batch: batch?.name,
        date,
        reason: uniqueTitles.length === 0 ? 'no_strong_live_title' : 'multiple_titles',
        titles: uniqueTitles.slice(0, 6),
        generics: genericsPlayable.map((g) => g.youtubeVideoId)
      });
      continue;
    }

    const bestLive = candidates[0];
    const src = genericsPlayable[0];
    const media = ytFields(src);
    const newTitle = bestLive.title.trim();

    if (!DRY) {
      src.title = newTitle;
      Object.assign(src, media);
      src.studentVisible = true;
      if (bestLive._id) src.liveClassId = String(bestLive._id);
      src.updatedAt = new Date();
      await src.save();

      for (const g of genericsPlayable.slice(1)) {
        g.studentVisible = false;
        g.updatedAt = new Date();
        await g.save();
      }

      const live = await LiveClass.findById(bestLive._id).exec();
      if (live) {
        live.youtubeVideoId = media.youtubeVideoId;
        live.youtubeVideoUrl = media.youtubeVideoUrl;
        live.youtubeEmbedUrl = media.youtubeEmbedUrl;
        live.driveFileId = media.driveId || live.driveFileId || '';
        live.classroomId = String(src._id);
        live.updatedAt = new Date();
        await live.save();
      }
    }

    report.renamedOrphan.push({
      batch: batch?.name,
      teacher: batch?.teacherName,
      date,
      from: '— Live class',
      to: newTitle,
      yt: media.youtubeVideoId
    });
  }

  if (!MERGES_ONLY) {
    for (const c of classrooms) {
      if (!isGeneric(c.title)) continue;
      if (playable(c)) continue;
      if (c.studentVisible === false) continue;
      const date = String(c.date || '').slice(0, 10);
      if (date && date < SINCE) continue;
      const batch = batchMap.get(String(c.batchId || ''));
      if (isTestBatch(batch?.name)) continue;
      if (!DRY) {
        c.studentVisible = false;
        c.updatedAt = new Date();
        await c.save();
      }
      report.hidEmptyGeneric.push({
        batch: batch?.name,
        date: c.date,
        title: c.title,
        id: String(c._id)
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        dry: DRY,
        since: SINCE,
        counts: {
          mergedToExisting: report.mergedToExisting.length,
          renamedOrphan: report.renamedOrphan.length,
          hidEmptyGeneric: report.hidEmptyGeneric.length,
          skippedAmbiguous: report.skippedAmbiguous.length,
          skippedTest: report.skippedTest.length
        },
        mergedToExisting: report.mergedToExisting,
        renamedOrphan: report.renamedOrphan,
        skippedAmbiguous: report.skippedAmbiguous,
        hidEmptyGenericSample: report.hidEmptyGeneric.slice(0, 30)
      },
      null,
      2
    )
  );
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
