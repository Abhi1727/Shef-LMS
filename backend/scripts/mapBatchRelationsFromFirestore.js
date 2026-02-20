// Map Firestore batch IDs used on users/classroom documents
// to the corresponding Mongo Batch _id values, based on
// batch name (and teacher) from Firestore.
//
// Usage (from backend directory):
//   npm run map:batchRelations
//
// Safe to run multiple times – it only updates documents where
// a matching Batch is found for a given Firestore batch id.

const { connectMongo } = require('../config/mongo');
const User = require('../models/User');
const Batch = require('../models/Batch');
const Classroom = require('../models/Classroom');
const { getAllBatchesFirestore } = require('../repositories/batchRepository');

async function mapRelations() {
  await connectMongo();

  const firestoreBatches = await getAllBatchesFirestore();
  console.log(`Found ${firestoreBatches.length} batches in Firestore for relation mapping`);

  let totalUserUpdates = 0;
  let totalVideoUpdates = 0;
  let matchedBatches = 0;
  let unmatchedBatches = 0;

  for (const fb of firestoreBatches) {
    const firestoreBatchId = fb.id;
    const name = fb.name;
    const teacherId = fb.teacherId;

    if (!firestoreBatchId || !name) {
      continue;
    }

    // Try to locate the corresponding Mongo Batch document.
    // Prefer matching by name + teacherId (same logic as migrateBatchesToMongo),
    // but fall back to name-only if needed.
    let batch = null;

    if (teacherId) {
      batch = await Batch.findOne({ name, teacherId }).exec();
    }

    if (!batch) {
      batch = await Batch.findOne({ name }).exec();
    }

    if (!batch) {
      unmatchedBatches++;
      continue;
    }

    matchedBatches++;
    const mongoBatchId = String(batch._id);

    // Update students whose batchId still equals the Firestore batch id.
    const userResult = await User.updateMany(
      { role: 'student', batchId: firestoreBatchId },
      { $set: { batchId: mongoBatchId } }
    );

    // Update classroom videos whose batchId still equals the Firestore batch id.
    const videoResult = await Classroom.updateMany(
      { batchId: firestoreBatchId },
      { $set: { batchId: mongoBatchId, batchName: name } }
    );

    totalUserUpdates += userResult.modifiedCount || 0;
    totalVideoUpdates += videoResult.modifiedCount || 0;

    console.log(
      `Mapped Firestore batch ${firestoreBatchId} (${name}) -> Mongo ${mongoBatchId}. ` +
      `Users updated: ${userResult.modifiedCount || 0}, Videos updated: ${videoResult.modifiedCount || 0}`
    );
  }

  console.log('\nMapping summary:');
  console.log(`  Firestore batches processed: ${firestoreBatches.length}`);
  console.log(`  Batches matched in Mongo:   ${matchedBatches}`);
  console.log(`  Batches without a match:    ${unmatchedBatches}`);
  console.log(`  Student batchId updates:    ${totalUserUpdates}`);
  console.log(`  Classroom batchId updates:  ${totalVideoUpdates}`);

  console.log('\nmapBatchRelationsFromFirestore completed.');
  process.exit(0);
}

mapRelations().catch(err => {
  console.error('mapBatchRelationsFromFirestore failed:', err);
  process.exit(1);
});
