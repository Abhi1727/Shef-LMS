const Batch = require('../models/Batch');
const LiveClass = require('../models/LiveClass');

/**
 * Combined classes: batches the admin links (Batch.combinedClassWith) that share a trainer and
 * weekly slot open one shared room when any of them starts. Each batch keeps its own
 * LiveClass row (roster, attendance, Classroom lecture); follower rows point at the lead
 * via jointLeadId and reuse the lead's conference + recording.
 */

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const IST_OFFSET_MS = 330 * 60 * 1000;
/** Trainers often open the room well before the slot. */
const EARLY_START_MINUTES = 60;
const INACTIVE_BATCH_STATUSES = new Set(['completed', 'inactive', 'archived', 'cancelled']);

const SHARED_CONFERENCE_FIELDS = [
  'status',
  'conferenceProvider',
  'zoomMeetingId',
  'zoomLink',
  'zoomStartUrl',
  'zoomPassword',
  'zoomIsPmr',
  'meetLink',
  'meetSpaceId',
  'calendarEventId',
  'actualStartedAt',
  'scheduledStart',
  'scheduledEnd',
  'timezone',
  'duration',
  'scheduledDate',
  'scheduledTime'
];

function parseClock(text) {
  const m = String(text || '')
    .trim()
    .match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!m) return null;
  let hours = Number(m[1]);
  const minutes = Number(m[2] || 0);
  const meridiem = (m[3] || '').toLowerCase();
  if (meridiem === 'pm' && hours < 12) hours += 12;
  if (meridiem === 'am' && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

function parseSlot(schedule) {
  if (!schedule || typeof schedule !== 'object') return null;
  const days = new Set(
    String(schedule.days || '')
      .toLowerCase()
      .split(/[^a-z]+/)
      .map((d) => d.slice(0, 3))
      .filter((d) => DAY_KEYS.includes(d))
  );
  const [from, to] = String(schedule.time || '').split(/\s*[-–—]\s*|\s+to\s+/i);
  const start = parseClock(from);
  const end = parseClock(to);
  if (!days.size || start == null || end == null) return null;
  return { days, start, end: end <= start ? end + 24 * 60 : end };
}

function slotIsNow(slot, now = Date.now()) {
  const ist = new Date(now + IST_OFFSET_MS);
  const minutes = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  return (
    slot.days.has(DAY_KEYS[ist.getUTCDay()]) &&
    minutes >= slot.start - EARLY_START_MINUTES &&
    minutes <= slot.end
  );
}

function linkedIds(batch) {
  return Array.isArray(batch?.combinedClassWith) ? batch.combinedClassWith.map(String) : [];
}

/**
 * Batches explicitly linked to this one (combinedClassWith, either direction) that belong to
 * the same trainer and share its slot right now. Same timing alone never combines batches:
 * stale timetables on one-to-one batches would otherwise pull them into group classes.
 */
async function findJointBatches(leadBatch, now = Date.now()) {
  if (!leadBatch?.teacherId) return [];
  const slot = parseSlot(leadBatch.schedule);
  if (!slot || !slotIsNow(slot, now)) return [];
  const leadId = String(leadBatch._id || leadBatch.id);
  const leadLinks = linkedIds(leadBatch);
  const batches = await Batch.find({ teacherId: String(leadBatch.teacherId) }).lean().exec();
  return batches.filter((b) => {
    if (String(b._id) === leadId) return false;
    if (!leadLinks.includes(String(b._id)) && !linkedIds(b).includes(leadId)) return false;
    if (INACTIVE_BATCH_STATUSES.has(String(b.status || '').toLowerCase())) return false;
    const other = parseSlot(b.schedule);
    return other && other.start === slot.start && other.end === slot.end && slotIsNow(other, now);
  });
}

function jointTitle(leadTitle, leadBatchName, batchName) {
  const title = String(leadTitle || 'Live class');
  if (leadBatchName && batchName && title.includes(leadBatchName)) {
    return title.replace(leadBatchName, batchName);
  }
  return `${batchName || 'Batch'} — ${title}`;
}

/**
 * Create or refresh follower rows for every batch sharing the lead's slot.
 * Returns [{ id, batchId, batchName }] for the batches now in the combined class.
 */
async function attachJointBatchSessions(lead, leadBatch, { buildRoster }) {
  if (!lead || !leadBatch || lead.jointLeadId || !lead.batchId) return [];
  const partners = await findJointBatches(leadBatch);
  if (!partners.length) return [];

  const leadId = String(lead._id || lead.id);
  const existing = await LiveClass.find({ jointLeadId: leadId }).exec();
  const byBatch = new Map(existing.map((d) => [String(d.batchId), d]));
  const shared = {};
  for (const field of SHARED_CONFERENCE_FIELDS) shared[field] = lead[field] ?? null;

  const linked = [];
  for (const batch of partners) {
    const batchId = String(batch._id);
    let row = byBatch.get(batchId);
    if (row) {
      Object.assign(row, shared, { updatedAt: new Date() });
      await row.save();
    } else {
      const roster = await buildRoster(batchId);
      row = await LiveClass.create({
        ...shared,
        title: jointTitle(lead.title, leadBatch.name, batch.name),
        description: lead.description || '',
        batchId,
        teacherId: lead.teacherId,
        teacherName: lead.teacherName || '',
        instructor: lead.instructor || lead.teacherName || '',
        course: batch.course || lead.course || '',
        courseId: batch.courseId ? String(batch.courseId) : '',
        attendance: roster.map((s) => ({
          studentId: s.studentId,
          studentName: s.studentName,
          status: 'absent',
          source: 'teacher',
          updatedAt: new Date()
        })),
        jointLeadId: leadId,
        skipRecordingUpload: false,
        createdBy: lead.createdBy || '',
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
    linked.push({ id: String(row._id), batchId, batchName: batch.name || '' });
  }

  lead.jointBatchIds = [String(leadBatch._id), ...linked.map((l) => l.batchId)];
  lead.jointBatchNames = [leadBatch.name || '', ...linked.map((l) => l.batchName)];
  lead.updatedAt = new Date();
  await lead.save();
  return linked;
}

/** Lead plus followers, excluding the given row. */
async function findJointGroupMembers(doc) {
  const id = String(doc?._id || doc?.id || '');
  const leadId = doc?.jointLeadId ? String(doc.jointLeadId) : id;
  if (!leadId) return [];
  const followers = await LiveClass.find({ jointLeadId: leadId }).exec();
  const members = [...followers];
  if (leadId !== id) {
    const lead = await LiveClass.findById(leadId);
    if (lead) members.push(lead);
  }
  if (!doc?.jointLeadId && !followers.length) return [];
  return members.filter((m) => String(m._id) !== id);
}

module.exports = {
  parseSlot,
  slotIsNow,
  findJointBatches,
  attachJointBatchSessions,
  findJointGroupMembers
};
