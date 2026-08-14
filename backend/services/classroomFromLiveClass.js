const Batch = require('../models/Batch');
const Classroom = require('../models/Classroom');
const lessonPath = require('./lessonPath');

/**
 * Ensure a Classroom lecture exists for a Meet session.
 * When a Drive recording is attached later, the same lecture is updated.
 */
async function ensureClassroomFromLiveClass(doc, { videoSource, driveFileId, driveLink } = {}) {
  if (!doc?.batchId || doc.skipRecordingUpload) return null;

  const batch = await Batch.findById(doc.batchId).lean().exec();
  const title = String(doc.title || 'Live class').trim();
  const date =
    doc.scheduledDate ||
    (doc.scheduledStart
      ? new Date(doc.scheduledStart).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10));

  let lecture = null;
  if (doc.classroomLectureId) {
    lecture = await Classroom.findById(doc.classroomLectureId).exec();
  }
  if (!lecture) {
    lecture = await Classroom.findOne({
      batchId: String(doc.batchId),
      title,
      date
    }).exec();
  }

  const source =
    videoSource ||
    (driveFileId || doc.driveFileId ? 'drive' : doc.meetLink ? 'meet-session' : 'pending');
  const hasPlayableRecording = Boolean(driveFileId || doc.driveFileId);

  if (!hasPlayableRecording) {
    if (lecture) {
      lecture.videoSource = source === 'drive' ? 'meet-session' : source;
      lecture.driveId = '';
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
      (source === 'drive'
        ? `Recording for ${title}`
        : `Live class on ${date}. The recording appears here after Meet finishes processing.`),
    course: doc.course || batch?.course || '',
    batchId: String(doc.batchId),
    batchName: batch?.name || doc.batchName || '',
    duration: doc.duration || '',
    date,
    videoSource: source,
    driveId: driveFileId || doc.driveFileId || '',
    zoomUrl: driveLink || doc.driveLink || doc.meetLink || '',
    unlockRule: 'open',
    updatedAt: new Date()
  };

  if (lecture) {
    Object.assign(lecture, payload);
    if (!lecture.order) {
      lecture.order = await lessonPath.nextOrderForBatch(String(doc.batchId));
    }
    await lecture.save();
  } else {
    const order = await lessonPath.nextOrderForBatch(String(doc.batchId));
    lecture = await Classroom.create({
      ...payload,
      order,
      uploadedBy: String(doc.teacherId || doc.createdBy || ''),
      createdAt: new Date()
    });
  }

  doc.classroomLectureId = String(lecture._id);
  if (driveFileId) doc.driveFileId = driveFileId;
  if (driveLink) doc.driveLink = driveLink;
  doc.updatedAt = new Date();
  await doc.save();
  return lecture;
}

module.exports = { ensureClassroomFromLiveClass };
