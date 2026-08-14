const path = require('path');
const Batch = require('../models/Batch');
const googleDriveService = require('./googleDriveService');
const { resolveNotesAbsolutePath, streamNotesFile } = require('../utils/notesDownload');

async function persistNotesToDrive({ file, batchId, lectureTitle }) {
  if (!file?.path) return {};
  try {
    const batch = batchId ? await Batch.findById(batchId).lean().exec() : null;
    const uploaded = await googleDriveService.uploadBatchFile({
      batchId: batchId || 'notes',
      batchName: batch?.name || 'Classroom notes',
      folderId: batch?.driveFolderId || '',
      filePath: file.path,
      fileName: file.originalname || file.filename,
      mimeType: file.mimetype,
      title: lectureTitle || file.originalname,
      shareWithEmails: []
    });
    return {
      notesDriveId: uploaded.driveFileId,
      notesDriveLink: uploaded.driveLink
    };
  } catch (err) {
    console.warn('[notes] Drive upload failed, keeping local file:', err.message || err);
    return {};
  }
}

async function deliverLectureNotes(res, video) {
  const name = video.notesFileName || path.basename(String(video.notesFilePath || 'notes'));
  const local = video.notesFilePath ? resolveNotesAbsolutePath(video.notesFilePath) : null;
  if (local && !local.error) {
    streamNotesFile(res, { filePath: local.path, downloadName: name });
    return true;
  }
  const driveId = video.notesDriveId || googleDriveService.extractDriveFileId(video.notesDriveLink);
  if (driveId) {
    await googleDriveService.streamFileToResponse(res, driveId, name);
    return true;
  }
  return false;
}

async function sendLectureNotes(res, video) {
  const hasNotes = video?.notesAvailable || video?.notesFilePath || video?.notesDriveId;
  if (!hasNotes) {
    res.status(404).json({ message: 'No notes available for this video' });
    return;
  }
  const sent = await deliverLectureNotes(res, video);
  if (sent) return;
  res.status(404).json({
    message:
      'Notes file is missing on the server. Ask your trainer to upload the zip again — it will be saved to Google Drive.'
  });
}

module.exports = { persistNotesToDrive, deliverLectureNotes, sendLectureNotes };
