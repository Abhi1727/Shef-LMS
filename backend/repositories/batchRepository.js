const Batch = require('../models/Batch');

// Mongo-backed operations only. All legacy Firestore helpers have been removed.
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

module.exports = {
  createBatchMongo,
  findBatchByIdMongo,
  getAllBatchesMongo,
};
