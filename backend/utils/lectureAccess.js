const Batch = require('../models/Batch');
const OneToOneBatch = require('../models/OneToOneBatch');
const { resolveStudentBatchIds } = require('./studentEnrollment');
const { isStudentVisible } = require('../services/lessonPath');

async function assertLectureAccess(user, lecture) {
  if (!user || !lecture) return false;
  const role = String(user.role || '').toLowerCase();
  if (role === 'admin') return true;

  const batchId = String(lecture.batchId || '').trim();
  if (!batchId) return role === 'teacher' && String(lecture.uploadedBy || '') === String(user.id);

  if (role === 'student') {
    if (!isStudentVisible(lecture)) return false;
    const batchIds = await resolveStudentBatchIds(user.id);
    return batchIds.map(String).includes(batchId);
  }

  if (role === 'teacher' || role === 'instructor' || role === 'mentor') {
    const batch =
      (await Batch.findById(batchId).select('teacherId').lean().exec()) ||
      (await OneToOneBatch.findById(batchId).select('teacherId').lean().exec());
    if (batch && String(batch.teacherId) === String(user.id)) return true;
    return String(lecture.uploadedBy || '') === String(user.id);
  }

  return false;
}

module.exports = { assertLectureAccess };
