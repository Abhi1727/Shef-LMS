// Moved legacy Firestore-backed user repository from backend/repositories/userRepository.js

const User = require('../../../backend/models/User');
const { initFirebaseAdmin } = require('../config/firebaseMigration');

async function createUserMongo(data) {
  const user = new User(data);
  return user.save();
}

async function findUserByIdMongo(id) {
  return User.findById(id).exec();
}

async function findUserByEmailMongo(email) {
  return User.findOne({ email }).exec();
}

async function getAllUsersFirestore() {
  const { db } = initFirebaseAdmin();
  const snapshot = await db.collection('users').get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

module.exports = {
  createUserMongo,
  findUserByIdMongo,
  findUserByEmailMongo,
  getAllUsersFirestore,
};
