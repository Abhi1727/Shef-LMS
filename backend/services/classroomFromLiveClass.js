const Batch = require('../models/Batch');
const Classroom = require('../models/Classroom');
const lessonPath = require('./lessonPath');

function lectureDateFromLiveClass(doc) {
  const tz = doc.timezone || 'Asia/Kolkata';
  if (doc.scheduledStart) {
    return new Date(doc.scheduledStart).toLocaleDateString('en-CA', { timeZone: tz });
  }
  if (doc.scheduledDate && /^\d{4}-\d{2}-\d{2}$/.test(String(doc.scheduledDate))) {
    return String(doc.scheduledDate);
  }
  return new Date().toLocaleDateString('en-CA', { timeZone: tz });
}

/**
 * Ensure a Classroom lecture exists for a live session.
 * Preferred playable source: YouTube (Zoom pipeline). Drive id kept as archive.
 */
async function ensureClassroomFromLiveClass(
  doc,
  {
    videoSource,
    driveFileId,
    driveLink,
    youtubeVideoId,
    youtubeVideoUrl,
    youtubeEmbedUrl,
    durationLabel
  } = {}
) {
  if (!doc?.batchId || doc.skipRecordingUpload) return null;
  if (doc.wasteSessionFlagged && !doc.wasteSessionDismissedAt) return null;

  const batch = await Batch.findById(doc.batchId).lean().exec();
  const title = String(doc.title || 'Live class').trim();
  const date = lectureDateFromLiveClass(doc);
  const liveClassId = String(doc._id || doc.id || '');

  let lecture = null;
  if (doc.classroomLectureId) {
    lecture = await Classroom.findById(doc.classroomLectureId).exec();
  }
  if (!lecture && liveClassId) {
    lecture = await Classroom.findOne({
      batchId: String(doc.batchId),
      liveClassId
    }).exec();
  }
  // Reclaim an orphan lecture for this live on any batch (avoids duplicates / wrong-batch rows)
  if (!lecture && liveClassId) {
    lecture = await Classroom.findOne({ liveClassId }).exec();
  }

  const ytId = youtubeVideoId || doc.youtubeVideoId || '';
  const ytUrl = youtubeVideoUrl || doc.youtubeVideoUrl || '';
  const ytEmbed =
    youtubeEmbedUrl ||
    doc.youtubeEmbedUrl ||
    (ytId ? `https://www.youtube.com/embed/${ytId}` : '');
  const resolvedDriveId = driveFileId || doc.driveFileId || '';
  const resolvedDriveLink = driveLink || doc.driveLink || '';

  const hasYouTube = Boolean(ytId);
  const hasDrive = Boolean(resolvedDriveId);
  const hasPlayableRecording = hasYouTube || hasDrive;

  const source =
    videoSource ||
    (hasYouTube
      ? 'youtube-url'
      : hasDrive
        ? 'drive'
        : doc.conferenceProvider === 'zoom'
          ? 'pending'
          : doc.meetLink
            ? 'meet-session'
            : 'pending');

  const resolvedDuration =
    (durationLabel && String(durationLabel).trim()) ||
    (doc.duration && String(doc.duration).trim()) ||
    '';

  if (!hasPlayableRecording) {
    if (lecture) {
      lecture.videoSource = source === 'drive' ? 'meet-session' : source;
      lecture.driveId = '';
      lecture.date = date;
      lecture.liveClassId = liveClassId;
      if (resolvedDuration) lecture.duration = resolvedDuration;
      lecture.updatedAt = new Date();
      await lecture.save();
    }
    return lecture || null;
  }

  const payload = {
    title,
    instructor: doc.teacherName || doc.instructor || '',
    description:
      doc.description ||
      (hasYouTube
        ? `Recording for ${title}`
        : `Live class on ${date}. The recording appears here after processing.`),
    course: doc.course || batch?.course || '',
    batchId: String(doc.batchId),
    batchName: batch?.name || doc.batchName || '',
    duration: resolvedDuration,
    date,
    liveClassId,
    videoSource: hasYouTube ? 'youtube-url' : source,
    driveId: resolvedDriveId,
    // Legacy field often holds an external link; prefer YouTube watch URL when present
    zoomUrl: ytUrl || resolvedDriveLink || doc.meetLink || '',
    youtubeVideoId: hasYouTube ? ytId : '',
    youtubeVideoUrl: hasYouTube ? ytUrl : '',
    youtubeEmbedUrl: hasYouTube ? ytEmbed : '',
    unlockRule: 'open',
    updatedAt: new Date()
  };

  if (lecture) {
    Object.assign(lecture, payload);
    // Always realign to the live session's batch when media is attached
    lecture.batchId = String(doc.batchId);
    if (batch?.name || doc.batchName) {
      lecture.batchName = batch?.name || doc.batchName || lecture.batchName || '';
    }
    if (!lecture.order) {
      lecture.order = await lessonPath.nextOrderForBatch(String(doc.batchId));
    }
    if (hasPlayableRecording) {
      // Do not re-publish lectures we intentionally hid (waste / short stubs).
      const wasteHidden =
        (doc.wasteSessionFlagged && !doc.wasteSessionDismissedAt) ||
        doc.skipRecordingUpload === true;
      if (!wasteHidden) {
        lecture.studentVisible = true;
      }
    }
    await lecture.save();
  } else {
    const order = await lessonPath.nextOrderForBatch(String(doc.batchId));
    const wasteHidden =
      (doc.wasteSessionFlagged && !doc.wasteSessionDismissedAt) ||
      doc.skipRecordingUpload === true;
    lecture = await Classroom.create({
      ...payload,
      order,
      studentVisible: hasPlayableRecording && !wasteHidden,
      uploadedBy: String(doc.teacherId || doc.createdBy || ''),
      createdAt: new Date()
    });
  }

  doc.classroomLectureId = String(lecture._id);
  if (resolvedDriveId) doc.driveFileId = resolvedDriveId;
  if (resolvedDriveLink) doc.driveLink = resolvedDriveLink;
  if (ytId) {
    doc.youtubeVideoId = ytId;
    doc.youtubeVideoUrl = ytUrl;
    doc.youtubeEmbedUrl = ytEmbed;
  }
  doc.updatedAt = new Date();
  await doc.save();
  return lecture;
}

module.exports = { ensureClassroomFromLiveClass, lectureDateFromLiveClass };
