/**
 * Student privacy helpers — teachers must not receive contact PII.
 */

const TEACHER_SAFE_STUDENT_FIELDS = [
  'name',
  'enrollmentNumber',
  'course',
  'status',
  'batchId',
  'domain',
  'createdAt',
  'joinedAt',
  'lastLoginTimestamp'
];

function isPrivilegedStaff(role) {
  return role === 'admin';
}

/**
 * Strip email, phone, address, login IPs, and other contact fields for teachers.
 * Admins receive the full (password-stripped) object.
 */
function sanitizeStudentForViewer(student, viewerRole) {
  if (!student) return student;

  const base = typeof student.toObject === 'function' ? student.toObject() : { ...student };
  delete base.password;

  if (isPrivilegedStaff(viewerRole)) {
    return {
      ...base,
      id: String(base._id || base.id || '')
    };
  }

  const safe = {
    id: String(base._id || base.id || ''),
    _id: base._id
  };

  TEACHER_SAFE_STUDENT_FIELDS.forEach((key) => {
    if (base[key] !== undefined) safe[key] = base[key];
  });

  return safe;
}

function sanitizeStudentsForViewer(students, viewerRole) {
  return (students || []).map((s) => sanitizeStudentForViewer(s, viewerRole));
}

module.exports = {
  sanitizeStudentForViewer,
  sanitizeStudentsForViewer,
  isPrivilegedStaff
};
