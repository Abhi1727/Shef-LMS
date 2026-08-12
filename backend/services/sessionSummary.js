const axios = require('axios');
const LiveClass = require('../models/LiveClass');
const attendanceAnalytics = require('./attendanceAnalytics');

/**
 * Build text context for Gemini session summary (v1 — no video transcription).
 */
function buildContext(doc, attendanceSummary) {
  const present = (doc.attendance || []).filter((a) =>
    ['present', 'late'].includes(String(a.status || '').toLowerCase())
  ).length;
  const absent = (doc.attendance || []).filter(
    (a) => String(a.status || '').toLowerCase() === 'absent'
  ).length;
  const materials = (doc.materials || [])
    .map((m) => m.name || m.driveFileId)
    .filter(Boolean);

  return [
    `Session title: ${doc.title || 'Untitled'}`,
    `Description: ${doc.description || '(none)'}`,
    `Course/batch: ${doc.course || ''} / ${doc.batchId || ''}`,
    `Trainer: ${doc.teacherName || doc.instructor || ''}`,
    `Scheduled: ${doc.scheduledStart || doc.scheduledDate || ''} – ${doc.scheduledEnd || ''}`,
    `Duration: ${doc.duration || ''}`,
    `Attendance: ${present} present/late, ${absent} absent` +
      (attendanceSummary?.batchJoinRateAvg != null
        ? `, batch avg join ${attendanceSummary.batchJoinRateAvg}%`
        : ''),
    materials.length ? `Materials uploaded: ${materials.join(', ')}` : 'Materials: none listed',
    doc.driveLink ? `Recording link available: yes` : 'Recording link available: no'
  ].join('\n');
}

async function callGeminiSummary(contextText, teacherNotes) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      summary: [
        '## Session summary',
        '',
        '_Gemini API key not configured. Showing a structured outline from session metadata:_',
        '',
        contextText,
        teacherNotes ? `\nTrainer notes:\n${teacherNotes}` : ''
      ].join('\n')
    };
  }

  const prompt = `You are an instructional assistant for Sky States LMS.
Write a clear markdown session summary for students who missed or want to revise the live class.
Use this session metadata (and optional trainer notes). Do NOT invent detailed lecture content that was not implied.
Include: Overview, Key topics (bullets), Action items / homework if any, Who should rewatch.
Keep it under 350 words.

SESSION METADATA:
${contextText}

TRAINER NOTES:
${teacherNotes || '(none)'}`;

  const geminiRes = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 1024 }
    },
    { timeout: 60000 }
  );

  const text =
    geminiRes.data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('\n') || '';
  if (!text.trim()) throw new Error('Empty Gemini response');
  return { ok: true, summary: text.trim() };
}

/**
 * Generate and persist summary on a LiveClass document.
 */
async function generateAndStoreSummary(meetingId, { teacherNotes } = {}) {
  const doc = await LiveClass.findById(meetingId);
  if (!doc) throw new Error('Meeting not found');

  doc.sessionSummaryStatus = 'pending';
  doc.updatedAt = new Date();
  await doc.save();

  try {
    let attendanceSummary = null;
    if (doc.batchId) {
      try {
        attendanceSummary = await attendanceAnalytics.getBatchAttendanceSummary(String(doc.batchId));
      } catch (_) {
        /* optional */
      }
    }
    const context = buildContext(doc, attendanceSummary);
    const { summary } = await callGeminiSummary(context, teacherNotes || '');
    doc.sessionSummary = summary;
    doc.sessionSummaryStatus = 'ready';
    doc.sessionSummaryGeneratedAt = new Date();
    doc.updatedAt = new Date();
    await doc.save();
    return doc;
  } catch (err) {
    doc.sessionSummaryStatus = 'failed';
    doc.sessionSummary =
      doc.sessionSummary ||
      `Summary generation failed: ${err.message || 'unknown error'}. You can retry from the session panel.`;
    doc.updatedAt = new Date();
    await doc.save();
    throw err;
  }
}

module.exports = {
  buildContext,
  callGeminiSummary,
  generateAndStoreSummary
};
