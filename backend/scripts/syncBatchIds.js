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

  // Build course -> batches map for fallback when batchId is Firestore ID (no Mongo match)
  const batchesByCourse = new Map();
  for (const b of batches) {
    const course = (b.course || '').trim();
    if (!course) continue;
    if (!batchesByCourse.has(course)) batchesByCourse.set(course, []);
    batchesByCourse.get(course).push(b);
  }

  for (const user of users) {
    const current = user.batchId;
    let targetBatch = null;

    if (isValidObjectIdString(current) && batchesById.has(current)) {
      targetBatch = batchesById.get(current);
    } else if (batchesByName.has(current)) {
      targetBatch = batchesByName.get(current);
    } else {
      // Fallback: batchId is Firestore ID - match by user's course when exactly one batch
      const userCourse = (user.course || '').trim();
      const courseBatches = batchesByCourse.get(userCourse);
      if (courseBatches && courseBatches.length === 1) {
        targetBatch = courseBatches[0];
      } else if (courseBatches && courseBatches.length > 1) {
        // Multiple batches: assign to first (user should review and reassign if needed)
        targetBatch = courseBatches[0];
      }
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
    } else {
      // Fallback: batchId is Firestore ID - match by video's course
      const vidCourse = (video.course || video.courseId || '').trim();
      const courseBatches = batchesByCourse.get(vidCourse);
      if (courseBatches && courseBatches.length >= 1) {
        targetBatch = courseBatches[0];
      }
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

  // Rebuild Batch.students from User.batchId (source of truth for student-batch mapping)
  console.log('🔄 Rebuilding Batch.students from User.batchId...');
  let batchesUpdated = 0;
  for (const batch of batches) {
    const batchIdStr = String(batch._id);
    const studentsInBatch = await User.find({
      role: 'student',
      $or: [
        { batchId: batchIdStr },
        { batchId: batch._id }
      ]
    })
      .select('_id')
      .lean()
      .exec();

    const studentIds = studentsInBatch.map((u) => u._id);
    const batchDoc = await Batch.findById(batch._id).exec();
    if (!batchDoc) continue;

    const currentIds = (batchDoc.students || []).map((id) => String(id)).sort().join(',');
    const newIds = studentIds.map((id) => String(id)).sort().join(',');
    if (currentIds !== newIds) {
      batchDoc.students = studentIds;
      batchDoc.updatedAt = new Date();
      await batchDoc.save();
      batchesUpdated++;
    }
  }
  console.log(`✅ Batch.students rebuilt. Batches updated: ${batchesUpdated}`);

  // Fix videos with no batchId: assign to batch when course matches and exactly one batch has that course
  const videosNoBatch = await Classroom.find({
    $or: [{ batchId: null }, { batchId: '' }, { batchId: { $exists: false } }]
  }).exec();

  let videosAssignedByCourse = 0;
  for (const video of videosNoBatch) {
    const vidCourse = String(video.course || video.courseId || '').trim();
    if (!vidCourse) continue; // Skip videos with no course info
    const batchesWithCourse = batchesByCourse.get(vidCourse);
    if (!batchesWithCourse || batchesWithCourse.length !== 1) continue;
    const targetBatch = batchesWithCourse[0];
    video.batchId = String(targetBatch._id);
    await video.save();
    videosAssignedByCourse++;
  }
  if (videosAssignedByCourse > 0) {
    console.log(`✅ Videos assigned by course (single-batch match): ${videosAssignedByCourse}`);
  }

  console.log('🎉 syncBatchIds completed.');
  process.exit(0);
}

syncBatchIds().catch(err => {
  console.error('❌ syncBatchIds failed:', err);
  process.exit(1);
});
