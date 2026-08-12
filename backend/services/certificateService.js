const Certificate = require('../models/Certificate');
const User = require('../models/User');
const Batch = require('../models/Batch');
const { Assessment, AssessmentAttempt } = require('../models/AssessmentStudio');
const attendanceAnalytics = require('./attendanceAnalytics');
const { generateCertificateCode, buildCertificatePdf } = require('../utils/certificatePdf');

/**
 * Check whether student meets auto-certificate criteria for a batch.
 */
async function evaluateEligibility(studentId, batchId) {
  const threshold = attendanceAnalytics.getThreshold();
  const summary = await attendanceAnalytics.getBatchAttendanceSummary(batchId);
  const student = (summary.students || []).find((s) => s.studentId === String(studentId));
  if (!student) {
    return { eligible: false, reason: 'Student not in batch roster', summary: null, assessments: null };
  }

  const joinOk = summary.sessionsTotal === 0 || student.joinRate >= threshold;

  const assessments = await Assessment.find({
    batchId,
    status: 'published'
  })
    .select('_id title passingMarks')
    .lean()
    .exec();

  let assessmentsPassed = 0;
  for (const a of assessments) {
    const attempt = await AssessmentAttempt.findOne({
      assessmentId: a._id,
      studentId,
      status: 'completed',
      percentage: { $gte: a.passingMarks ?? 40 }
    })
      .lean()
      .exec();
    if (attempt) assessmentsPassed += 1;
  }

  const assessmentsOk = assessments.length === 0 || assessmentsPassed >= assessments.length;
  const eligible = joinOk && assessmentsOk;

  return {
    eligible,
    reason: eligible
      ? 'Criteria met'
      : !joinOk
        ? `Join rate ${student.joinRate}% below ${threshold}%`
        : `Assessments passed ${assessmentsPassed}/${assessments.length}`,
    summary,
    student,
    assessments: {
      required: assessments.length,
      passed: assessmentsPassed
    },
    threshold
  };
}

async function issueCertificate({
  studentId,
  batchId,
  issuedBy,
  issuedByName,
  source = 'manual'
}) {
  const existing = await Certificate.findOne({
    studentId: String(studentId),
    batchId: String(batchId)
  }).lean();
  if (existing) {
    return { created: false, certificate: existing };
  }

  const user = await User.findById(studentId).select('name email').lean();
  const batch = await Batch.findById(batchId).select('name course').lean();
  const evalResult = await evaluateEligibility(studentId, batchId);

  const code = generateCertificateCode();
  const doc = await Certificate.create({
    studentId: String(studentId),
    studentName: user?.name || evalResult.student?.studentName || '',
    studentEmail: user?.email || evalResult.student?.email || '',
    batchId: String(batchId),
    batchName: batch?.name || evalResult.summary?.batch?.name || '',
    course: batch?.course || evalResult.summary?.batch?.course || '',
    code,
    issuedAt: new Date(),
    issuedBy: String(issuedBy || 'system'),
    issuedByName: issuedByName || (source === 'auto' ? 'Auto-issue' : ''),
    source,
    criteriaSnapshot: {
      joinRate: evalResult.student?.joinRate ?? null,
      joinThreshold: evalResult.threshold ?? null,
      assessmentsRequired: evalResult.assessments?.required ?? 0,
      assessmentsPassed: evalResult.assessments?.passed ?? 0,
      sessionsTotal: evalResult.summary?.sessionsTotal ?? 0
    }
  });

  return { created: true, certificate: doc.toObject ? doc.toObject() : doc };
}

/**
 * Auto-issue if eligible and not already issued.
 */
async function maybeAutoIssue(studentId, batchId) {
  if (!studentId || !batchId) return null;
  const evalResult = await evaluateEligibility(studentId, batchId);
  if (!evalResult.eligible) return null;
  const result = await issueCertificate({
    studentId,
    batchId,
    issuedBy: 'system',
    issuedByName: 'Auto-issue',
    source: 'auto'
  });
  return result;
}

module.exports = {
  evaluateEligibility,
  issueCertificate,
  maybeAutoIssue,
  buildCertificatePdf,
  generateCertificateCode
};
