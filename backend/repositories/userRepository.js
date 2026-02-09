const User = require('../models/User');

// Mongo-backed operations only. All legacy Firestore helpers have been removed.
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

module.exports = {
  createUserMongo,
  findUserByIdMongo,
  findUserByEmailMongo,
};
