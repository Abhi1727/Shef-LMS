const path = require('path');
const fs = require('fs');

const MIME = {
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
  tar: 'application/x-tar',
  gz: 'application/gzip',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  ipynb: 'application/x-ipynb+json',
  py: 'text/x-python',
  json: 'application/json',
  md: 'text/markdown',
  rtf: 'application/rtf',
  sql: 'application/sql',
  mp4: 'video/mp4',
  webm: 'video/webm'
};

function getContentType(filename) {
  const ext = path.extname(String(filename || '')).toLowerCase().replace('.', '');
  return MIME[ext] || 'application/octet-stream';
}

function contentDisposition(filename) {
  const raw = String(filename || 'notes').replace(/[/\\]/g, '_');
  const ascii = raw.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');
  const encoded = encodeURIComponent(raw);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

function getBackendRoot() {
  return path.join(__dirname, '..');
}

function getUploadsDirs() {
  const root = getBackendRoot();
  return ['uploads/notes', 'uploads/teacher-notes'].map((rel) => path.join(root, rel));
}

function stripDiskPrefix(name) {
  return String(name || '').replace(/^\d+-/, '');
}

function normalizeNotesKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[''´`]/g, '')
    .replace(/\(\s*1\s*\)/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

function listUploadFiles() {
  const files = [];
  for (const dir of getUploadsDirs()) {
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isFile()) files.push(full);
    }
  }
  return files;
}

function scoreNotesMatch(diskPath, hints) {
  const diskKey = normalizeNotesKey(stripDiskPrefix(path.basename(diskPath)));
  if (!diskKey) return 0;
  let best = 0;
  for (const hint of hints) {
    const hintKey = normalizeNotesKey(stripDiskPrefix(hint));
    if (!hintKey) continue;
    if (diskKey === hintKey) best = Math.max(best, 100);
    else if (diskKey.includes(hintKey) || hintKey.includes(diskKey)) {
      const ratio =
        Math.min(diskKey.length, hintKey.length) / Math.max(diskKey.length, hintKey.length);
      best = Math.max(best, Math.round(ratio * 92));
    }
  }
  return best;
}

function findLocalNotesFile({ notesFilePath, notesFileName, title }, diskFiles) {
  const exact = notesFilePath ? resolveNotesAbsolutePath(notesFilePath) : null;
  if (exact && !exact.error) return exact;

  const hints = [notesFileName, path.basename(String(notesFilePath || '')), title].filter(Boolean);
  let bestPath = null;
  let bestScore = 0;
  const files = diskFiles || listUploadFiles();
  for (const file of files) {
    const score = scoreNotesMatch(file, hints);
    if (score > bestScore) {
      bestScore = score;
      bestPath = file;
    }
  }
  if (bestPath && bestScore >= 85) {
    return { path: bestPath, matched: true, score: bestScore };
  }
  return { error: 404, message: 'Notes file not found on server' };
}

function resolveNotesAbsolutePath(notesFilePath) {
  const backendRoot = getBackendRoot();
  const uploadsDir = path.normalize(path.join(backendRoot, 'uploads'));
  const relative = String(notesFilePath || '').replace(/^\/+/, '');
  const notesPath = path.normalize(path.join(backendRoot, relative));
  if (notesPath !== uploadsDir && !notesPath.startsWith(uploadsDir + path.sep)) {
    return { error: 403, message: 'Access denied' };
  }
  if (!fs.existsSync(notesPath) || !fs.statSync(notesPath).isFile()) {
    return { error: 404, message: 'Notes file not found on server' };
  }
  return { path: notesPath };
}

function streamNotesFile(res, { filePath, downloadName }) {
  const stats = fs.statSync(filePath);
  let name = downloadName || path.basename(filePath);
  // Strip spurious .zip suffix appended to non-zip formats
  name = name.replace(/\.(docx|pptx|xlsx|pdf|ipynb|doc|ppt|xls|txt|csv|py|json|md|rtf)\.zip$/i, '.$1');
  // Ensure extension is retained if downloadName lacked an extension but filePath has one
  if (!path.extname(name) && path.extname(filePath)) {
    name = `${name}${path.extname(filePath)}`;
  }
  const type = getContentType(name) !== 'application/octet-stream'
    ? getContentType(name)
    : getContentType(filePath);
  res.setHeader('Content-Type', type);
  res.setHeader('Content-Length', stats.size);
  res.setHeader('Content-Disposition', contentDisposition(name));
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  fs.createReadStream(filePath).pipe(res);
}

module.exports = {
  getContentType,
  contentDisposition,
  resolveNotesAbsolutePath,
  findLocalNotesFile,
  listUploadFiles,
  streamNotesFile
};
