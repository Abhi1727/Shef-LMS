// Moved legacy Firestore migration script from backend/scripts/migrateGenericCollectionsFromFirestore.js

const { connectMongo } = require('../../backend/config/mongo');
const mongoose = require('mongoose');
const { initFirebaseAdmin } = require('../config/firebaseMigration');

const genericSchema = new mongoose.Schema({}, { strict: false, timestamps: true });
const dynamicModels = {};
function getDynamicModel(collectionName) {
  if (!dynamicModels[collectionName]) {
    dynamicModels[collectionName] = mongoose.model(
      `Dyn_Mig_${collectionName}`,
      genericSchema,
      collectionName
    );
  }
  return dynamicModels[collectionName];
}

async function migrateCollection(collectionName) {
  const { db } = initFirebaseAdmin();
  const Model = getDynamicModel(collectionName);

  console.log(`\n=== Migrating collection: ${collectionName} ===`);

  const snapshot = await db.collection(collectionName).get();
  console.log(`Found ${snapshot.size} documents in Firestore collection "${collectionName}"`);

  let created = 0;
  let skipped = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const existing = await Model.findOne({ externalId: doc.id }).lean().exec();
    if (existing) {
      skipped += 1;
      continue;
    }

    const normalized = {};
    for (const [key, value] of Object.entries(data)) {
      if (value && typeof value.toDate === 'function') {
        normalized[key] = value.toDate();
      } else {
        normalized[key] = value;
      }
    }

    const toSave = new Model({ externalId: doc.id, ...normalized });
    await toSave.save();
    created += 1;
  }

  console.log(`Migrated ${created} documents, skipped ${skipped} existing`);
}

async function main() {
  try {
    await connectMongo();
    console.log('MongoDB connected');

    const collections = [
      'courses',
      'modules',
      'lessons',
      'projects',
      'assessments',
      'jobs',
      'content',
      'liveClasses',
      'userProgress',
      'videoAccess',
      'jitsiRooms',
    ];

    for (const name of collections) {
      await migrateCollection(name);
    }

    console.log('\nAll generic collections migrated from Firestore');
    process.exit(0);
  } catch (err) {
    console.error('Generic Firestore migration failed:', err);
    process.exit(1);
  }
}

main();
