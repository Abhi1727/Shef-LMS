/**
 * Official Sky States student record PDF on company letterhead.
 * Legal / professional dossier layout (Times body, bordered schedules, attestation).
 *
 * Form No.     = sequential series SKY_FORM_NNNN (shown in report body)
 * Document No. = unique per issuance (footer trackability)
 */
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const crypto = require('crypto');

const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 54;
const CONTENT_TOP = 112;
const CONTENT_BOTTOM = 78;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;

const INK = '#1a1a1a';
const MUTED = '#4a4a4a';
const RULE = '#2c2c2c';
const RULE_LIGHT = '#b8b8b8';
const FILL_ALT = '#f4f4f4';
const FILL_HEADER = '#1f2933';
const NOTICE_PHONE = '+1 (888) 810-2434';

const TEMPLATE_CANDIDATES = [
  path.join(__dirname, '../assets/sky-states-template.jpeg'),
  path.join(__dirname, '../../frontend/public/Sky States Template.jpeg'),
  path.join(process.cwd(), 'assets/sky-states-template.jpeg'),
  path.join(__dirname, '../assets/sky-states-template.jpg'),
  path.join(process.cwd(), 'assets/sky-states-template.jpg'),
];

function resolveTemplatePath() {
  for (const candidate of TEMPLATE_CANDIDATES) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function formatDateTime(value) {
  if (!value) return 'Not recorded';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Not recorded';
  return d.toLocaleString('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  });
}

function formatDateOnly(value) {
  if (!value) return 'Not recorded';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Not recorded';
  return d.toLocaleDateString('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function safe(value, fallback = 'Not recorded') {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value).trim();
}

function titleCaseStatus(value) {
  const s = safe(value, 'Unknown');
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function humanAction(action) {
  const map = {
    login: 'System login',
    logout: 'System logout',
    video_view: 'Video viewing',
    assessment: 'Assessment',
    assessment_submit: 'Assessment submission',
    page_view: 'Page view',
  };
  if (!action) return '—';
  return map[action] || String(action).replace(/_/g, ' ');
}

/** Unique document number per issuance (for audit / trackability). */
function documentControlNo(student, generatedAt) {
  const id = String(student?.enrollmentNumber || student?.id || student?._id || 'UNKNOWN');
  const stamp = new Date(generatedAt).toISOString().slice(0, 10).replace(/-/g, '');
  const hash = crypto
    .createHash('sha1')
    .update(`${id}|${stamp}|${generatedAt.getTime()}|sky-states`)
    .digest('hex')
    .slice(0, 8)
    .toUpperCase();
  return `SSR-${stamp}-${hash}`;
}

function drawTemplateBackground(doc, templatePath) {
  if (!templatePath) return;
  try {
    doc.image(templatePath, 0, 0, {
      width: PAGE_WIDTH,
      height: PAGE_HEIGHT,
    });
  } catch (err) {
    console.error('Failed to draw Sky States template background:', err.message);
  }
}

function resetCursor(doc, y) {
  doc.x = MARGIN_X;
  if (typeof y === 'number') doc.y = y;
}

/**
 * Footer only — call once per page at end (never mid-flow).
 * lineBreak:false prevents PDFKit from spilling footer text onto the next page.
 */
function drawPageChrome(doc, meta) {
  const { controlNo, pageNumber, pageCount } = meta;
  const footerY = PAGE_HEIGHT - 36;
  const saved = { x: doc.x, y: doc.y };

  doc
    .strokeColor(RULE_LIGHT)
    .lineWidth(0.5)
    .moveTo(MARGIN_X, footerY - 10)
    .lineTo(MARGIN_X + CONTENT_WIDTH, footerY - 10)
    .stroke();

  doc
    .fillColor(MUTED)
    .font('Times-Roman')
    .fontSize(7)
    .text('CONFIDENTIAL — For authorized institutional use only', MARGIN_X, footerY, {
      width: CONTENT_WIDTH * 0.48,
      align: 'left',
      lineBreak: false,
    });

  doc
    .fillColor(MUTED)
    .font('Times-Roman')
    .fontSize(7)
    .text(`Doc. No. ${controlNo}  ·  Page ${pageNumber} of ${pageCount}`, MARGIN_X + CONTENT_WIDTH * 0.48, footerY, {
      width: CONTENT_WIDTH * 0.52,
      align: 'right',
      lineBreak: false,
    });

  doc.x = saved.x;
  doc.y = saved.y;
}

function ensureSpace(ctx, needed) {
  const { doc, templatePath, meta } = ctx;
  if (doc.y + needed <= PAGE_HEIGHT - CONTENT_BOTTOM) return;
  doc.addPage();
  meta.pageNumber += 1;
  drawTemplateBackground(doc, templatePath);
  resetCursor(doc, CONTENT_TOP);
}

function drawDocumentBanner(doc, student, periodLabel, generatedAt, formNo) {
  doc
    .save()
    .rect(MARGIN_X, CONTENT_TOP, CONTENT_WIDTH, 18)
    .fill(FILL_HEADER)
    .restore();

  doc
    .fillColor('#ffffff')
    .font('Helvetica-Bold')
    .fontSize(8)
    .text('CONFIDENTIAL  ·  OFFICIAL STUDENT RECORD', MARGIN_X, CONTENT_TOP + 5, {
      width: CONTENT_WIDTH,
      align: 'center',
      lineBreak: false,
    });

  let y = CONTENT_TOP + 28;

  doc
    .fillColor(INK)
    .font('Times-Bold')
    .fontSize(16)
    .text('STUDENT ACTIVITY & ENROLLMENT REPORT', MARGIN_X, y, {
      width: CONTENT_WIDTH,
      align: 'center',
    });

  y = doc.y + 4;

  doc
    .fillColor(MUTED)
    .font('Times-Italic')
    .fontSize(9)
    .text('Sky States Learning Management System', MARGIN_X, y, {
      width: CONTENT_WIDTH,
      align: 'center',
    });

  y = doc.y + 8;

  doc
    .strokeColor(RULE)
    .lineWidth(1.25)
    .moveTo(MARGIN_X, y)
    .lineTo(MARGIN_X + CONTENT_WIDTH, y)
    .stroke();
  doc
    .strokeColor(RULE)
    .lineWidth(0.4)
    .moveTo(MARGIN_X, y + 3)
    .lineTo(MARGIN_X + CONTENT_WIDTH, y + 3)
    .stroke();

  y += 12;

  const metaRows = [
    ['Form No.', formNo],
    ['Subject Student', safe(student?.name)],
    ['Enrollment Number', safe(student?.enrollmentNumber)],
    ['Reporting Period', safe(periodLabel)],
    ['Date of Issuance', formatDateOnly(generatedAt)],
    ['Time of Issuance', formatDateTime(generatedAt)],
  ];

  const colLabel = 150;
  const rowH = 14;
  metaRows.forEach(([label, value], i) => {
    const rowY = y + i * rowH;
    if (i % 2 === 0) {
      doc.save().rect(MARGIN_X, rowY, CONTENT_WIDTH, rowH).fill('#f7f7f7').restore();
    }
    doc
      .strokeColor(RULE_LIGHT)
      .lineWidth(0.35)
      .rect(MARGIN_X, rowY, CONTENT_WIDTH, rowH)
      .stroke();
    doc
      .fillColor(MUTED)
      .font('Times-Bold')
      .fontSize(8)
      .text(label, MARGIN_X + 6, rowY + 3, { width: colLabel, lineBreak: false });
    doc
      .fillColor(INK)
      .font('Times-Roman')
      .fontSize(8)
      .text(value, MARGIN_X + colLabel + 4, rowY + 3, {
        width: CONTENT_WIDTH - colLabel - 12,
        lineBreak: false,
      });
  });

  resetCursor(doc, y + metaRows.length * rowH + 14);
}

function sectionHeading(ctx, article, title) {
  ensureSpace(ctx, 36);
  const { doc } = ctx;
  const y = doc.y;

  doc
    .strokeColor(RULE)
    .lineWidth(0.8)
    .moveTo(MARGIN_X, y)
    .lineTo(MARGIN_X + CONTENT_WIDTH, y)
    .stroke();

  doc
    .fillColor(INK)
    .font('Times-Bold')
    .fontSize(10)
    .text(`ARTICLE ${article}  —  ${title.toUpperCase()}`, MARGIN_X, y + 6, {
      width: CONTENT_WIDTH,
      align: 'left',
      lineBreak: false,
    });

  doc
    .strokeColor(RULE_LIGHT)
    .lineWidth(0.5)
    .moveTo(MARGIN_X, y + 22)
    .lineTo(MARGIN_X + CONTENT_WIDTH, y + 22)
    .stroke();

  resetCursor(doc, y + 28);
}

function fieldSchedule(ctx, rows) {
  const { doc } = ctx;
  const labelW = 168;
  const rowMinH = 16;

  rows.forEach(([label, value]) => {
    const text = safe(value);
    doc.font('Times-Roman').fontSize(8.5);
    const valueH = doc.heightOfString(text, {
      width: CONTENT_WIDTH - labelW - 14,
    });
    const h = Math.max(rowMinH, valueH + 8);
    ensureSpace(ctx, h + 2);

    const y = doc.y;
    doc.save().rect(MARGIN_X, y, labelW, h).fill(FILL_ALT).restore();
    doc
      .strokeColor(RULE_LIGHT)
      .lineWidth(0.45)
      .rect(MARGIN_X, y, CONTENT_WIDTH, h)
      .stroke();
    doc
      .strokeColor(RULE_LIGHT)
      .lineWidth(0.45)
      .moveTo(MARGIN_X + labelW, y)
      .lineTo(MARGIN_X + labelW, y + h)
      .stroke();

    doc
      .fillColor(MUTED)
      .font('Times-Bold')
      .fontSize(8)
      .text(String(label).toUpperCase(), MARGIN_X + 6, y + 4, {
        width: labelW - 10,
        lineBreak: false,
      });
    doc
      .fillColor(INK)
      .font('Times-Roman')
      .fontSize(8.5)
      .text(text, MARGIN_X + labelW + 6, y + 4, {
        width: CONTENT_WIDTH - labelW - 12,
      });

    resetCursor(doc, y + h);
  });

  resetCursor(doc, doc.y + 8);
}

function summarySchedule(ctx, cards) {
  ensureSpace(ctx, 48);
  const { doc } = ctx;
  const colW = CONTENT_WIDTH / cards.length;
  const labelH = 16;
  const valueH = 22;
  const y = doc.y;

  cards.forEach((card, i) => {
    const x = MARGIN_X + i * colW;
    doc.save().rect(x, y, colW, labelH).fill(FILL_ALT).restore();
    doc
      .strokeColor(RULE)
      .lineWidth(0.55)
      .rect(x, y, colW, labelH + valueH)
      .stroke();
    doc
      .strokeColor(RULE_LIGHT)
      .lineWidth(0.4)
      .moveTo(x, y + labelH)
      .lineTo(x + colW, y + labelH)
      .stroke();
    doc
      .fillColor(MUTED)
      .font('Times-Bold')
      .fontSize(6.5)
      .text(card.label.toUpperCase(), x + 3, y + 4, {
        width: colW - 6,
        align: 'center',
        lineBreak: false,
      });
    doc
      .fillColor(INK)
      .font('Times-Bold')
      .fontSize(14)
      .text(String(card.value), x + 3, y + labelH + 4, {
        width: colW - 6,
        align: 'center',
        lineBreak: false,
      });
  });

  resetCursor(doc, y + labelH + valueH + 12);
}

function activityTable(ctx, activities) {
  const { doc } = ctx;

  if (!activities.length) {
    resetCursor(doc);
    doc
      .fillColor(MUTED)
      .font('Times-Italic')
      .fontSize(9)
      .text('No activity was recorded during the stated reporting period.', MARGIN_X, doc.y, {
        width: CONTENT_WIDTH,
      });
    resetCursor(doc, doc.y + 8);
    return;
  }

  const cols = [
    { key: 'when', label: 'Date & Time', width: 118 },
    { key: 'action', label: 'Event', width: 88 },
    { key: 'detail', label: 'Particulars', width: 168 },
    { key: 'ip', label: 'IP / Location', width: CONTENT_WIDTH - 118 - 88 - 168 },
  ];

  const drawHeader = () => {
    ensureSpace(ctx, 26);
    const y = doc.y;
    doc.save().rect(MARGIN_X, y, CONTENT_WIDTH, 15).fill(FILL_HEADER).restore();
    let x = MARGIN_X + 4;
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(7);
    for (const col of cols) {
      doc.text(col.label.toUpperCase(), x, y + 4, {
        width: col.width - 6,
        lineBreak: false,
      });
      x += col.width;
    }
    resetCursor(doc, y + 15);
  };

  drawHeader();

  activities.forEach((activity, idx) => {
    if (doc.y > PAGE_HEIGHT - CONTENT_BOTTOM - 26) {
      doc.addPage();
      ctx.meta.pageNumber += 1;
      drawTemplateBackground(doc, ctx.templatePath);
      resetCursor(doc, CONTENT_TOP);
      drawHeader();
    }

    const detail =
      activity.videoTitle ||
      activity.assessmentTitle ||
      activity.path ||
      (activity.score != null ? `Score: ${activity.score}` : '—');
    const location = [activity.city, activity.country].filter(Boolean).join(', ');
    const ipLoc = [activity.ipAddress, location].filter(Boolean).join(' / ') || '—';

    const row = {
      when: formatDateTime(activity.timestamp),
      action: humanAction(activity.action),
      detail: safe(detail, '—'),
      ip: ipLoc,
    };

    doc.font('Times-Roman').fontSize(7);
    let maxH = 14;
    for (const col of cols) {
      const h = doc.heightOfString(row[col.key], { width: col.width - 6 });
      maxH = Math.max(maxH, Math.min(h + 4, 28));
    }

    const y = doc.y;
    if (idx % 2 === 0) {
      doc.save().rect(MARGIN_X, y, CONTENT_WIDTH, maxH).fill('#fafafa').restore();
    }
    doc
      .strokeColor('#d8d8d8')
      .lineWidth(0.3)
      .rect(MARGIN_X, y, CONTENT_WIDTH, maxH)
      .stroke();

    let x = MARGIN_X + 4;
    doc.fillColor(INK).font('Times-Roman').fontSize(7);
    for (const col of cols) {
      doc.text(row[col.key], x, y + 3, {
        width: col.width - 6,
        height: maxH - 4,
        ellipsis: true,
        lineBreak: false,
      });
      x += col.width;
    }
    resetCursor(doc, y + maxH);
  });

  resetCursor(doc, doc.y + 6);
}

function attestationBlock(ctx, formNo, generatedAt) {
  ensureSpace(ctx, 120);
  const { doc } = ctx;

  sectionHeading(ctx, 'V', 'Certification');

  resetCursor(doc);
  doc
    .fillColor(INK)
    .font('Times-Roman')
    .fontSize(8.5)
    .text(
      'This document constitutes an official extract of records maintained by Sky States within its Learning Management System. The particulars set forth herein are true and correct to the best of the system\'s records as of the date and time of issuance stated above. This report is issued for administrative, academic, and compliance purposes and shall not be altered.',
      MARGIN_X,
      doc.y,
      { width: CONTENT_WIDTH, align: 'justify', lineGap: 1.5 }
    );

  doc.moveDown(0.7);
  resetCursor(doc);

  doc
    .fillColor(MUTED)
    .font('Times-Italic')
    .fontSize(8)
    .text(
      `Electronically generated under Form No. ${formNo} on ${formatDateTime(generatedAt)}. No wet-ink signature is required for system-generated institutional records.`,
      MARGIN_X,
      doc.y,
      { width: CONTENT_WIDTH, align: 'justify' }
    );

  doc.moveDown(1.2);

  const sigY = doc.y;
  const sigW = Math.min(240, CONTENT_WIDTH * 0.55);

  doc
    .strokeColor(RULE)
    .lineWidth(0.6)
    .moveTo(MARGIN_X, sigY + 28)
    .lineTo(MARGIN_X + sigW, sigY + 28)
    .stroke();
  doc
    .fillColor(INK)
    .font('Times-Bold')
    .fontSize(8)
    .text('Authorized Administrator', MARGIN_X, sigY + 32, {
      width: sigW,
      lineBreak: false,
    });
  doc
    .fillColor(MUTED)
    .font('Times-Roman')
    .fontSize(7.5)
    .text('Sky States — Academic Affairs', MARGIN_X, sigY + 44, {
      width: sigW,
      lineBreak: false,
    });

  resetCursor(doc, sigY + 62);
  ensureSpace(ctx, 30);

  const noticeY = doc.y;
  doc.save().rect(MARGIN_X, noticeY, CONTENT_WIDTH, 24).fill(FILL_ALT).restore();
  doc
    .strokeColor(RULE_LIGHT)
    .lineWidth(0.45)
    .rect(MARGIN_X, noticeY, CONTENT_WIDTH, 24)
    .stroke();
  doc
    .fillColor(MUTED)
    .font('Times-Roman')
    .fontSize(7)
    .text(
      `NOTICE: Unauthorized reproduction, distribution, or alteration of this record is prohibited. Direct inquiries to support@skystates.us or ${NOTICE_PHONE}.`,
      MARGIN_X + 8,
      noticeY + 7,
      { width: CONTENT_WIDTH - 16, align: 'left', lineBreak: false }
    );
  resetCursor(doc, noticeY + 32);
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
    formNo,
    generatedAt = new Date(),
  } = payload;

  const templatePath = resolveTemplatePath();
  const controlNo = documentControlNo(student, generatedAt);
  const resolvedFormNo = formNo || controlNo;
  const periodLabel = period?.label || 'Selected reporting period';
  const activitySlice = (activities || []).slice(0, 100);

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 0,
        autoFirstPage: true,
        bufferPages: true,
        info: {
          Title: `Official Student Record — ${student?.name || 'Student'}`,
          Author: 'Sky States',
          Subject: 'Confidential student enrollment and activity report',
          Keywords: 'Sky States, student record, confidential',
        },
      });

      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('error', reject);
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      const meta = { controlNo, formNo: resolvedFormNo, pageNumber: 1, pageCount: 1 };
      const ctx = { doc, templatePath, meta };

      drawTemplateBackground(doc, templatePath);
      resetCursor(doc, CONTENT_TOP);

      drawDocumentBanner(doc, student, periodLabel, generatedAt, resolvedFormNo);

      sectionHeading(ctx, 'I', 'Personal Particulars of the Student');
      fieldSchedule(ctx, [
        ['Full legal name', student?.name],
        ['Electronic mail address', student?.email],
        ['Enrollment number', student?.enrollmentNumber],
        ['Telephone', student?.phone],
        ['Residential / mailing address', student?.address],
        ['Program of study', student?.course],
        ['Enrollment status', titleCaseStatus(student?.status)],
        ['Date of joining', formatDateOnly(student?.joiningDate || student?.createdAt)],
      ]);

      sectionHeading(ctx, 'II', 'Batch / Cohort Assignment');
      if (batch) {
        const schedule =
          typeof batch.schedule === 'object' && batch.schedule
            ? [batch.schedule.days, batch.schedule.time].filter(Boolean).join(', ')
            : batch.schedule;
        fieldSchedule(ctx, [
          ['Assignment type', 'Group batch'],
          ['Batch designation', batch.name],
          ['Program / course', batch.course || batch.programLabel || student?.course],
          ['Assigned trainer', batch.teacherName],
          ['Batch status', titleCaseStatus(batch.status)],
          ['Scheduled sessions', schedule],
        ]);
      } else if (oneToOneBatch) {
        fieldSchedule(ctx, [
          ['Assignment type', 'One-to-One instruction'],
          ['Batch designation', oneToOneBatch.name],
          ['Program / course', oneToOneBatch.course],
          ['Assigned trainer', oneToOneBatch.teacherName || oneToOneBatch.teacherId],
          ['Batch status', titleCaseStatus(oneToOneBatch.status)],
        ]);
      } else {
        fieldSchedule(ctx, [['Assignment status', 'No batch currently assigned']]);
      }

      sectionHeading(ctx, 'III', 'Access & Login Particulars');
      const lastLoginTs = student?.lastLogin?.timestamp || student?.lastLoginTimestamp || null;
      fieldSchedule(ctx, [
        ['Most recent login', formatDateTime(lastLoginTs)],
        ['Most recent IP address', student?.lastLoginIP || student?.lastLogin?.ipAddress],
        [
          'Geographic location',
          [student?.lastLogin?.city, student?.lastLogin?.country].filter(Boolean).join(', ') ||
            'Not recorded',
        ],
        ['Internet service provider', student?.lastLogin?.isp],
      ]);

      const history = Array.isArray(student?.loginHistory) ? student.loginHistory.slice(0, 8) : [];
      if (history.length) {
        ensureSpace(ctx, 28);
        resetCursor(doc);
        doc
          .fillColor(INK)
          .font('Times-Bold')
          .fontSize(8.5)
          .text('Schedule of Recent Access Events', MARGIN_X, doc.y, {
            width: CONTENT_WIDTH,
            lineBreak: false,
          });
        resetCursor(doc, doc.y + 12);

        const histCols = [
          { key: 'n', label: 'No.', width: 28 },
          { key: 'when', label: 'Date & Time', width: 160 },
          { key: 'ip', label: 'IP Address', width: 100 },
          { key: 'loc', label: 'Location', width: CONTENT_WIDTH - 28 - 160 - 100 },
        ];

        ensureSpace(ctx, 20);
        const hy = doc.y;
        doc.save().rect(MARGIN_X, hy, CONTENT_WIDTH, 14).fill(FILL_HEADER).restore();
        let hx = MARGIN_X + 4;
        doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(7);
        histCols.forEach((c) => {
          doc.text(c.label.toUpperCase(), hx, hy + 3.5, {
            width: c.width - 6,
            lineBreak: false,
          });
          hx += c.width;
        });
        resetCursor(doc, hy + 14);

        history.forEach((h, i) => {
          ensureSpace(ctx, 16);
          const rowY = doc.y;
          const loc = [h.city, h.country].filter(Boolean).join(', ') || '—';
          const row = {
            n: String(i + 1),
            when: formatDateTime(h.timestamp),
            ip: safe(h.ipAddress),
            loc,
          };
          if (i % 2 === 0) {
            doc.save().rect(MARGIN_X, rowY, CONTENT_WIDTH, 15).fill('#fafafa').restore();
          }
          doc
            .strokeColor('#d8d8d8')
            .lineWidth(0.3)
            .rect(MARGIN_X, rowY, CONTENT_WIDTH, 15)
            .stroke();
          let cx = MARGIN_X + 4;
          doc.fillColor(INK).font('Times-Roman').fontSize(7.5);
          histCols.forEach((c) => {
            doc.text(row[c.key], cx, rowY + 3, {
              width: c.width - 6,
              height: 12,
              ellipsis: true,
              lineBreak: false,
            });
            cx += c.width;
          });
          resetCursor(doc, rowY + 15);
        });
        resetCursor(doc, doc.y + 8);
      }

      sectionHeading(ctx, 'IV', 'Interactivity & Engagement Summary');
      resetCursor(doc);
      doc
        .fillColor(MUTED)
        .font('Times-Italic')
        .fontSize(8)
        .text(
          'The following figures summarize recorded platform activity attributable to the subject student during the reporting period.',
          MARGIN_X,
          doc.y,
          { width: CONTENT_WIDTH }
        );
      resetCursor(doc, doc.y + 8);

      summarySchedule(ctx, [
        { label: 'Total activities', value: summary?.totalActivities ?? 0 },
        { label: 'Video views', value: summary?.videoViews ?? 0 },
        { label: 'Login events', value: summary?.logins ?? 0 },
        { label: 'Assessments', value: summary?.assessments ?? 0 },
      ]);

      ensureSpace(ctx, 24);
      resetCursor(doc);
      doc
        .fillColor(INK)
        .font('Times-Bold')
        .fontSize(8.5)
        .text(
          `Detailed Activity Log (showing ${activitySlice.length} most recent event${activitySlice.length === 1 ? '' : 's'})`,
          MARGIN_X,
          doc.y,
          { width: CONTENT_WIDTH, lineBreak: false }
        );
      resetCursor(doc, doc.y + 12);

      activityTable(ctx, activitySlice);

      attestationBlock(ctx, resolvedFormNo, generatedAt);

      const range = doc.bufferedPageRange();
      meta.pageCount = range.count;
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(range.start + i);
        drawPageChrome(doc, {
          controlNo,
          pageNumber: i + 1,
          pageCount: range.count,
        });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { buildStudentReportPdf, resolveTemplatePath };
