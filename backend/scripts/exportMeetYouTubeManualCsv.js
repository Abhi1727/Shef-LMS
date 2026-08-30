#!/usr/bin/env node
/**
 * Export PROD Meet sessions that still need YouTube — for manual upload (no VM bandwidth).
 *
 * Writes:
 *   scripts/prod-meet-youtube-manual-upload.csv
 *
 * Columns include Drive open links + empty youtubeVideoId / youtubeVideoUrl for you to fill.
 * Already-uploaded sessions (LiveClass/Classroom or upload-state.json) are marked done / omitted
 * from the "pending" sheet (still listed in full file with status).
 *
 * Usage:
 *   ENV_PATH=.env node scripts/exportMeetYouTubeManualCsv.js
 */
const path = require('path');
const fs = require('fs');

const envPath = process.env.ENV_PATH
  ? path.resolve(process.cwd(), process.env.ENV_PATH)
  : path.resolve(__dirname, '../.env');
require('dotenv').config({ path: envPath });

const LiveClass = require('../models/LiveClass');
const Classroom = require('../models/Classroom');
const Batch = require('../models/Batch');
const googleDriveService = require('../services/googleDriveService');

const STATE_PATH = path.join(__dirname, 'prod-meet-youtube-upload-state.json');
const OUT_ALL = path.join(__dirname, 'prod-meet-youtube-manual-upload.csv');
const OUT_PENDING = path.join(__dirname, 'prod-meet-youtube-manual-pending.csv');

function csvEscape(v) {
  const s = v == null ? '' : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function isMeetSession(m) {
  const provider = m.conferenceProvider || (m.zoomMeetingId && !m.meetLink ? 'zoom' : 'meet');
  return provider === 'meet' || Boolean(m.meetLink);
}

function loadStateOk() {
  const map = new Map();
  try {
    if (!fs.existsSync(STATE_PATH)) return map;
    const d = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
    for (const [id, row] of Object.entries(d.results || {})) {
      if (row?.status === 'ok' && row.youtubeVideoId) {
        map.set(id, row);
      }
    }
  } catch (_) {
    /* ignore */
  }
  return map;
}

async function main() {
  const stateOk = loadStateOk();
  const meetings = (await LiveClass.find({}).lean().exec()).filter(isMeetSession);
  const batchIds = [...new Set(meetings.map((m) => String(m.batchId || '')).filter(Boolean))];
  const batches = batchIds.length
    ? await Batch.find({ _id: { $in: batchIds } }).select('name course').lean().exec()
    : [];
  const batchMap = new Map(batches.map((b) => [String(b._id || b.id), b]));
  const classrooms = batchIds.length
    ? await Classroom.find({ batchId: { $in: batchIds } }).lean().exec()
    : [];
  const classById = new Map(classrooms.map((c) => [String(c._id || c.id), c]));

  const header = [
    'liveClassId',
    'title',
    'suggestedYouTubeTitle',
    'status',
    'batchName',
    'teacherName',
    'scheduledStartIST',
    'classroomLectureId',
    'driveFileId',
    'driveLink',
    'driveOpenHint',
    'youtubeVideoId',
    'youtubeVideoUrl',
    'youtubeStatus',
    'notes'
  ];

  const rows = [];
  for (const m of meetings) {
    if (m.status === 'cancelled') continue;
    const bid = String(m.batchId || '');
    if (!bid || m.skipRecordingUpload) continue;
    const id = String(m._id || m.id);
    const room = m.classroomLectureId ? classById.get(String(m.classroomLectureId)) : null;
    const driveId =
      googleDriveService.extractDriveFileId(m.driveFileId) ||
      googleDriveService.extractDriveFileId(m.driveLink) ||
      googleDriveService.extractDriveFileId(room?.driveId) ||
      googleDriveService.extractDriveFileId(room?.driveFileId) ||
      '';
    if (!driveId) continue;

    const fromState = stateOk.get(id);
    const ytId =
      m.youtubeVideoId ||
      room?.youtubeVideoId ||
      fromState?.youtubeVideoId ||
      '';
    const ytUrl =
      m.youtubeVideoUrl ||
      room?.youtubeVideoUrl ||
      fromState?.youtubeVideoUrl ||
      (ytId ? `https://www.youtube.com/watch?v=${ytId}` : '');

    const batchName = batchMap.get(bid)?.name || '';
    const teacher = m.teacherName || m.instructor || '';
    const title = m.title || 'Live class';
    const suggested = [title, batchName ? `· ${batchName}` : '', teacher ? `· ${teacher}` : '']
      .filter(Boolean)
      .join(' ')
      .slice(0, 100);

    let startIst = '';
    try {
      const d = m.scheduledStart ? new Date(m.scheduledStart) : null;
      if (d && !Number.isNaN(d.getTime())) {
        startIst = new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Asia/Kolkata',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        }).format(d);
      }
    } catch (_) {
      /* ignore */
    }

    const driveLink = `https://drive.google.com/file/d/${driveId}/view`;
    rows.push({
      liveClassId: id,
      title,
      suggestedYouTubeTitle: suggested,
      status: m.status || '',
      batchName,
      teacherName: teacher,
      scheduledStartIST: startIst,
      classroomLectureId: m.classroomLectureId || (room?._id || room?.id || ''),
      driveFileId: driveId,
      driveLink,
      driveOpenHint: 'Download MP4 from Drive → Upload unlisted on YouTube Studio',
      youtubeVideoId: ytId,
      youtubeVideoUrl: ytUrl,
      youtubeStatus: ytId ? 'done' : 'pending_manual_upload',
      notes: ytId ? 'Already linked in LMS' : 'Fill youtubeVideoId (or paste watch URL in youtubeVideoUrl)'
    });
  }

  rows.sort((a, b) => String(a.scheduledStartIST).localeCompare(String(b.scheduledStartIST)));

  const writeCsv = (filePath, list) => {
    const lines = [header.join(',')];
    for (const r of list) {
      lines.push(header.map((h) => csvEscape(r[h])).join(','));
    }
    fs.writeFileSync(filePath, lines.join('\n') + '\n');
  };

  const pending = rows.filter((r) => r.youtubeStatus === 'pending_manual_upload');
  writeCsv(OUT_ALL, rows);
  writeCsv(OUT_PENDING, pending);

  console.log(
    JSON.stringify(
      {
        firestoreDb: process.env.FIRESTORE_DATABASE,
        totalWithDrive: rows.length,
        alreadyOnYouTube: rows.length - pending.length,
        pendingManual: pending.length,
        allCsv: OUT_ALL,
        pendingCsv: OUT_PENDING,
        applyHint:
          'After filling youtubeVideoId (or youtubeVideoUrl) on pending rows: ENV_PATH=.env node scripts/applyMeetYouTubeFromCsv.js'
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
