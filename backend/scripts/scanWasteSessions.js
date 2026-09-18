#!/usr/bin/env node
/**
 * Clear waste flags and re-scan with current rules.
 *   node scripts/scanWasteSessions.js --reset --since=2026-08-01
 */
require('dotenv').config({ path: process.env.ENV_PATH || '.env' });

const LiveClass = require('../models/LiveClass');
const {
  analyzeWasteSession,
  applyWasteSessionFlags,
  groupSiblingsByTeacherBatch
} = require('../utils/wasteSessionDetection');

const dryRun = process.argv.includes('--dry-run');
const reset = process.argv.includes('--reset');
const sinceArg = process.argv.find((a) => a.startsWith('--since='));
const sinceDate = sinceArg
  ? new Date(`${sinceArg.split('=')[1]}T00:00:00.000Z`)
  : new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);

(async () => {
  if (reset) {
    const q = { scheduledStart: { $gte: sinceDate }, wasteSessionFlagged: true };
    const count = await LiveClass.countDocuments(q);
    console.log(`Resetting ${count} flagged sessions...`);
    if (!dryRun) {
      await LiveClass.updateMany(q, {
        $set: {
          wasteSessionFlagged: false,
          wasteSessionReasons: [],
          wasteSessionDetectedAt: null,
          skipRecordingUpload: false,
          updatedAt: new Date()
        }
      });
    }
  }

  const docs = await LiveClass.find({
    batchId: { $nin: ['', null] },
    status: { $nin: ['cancelled'] },
    scheduledStart: { $gte: sinceDate },
    $or: [
      { wasteSessionDismissedAt: { $exists: false } },
      { wasteSessionDismissedAt: null },
      { wasteSessionDismissedAt: '' }
    ]
  })
    .sort({ scheduledStart: 1 })
    .exec();

  const groups = groupSiblingsByTeacherBatch(docs);
  const siblingMap = new Map();
  for (const [, group] of groups) {
    for (const doc of group) siblingMap.set(String(doc._id || doc.id), group);
  }

  let flagged = 0;
  for (const doc of docs) {
    const id = String(doc._id || doc.id);
    const siblings = (siblingMap.get(id) || []).filter((s) => String(s._id || s.id) !== id);
    const analysis = analyzeWasteSession(doc, { siblings });
    if (!analysis.isWaste) {
      if (!dryRun && doc.wasteSessionFlagged) {
        doc.wasteSessionFlagged = false;
        doc.wasteSessionReasons = [];
        await doc.save();
      }
      continue;
    }
    flagged += 1;
    console.log(
      `- ${new Date(doc.scheduledStart).toISOString().slice(0, 16)} | ${doc.title} | ${analysis.reasons.join(', ')}`
    );
    if (!dryRun) await applyWasteSessionFlags(doc, { siblings });
  }

  console.log(`\nFlagged: ${flagged} / ${docs.length}`);
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
