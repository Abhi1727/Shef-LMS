const Classroom = require('../models/Classroom');

// Mongo-backed operations
async function createClassroomMongo(data) {
  const item = new Classroom(data);
  return item.save();
}

async function getAllClassroomMongo(filter = {}) {
  return Classroom.find(filter).exec();
}

module.exports = {
  createClassroomMongo,
  getAllClassroomMongo,
};

