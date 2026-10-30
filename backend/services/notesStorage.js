const path = require('path');
const Batch = require('../models/Batch');
const googleDriveService = require('./googleDriveService');
const { findLocalNotesFile, streamNotesFile } = require('../utils/notesDownload');

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

function isLectureNotesDeliverable(lecture, diskFiles) {
  if (!lecture) return false;
  if (!lecture.notesAvailable && !lecture.notesFilePath && !lecture.notesDriveId && !lecture.notesDriveLink) {
    return false;
  }
  const local = findLocalNotesFile(
    {
      notesFilePath: lecture.notesFilePath,
      notesFileName: lecture.notesFileName,
      title: lecture.title
    },
    diskFiles
  );
  if (local && !local.error) return true;
  const driveId =
    lecture.notesDriveId || googleDriveService.extractDriveFileId(lecture.notesDriveLink);
  return Boolean(driveId);
}

async function deliverLectureNotes(res, video) {
  let name = video.notesFileName || path.basename(String(video.notesFilePath || 'notes'));
  name = name.replace(/\.(docx|pptx|xlsx|pdf|ipynb|doc|ppt|xls|txt|csv|py|json|md|rtf)\.zip$/i, '.$1');
  const local = findLocalNotesFile({
    notesFilePath: video.notesFilePath,
    notesFileName: video.notesFileName,
    title: video.title
  });
  if (local && !local.error) {
    if (!path.extname(name) && path.extname(local.path)) {
      name = `${name}${path.extname(local.path)}`;
    }
    streamNotesFile(res, { filePath: local.path, downloadName: name });
    return true;
  }
  const driveId = video.notesDriveId || googleDriveService.extractDriveFileId(video.notesDriveLink);
  if (driveId) {
    try {
      await googleDriveService.streamFileToResponse(res, driveId, name);
      return true;
    } catch (err) {
      console.warn('[notes] Drive download failed:', err.message || err);
    }
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
      'Notes file is missing on the server. Ask your trainer to upload the notes file again — it will be saved to Google Drive.'
  });
}

module.exports = { persistNotesToDrive, deliverLectureNotes, sendLectureNotes, isLectureNotesDeliverable };
