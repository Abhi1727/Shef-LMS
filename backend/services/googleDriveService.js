const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const { getGoogleAuth, isGoogleConfigured, getAuthMode } = require('./googleAuth');

const ROOT_FOLDER_NAME = process.env.GOOGLE_DRIVE_ROOT_FOLDER || 'Sky States LMS Recordings';

function envFlag(name, defaultTrue = false) {
  const raw = String(process.env[name] ?? '').trim().toLowerCase();
  if (!raw) return defaultTrue;
  return raw === '1' || raw === 'true' || raw === 'yes';
}

/**
 * Drive archive stays on the admin host account.
 * Trainers/students should use LMS (Classroom / Materials), not browse the whole admin Drive.
 * - Do NOT share the root or sibling batch folders with trainers.
 * - Public/domain link sharing is off unless GOOGLE_DRIVE_PUBLIC_LINKS=true.
 * - Optional: GOOGLE_DRIVE_SHARE_TRAINER_FILE=true shares only the uploaded file (reader) with that trainer.
 */
function shouldSharePublicLinks() {
  return envFlag('GOOGLE_DRIVE_PUBLIC_LINKS', false);
}

function shouldShareTrainerOnFile() {
  return envFlag('GOOGLE_DRIVE_SHARE_TRAINER_FILE', false);
}

function shouldShareTrainerOnFolder() {
  // Default false — folder writer access let trainers open Drive and often see far more than one batch.
  return envFlag('GOOGLE_DRIVE_SHARE_TRAINER_FOLDER', false);
}

async function getDriveClient() {
  // Drive is used for Zoom + Meet recording archives — independent of Meet live toggle
  if (!isGoogleConfigured()) {
    const err = new Error(
      'Google Drive is not configured. Set GOOGLE_MEET_CLIENT_ID / SECRET / REFRESH_TOKEN (Drive scopes).'
    );
    err.code = 'DRIVE_NOT_CONFIGURED';
    throw err;
  }
  const auth = await getGoogleAuth();
  return google.drive({ version: 'v3', auth });
}

async function findChildFolder(drive, name, parentId) {
  const q = parentId
    ? `mimeType='application/vnd.google-apps.folder' and name='${name.replace(/'/g, "\\'")}' and '${parentId}' in parents and trashed=false`
    : `mimeType='application/vnd.google-apps.folder' and name='${name.replace(/'/g, "\\'")}' and 'root' in parents and trashed=false`;
  const res = await drive.files.list({
    q,
    fields: 'files(id, name, webViewLink)',
    spaces: 'drive',
    pageSize: 5
  });
  return (res.data.files || [])[0] || null;
}

async function createFolder(drive, name, parentId) {
  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : undefined
    },
    fields: 'id, name, webViewLink'
  });
  return res.data;
}

/**
 * Ensure root LMS folder + per-batch folder exist on the host Drive.
 */
async function ensureBatchFolder({ batchId, batchName }) {
  const drive = await getDriveClient();
  let root = await findChildFolder(drive, ROOT_FOLDER_NAME, null);
  if (!root) {
    root = await createFolder(drive, ROOT_FOLDER_NAME, null);
  }

  const folderLabel = `${String(batchName || 'Batch').slice(0, 80)} [${String(batchId).slice(-6)}]`;
  let batchFolder = await findChildFolder(drive, folderLabel, root.id);
  if (!batchFolder) {
    batchFolder = await createFolder(drive, folderLabel, root.id);
  }

  return {
    rootFolderId: root.id,
    folderId: batchFolder.id,
    folderLink: batchFolder.webViewLink || `https://drive.google.com/drive/folders/${batchFolder.id}`
  };
}

async function makeFileReadableWithLink(drive, fileId) {
  if (!shouldSharePublicLinks()) {
    return;
  }
  try {
    await drive.permissions.create({
      fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone'
      }
    });
  } catch (err) {
    // Domain-restricted Workspace may block "anyone"; try domain
    const domain = process.env.GOOGLE_DRIVE_SHARE_DOMAIN || 'skystates.us';
    try {
      await drive.permissions.create({
        fileId,
        requestBody: {
          role: 'reader',
          type: 'domain',
          domain
        }
      });
    } catch (err2) {
      console.warn('[Drive] Could not set public/domain share:', err2.message || err.message);
    }
  }
}

async function shareWithEmails(drive, fileId, emails, role = 'writer') {
  const list = [...new Set((emails || []).filter(Boolean).map((e) => String(e).trim().toLowerCase()))];
  for (const email of list) {
    try {
      await drive.permissions.create({
        fileId,
        sendNotificationEmail: false,
        requestBody: {
          type: 'user',
          role,
          emailAddress: email
        }
      });
    } catch (err) {
      console.warn(`[Drive] Could not share ${fileId} with ${email}:`, err?.message || err);
    }
  }
}

/**
 * Upload a recording file into the batch Drive folder.
 */
async function uploadRecordingFile({
  batchId,
  batchName,
  folderId,
  filePath,
  fileName,
  mimeType,
  title,
  shareWithEmails: shareEmails = []
}) {
  const drive = await getDriveClient();
  let parentId = folderId;
  if (!parentId) {
    const ensured = await ensureBatchFolder({ batchId, batchName });
    parentId = ensured.folderId;
  }

  const name = fileName || `${title || 'recording'}${path.extname(filePath) || '.mp4'}`;
  const ext = (name.includes('.') ? name.split('.').pop() : '').toLowerCase();
  const docMimes = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    txt: 'text/plain',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    csv: 'text/csv',
    zip: 'application/zip',
    rar: 'application/vnd.rar',
    '7z': 'application/x-7z-compressed',
    ipynb: 'application/x-ipynb+json',
    py: 'text/x-python',
    json: 'application/json',
    md: 'text/markdown',
    mp4: 'video/mp4',
    webm: 'video/webm'
  };
  const resolvedMime = mimeType && mimeType !== 'application/octet-stream'
    ? mimeType
    : (docMimes[ext] || mimeType || 'video/mp4');

  const res = await drive.files.create({
    requestBody: {
      name,
      parents: [parentId]
    },
    media: {
      mimeType: resolvedMime,
      body: fs.createReadStream(filePath)
    },
    fields: 'id, name, webViewLink, webContentLink, mimeType, size'
  });

  const file = res.data;
  await makeFileReadableWithLink(drive, file.id);
  // Never share the LMS root. Batch-folder writer shares are off by default.
  if (shouldShareTrainerOnFile() && shareEmails.length) {
    await shareWithEmails(drive, file.id, shareEmails, 'reader');
  }
  if (shouldShareTrainerOnFolder() && parentId && shareEmails.length) {
    await shareWithEmails(drive, parentId, shareEmails, 'reader');
  }

  // Refresh links after permission change
  const meta = await drive.files.get({
    fileId: file.id,
    fields: 'id, name, webViewLink, webContentLink'
  });

  return {
    folderId: parentId,
    driveFileId: meta.data.id,
    driveLink: meta.data.webViewLink || `https://drive.google.com/file/d/${meta.data.id}/view`,
    driveName: meta.data.name,
    webContentLink: meta.data.webContentLink || ''
  };
}

/**
 * Generic batch file upload (projects, handouts, session materials).
 * Reuses recording upload + share logic.
 */
async function uploadBatchFile(opts) {
  return uploadRecordingFile(opts);
}

function extractDriveFileId(raw) {
  const value = String(raw || '').trim();
  if (!value) return '';
  const fromPath = value.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (fromPath) return fromPath[1];
  const fromQuery = value.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (fromQuery) return fromQuery[1];
  const fromApi = value.match(/drive\/v3\/files\/([a-zA-Z0-9_-]+)/);
  if (fromApi) return fromApi[1];
  const fromResource = value.match(/driveFiles\/([a-zA-Z0-9_-]+)/);
  if (fromResource) return fromResource[1];
  if (/^[a-zA-Z0-9_-]{10,}$/.test(value)) return value;
  return '';
}

/**
 * Copy a Drive file the host already owns (e.g. a Meet recording) into the batch folder.
 */
async function copyFileToBatchFolder({
  sourceFileId,
  batchId,
  batchName,
  folderId,
  fileName,
  shareWithEmails: shareEmails = []
}) {
  const drive = await getDriveClient();
  let parentId = folderId;
  if (!parentId) {
    const ensured = await ensureBatchFolder({ batchId, batchName });
    parentId = ensured.folderId;
  }

  const copied = await drive.files.copy({
    fileId: sourceFileId,
    supportsAllDrives: true,
    requestBody: {
      name: fileName || 'Class recording',
      parents: [parentId]
    },
    fields: 'id, name, webViewLink, webContentLink'
  });

  const file = copied.data;
  await makeFileReadableWithLink(drive, file.id);
  if (shouldShareTrainerOnFile() && shareEmails.length) {
    await shareWithEmails(drive, file.id, shareEmails, 'reader');
  }
  if (shouldShareTrainerOnFolder() && parentId && shareEmails.length) {
    await shareWithEmails(drive, parentId, shareEmails, 'reader');
  }

  const meta = await drive.files.get({
    fileId: file.id,
    fields: 'id, name, webViewLink, webContentLink, mimeType, size, videoMediaMetadata',
    supportsAllDrives: true
  });
  const durationMillis = Number(meta.data.videoMediaMetadata?.durationMillis || 0);

  return {
    folderId: parentId,
    driveFileId: meta.data.id,
    driveLink: meta.data.webViewLink || `https://drive.google.com/file/d/${meta.data.id}/view`,
    driveName: meta.data.name,
    webContentLink: meta.data.webContentLink || '',
    mimeType: meta.data.mimeType || '',
    size: Number(meta.data.size || 0),
    durationMillis,
    durationLabel: formatVideoDurationLabel(durationMillis),
    copiedFrom: sourceFileId
  };
}

async function getFileMeta(fileId) {
  if (!fileId) return null;
  const drive = await getDriveClient();
  const meta = await drive.files.get({
    fileId,
    fields: 'id, name, mimeType, size, webViewLink, webContentLink, trashed, videoMediaMetadata',
    supportsAllDrives: true
  });
  const durationMillis = Number(meta.data.videoMediaMetadata?.durationMillis || 0);
  return {
    driveFileId: meta.data.id,
    driveName: meta.data.name,
    mimeType: meta.data.mimeType || '',
    size: Number(meta.data.size || 0),
    driveLink: meta.data.webViewLink || `https://drive.google.com/file/d/${meta.data.id}/view`,
    webContentLink: meta.data.webContentLink || '',
    trashed: Boolean(meta.data.trashed),
    durationMillis: Number.isFinite(durationMillis) ? durationMillis : 0,
    durationLabel: formatVideoDurationLabel(durationMillis)
  };
}

function formatVideoDurationLabel(durationMillis) {
  const ms = Number(durationMillis || 0);
  if (!Number.isFinite(ms) || ms < 1000) return '';
  const totalSec = Math.round(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return s >= 30 ? `${m + 1} mins` : `${m} mins`;
  return `${s}s`;
}

const MIN_PLAYABLE_VIDEO_BYTES = 1024 * 1024;

const videoMetaCache = new Map();
const VIDEO_META_TTL_MS = 10 * 60 * 1000;

async function getCachedVideoMeta(fileId) {
  const cached = videoMetaCache.get(fileId);
  if (cached && cached.expires > Date.now()) return cached.meta;
  const drive = await getDriveClient();
  const meta = await drive.files.get({
    fileId,
    fields: 'id, name, mimeType, size',
    supportsAllDrives: true
  });
  const parsed = {
    total: Number(meta.data.size || 0),
    mime:
      meta.data.mimeType && /^video\//.test(meta.data.mimeType)
        ? meta.data.mimeType
        : 'video/mp4'
  };
  videoMetaCache.set(fileId, { meta: parsed, expires: Date.now() + VIDEO_META_TTL_MS });
  return parsed;
}

/** Short-lived Google CDN URL — browser reads bytes directly (fast start + seek). */
async function getDirectVideoStreamUrl(fileId) {
  if (!fileId) return null;
  const auth = await getGoogleAuth();
  const tokenResult = await auth.getAccessToken();
  const accessToken =
    typeof tokenResult === 'string' ? tokenResult : tokenResult?.token || tokenResult?.access_token;
  if (!accessToken) return null;
  const params = new URLSearchParams({ alt: 'media', access_token: accessToken });
  return `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?${params.toString()}`;
}

async function writeVideoHead(res, fileId) {
  const { total, mime } = await getCachedVideoMeta(fileId);
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', mime);
  if (total) res.setHeader('Content-Length', total);
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.status(200).end();
}

function isPlayableVideoFile(meta) {
  if (!meta || meta.trashed) return false;
  const mime = String(meta.mimeType || '');
  const name = String(meta.driveName || meta.name || '');
  const looksVideo = /^video\//.test(mime) || /\.(mp4|webm|mov|mkv|m4v)$/i.test(name);
  return looksVideo && Number(meta.size || 0) >= MIN_PLAYABLE_VIDEO_BYTES;
}

async function streamFileToResponse(res, fileId, downloadName) {
  const drive = await getDriveClient();
  const meta = await drive.files.get({
    fileId,
    fields: 'id, name, mimeType, size',
    supportsAllDrives: true
  });
  let name = String(downloadName || meta.data.name || 'download').replace(/[/\\]/g, '_');
  name = name.replace(/\.(docx|pptx|xlsx|pdf|ipynb|doc|ppt|xls|txt|csv|py|json|md|rtf)\.zip$/i, '.$1');
  if (!path.extname(name) && meta.data.name && path.extname(meta.data.name)) {
    name = `${name}${path.extname(meta.data.name)}`;
  } else if (!path.extname(name) && meta.data.name) {
    name = meta.data.name;
  }
  const ascii = name.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const mimeByExt = {
    zip: 'application/zip',
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    csv: 'text/csv',
    txt: 'text/plain',
    ipynb: 'application/x-ipynb+json',
    py: 'text/x-python',
    json: 'application/json',
    rar: 'application/vnd.rar',
    '7z': 'application/x-7z-compressed',
    tar: 'application/x-tar',
    gz: 'application/gzip',
    md: 'text/markdown',
    rtf: 'application/rtf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    mp4: 'video/mp4',
    webm: 'video/webm'
  };
  let mime =
    mimeByExt[ext] ||
    (meta.data.mimeType && meta.data.mimeType !== 'application/vnd.google-apps.document'
      ? meta.data.mimeType
      : 'application/octet-stream');
  if (mime === 'application/vnd.google-apps.document') mime = 'application/octet-stream';
  res.setHeader('Content-Type', mime);
  if (meta.data.size) res.setHeader('Content-Length', meta.data.size);
  res.setHeader('Content-Disposition', `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const media = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'stream' }
  );
  return new Promise((resolve, reject) => {
    media.data.on('error', reject);
    media.data.on('end', resolve);
    media.data.pipe(res);
  });
}

/** Stream a Drive video through LMS (supports HTTP Range for seeking). */
async function streamVideoToResponse(res, fileId, req = {}) {
  if (req.method === 'HEAD') {
    return writeVideoHead(res, fileId);
  }

  const { total, mime } = await getCachedVideoMeta(fileId);
  const rangeHeader = req.headers?.range;

  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  const drive = await getDriveClient();

  if (rangeHeader && total > 0) {
    const match = String(rangeHeader).match(/bytes=(\d*)-(\d*)/);
    const start = match && match[1] ? parseInt(match[1], 10) : 0;
    const end = match && match[2] ? parseInt(match[2], 10) : total - 1;
    const safeEnd = Math.min(end, total - 1);
    const safeStart = Math.min(start, safeEnd);
    const chunkSize = safeEnd - safeStart + 1;
    res.status(206);
    res.setHeader('Content-Range', `bytes ${safeStart}-${safeEnd}/${total}`);
    res.setHeader('Content-Length', chunkSize);
    res.setHeader('Content-Type', mime);
    const media = await drive.files.get(
      { fileId, alt: 'media', supportsAllDrives: true },
      {
        responseType: 'stream',
        headers: { Range: `bytes=${safeStart}-${safeEnd}` }
      }
    );
    return new Promise((resolve, reject) => {
      media.data.on('error', reject);
      media.data.on('end', resolve);
      media.data.pipe(res);
    });
  }

  if (total) res.setHeader('Content-Length', total);
  res.setHeader('Content-Type', mime);
  const media = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'stream' }
  );
  return new Promise((resolve, reject) => {
    media.data.on('error', reject);
    media.data.on('end', resolve);
    media.data.pipe(res);
  });
}

async function listRecentHostVideos({ after, before, pageSize = 50 } = {}) {
  const drive = await getDriveClient();
  const clauses = ["mimeType contains 'video/'", 'trashed=false'];
  if (after) clauses.push(`createdTime > '${new Date(after).toISOString()}'`);
  if (before) clauses.push(`createdTime < '${new Date(before).toISOString()}'`);
  const res = await drive.files.list({
    q: clauses.join(' and '),
    fields: 'files(id, name, createdTime, webViewLink, mimeType, size)',
    orderBy: 'createdTime desc',
    pageSize,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    spaces: 'drive'
  });
  return res.data.files || [];
}

function getDriveStatus() {
  return {
    enabled: isGoogleConfigured(),
    configured: getAuthMode() !== 'none',
    authMode: getAuthMode(),
    rootFolderName: ROOT_FOLDER_NAME
  };
}

module.exports = {
  ensureBatchFolder,
  uploadRecordingFile,
  uploadBatchFile,
  copyFileToBatchFolder,
  listRecentHostVideos,
  extractDriveFileId,
  makeFileReadableWithLink,
  getFileMeta,
  getDirectVideoStreamUrl,
  formatVideoDurationLabel,
  isPlayableVideoFile,
  streamFileToResponse,
  streamVideoToResponse,
  MIN_PLAYABLE_VIDEO_BYTES,
  getDriveStatus,
  getDriveClient
};
