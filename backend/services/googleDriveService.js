const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const { getGoogleAuth, isMeetEnabled, getAuthMode } = require('./googleAuth');

const ROOT_FOLDER_NAME = process.env.GOOGLE_DRIVE_ROOT_FOLDER || 'Sky States LMS Recordings';

async function getDriveClient() {
  if (!isMeetEnabled()) {
    const err = new Error('Google Meet/Drive is disabled. Set GOOGLE_MEET_ENABLED=true.');
    err.code = 'MEET_DISABLED';
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
  title
}) {
  const drive = await getDriveClient();
  let parentId = folderId;
  if (!parentId) {
    const ensured = await ensureBatchFolder({ batchId, batchName });
    parentId = ensured.folderId;
  }

  const name = fileName || `${title || 'recording'}${path.extname(filePath) || '.mp4'}`;
  const res = await drive.files.create({
    requestBody: {
      name,
      parents: [parentId]
    },
    media: {
      mimeType: mimeType || 'video/mp4',
      body: fs.createReadStream(filePath)
    },
    fields: 'id, name, webViewLink, webContentLink, mimeType, size'
  });

  const file = res.data;
  await makeFileReadableWithLink(drive, file.id);

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

function getDriveStatus() {
  return {
    enabled: isMeetEnabled(),
    configured: getAuthMode() !== 'none',
    authMode: getAuthMode(),
    rootFolderName: ROOT_FOLDER_NAME
  };
}

module.exports = {
  ensureBatchFolder,
  uploadRecordingFile,
  uploadBatchFile,
  getDriveStatus,
  getDriveClient
};
