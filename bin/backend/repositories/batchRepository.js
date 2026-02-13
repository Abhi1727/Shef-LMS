// Moved legacy Firestore-backed batch repository from backend/repositories/batchRepository.js

const Batch = require('../../../backend/models/Batch');
const { initFirebaseAdmin } = require('../config/firebaseMigration');

async function createBatchMongo(data) {
  const batch = new Batch(data);
  return batch.save();
}

async function findBatchByIdMongo(id) {
  return Batch.findById(id).exec();
}

async function getAllBatchesMongo() {
  return Batch.find({}).exec();
}

async function getAllBatchesFirestore() {
  const { db } = initFirebaseAdmin();
  const snapshot = await db.collection('batches').get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

module.exports = {
  createBatchMongo,
  findBatchByIdMongo,
  getAllBatchesMongo,
  getAllBatchesFirestore,
};
