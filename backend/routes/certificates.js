const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Batch = require('../models/Batch');
const Certificate = require('../models/Certificate');
const certificateService = require('../services/certificateService');

router.use(auth);

function isAdmin(role) {
  return String(role || '').toLowerCase() === 'admin';
}
function isTeacherRole(role) {
  const r = String(role || '').toLowerCase();
  return r === 'teacher' || r === 'mentor' || r === 'instructor';
}

async function assertCanManageBatch(user, batchId) {
  if (isAdmin(user.role)) return true;
  if (!isTeacherRole(user.role)) return false;
  const batch = await Batch.findById(batchId).select('teacherId').lean();
  return batch && String(batch.teacherId) === String(user.id);
}

// @route   GET /api/certificates/mine
router.get('/mine', async (req, res) => {
  try {
    const list = await Certificate.find({ studentId: String(req.user.id) })
      .sort({ issuedAt: -1 })
      .lean();
    res.json({
      success: true,
      certificates: list.map((c) => ({
        id: String(c._id),
        code: c.code,
        batchId: c.batchId,
        batchName: c.batchName,
        course: c.course,
        issuedAt: c.issuedAt,
        source: c.source
      }))
    });
  } catch (error) {
    console.error('GET /certificates/mine error:', error);
    res.status(500).json({ success: false, message: 'Failed to list certificates' });
  }
});

// @route   GET /api/certificates/batch/:batchId
router.get('/batch/:batchId', async (req, res) => {
  try {
    if (!(await assertCanManageBatch(req.user, req.params.batchId))) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const list = await Certificate.find({ batchId: String(req.params.batchId) })
      .sort({ issuedAt: -1 })
      .lean();
    res.json({
      success: true,
      certificates: list.map((c) => ({
        id: String(c._id),
        studentId: c.studentId,
        studentName: c.studentName,
        code: c.code,
        issuedAt: c.issuedAt,
        source: c.source,
        criteriaSnapshot: c.criteriaSnapshot
      }))
    });
  } catch (error) {
    console.error('GET /certificates/batch error:', error);
    res.status(500).json({ success: false, message: 'Failed to list batch certificates' });
  }
});

// @route   POST /api/certificates/issue
router.post('/issue', async (req, res) => {
  try {
    const studentId = String(req.body?.studentId || '');
    const batchId = String(req.body?.batchId || '');
    if (!studentId || !batchId) {
      return res.status(400).json({ success: false, message: 'studentId and batchId required' });
    }
    if (!(await assertCanManageBatch(req.user, batchId))) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const result = await certificateService.issueCertificate({
      studentId,
      batchId,
      issuedBy: req.user.id,
      issuedByName: req.user.name || req.user.email || '',
      source: 'manual'
    });

    res.json({
      success: true,
      created: result.created,
      certificate: {
        id: String(result.certificate._id || result.certificate.id),
        code: result.certificate.code,
        studentId: result.certificate.studentId,
        batchId: result.certificate.batchId,
        issuedAt: result.certificate.issuedAt
      },
      message: result.created ? 'Certificate issued' : 'Certificate already exists'
    });
  } catch (error) {
    console.error('POST /certificates/issue error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to issue certificate' });
  }
});

// @route   GET /api/certificates/eligibility
router.get('/eligibility', async (req, res) => {
  try {
    const studentId = String(req.query.studentId || req.user.id);
    const batchId = String(req.query.batchId || '');
    if (!batchId) {
      return res.status(400).json({ success: false, message: 'batchId required' });
    }
    if (
      String(studentId) !== String(req.user.id) &&
      !(await assertCanManageBatch(req.user, batchId))
    ) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const result = await certificateService.evaluateEligibility(studentId, batchId);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('GET /certificates/eligibility error:', error);
    res.status(500).json({ success: false, message: 'Failed to evaluate eligibility' });
  }
});

// @route   GET /api/certificates/:id/pdf
router.get('/:id/pdf', async (req, res) => {
  try {
    const cert = await Certificate.findById(req.params.id).lean();
    if (!cert) return res.status(404).json({ success: false, message: 'Not found' });

    const uid = String(req.user.id);
    const allowed =
      String(cert.studentId) === uid ||
      isAdmin(req.user.role) ||
      (await assertCanManageBatch(req.user, cert.batchId));
    if (!allowed) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const pdf = await certificateService.buildCertificatePdf(cert);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="sky-states-certificate-${cert.code}.pdf"`
    );
    res.send(pdf);
  } catch (error) {
    console.error('GET /certificates/:id/pdf error:', error);
    res.status(500).json({ success: false, message: 'Failed to build PDF' });
  }
});

module.exports = router;
