/**
 * Generate a Sky States student dossier PDF (personal, batch, login, interactivity).
 */
const PDFDocument = require('pdfkit');

const MARGIN = 50;
const PAGE_WIDTH = 595.28; // A4
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function formatDate(value) {
  if (!value) return 'N/A';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'N/A';
  return d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
}

function formatDateOnly(value) {
  if (!value) return 'N/A';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'N/A';
  return d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
}

function safe(value, fallback = 'N/A') {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
}

function ensureSpace(doc, needed = 80) {
  if (doc.y + needed > doc.page.height - MARGIN) {
    doc.addPage();
  }
}

function drawHeader(doc, title, subtitle) {
  doc
    .fillColor('#0b3d4a')
    .fontSize(18)
    .font('Helvetica-Bold')
    .text('Sky States LMS', MARGIN, MARGIN, { width: CONTENT_WIDTH });

  doc
    .fillColor('#147a7a')
    .fontSize(12)
    .font('Helvetica-Bold')
    .text(title, { width: CONTENT_WIDTH });

  if (subtitle) {
    doc
      .fillColor('#5a6d76')
      .fontSize(9)
      .font('Helvetica')
      .text(subtitle, { width: CONTENT_WIDTH });
  }

  doc.moveDown(0.6);
  doc
    .strokeColor('#d5dee3')
    .lineWidth(1)
    .moveTo(MARGIN, doc.y)
    .lineTo(PAGE_WIDTH - MARGIN, doc.y)
    .stroke();
  doc.moveDown(0.8);
}

function sectionTitle(doc, label) {
  ensureSpace(doc, 40);
  doc
    .fillColor('#102a33')
    .fontSize(12)
    .font('Helvetica-Bold')
    .text(label, { width: CONTENT_WIDTH });
  doc.moveDown(0.35);
  doc
    .strokeColor('#a9d8d8')
    .lineWidth(1.5)
    .moveTo(MARGIN, doc.y)
    .lineTo(MARGIN + 120, doc.y)
    .stroke();
  doc.moveDown(0.55);
}

function keyValueRows(doc, rows) {
  const labelWidth = 150;
  doc.fontSize(9);
  for (const [label, value] of rows) {
    ensureSpace(doc, 18);
    const y = doc.y;
    doc
      .fillColor('#5a6d76')
      .font('Helvetica-Bold')
      .text(`${label}`, MARGIN, y, { width: labelWidth, continued: false });
    doc
      .fillColor('#102a33')
      .font('Helvetica')
      .text(safe(value), MARGIN + labelWidth, y, { width: CONTENT_WIDTH - labelWidth });
    doc.moveDown(0.25);
  }
  doc.moveDown(0.4);
}

function summaryCards(doc, cards) {
  ensureSpace(doc, 70);
  const gap = 10;
  const cardW = (CONTENT_WIDTH - gap * (cards.length - 1)) / cards.length;
  const startY = doc.y;

  cards.forEach((card, i) => {
    const x = MARGIN + i * (cardW + gap);
    doc
      .roundedRect(x, startY, cardW, 52, 6)
      .fillAndStroke('#f4f7f8', '#d5dee3');
    doc
      .fillColor('#5a6d76')
      .fontSize(8)
      .font('Helvetica-Bold')
      .text(card.label.toUpperCase(), x + 8, startY + 10, { width: cardW - 16 });
    doc
      .fillColor('#0b3d4a')
      .fontSize(16)
      .font('Helvetica-Bold')
      .text(String(card.value), x + 8, startY + 26, { width: cardW - 16 });
  });

  doc.y = startY + 64;
  doc.moveDown(0.3);
}

function activityTable(doc, activities) {
  if (!activities.length) {
    doc
      .fillColor('#5a6d76')
      .fontSize(9)
      .font('Helvetica')
      .text('No activity recorded for this period.');
    return;
  }

  const cols = [
    { key: 'when', label: 'When', width: 105 },
    { key: 'action', label: 'Action', width: 75 },
    { key: 'detail', label: 'Detail', width: 180 },
    { key: 'ip', label: 'IP / Location', width: 135 },
  ];

  const drawTableHeader = () => {
    ensureSpace(doc, 30);
    const y = doc.y;
    doc.rect(MARGIN, y, CONTENT_WIDTH, 18).fill('#0b3d4a');
    let x = MARGIN + 4;
    doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
    for (const col of cols) {
      doc.text(col.label, x, y + 5, { width: col.width - 6 });
      x += col.width;
    }
    doc.y = y + 22;
  };

  drawTableHeader();

  activities.forEach((activity, idx) => {
    ensureSpace(doc, 28);
    if (doc.y > doc.page.height - MARGIN - 40) {
      doc.addPage();
      drawTableHeader();
    }

    const y = doc.y;
    if (idx % 2 === 0) {
      doc.rect(MARGIN, y - 2, CONTENT_WIDTH, 20).fill('#f8fbfb');
    }

    const detail =
      activity.videoTitle ||
      activity.assessmentTitle ||
      activity.path ||
      (activity.score != null ? `Score: ${activity.score}` : '—');
    const location = [activity.city, activity.country].filter(Boolean).join(', ');
    const ipLoc = [activity.ipAddress, location].filter(Boolean).join(' · ') || '—';

    const row = {
      when: formatDate(activity.timestamp),
      action: safe(activity.action, '—'),
      detail: safe(detail, '—'),
      ip: ipLoc,
    };

    let x = MARGIN + 4;
    doc.fillColor('#102a33').fontSize(7.5).font('Helvetica');
    for (const col of cols) {
      doc.text(row[col.key], x, y, { width: col.width - 6, height: 18, ellipsis: true });
      x += col.width;
    }
    doc.y = y + 20;
  });
}

/**
 * @param {object} payload
 * @returns {Promise<Buffer>}
 */
function buildStudentReportPdf(payload) {
  const {
    student,
    batch,
    oneToOneBatch,
    period,
    summary,
    activities,
    generatedAt = new Date(),
  } = payload;

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: MARGIN,
        info: {
          Title: `Student Report — ${student?.name || 'Student'}`,
          Author: 'Sky States LMS',
          Subject: 'Student personal, batch, login and interactivity report',
        },
      });

      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const periodLabel = period?.label || 'Selected period';
      drawHeader(
        doc,
        'Student Activity & Profile Report',
        `Generated ${formatDate(generatedAt)} · Period: ${periodLabel}`
      );

      // Personal
      sectionTitle(doc, '1. Personal details');
      keyValueRows(doc, [
        ['Full name', student?.name],
        ['Email', student?.email],
        ['Enrollment no.', student?.enrollmentNumber],
        ['Phone', student?.phone],
        ['Address', student?.address],
        ['Course', student?.course],
        ['Status', student?.status],
        ['Joining date', formatDateOnly(student?.joiningDate || student?.createdAt)],
        ['Student ID', student?.id || student?._id],
      ]);

      // Batch
      sectionTitle(doc, '2. Batch details');
      if (batch) {
        const schedule =
          typeof batch.schedule === 'object' && batch.schedule
            ? [batch.schedule.days, batch.schedule.time].filter(Boolean).join(' · ')
            : batch.schedule;
        keyValueRows(doc, [
          ['Batch name', batch.name],
          ['Program / course', batch.course || batch.programLabel || student?.course],
          ['Trainer', batch.teacherName],
          ['Status', batch.status],
          ['Schedule', schedule],
          ['Batch ID', batch.id || batch._id],
        ]);
      } else if (oneToOneBatch) {
        keyValueRows(doc, [
          ['Type', 'One-to-One'],
          ['Batch name', oneToOneBatch.name],
          ['Course', oneToOneBatch.course],
          ['Trainer ID', oneToOneBatch.teacherId],
          ['Status', oneToOneBatch.status],
          ['Batch ID', oneToOneBatch.id || oneToOneBatch._id],
        ]);
      } else {
        doc
          .fillColor('#5a6d76')
          .fontSize(9)
          .font('Helvetica')
          .text('No batch currently assigned.')
          .moveDown(0.6);
      }

      // Login
      sectionTitle(doc, '3. Login details');
      const lastLoginTs =
        student?.lastLogin?.timestamp ||
        student?.lastLoginTimestamp ||
        null;
      keyValueRows(doc, [
        ['Last login', formatDate(lastLoginTs)],
        [
          'Last IP',
          student?.lastLoginIP || student?.lastLogin?.ipAddress,
        ],
        [
          'Location',
          [student?.lastLogin?.city, student?.lastLogin?.country].filter(Boolean).join(', ') ||
            'N/A',
        ],
        ['ISP', student?.lastLogin?.isp],
      ]);

      const history = Array.isArray(student?.loginHistory)
        ? student.loginHistory.slice(0, 8)
        : [];
      if (history.length) {
        doc
          .fillColor('#5a6d76')
          .fontSize(9)
          .font('Helvetica-Bold')
          .text('Recent login history')
          .moveDown(0.3);
        history.forEach((h, i) => {
          ensureSpace(doc, 16);
          const loc = [h.city, h.country].filter(Boolean).join(', ');
          doc
            .fillColor('#102a33')
            .font('Helvetica')
            .fontSize(8)
            .text(
              `${i + 1}. ${formatDate(h.timestamp)} — ${safe(h.ipAddress)} ${loc ? `(${loc})` : ''}`
            );
        });
        doc.moveDown(0.5);
      }

      // Interactivity
      sectionTitle(doc, '4. Interactivity details');
      summaryCards(doc, [
        { label: 'Activities', value: summary?.totalActivities ?? 0 },
        { label: 'Video views', value: summary?.videoViews ?? 0 },
        { label: 'Logins', value: summary?.logins ?? 0 },
        { label: 'Assessments', value: summary?.assessments ?? 0 },
      ]);

      doc
        .fillColor('#5a6d76')
        .fontSize(9)
        .font('Helvetica-Bold')
        .text(
          `Activity log (${Math.min(activities?.length || 0, 100)} most recent in period)`
        )
        .moveDown(0.35);

      activityTable(doc, (activities || []).slice(0, 100));

      // Footer on last page
      doc
        .fillColor('#8a9aa3')
        .fontSize(8)
        .font('Helvetica')
        .text(
          'Confidential — Sky States LMS student report',
          MARGIN,
          doc.page.height - 36,
          { width: CONTENT_WIDTH, align: 'center' }
        );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { buildStudentReportPdf };
