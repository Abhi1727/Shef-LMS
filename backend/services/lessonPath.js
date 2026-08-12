const Classroom = require('../models/Classroom');
const ActivityLog = require('../models/ActivityLog');
const { Assessment } = require('../models/AssessmentStudio');

const WATCH_COMPLETE_THRESHOLD = 95;

/**
 * Next order index for a batch (1-based).
 */
async function nextOrderForBatch(batchId) {
  const last = await Classroom.findOne({ batchId: String(batchId) })
    .sort({ order: -1 })
    .select('order')
    .lean()
    .exec();
  const n = Number(last?.order) || 0;
  return n + 1;
}

/**
 * Sort lectures: explicit order first; fall back to date for order=0 ties.
 */
function sortLessons(lectures) {
  const hasOrder = lectures.some((l) => Number(l.order) > 0);
  return [...lectures].sort((a, b) => {
    if (hasOrder) {
      const oa = Number(a.order) || 0;
      const ob = Number(b.order) || 0;
      if (oa !== ob) return oa - ob;
    }
    const da = new Date(a.date || a.createdAt || 0).getTime();
    const db = new Date(b.date || b.createdAt || 0).getTime();
    return da - db;
  });
}

async function getWatchedVideoIds(userId) {
  if (!userId) return new Set();
  const ids = await ActivityLog.distinct('videoId', {
    userId: String(userId),
    action: { $in: ['video_view', 'video_completed', 'VIDEO_VIEW'] }
  });
  return new Set((ids || []).map(String).filter(Boolean));
}

/**
 * Build lesson path for a batch with unlock + step state for a student.
 */
async function buildLessonPath({ batchId, studentId }) {
  const lectures = await Classroom.find({ batchId: String(batchId) }).lean().exec();
  const ordered = sortLessons(lectures);
  const watched = await getWatchedVideoIds(studentId);

  const assessmentIds = ordered
    .map((l) => l.linkedAssessmentId)
    .filter(Boolean)
    .map(String);

  let assessmentsById = {};
  if (assessmentIds.length) {
    const assessments = await Assessment.find({
      _id: { $in: assessmentIds.filter((id) => /^[a-f\d]{24}$/i.test(id)) },
      status: 'published'
    })
      .select('title status duration passingMarks')
      .lean()
      .exec();
    assessmentsById = Object.fromEntries(assessments.map((a) => [String(a._id), a]));
  }

  let previousComplete = true;
  return ordered.map((lec, index) => {
    const id = String(lec._id);
    const watchedOk = watched.has(id);
    const unlockRule = lec.unlockRule === 'afterPrevious' ? 'afterPrevious' : 'open';
    const locked = unlockRule === 'afterPrevious' && index > 0 && !previousComplete;
    const linked = lec.linkedAssessmentId ? assessmentsById[String(lec.linkedAssessmentId)] : null;

    const lesson = {
      id,
      title: lec.title,
      description: lec.description || '',
      instructor: lec.instructor || '',
      order: Number(lec.order) || index + 1,
      unlockRule,
      locked,
      watchComplete: watchedOk,
      notesAvailable: !!(lec.notesAvailable && lec.notesFilePath),
      notesFileName: lec.notesFileName || '',
      linkedAssessmentId: lec.linkedAssessmentId || '',
      linkedAssessment: linked
        ? {
            id: String(linked._id),
            title: linked.title,
            duration: linked.duration,
            passingMarks: linked.passingMarks
          }
        : null,
      steps: {
        watch: watchedOk ? 'done' : locked ? 'locked' : 'available',
        notes: !(lec.notesAvailable && lec.notesFilePath)
          ? 'skipped'
          : locked
            ? 'locked'
            : watchedOk
              ? 'available'
              : 'pending',
        quiz: !lec.linkedAssessmentId
          ? 'skipped'
          : locked || !linked
            ? 'locked'
            : watchedOk
              ? 'available'
              : 'pending'
      },
      videoSource: lec.videoSource,
      youtubeVideoId: lec.youtubeVideoId,
      youtubeVideoUrl: lec.youtubeVideoUrl,
      youtubeEmbedUrl: lec.youtubeEmbedUrl,
      driveId: lec.driveId || '',
      zoomUrl: lec.zoomUrl || '',
      date: lec.date,
      createdAt: lec.createdAt,
      duration: lec.duration,
      course: lec.course,
      batchId: lec.batchId,
      batchName: lec.batchName
    };

    previousComplete = watchedOk;
    return lesson;
  });
}

/**
 * Annotate flat video list (dashboard) with path metadata for a student.
 */
async function annotateVideosWithPath(videos, studentId) {
  if (!videos?.length) return videos;
  const byBatch = {};
  videos.forEach((v) => {
    const bid = String(v.batchId || '');
    if (!bid) return;
    if (!byBatch[bid]) byBatch[bid] = [];
    byBatch[bid].push(v);
  });

  const watched = await getWatchedVideoIds(studentId);
  const out = [];

  for (const bid of Object.keys(byBatch)) {
    const group = sortLessons(byBatch[bid]);
    let previousComplete = true;
    for (let i = 0; i < group.length; i++) {
      const v = group[i];
      const id = String(v.id || v._id);
      const watchedOk = watched.has(id);
      const unlockRule = v.unlockRule === 'afterPrevious' ? 'afterPrevious' : 'open';
      const locked = unlockRule === 'afterPrevious' && i > 0 && !previousComplete;
      out.push({
        ...v,
        id,
        order: Number(v.order) || i + 1,
        unlockRule,
        locked,
        watchComplete: watchedOk,
        lessonPath: true
      });
      previousComplete = watchedOk;
    }
  }

  // Videos without batchId
  videos.filter((v) => !v.batchId).forEach((v) => out.push(v));

  // Prefer path order within batch; overall keep batch groups then order
  return out.sort((a, b) => {
    const ba = String(a.batchId || '');
    const bb = String(b.batchId || '');
    if (ba !== bb) return ba.localeCompare(bb);
    return (Number(a.order) || 0) - (Number(b.order) || 0);
  });
}

module.exports = {
  WATCH_COMPLETE_THRESHOLD,
  nextOrderForBatch,
  sortLessons,
  getWatchedVideoIds,
  buildLessonPath,
  annotateVideosWithPath
};
