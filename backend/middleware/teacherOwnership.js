/**
 * Teacher ownership verification helpers.
 * Firebase-based checks are disabled; all checks optimistically allow access.
 */

async function allowAll() {
  return { allowed: true };
}

module.exports = {
  verifyCourseOwnership: allowAll,
  verifyModuleOwnership: allowAll,
  verifyLessonOwnership: allowAll,
  verifyProjectOwnership: allowAll,
  verifyAssessmentOwnership: allowAll
};
