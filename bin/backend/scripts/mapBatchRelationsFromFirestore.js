// Moved Firestore batch relation mapper from backend/scripts/mapBatchRelationsFromFirestore.js

const { connectMongo } = require('../../backend/config/mongo');
const { initFirebaseAdmin } = require('../config/firebaseMigration');
const Batch = require('../../backend/models/Batch');
const User = require('../../backend/models/User');
const Classroom = require('../../backend/models/Classroom');

async function main() {
  try {
    await connectMongo();
    console.log('MongoDB connected');

    const { db } = initFirebaseAdmin();

    const snapshot = await db.collection('batches').get();
    console.log(`Found ${snapshot.size} batches in Firestore`);

    let mapped = 0;
    let missing = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const fsBatchId = doc.id;

      const query = {
        name: data.name,
        course: data.course,
        teacherId: data.teacherId,
      };

      const batch = await Batch.findOne(query).exec();

      if (!batch) {
        console.warn('No matching Mongo batch for Firestore batch', {
          firestoreId: fsBatchId,
          name: data.name,
          course: data.course,
          teacherId: data.teacherId,
        });
        missing += 1;
        continue;
      }

      const mongoBatchId = String(batch._id);

      await User.updateMany({ batchId: fsBatchId }, { $set: { batchId: mongoBatchId } });
      await Classroom.updateMany(
        { batchId: fsBatchId },
        { $set: { batchId: mongoBatchId, batchName: batch.name } }
      );

      mapped += 1;
    }

    console.log(`Batch relation mapping complete. Mapped=${mapped}, missing=${missing}`);
    process.exit(0);
  } catch (err) {
    console.error('Batch relation mapping failed:', err);
    process.exit(1);
  }
}

main();
