// Moved legacy Firestore-backed classroom repository from backend/repositories/classroomRepository.js

const Classroom = require('../../../backend/models/Classroom');
const { initFirebaseAdmin } = require('../config/firebaseMigration');

async function createClassroomMongo(data) {
  const item = new Classroom(data);
  return item.save();
}

async function getAllClassroomMongo(filter = {}) {
  return Classroom.find(filter).exec();
}

async function getAllClassroomFirestore() {
  const { db } = initFirebaseAdmin();
  const snapshot = await db.collection('classroom').get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

module.exports = {
  createClassroomMongo,
  getAllClassroomMongo,
  getAllClassroomFirestore,
};
