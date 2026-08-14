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
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  ipynb: 'application/json'
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

function resolveNotesAbsolutePath(notesFilePath) {
  const backendRoot = path.join(__dirname, '..');
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
  const name = downloadName || path.basename(filePath);
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
  streamNotesFile
};
