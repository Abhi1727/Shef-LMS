/**
 * Sky States completion certificate PDF (landscape A4).
 */
const PDFDocument = require('pdfkit');
const crypto = require('crypto');

const PAGE_WIDTH = 841.89; // A4 landscape
const PAGE_HEIGHT = 595.28;

function generateCertificateCode() {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `SKY-${stamp}-${rand}`;
}

function buildCertificatePdf(cert) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: [PAGE_WIDTH, PAGE_HEIGHT],
        margins: { top: 48, bottom: 48, left: 56, right: 56 }
      });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const ink = '#1a1a1a';
      const accent = '#0f4c5c';

      doc.rect(24, 24, PAGE_WIDTH - 48, PAGE_HEIGHT - 48).lineWidth(1.5).stroke(accent);
      doc.rect(32, 32, PAGE_WIDTH - 64, PAGE_HEIGHT - 64).lineWidth(0.5).stroke('#9ca3af');

      doc
        .fillColor(accent)
        .font('Times-Bold')
        .fontSize(28)
        .text('SKY STATES', { align: 'center' });
      doc
        .fillColor(ink)
        .font('Times-Roman')
        .fontSize(12)
        .text('Learning Management System', { align: 'center' });

      doc.moveDown(1.2);
      doc.font('Times-Bold').fontSize(22).fillColor(ink).text('Certificate of Completion', {
        align: 'center'
      });

      doc.moveDown(1);
      doc.font('Times-Roman').fontSize(12).text('This certifies that', { align: 'center' });
      doc.moveDown(0.4);
      doc
        .font('Times-Bold')
        .fontSize(26)
        .fillColor(accent)
        .text(cert.studentName || 'Student', { align: 'center' });

      doc.moveDown(0.6);
      doc
        .fillColor(ink)
        .font('Times-Roman')
        .fontSize(13)
        .text('has successfully completed the program', { align: 'center' });
      doc.moveDown(0.3);
      doc
        .font('Times-Bold')
        .fontSize(16)
        .text(cert.course || cert.batchName || 'Program', { align: 'center' });
      if (cert.batchName) {
        doc.moveDown(0.2);
        doc.font('Times-Roman').fontSize(12).text(`Batch: ${cert.batchName}`, { align: 'center' });
      }

      const issued = cert.issuedAt ? new Date(cert.issuedAt) : new Date();
      const issuedStr = issued.toLocaleDateString('en-IN', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      doc.moveDown(1.2);
      doc.fontSize(11).text(`Issued on ${issuedStr}`, { align: 'center' });
      doc.moveDown(0.3);
      doc.fontSize(10).fillColor('#4b5563').text(`Verification code: ${cert.code}`, {
        align: 'center'
      });

      if (cert.criteriaSnapshot?.joinRate != null) {
        doc.moveDown(0.4);
        doc
          .fontSize(9)
          .text(
            `Criteria: join rate ${cert.criteriaSnapshot.joinRate}%` +
              (cert.criteriaSnapshot.joinThreshold != null
                ? ` (threshold ${cert.criteriaSnapshot.joinThreshold}%)`
                : '') +
              (cert.criteriaSnapshot.assessmentsRequired
                ? `, assessments passed ${cert.criteriaSnapshot.assessmentsPassed}/${cert.criteriaSnapshot.assessmentsRequired}`
                : ''),
            { align: 'center' }
          );
      }

      doc
        .fillColor(ink)
        .fontSize(10)
        .text('Sky States LMS', 56, PAGE_HEIGHT - 72, { width: 200 });
      doc.text(cert.issuedByName ? `Issued by ${cert.issuedByName}` : 'Authorized issuer', {
        align: 'right'
      });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  generateCertificateCode,
  buildCertificatePdf
};
