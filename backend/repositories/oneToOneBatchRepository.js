/**
 * Repository for OneToOneBatch - 1:1 personalized batches (1 teacher : 1 student).
 * Separate from regular batches - no conflicts.
 */
const OneToOneBatch = require('../models/OneToOneBatch');
const User = require('../models/User');
const mongoose = require('mongoose');

async function validateStudent(studentId) {
  if (!studentId) return null;
  const id = String(studentId);
  let user = await User.findOne({ firestoreId: id, role: 'student' }).exec();
  if (!user && mongoose.Types.ObjectId.isValid(id)) {
    user = await User.findOne({ _id: id, role: 'student' }).exec();
  }
  return user || null;
}

async function validateTeacher(teacherId) {
  if (!teacherId) return null;
  const id = String(teacherId);
  const user = await User.findOne({
    $or: [{ _id: id }, { firestoreId: id }],
    role: { $in: ['teacher', 'instructor', 'admin'] }
  }).exec();
  return user;
}

async function create(batchData) {
  const batch = new OneToOneBatch(batchData);
  return batch.save();
}

async function updateStudentCourse(batchId, studentId, course) {
  return User.findOneAndUpdate(
    { $or: [{ _id: studentId }, { firestoreId: studentId }] },
    { $set: { course, oneToOneBatchId: String(batchId), updatedAt: new Date() } },
    { new: true }
  ).exec();
}

async function findAll() {
  return OneToOneBatch.find({}).sort({ createdAt: -1 }).lean().exec();
}

async function findById(id) {
  const batch = await OneToOneBatch.findById(id).lean().exec();
  return batch;
}

async function update(id, updateData) {
  updateData.updatedAt = new Date();
  return OneToOneBatch.findByIdAndUpdate(id, updateData, { new: true }).lean().exec();
}

async function remove(id) {
  const batch = await OneToOneBatch.findById(id).exec();
  if (!batch) return null;
  const studentId = batch.studentId;
  await OneToOneBatch.findByIdAndDelete(id).exec();
  if (studentId) {
    await User.findOneAndUpdate(
      { $or: [{ _id: studentId }, { firestoreId: String(studentId) }] },
      { $unset: { oneToOneBatchId: '' } }
    ).exec();
  }
  return batch ? batch.toObject() : null;
}

async function addVideo(id, videoData) {
  const batch = await OneToOneBatch.findById(id).exec();
  if (!batch) return null;
  batch.videos = batch.videos || [];
  batch.videos.push({
    _id: new mongoose.Types.ObjectId(),
    ...videoData,
    addedAt: new Date()
  });
  batch.updatedAt = new Date();
  await batch.save();
  return batch.toObject();
}

async function updateVideo(id, videoId, videoData) {
  const batch = await OneToOneBatch.findById(id).exec();
  if (!batch || !batch.videos) return null;
  const idx = batch.videos.findIndex(v => String(v._id) === String(videoId));
  if (idx === -1) return null;
  batch.videos[idx] = { ...batch.videos[idx].toObject(), ...videoData };
  batch.updatedAt = new Date();
  await batch.save();
  return batch.toObject();
}

async function removeVideo(id, videoId) {
  const batch = await OneToOneBatch.findById(id).exec();
  if (!batch || !batch.videos) return null;
  batch.videos = batch.videos.filter(v => String(v._id) !== String(videoId));
  batch.updatedAt = new Date();
  await batch.save();
  return batch.toObject();
}

async function removeVideoByIndex(id, index) {
  const batch = await OneToOneBatch.findById(id).exec();
  if (!batch || !batch.videos || index >= batch.videos.length) return null;
  batch.videos.splice(index, 1);
  batch.updatedAt = new Date();
  await batch.save();
  return batch.toObject();
}

async function updateStudent(id, studentData) {
  const batch = await OneToOneBatch.findByIdAndUpdate(
    id,
    {
      $set: {
        studentId: studentData.studentId,
        studentName: studentData.studentName,
        studentEmail: studentData.studentEmail,
        updatedAt: new Date()
      }
    },
    { new: true }
  ).lean().exec();
  if (batch && studentData.studentId) {
    await User.findOneAndUpdate(
      { $or: [{ _id: studentData.studentId }, { firestoreId: String(studentData.studentId) }] },
      { $set: { oneToOneBatchId: String(id), updatedAt: new Date() } }
    ).exec();
  }
  return batch;
}

async function removeStudent(id) {
  const batch = await OneToOneBatch.findById(id).exec();
  if (!batch) return null;
  const oldStudentId = batch.studentId;
  batch.studentId = undefined;
  batch.studentName = 'To be assigned';
  batch.studentEmail = 'To be assigned';
  batch.updatedAt = new Date();
  await batch.save();
  if (oldStudentId) {
    await User.findOneAndUpdate(
      { $or: [{ _id: oldStudentId }, { firestoreId: String(oldStudentId) }] },
      { $unset: { oneToOneBatchId: '' } }
    ).exec();
  }
  return batch.toObject();
}

async function findByCourse(courseName) {
  return OneToOneBatch.find({ course: courseName }).sort({ createdAt: -1 }).lean().exec();
}

async function updateProgress(id, progress) {
  return OneToOneBatch.findByIdAndUpdate(
    id,
    { $set: { progress, updatedAt: new Date() } },
    { new: true }
  ).lean().exec();
}

async function findUnassignedStudents(course, currentBatchId = null) {
  const students = await User.find({ role: 'student' }).select('name email _id').lean().exec();
  const oneToOneBatches = await OneToOneBatch.find({ course }).lean().exec();
  const assignedIds = new Set(oneToOneBatches.map(b => String(b.studentId)).filter(Boolean));
  if (currentBatchId) {
    const current = oneToOneBatches.find(b => String(b._id) === String(currentBatchId));
    if (current && current.studentId) assignedIds.delete(String(current.studentId));
  }
  return students
    .filter(s => !assignedIds.has(String(s._id)))
    .map(s => ({ id: String(s._id), name: s.name, email: s.email }));
}

module.exports = {
  validateStudent,
  validateTeacher,
  create,
  updateStudentCourse,
  findAll,
  findById,
  update,
  delete: remove,
  addVideo,
  updateVideo,
  removeVideo,
  removeVideoByIndex,
  updateStudent,
  removeStudent,
  findByCourse,
  updateProgress,
  findUnassignedStudents
};
