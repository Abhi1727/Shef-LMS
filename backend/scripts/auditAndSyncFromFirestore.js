/**
 * Audit Firestore vs MongoDB Atlas and sync batch mappings from Firestore (source of truth).
 *
 * 1. Fetches batches, users, classroom from Firestore
 * 2. Compares counts with MongoDB Atlas
 * 3. Maps Firestore batch IDs -> Mongo batch IDs (by batch name)
 * 4. Updates Mongo User.batchId from Firestore user data (match by email)
 * 5. Updates Mongo Classroom.batchId from Firestore (match by title+date+url)
 * 6. Rebuilds Batch.students from User.batchId
 *
 * Requires: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY in .env
 *
 * Usage: node scripts/auditAndSyncFromFirestore.js
 */

const { connectMongo } = require('../config/mongo');
const User = require('../models/User');
const Batch = require('../models/Batch');
const Classroom = require('../models/Classroom');
const { getAllBatchesFirestore } = require('../repositories/batchRepository');
const { getAllUsersFirestore } = require('../repositories/userRepository');
const { getAllClassroomFirestore } = require('../repositories/classroomRepository');

function firestoreKey(v) {
  return (v || '').toString().trim();
}

async function main() {
  console.log('=== Firestore -> MongoDB Atlas Audit & Sync ===\n');

  await connectMongo();

  let firestoreBatches, firestoreUsers, firestoreClassroom;
  try {
    firestoreBatches = await getAllBatchesFirestore();
    firestoreUsers = await getAllUsersFirestore();
    firestoreClassroom = await getAllClassroomFirestore();
  } catch (err) {
    console.error('Failed to fetch Firestore data. Check Firebase credentials in .env:', err.message);
    process.exit(1);
  }

  const mongoBatches = await Batch.find({}).lean().exec();
  const mongoUsers = await User.find({ role: 'student' }).lean().exec();
  const mongoClassroom = await Classroom.find({}).lean().exec();

  // Audit
  console.log('--- Counts ---');
  console.log('Firestore batches:', firestoreBatches.length, '| Mongo batches:', mongoBatches.length);
  console.log('Firestore users (all):', firestoreUsers.length, '| Mongo students:', mongoUsers.length);
  console.log('Firestore classroom:', firestoreClassroom.length, '| Mongo classroom:', mongoClassroom.length);

  // Build Firestore batch ID -> Mongo batch ID mapping (by name)
  const fsBatchIdToMongo = new Map();
  const mongoBatchesByName = new Map();
  for (const b of mongoBatches) {
    const name = (b.name || '').trim();
    if (name) mongoBatchesByName.set(name, b);
  }

  for (const fb of firestoreBatches) {
    const name = (fb.name || '').trim();
    if (!name || !fb.id) continue;
    const mongoBatch = mongoBatchesByName.get(name);
    if (mongoBatch) {
      fsBatchIdToMongo.set(fb.id, String(mongoBatch._id));
    }
  }

  console.log('\n--- Batch mapping (Firestore ID -> Mongo ID by name) ---');
  for (const fb of firestoreBatches) {
    const mongoId = fsBatchIdToMongo.get(fb.id);
    console.log(`  ${fb.id} (${fb.name}) -> ${mongoId || 'NO MATCH'}`);
  }

  // Sync Users: use Firestore as source of truth for batchId
  console.log('\n--- Syncing User.batchId from Firestore ---');
  const mongoUsersByEmail = new Map();
  for (const u of mongoUsers) {
    mongoUsersByEmail.set((u.email || '').toLowerCase(), u);
  }

  let usersUpdated = 0;
  for (const fu of firestoreUsers) {
    if (fu.role !== 'student') continue;
    const email = (fu.email || '').toLowerCase().trim();
    if (!email) continue;
    const mongoUser = mongoUsersByEmail.get(email);
    if (!mongoUser) continue;

    const fsBatchId = fu.batchId;
    const mongoBatchId = fsBatchId ? fsBatchIdToMongo.get(fsBatchId) : null;
    const currentMongoBatchId = mongoUser.batchId ? String(mongoUser.batchId) : null;

    if (mongoBatchId && mongoBatchId !== currentMongoBatchId) {
      await User.findByIdAndUpdate(mongoUser._id, { batchId: mongoBatchId, updatedAt: new Date() });
      usersUpdated++;
    } else if (!mongoBatchId && currentMongoBatchId) {
      // Firestore has no batch or batch not found - clear
      await User.findByIdAndUpdate(mongoUser._id, { $unset: { batchId: '' }, updatedAt: new Date() });
      usersUpdated++;
    }
  }
  console.log(`  Users updated: ${usersUpdated}`);

  // Sync Classroom: use Firestore as source of truth
  console.log('\n--- Syncing Classroom.batchId from Firestore ---');
  const mongoVideosByKey = new Map();
  for (const v of mongoClassroom) {
    const key = [v.title, v.date, v.youtubeVideoUrl || v.driveId || v.zoomUrl || ''].map(firestoreKey).join('|||');
    mongoVideosByKey.set(key, v);
  }

  let videosUpdated = 0;
  for (const fv of firestoreClassroom) {
    const key = [fv.title, fv.date, fv.youtubeVideoUrl || fv.driveId || fv.zoomUrl || ''].map(firestoreKey).join('|||');
    const mongoVideo = mongoVideosByKey.get(key);
    if (!mongoVideo) continue;

    const fsBatchId = fv.batchId;
    const mongoBatchId = fsBatchId ? fsBatchIdToMongo.get(fsBatchId) : null;
    const currentMongoBatchId = mongoVideo.batchId ? String(mongoVideo.batchId) : null;

    if (mongoBatchId !== currentMongoBatchId) {
      await Classroom.findByIdAndUpdate(mongoVideo._id, {
        batchId: mongoBatchId || null,
        batchName: fsBatchId ? (firestoreBatches.find(b => b.id === fsBatchId)?.name || null) : null,
        updatedAt: new Date()
      });
      videosUpdated++;
    }
  }
  console.log(`  Classroom videos updated: ${videosUpdated}`);

  // Rebuild Batch.students from User.batchId
  console.log('\n--- Rebuilding Batch.students ---');
  let batchesRebuilt = 0;
  for (const batch of mongoBatches) {
    const batchIdStr = String(batch._id);
    const students = await User.find({ role: 'student', batchId: batchIdStr }).select('_id').lean().exec();
    const studentIds = students.map((u) => u._id);
    const batchDoc = await Batch.findById(batch._id).exec();
    if (!batchDoc) continue;

    const currentIds = (batchDoc.students || []).map((id) => String(id)).sort().join(',');
    const newIds = studentIds.map((id) => String(id)).sort().join(',');
    if (currentIds !== newIds) {
      batchDoc.students = studentIds;
      batchDoc.updatedAt = new Date();
      await batchDoc.save();
      batchesRebuilt++;
    }
  }
  console.log(`  Batches rebuilt: ${batchesRebuilt}`);

  // Summary by batch
  console.log('\n--- Per-batch summary (after sync) ---');
  for (const b of mongoBatches) {
    const batchIdStr = String(b._id);
    const studentCount = await User.countDocuments({ role: 'student', batchId: batchIdStr });
    const videoCount = await Classroom.countDocuments({ batchId: batchIdStr });
    console.log(`  ${b.name}: ${studentCount} students, ${videoCount} videos`);
  }

  console.log('\n=== Audit & Sync completed ===');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
