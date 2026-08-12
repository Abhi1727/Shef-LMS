const mongoose = require('mongoose');
const Batch = require('../models/Batch');
const OneToOneBatch = require('../models/OneToOneBatch');
const User = require('../models/User');

function asObjectIdOrNull(id) {
  if (id && mongoose.Types.ObjectId.isValid(id)) {
    return new mongoose.Types.ObjectId(id);
  }
  return null;
}

/**
 * Returns whether student and teacher are linked via a Batch or OneToOneBatch.
 */
async function canChatPair(studentId, teacherId) {
  const sid = String(studentId || '');
  const tid = String(teacherId || '');
  if (!sid || !tid) return { allowed: false, batchId: '', batchName: '' };

  const sidObj = asObjectIdOrNull(sid);
  const studentOr = [{ students: sid }];
  if (sidObj) studentOr.push({ students: sidObj });

  const batchMatch = await Batch.findOne({
    teacherId: tid,
    $or: studentOr
  })
    .select('_id name')
    .lean()
    .exec();

  if (batchMatch) {
    return { allowed: true, batchId: String(batchMatch._id), batchName: batchMatch.name || '' };
  }

  const student = await User.findById(sid).select('batchId oneToOneBatchId').lean().exec();
  if (student?.batchId) {
    const byUserBatch = await Batch.findOne({
      _id: student.batchId,
      teacherId: tid
    })
      .select('_id name')
      .lean()
      .exec();
    if (byUserBatch) {
      return { allowed: true, batchId: String(byUserBatch._id), batchName: byUserBatch.name || '' };
    }
  }

  const otoOr = [{ studentId: sid }];
  if (sidObj) otoOr.push({ studentId: sidObj });
  const oto = await OneToOneBatch.findOne({
    teacherId: tid,
    $or: otoOr
  })
    .select('_id name')
    .lean()
    .exec();
  if (oto) {
    return { allowed: true, batchId: String(oto._id), batchName: oto.name || '' };
  }

  if (student?.oneToOneBatchId) {
    const otoByUser = await OneToOneBatch.findOne({
      _id: student.oneToOneBatchId,
      teacherId: tid
    })
      .select('_id name')
      .lean()
      .exec();
    if (otoByUser) {
      return { allowed: true, batchId: String(otoByUser._id), batchName: otoByUser.name || '' };
    }
  }

  return { allowed: false, batchId: '', batchName: '' };
}

async function getTeachersForStudent(studentId) {
  const sid = String(studentId);
  const sidObj = asObjectIdOrNull(sid);
  const teacherMap = new Map();

  const student = await User.findById(sid).select('batchId oneToOneBatchId').lean().exec();

  const batchOr = [{ students: sid }];
  if (sidObj) batchOr.push({ students: sidObj });
  if (student?.batchId) batchOr.push({ _id: student.batchId });

  const batches = await Batch.find({ $or: batchOr })
    .select('teacherId teacherName name')
    .lean()
    .exec();

  batches.forEach((b) => {
    const tid = String(b.teacherId || '');
    if (!tid) return;
    if (!teacherMap.has(tid)) {
      teacherMap.set(tid, {
        id: tid,
        name: b.teacherName || 'Trainer',
        batchId: String(b._id),
        batchName: b.name || ''
      });
    }
  });

  const otoOr = [{ studentId: sid }];
  if (sidObj) otoOr.push({ studentId: sidObj });
  if (student?.oneToOneBatchId) otoOr.push({ _id: student.oneToOneBatchId });

  const otos = await OneToOneBatch.find({ $or: otoOr })
    .select('teacherId teacherName name')
    .lean()
    .exec();
  otos.forEach((b) => {
    const tid = String(b.teacherId || '');
    if (!tid) return;
    if (!teacherMap.has(tid)) {
      teacherMap.set(tid, {
        id: tid,
        name: b.teacherName || 'Trainer',
        batchId: String(b._id),
        batchName: b.name || ''
      });
    }
  });

  const teacherIds = Array.from(teacherMap.keys()).filter((id) => mongoose.Types.ObjectId.isValid(id));
  if (!teacherIds.length) return [];

  // Availability is admin-only — do not expose to students via chat peers.
  const users = await User.find({ _id: { $in: teacherIds } })
    .select('name status')
    .lean()
    .exec();

  return users.map((u) => {
    const base = teacherMap.get(String(u._id)) || {};
    return {
      id: String(u._id),
      name: u.name || base.name || 'Trainer',
      role: 'teacher',
      batchId: base.batchId || '',
      batchName: base.batchName || '',
      status: u.status || 'active'
    };
  });
}

async function getStudentsForTeacher(teacherId) {
  const tid = String(teacherId);
  const studentMap = new Map();

  const batches = await Batch.find({ teacherId: tid }).select('students name').lean().exec();
  batches.forEach((b) => {
    (b.students || []).forEach((sid) => {
      const id = String(sid);
      if (!studentMap.has(id)) {
        studentMap.set(id, { id, batchId: String(b._id), batchName: b.name || '' });
      }
    });
  });

  const otos = await OneToOneBatch.find({ teacherId: tid }).select('studentId name').lean().exec();
  otos.forEach((b) => {
    const id = String(b.studentId || '');
    if (!id || id === 'undefined' || id === 'null') return;
    if (!studentMap.has(id)) {
      studentMap.set(id, { id, batchId: String(b._id), batchName: b.name || '' });
    }
  });

  const ids = Array.from(studentMap.keys()).filter((id) => mongoose.Types.ObjectId.isValid(id));
  if (!ids.length) return [];

  const users = await User.find({ _id: { $in: ids }, role: 'student' })
    .select('name enrollmentNumber status course')
    .lean()
    .exec();

  return users.map((u) => {
    const base = studentMap.get(String(u._id)) || {};
    return {
      id: String(u._id),
      name: u.name || 'Student',
      role: 'student',
      enrollmentNumber: u.enrollmentNumber || '',
      course: u.course || '',
      status: u.status || 'active',
      batchId: base.batchId || '',
      batchName: base.batchName || ''
    };
  });
}

module.exports = {
  canChatPair,
  getTeachersForStudent,
  getStudentsForTeacher
};
