// Synchronize batchId references in User and Classroom documents
// so they consistently use the Mongo Batch _id string.
//
// Usage (from backend directory):
//   node scripts/syncBatchIds.js
//
// This script is safe to run multiple times; it only normalizes
// existing values and logs how many documents were updated.

const { connectMongo, mongoose } = require('../config/mongo');
const User = require('../models/User');
const Batch = require('../models/Batch');
const Classroom = require('../models/Classroom');

function isValidObjectIdString(value) {
  return typeof value === 'string' && mongoose.Types.ObjectId.isValid(value);
}

async function syncBatchIds() {
  await connectMongo();

  const batches = await Batch.find({}).lean().exec();
  const batchesById = new Map();
  const batchesByName = new Map();

  for (const b of batches) {
    const idStr = String(b._id);
    batchesById.set(idStr, b);
    if (b.name) {
      batchesByName.set(b.name, b);
    }
  }

  let updatedUsers = 0;
  let skippedUsers = 0;
  let updatedVideos = 0;
  let skippedVideos = 0;

  console.log('🔄 Syncing user.batchId values...');

  const users = await User.find({
    role: 'student',
    batchId: { $ne: null, $ne: '' }
  }).exec();

  for (const user of users) {
    const current = user.batchId;
    let targetBatch = null;

    if (isValidObjectIdString(current) && batchesById.has(current)) {
      targetBatch = batchesById.get(current);
    } else if (batchesByName.has(current)) {
      targetBatch = batchesByName.get(current);
    }

    if (targetBatch) {
      const newVal = String(targetBatch._id);
      if (newVal !== current) {
        user.batchId = newVal;
        await user.save();
        updatedUsers++;
      }
    } else {
      skippedUsers++;
    }
  }

  console.log(`✅ Users processed. Updated: ${updatedUsers}, Skipped (no matching batch): ${skippedUsers}`);

  console.log('🔄 Syncing classroom.batchId values...');

  const videos = await Classroom.find({
    batchId: { $ne: null, $ne: '' }
  }).exec();

  for (const video of videos) {
    const current = video.batchId;
    let targetBatch = null;

    if (isValidObjectIdString(current) && batchesById.has(current)) {
      targetBatch = batchesById.get(current);
    } else if (video.batchName && batchesByName.has(video.batchName)) {
      targetBatch = batchesByName.get(video.batchName);
    } else if (batchesByName.has(current)) {
      targetBatch = batchesByName.get(current);
    }

    if (targetBatch) {
      const newVal = String(targetBatch._id);
      if (newVal !== current) {
        video.batchId = newVal;
        await video.save();
        updatedVideos++;
      }
    } else {
      skippedVideos++;
    }
  }

  console.log(`✅ Classroom videos processed. Updated: ${updatedVideos}, Skipped (no matching batch): ${skippedVideos}`);

  console.log('🎉 syncBatchIds completed.');
  process.exit(0);
}

syncBatchIds().catch(err => {
  console.error('❌ syncBatchIds failed:', err);
  process.exit(1);
});
