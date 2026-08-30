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
async function canChatPair(studentId, teacherId, preferredBatchId = '') {
  const sid = String(studentId || '');
  const tid = String(teacherId || '');
  const bid = String(preferredBatchId || '');
  if (!sid || !tid) return { allowed: false, batchId: '', batchName: '' };

  const sidObj = asObjectIdOrNull(sid);
  const studentOr = [{ students: sid }];
  if (sidObj) studentOr.push({ students: sidObj });

  if (bid) {
    const scopedBatch = await Batch.findOne({
      _id: bid,
      teacherId: tid,
      $or: studentOr
    })
      .select('_id name')
      .lean()
      .exec();
    if (scopedBatch) {
      return { allowed: true, batchId: String(scopedBatch._id), batchName: scopedBatch.name || '' };
    }

    const scopedOto = await OneToOneBatch.findOne({
      _id: bid,
      teacherId: tid,
      $or: [{ studentId: sid }, ...(sidObj ? [{ studentId: sidObj }] : [])]
    })
      .select('_id name')
      .lean()
      .exec();
    if (scopedOto) {
      return { allowed: true, batchId: String(scopedOto._id), batchName: scopedOto.name || '' };
    }

    return { allowed: false, batchId: '', batchName: '' };
  }

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

async function getTeachersForStudent(studentId, batchId = '') {
  const sid = String(studentId);
  const bid = String(batchId || '');
  const sidObj = asObjectIdOrNull(sid);
  const teacherMap = new Map();

  const student = await User.findById(sid).select('batchId oneToOneBatchId').lean().exec();

  const batchOr = [{ students: sid }];
  if (sidObj) batchOr.push({ students: sidObj });
  if (student?.batchId) batchOr.push({ _id: student.batchId });

  const batchQuery = bid ? { _id: bid, $or: batchOr } : { $or: batchOr };

  const batches = await Batch.find(batchQuery)
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

  const otoQuery = bid ? { _id: bid, $or: otoOr } : { $or: otoOr };

  const otos = await OneToOneBatch.find(otoQuery)
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

async function getStudentsForTeacher(teacherId, batchId = '') {
  const tid = String(teacherId);
  const bid = String(batchId || '');
  const studentMap = new Map();

  const batchQuery = { teacherId: tid };
  if (bid) batchQuery._id = bid;

  const batches = await Batch.find(batchQuery).select('students name').lean().exec();
  batches.forEach((b) => {
    (b.students || []).forEach((sid) => {
      const id = String(sid);
      if (!studentMap.has(id)) {
        studentMap.set(id, { id, batchId: String(b._id), batchName: b.name || '' });
      }
    });
  });

  const otoQuery = { teacherId: tid };
  if (bid) otoQuery._id = bid;

  const otos = await OneToOneBatch.find(otoQuery).select('studentId name').lean().exec();
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
