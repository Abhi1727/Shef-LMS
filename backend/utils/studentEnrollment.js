/**
 * Multi-program student enrollment helpers.
 * One LMS user can belong to many batches/programs; each program gets its own SKY enrollment ID.
 */
const User = require('../models/User');
const Batch = require('../models/Batch');
const { allocateEnrollmentNumber } = require('./enrollmentNumber');
const { findUserById } = require('./findUserById');

function asString(v) {
  if (v == null) return '';
  return String(v).trim();
}

function normalizeEnrollment(entry) {
  if (!entry) return null;
  const batchId = asString(entry.batchId);
  if (!batchId) return null;
  return {
    batchId,
    course: asString(entry.course) || '',
    enrollmentNumber: asString(entry.enrollmentNumber) || '',
    enrolledAt: entry.enrolledAt ? new Date(entry.enrolledAt) : new Date(),
    status: entry.status === 'withdrawn' ? 'withdrawn' : 'active'
  };
}

/**
 * Ensure legacy batchId / enrollmentNumber appear in enrollments[].
 * Mutates plain or mongoose-like user doc in memory (does not save).
 */
function hydrateEnrollments(user) {
  if (!user) return [];
  const list = Array.isArray(user.enrollments)
    ? user.enrollments.map(normalizeEnrollment).filter(Boolean)
    : [];
  const byBatch = new Set(list.map((e) => e.batchId));

  const primaryBatch = asString(user.batchId);
  if (primaryBatch && !byBatch.has(primaryBatch)) {
    list.unshift({
      batchId: primaryBatch,
      course: asString(user.course) || '',
      enrollmentNumber: asString(user.enrollmentNumber) || '',
      enrolledAt: user.joiningDate || user.createdAt || new Date(),
      status: 'active'
    });
    byBatch.add(primaryBatch);
  }

  const oneToOne = asString(user.oneToOneBatchId);
  if (oneToOne && !byBatch.has(oneToOne)) {
    list.push({
      batchId: oneToOne,
      course: asString(user.course) || '',
      enrollmentNumber: asString(user.enrollmentNumber) || '',
      enrolledAt: user.joiningDate || user.createdAt || new Date(),
      status: 'active'
    });
  }

  user.enrollments = list;
  return list;
}

function activeEnrollments(user) {
  return hydrateEnrollments(user).filter((e) => e.status !== 'withdrawn');
}

/**
 * Sync denormalized primary fields from enrollments (first active).
 */
function syncPrimaryFromEnrollments(user) {
  const active = activeEnrollments(user);
  if (!active.length) {
    user.batchId = null;
    // Keep enrollmentNumber / course for history unless cleared by caller
    return user;
  }
  const primary = active[0];
  user.batchId = primary.batchId;
  if (primary.course) user.course = primary.course;
  if (primary.enrollmentNumber) user.enrollmentNumber = primary.enrollmentNumber;
  return user;
}

/**
 * Collect every SKY-looking number on a user (primary + enrollments).
 */
function collectEnrollmentNumbers(user) {
  const nums = [];
  if (user?.enrollmentNumber) nums.push(String(user.enrollmentNumber));
  (user?.enrollments || []).forEach((e) => {
    if (e?.enrollmentNumber) nums.push(String(e.enrollmentNumber));
  });
  return nums;
}

/**
 * Resolve all batch IDs a student can access (enrollments + roster membership).
 */
async function resolveStudentBatchIds(userId) {
  const userDoc = await findUserById(
    userId,
    'batchId oneToOneBatchId enrollments'
  );

  const batchIds = [];
  if (userDoc) {
    activeEnrollments(userDoc).forEach((e) => batchIds.push(e.batchId));
    if (userDoc.batchId) batchIds.push(String(userDoc.batchId));
    if (userDoc.oneToOneBatchId) batchIds.push(String(userDoc.oneToOneBatchId));
  }

  const memberBatches = await Batch.find({ students: userId }).select('_id').lean().exec();
  memberBatches.forEach((b) => batchIds.push(String(b._id)));

  return [...new Set(batchIds.filter(Boolean))];
}

/**
 * Enroll (or re-activate) a student into a batch/program with a dedicated SKY ID.
 * Does NOT remove other enrollments.
 *
 * @returns {{ user, enrollment, created: boolean }}
 */
async function enrollStudentInBatch(userOrId, batchOrId, opts = {}) {
  const allocateNewId = opts.allocateNewId !== false;

  let user =
    userOrId && typeof userOrId === 'object' && (userOrId._id || userOrId.id || userOrId.email)
      ? userOrId
      : await User.findById(userOrId).exec();
  if (!user) {
    const err = new Error('Student not found');
    err.code = 'STUDENT_NOT_FOUND';
    throw err;
  }

  let batch =
    batchOrId && typeof batchOrId === 'object' && (batchOrId._id || batchOrId.id)
      ? batchOrId
      : await Batch.findById(batchOrId).lean().exec();
  if (!batch) {
    const err = new Error('Batch not found');
    err.code = 'BATCH_NOT_FOUND';
    throw err;
  }

  const batchId = String(batch._id || batch.id);
  const course = asString(batch.course) || asString(batch.programLabel) || asString(user.course);
  const list = hydrateEnrollments(user);
  const existingIdx = list.findIndex((e) => e.batchId === batchId);

  let enrollment;
  let created = false;

  if (existingIdx >= 0) {
    enrollment = { ...list[existingIdx], status: 'active', course: course || list[existingIdx].course };
    if (!enrollment.enrollmentNumber && allocateNewId) {
      const { enrollmentNumber } = await allocateEnrollmentNumber(User, user.joiningDate || new Date());
      enrollment.enrollmentNumber = enrollmentNumber;
      created = true;
    }
    list[existingIdx] = enrollment;
  } else {
    let enrollmentNumber = '';
    if (allocateNewId) {
      if (list.length === 0 && asString(user.enrollmentNumber)) {
        // First enrollments[] row — reuse existing primary SKY ID
        enrollmentNumber = asString(user.enrollmentNumber);
      } else {
        // New student or additional program — allocate a distinct SKY ID
        const allocated = await allocateEnrollmentNumber(
          User,
          list.length === 0 ? user.joiningDate || new Date() : new Date()
        );
        enrollmentNumber = allocated.enrollmentNumber;
      }
    }
    enrollment = {
      batchId,
      course,
      enrollmentNumber,
      enrolledAt: new Date(),
      status: 'active'
    };
    list.push(enrollment);
    created = true;
  }

  user.enrollments = list;
  // Keep primary batchId pointing at first active enrollment (stable), but set course from newest if empty
  if (!asString(user.batchId)) {
    user.batchId = batchId;
    if (course) user.course = course;
    if (enrollment.enrollmentNumber && !asString(user.enrollmentNumber)) {
      user.enrollmentNumber = enrollment.enrollmentNumber;
    }
  } else if (!asString(user.course) && course) {
    user.course = course;
  }
  // Always refresh primary enrollmentNumber if empty
  if (!asString(user.enrollmentNumber) && enrollment.enrollmentNumber) {
    user.enrollmentNumber = enrollment.enrollmentNumber;
  }

  user.updatedAt = new Date();
  await user.save();

  // Roster sync
  try {
    const batchDoc = await Batch.findById(batchId).exec();
    if (batchDoc) {
      const students = batchDoc.students || [];
      const sid = String(user._id);
      if (!students.some((id) => String(id) === sid)) {
        batchDoc.students = [...students, user._id];
        batchDoc.updatedAt = new Date();
        await batchDoc.save();
      }
    }
  } catch (err) {
    console.warn('[enrollment] batch roster sync failed:', err.message || err);
  }

  return { user, enrollment, created };
}

/**
 * Remove student from one batch/program without deleting the account.
 */
async function unenrollStudentFromBatch(userOrId, batchId) {
  const bid = asString(batchId);
  let user =
    userOrId && typeof userOrId === 'object' && (userOrId._id || userOrId.id)
      ? userOrId
      : await User.findById(userOrId).exec();
  if (!user) return null;

  const list = hydrateEnrollments(user).filter((e) => e.batchId !== bid);
  user.enrollments = list;

  if (asString(user.batchId) === bid) {
    const next = list.find((e) => e.status === 'active');
    if (next) {
      user.batchId = next.batchId;
      if (next.course) user.course = next.course;
      if (next.enrollmentNumber) user.enrollmentNumber = next.enrollmentNumber;
    } else {
      user.batchId = null;
    }
  }

  if (asString(user.oneToOneBatchId) === bid) {
    user.oneToOneBatchId = null;
  }

  user.updatedAt = new Date();
  await user.save();

  try {
    const batchDoc = await Batch.findById(bid).exec();
    if (batchDoc) {
      batchDoc.students = (batchDoc.students || []).filter((id) => String(id) !== String(user._id));
      batchDoc.updatedAt = new Date();
      await batchDoc.save();
    }
  } catch (err) {
    console.warn('[enrollment] batch unenroll roster sync failed:', err.message || err);
  }

  return user;
}

function serializeEnrollments(user, batchMap = new Map()) {
  return activeEnrollments(user).map((e) => {
    const batch = batchMap.get(e.batchId) || {};
    return {
      batchId: e.batchId,
      batchName: batch.name || '',
      course: e.course || batch.course || '',
      enrollmentNumber: e.enrollmentNumber || '',
      enrolledAt: e.enrolledAt || null,
      status: e.status || 'active'
    };
  });
}

module.exports = {
  hydrateEnrollments,
  activeEnrollments,
  syncPrimaryFromEnrollments,
  collectEnrollmentNumbers,
  resolveStudentBatchIds,
  enrollStudentInBatch,
  unenrollStudentFromBatch,
  serializeEnrollments,
  normalizeEnrollment
};
