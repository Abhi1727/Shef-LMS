/**
 * Data store switch: Mongo (default) vs Firestore (DEV USE_FIRESTORE=true).
 */
const { isFirestoreEnabled } = require('../services/firestoreDb');

function useFirestore() {
  return isFirestoreEnabled();
}

function getModel(name) {
  if (useFirestore()) {
    const fsModels = require('../firestore/models');
    if (!fsModels[name]) {
      throw new Error(`Firestore model not registered: ${name}`);
    }
    return fsModels[name];
  }
  // Lazy mongoose model load by conventional path
  switch (name) {
    case 'User':
      return require('../models/User');
    case 'Batch':
      return require('../models/Batch');
    case 'Classroom':
      return require('../models/Classroom');
    case 'LiveClass':
      return require('../models/LiveClass');
    case 'ActivityLog':
      return require('../models/ActivityLog');
    default:
      throw new Error(`Unknown model: ${name}`);
  }
}

async function connectDataStore() {
  if (useFirestore()) {
    const { ping } = require('../services/firestoreDb');
    await ping();
    return { type: 'firestore' };
  }
  const { connectMongo } = require('./mongo');
  await connectMongo();
  return { type: 'mongo' };
}

module.exports = {
  useFirestore,
  getModel,
  connectDataStore
};
