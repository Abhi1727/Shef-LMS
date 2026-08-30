#!/usr/bin/env node
/**
 * Apply manual YouTube uploads from CSV → LiveClass + Classroom (PROD/DEV).
 *
 * Input CSV must include liveClassId and either youtubeVideoId or youtubeVideoUrl.
 * Drive columns are optional (kept as archive).
 *
 * Usage:
 *   ENV_PATH=.env node scripts/applyMeetYouTubeFromCsv.js
 *   ENV_PATH=.env node scripts/applyMeetYouTubeFromCsv.js --file=scripts/prod-meet-youtube-manual-pending.csv
 *   ENV_PATH=.env node scripts/applyMeetYouTubeFromCsv.js --dry-run
 */
const path = require('path');
const fs = require('fs');

const envPath = process.env.ENV_PATH
  ? path.resolve(process.cwd(), process.env.ENV_PATH)
  : path.resolve(__dirname, '../.env');
require('dotenv').config({ path: envPath });

const LiveClass = require('../models/LiveClass');
const googleDriveService = require('../services/googleDriveService');
const { ensureClassroomFromLiveClass } = require('../services/classroomFromLiveClass');

const DEFAULT_FILE = path.join(__dirname, 'prod-meet-youtube-manual-pending.csv');
const STATE_PATH = path.join(__dirname, 'prod-meet-youtube-upload-state.json');

function argVal(name, fallback = '') {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}
function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function extractYouTubeId(raw) {
  if (!raw) return '';
  const value = String(raw).trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(value)) return value;
  const match = value.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube-nocookie\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : '';
}

/** Minimal CSV parser (handles quotes). */
function parseCsv(text) {
  const rows = [];
  let i = 0;
  const len = text.length;
  let field = '';
  let row = [];
  let inQuotes = false;
  while (i < len) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += c;
      i += 1;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (c === ',') {
      row.push(field);
      field = '';
      i += 1;
      continue;
    }
    if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      field = '';
      if (row.some((x) => String(x).trim() !== '')) rows.push(row);
      row = [];
      i += 1;
      continue;
    }
    field += c;
    i += 1;
  }
  if (field.length || row.length) {
    row.push(field);
    if (row.some((x) => String(x).trim() !== '')) rows.push(row);
  }
  if (!rows.length) return [];
  const header = rows[0].map((h) => String(h || '').trim());
  return rows.slice(1).map((cols) => {
    const obj = {};
    header.forEach((h, idx) => {
      obj[h] = cols[idx] != null ? String(cols[idx]).trim() : '';
    });
    return obj;
  });
}

function loadState() {
  try {
    if (fs.existsSync(STATE_PATH)) return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
  } catch (_) {
    /* ignore */
  }
  return { startedAt: new Date().toISOString(), results: {} };
}

function saveState(state) {
  state.updatedAt = new Date().toISOString();
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

async function main() {
  const dryRun = hasFlag('dry-run');
  const filePath = path.resolve(process.cwd(), argVal('file', DEFAULT_FILE));
  if (!fs.existsSync(filePath)) {
    throw new Error(`CSV not found: ${filePath}`);
  }

  const records = parseCsv(fs.readFileSync(filePath, 'utf8'));
  console.log(
    JSON.stringify(
      {
        envPath,
        firestoreDb: process.env.FIRESTORE_DATABASE,
        filePath,
        rows: records.length,
        dryRun
      },
      null,
      2
    )
  );

  const state = loadState();
  let applied = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of records) {
    const liveClassId = String(row.liveClassId || '').trim();
    if (!liveClassId) {
      skipped += 1;
      continue;
    }
    const ytId =
      extractYouTubeId(row.youtubeVideoId) ||
      extractYouTubeId(row.youtubeVideoUrl) ||
      extractYouTubeId(row.youtubeEmbedUrl);
    if (!ytId) {
      skipped += 1;
      continue;
    }
    if (String(row.youtubeStatus || '').toLowerCase() === 'done' && !hasFlag('force')) {
      // Still apply if LMS might be missing — only skip empty
    }

    const ytUrl = `https://www.youtube.com/watch?v=${ytId}`;
    const embedUrl = `https://www.youtube-nocookie.com/embed/${ytId}?rel=0&modestbranding=1`;
    const driveFileId =
      googleDriveService.extractDriveFileId(row.driveFileId) ||
      googleDriveService.extractDriveFileId(row.driveLink) ||
      '';

    console.log(`\n→ ${row.title || liveClassId} · yt=${ytId}`);

    if (dryRun) {
      applied += 1;
      continue;
    }

    try {
      const live = await LiveClass.findById(liveClassId).exec();
      if (!live) throw new Error('LiveClass not found');

      live.youtubeVideoId = ytId;
      live.youtubeVideoUrl = ytUrl;
      live.youtubeEmbedUrl = embedUrl;
      if (driveFileId) {
        live.driveFileId = live.driveFileId || driveFileId;
        if (!live.driveLink) {
          live.driveLink = `https://drive.google.com/file/d/${driveFileId}/view`;
        }
      }
      live.recordingPipelineStatus = 'ready';
      live.recordingSyncError = '';
      live.recordingSyncAt = new Date();
      live.updatedAt = new Date();
      await live.save();

      await ensureClassroomFromLiveClass(live, {
        videoSource: 'youtube-url',
        driveFileId: driveFileId || live.driveFileId || '',
        driveLink: live.driveLink || '',
        youtubeVideoId: ytId,
        youtubeVideoUrl: ytUrl,
        youtubeEmbedUrl: embedUrl
      });

      state.results[liveClassId] = {
        status: 'ok',
        source: 'manual-csv',
        title: row.title || live.title || '',
        batchName: row.batchName || '',
        driveFileId: driveFileId || live.driveFileId || '',
        youtubeVideoId: ytId,
        youtubeVideoUrl: ytUrl,
        at: new Date().toISOString()
      };
      saveState(state);
      applied += 1;
      console.log(`  ✅ linked ${ytUrl}`);
    } catch (err) {
      failed += 1;
      console.error(`  ❌ ${err.message || err}`);
      state.results[liveClassId] = {
        status: 'failed',
        source: 'manual-csv',
        error: String(err.message || err).slice(0, 500),
        at: new Date().toISOString()
      };
      saveState(state);
    }
  }

  console.log(
    JSON.stringify(
      {
        done: true,
        applied,
        skippedNoIdOrEmpty: skipped,
        failed,
        statePath: STATE_PATH
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
