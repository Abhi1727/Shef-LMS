/**
 * Remove duplicate videos from batches.
 * Detects duplicates by: (1) same YouTube video ID in same batch, or (2) same title+date in same batch.
 * Keeps the first occurrence, unassigns the rest from the batch.
 *
 * Usage (from backend directory):
 *   node scripts/removeDuplicateBatchVideos.js
 *
 * Use --dry-run to only report what would be changed.
 * Use --verbose to list all batch videos being checked.
 */

const { connectMongo } = require('../config/mongo');
const Classroom = require('../models/Classroom');

function extractYoutubeId(v) {
  let id = (v.youtubeVideoId || '').toString().trim();
  if (id) return id;
  for (const url of [v.youtubeVideoUrl, v.youtubeEmbedUrl]) {
    if (!url) continue;
    const m = String(url).match(/(?:v=|\/)([a-zA-Z0-9_-]{11})(?:\?|$|&)/);
    if (m) return m[1];
  }
  return '';
}

function normalizeTitle(s) {
  return (s || '').toString().trim().toLowerCase().replace(/\s+/g, ' ').replace(/\.+$/, '');
}

async function removeDuplicateBatchVideos() {
  const isDryRun = process.argv.includes('--dry-run');
  const verbose = process.argv.includes('--verbose');
  if (isDryRun) {
    console.log('🔍 DRY RUN - no changes will be made\n');
  }

  await connectMongo();

  const videos = await Classroom.find({})
    .sort({ createdAt: 1 })
    .lean()
    .exec();

  const withMeta = videos.map((v) => ({
    ...v,
    _ytId: extractYoutubeId(v),
    _titleNorm: normalizeTitle(v.title),
    _date: (v.date || v.createdAt || '').toString().trim()
  }));

  const withBatch = withMeta.filter((v) => {
    const b = (v.batchId || '').toString().trim();
    return b && b !== 'null' && b !== 'undefined';
  });
  const orphanCount = withMeta.length - withBatch.length;
  console.log(`Found ${videos.length} total classroom videos. ${withBatch.length} assigned to batches, ${orphanCount} with null/invalid batchId.\n`);

  // Track ids we've already marked for unassign (avoid double-counting)
  const toUnassign = new Set();

  let unassignedCount = 0;

  // 1) Group by (batchId, youtubeVideoId) - when YouTube ID exists
  const ytGroups = new Map();
  for (const v of withMeta) {
    const batchNorm = (v.batchId || '').toString().trim();
    const ytNorm = v._ytId;
    if (!batchNorm || !ytNorm) continue;
    const key = `yt:${batchNorm}::${ytNorm}`;
    if (!ytGroups.has(key)) ytGroups.set(key, []);
    ytGroups.get(key).push(v);
  }

  for (const [key, arr] of ytGroups) {
    if (arr.length <= 1) continue;
    const [keep, ...dups] = arr;
    console.log(`\n📹 Duplicates (same YouTube video in same batch):`);
    console.log(`   Batch: ${keep.batchId} | YouTube ID: ${keep._ytId}`);
    console.log(`   Keep: "${keep.title}" (${keep._id})`);
    for (const d of dups) {
      if (toUnassign.has(String(d._id))) continue;
      toUnassign.add(String(d._id));
      console.log(`   Unassign: "${d.title}" (${d._id})`);
      if (!isDryRun) {
        await Classroom.findByIdAndUpdate(d._id, { batchId: null, updatedAt: new Date() }).exec();
        unassignedCount++;
      }
    }
  }

  // 2) Group by (batchId, normalizedTitle, date) - catches "Python Custom Functions" x3 with same date
  const titleGroups = new Map();
  for (const v of withMeta) {
    if (toUnassign.has(String(v._id))) continue;
    const batchNorm = (v.batchId || '').toString().trim();
    const titleNorm = v._titleNorm;
    const dateNorm = v._date;
    if (!batchNorm || !titleNorm) continue;
    const key = `title:${batchNorm}::${titleNorm}::${dateNorm}`;
    if (!titleGroups.has(key)) titleGroups.set(key, []);
    titleGroups.get(key).push(v);
  }

  // 3) Delete orphan duplicates: videos with null/invalid batchId that duplicate each other (same youtubeVideoId)
  const orphans = withMeta.filter((v) => {
    const b = (v.batchId || '').toString().trim();
    return !b || b === 'null' || b === 'undefined';
  });
  const orphanByYt = new Map();
  for (const v of orphans) {
    if (!v._ytId) continue;
    const key = v._ytId;
    if (!orphanByYt.has(key)) orphanByYt.set(key, []);
    orphanByYt.get(key).push(v);
  }
  let deletedOrphans = 0;
  for (const [ytId, arr] of orphanByYt) {
    if (arr.length <= 1) continue;
    const [keep, ...toDelete] = arr;
    console.log(`\n🗑️ Deleting orphan duplicates (${arr.length} with same YouTube ID, batchId=null):`);
    console.log(`   Keep: "${keep.title}" (${keep._id})`);
    for (const d of toDelete) {
      console.log(`   Delete: "${d.title}" (${d._id})`);
      if (!isDryRun) {
        await Classroom.findByIdAndDelete(d._id).exec();
        deletedOrphans++;
      }
    }
  }

  for (const [key, arr] of titleGroups) {
    if (arr.length <= 1) continue;
    const [keep, ...dups] = arr;
    console.log(`\n📹 Duplicates (same title+date in same batch):`);
    console.log(`   Batch: ${keep.batchId} | Title: "${keep.title}" | Date: ${keep._date}`);
    console.log(`   Keep: "${keep.title}" (${keep._id})`);
    for (const d of dups) {
      if (toUnassign.has(String(d._id))) continue;
      toUnassign.add(String(d._id));
      console.log(`   Unassign: "${d.title}" (${d._id})`);
      if (!isDryRun) {
        await Classroom.findByIdAndUpdate(d._id, { batchId: null, updatedAt: new Date() }).exec();
        unassignedCount++;
      }
    }
  }

  if (verbose) {
    console.log('\n--- All batch videos (sample) ---');
    withMeta.slice(0, 25).forEach((v) => {
      console.log(`  batchId=${JSON.stringify(v.batchId)} | title="${v.title}" | date=${v._date} | ytId=${v._ytId || '(none)'}`);
    });
    console.log('\n--- YouTube-ID groups with 2+ videos ---');
    for (const [key, arr] of ytGroups) {
      if (arr.length > 1) console.log(`  ${key}: ${arr.length} videos`);
    }
    console.log('\n--- Title+date groups with 2+ videos ---');
    for (const [key, arr] of titleGroups) {
      if (arr.length > 1) console.log(`  ${key}: ${arr.length} videos`);
    }
  }

  if (unassignedCount === 0 && deletedOrphans === 0) {
    console.log('\n✅ No duplicate batch videos found.');
  } else {
    if (unassignedCount > 0) {
      console.log(`\n${isDryRun ? 'Would unassign' : 'Unassigned'} ${unassignedCount} duplicate(s) from batches.`);
    }
    if (deletedOrphans > 0) {
      console.log(`${isDryRun ? 'Would delete' : 'Deleted'} ${deletedOrphans} orphan duplicate(s).`);
    }
  }
}

removeDuplicateBatchVideos()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
