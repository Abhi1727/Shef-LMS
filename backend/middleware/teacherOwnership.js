/**
 * Teacher ownership verification helpers.
 * Verifies that a teacher can only access/modify resources they own.
 */

const { db } = require('../config/firebase');

/**
 * Check if teacher owns a course (course.teacherId === teacherId)
 */
async function verifyCourseOwnership(teacherId, courseId) {
  const courseDoc = await db.collection('courses').doc(courseId).get();
  if (!courseDoc.exists) return { allowed: false, error: 'Course not found' };
  const course = courseDoc.data();
  if (course.teacherId !== teacherId) {
    return { allowed: false, error: 'You do not have permission to access this course' };
  }
  return { allowed: true, course: { id: courseDoc.id, ...course } };
}

/**
 * Check if teacher owns a module (via module.courseId -> course.teacherId)
 */
async function verifyModuleOwnership(teacherId, moduleId) {
  const moduleDoc = await db.collection('modules').doc(moduleId).get();
  if (!moduleDoc.exists) return { allowed: false, error: 'Module not found' };
  const mod = moduleDoc.data();
  const courseDoc = await db.collection('courses').doc(mod.courseId).get();
  if (!courseDoc.exists) return { allowed: false, error: 'Course not found' };
  const course = courseDoc.data();
  if (course.teacherId !== teacherId) {
    return { allowed: false, error: 'You do not have permission to access this module' };
  }
  return { allowed: true, module: { id: moduleDoc.id, ...mod }, course: { id: courseDoc.id, ...course } };
}

/**
 * Check if teacher owns a lesson (via lesson.moduleId -> module.courseId -> course.teacherId)
 */
async function verifyLessonOwnership(teacherId, lessonId) {
  const lessonDoc = await db.collection('lessons').doc(lessonId).get();
  if (!lessonDoc.exists) return { allowed: false, error: 'Lesson not found' };
  const lesson = lessonDoc.data();
  const moduleDoc = await db.collection('modules').doc(lesson.moduleId).get();
  if (!moduleDoc.exists) return { allowed: false, error: 'Module not found' };
  const mod = moduleDoc.data();
  const courseDoc = await db.collection('courses').doc(mod.courseId).get();
  if (!courseDoc.exists) return { allowed: false, error: 'Course not found' };
  const course = courseDoc.data();
  if (course.teacherId !== teacherId) {
    return { allowed: false, error: 'You do not have permission to access this lesson' };
  }
  return { allowed: true };
}

/**
 * Check if teacher owns a project (via project.courseId -> course.teacherId)
 */
async function verifyProjectOwnership(teacherId, projectId) {
  const projectDoc = await db.collection('projects').doc(projectId).get();
  if (!projectDoc.exists) return { allowed: false, error: 'Project not found' };
  const project = projectDoc.data();
  const courseId = project.courseId;
  if (!courseId) return { allowed: false, error: 'Project is not linked to a course' };
  return verifyCourseOwnership(teacherId, courseId);
}

/**
 * Check if teacher owns an assessment (via assessment.courseId -> course.teacherId)
 */
async function verifyAssessmentOwnership(teacherId, assessmentId) {
  const assessmentDoc = await db.collection('assessments').doc(assessmentId).get();
  if (!assessmentDoc.exists) return { allowed: false, error: 'Assessment not found' };
  const assessment = assessmentDoc.data();
  const courseId = assessment.courseId;
  if (!courseId) return { allowed: false, error: 'Assessment is not linked to a course' };
  return verifyCourseOwnership(teacherId, courseId);
}

module.exports = {
  verifyCourseOwnership,
  verifyModuleOwnership,
  verifyLessonOwnership,
  verifyProjectOwnership,
  verifyAssessmentOwnership
};
