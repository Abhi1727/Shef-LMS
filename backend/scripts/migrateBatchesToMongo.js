const { connectMongo } = require('../config/mongo');
const { getAllBatchesFirestore } = require('../repositories/batchRepository');
const Batch = require('../models/Batch');

async function migrateBatches() {
  await connectMongo();

  const firestoreBatches = await getAllBatchesFirestore();
  console.log(`Found ${firestoreBatches.length} batches in Firestore`);

  let migrated = 0;

  for (const b of firestoreBatches) {
    try {
      const existing = await Batch.findOne({ name: b.name, teacherId: b.teacherId }).exec();
      if (existing) {
        continue;
      }

      const batch = new Batch({
        name: b.name,
        course: b.course,
        startDate: b.startDate ? new Date(b.startDate) : undefined,
        endDate: b.endDate ? new Date(b.endDate) : undefined,
        teacherId: b.teacherId,
        teacherName: b.teacherName,
        status: b.status || 'active',
        students: [],
      });

      await batch.save();
      migrated += 1;
    } catch (err) {
      console.error('Error migrating batch', b.id, err.message);
    }
  }

  console.log(`Migrated ${migrated} batches to MongoDB`);
}

migrateBatches()
  .then(() => {
    console.log('Batch migration complete');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Batch migration failed', err);
    process.exit(1);
  });
