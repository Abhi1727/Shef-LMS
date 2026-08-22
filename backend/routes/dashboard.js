const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Classroom = require('../models/Classroom');
const Batch = require('../models/Batch');
const logger = require('../utils/logger');
const lessonPath = require('../services/lessonPath');
const {
  resolveStudentBatchIds,
  activeEnrollments
} = require('../utils/studentEnrollment');

// Apply auth middleware to all dashboard routes
router.use(auth);

function sortVideosNewestFirst(videos) {
  return videos.sort(
    (a, b) => new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0)
  );
}

// @route   GET /api/dashboard/classroom
// @desc    Get classroom videos for all enrolled programs/batches
router.get('/classroom', async (req, res) => {
  try {
    const tokenUser = req.user;

    if (tokenUser.role === 'admin') {
      const classroomDocs = await Classroom.find({})
        .sort({ date: -1 })
        .limit(500)
        .lean()
        .exec();
      const allVideos = classroomDocs.map((doc) => ({ id: String(doc._id), ...doc }));
      return res.json(sortVideosNewestFirst(allVideos));
    }

    if (tokenUser.role === 'teacher' || tokenUser.role === 'instructor' || tokenUser.role === 'mentor') {
      const teacherId = String(tokenUser.id);
      const teacherBatches = await Batch.find({ teacherId }).select('_id course').lean().exec();
      const teacherBatchIds = teacherBatches.map((b) => String(b._id));

      let classroomDocs = [];
      if (teacherBatchIds.length) {
        classroomDocs = await Classroom.find({ batchId: { $in: teacherBatchIds } }).lean().exec();
      } else {
        let userCourse = tokenUser.currentCourse || tokenUser.course || '';
        try {
          const mongoUser = await User.findById(tokenUser.id).select('course assignedCourses').lean().exec();
          if (mongoUser?.course) userCourse = mongoUser.course;
        } catch (_) {
          /* keep token */
        }
        if (userCourse) {
          const courseBatches = await Batch.find({ course: userCourse }).select('_id').lean().exec();
          const batchIds = courseBatches.map((b) => String(b._id));
          if (batchIds.length) {
            classroomDocs = await Classroom.find({ batchId: { $in: batchIds } }).lean().exec();
          }
        }
      }

      return res.json(
        sortVideosNewestFirst(
          classroomDocs.map((doc) => ({ id: String(doc._id), ...doc }))
        )
      );
    }

    // Students — union classrooms across all enrolled batches/programs
    if (tokenUser.role !== 'student') {
      return res.json([]);
    }

    const batchIds = await resolveStudentBatchIds(tokenUser.id);
    if (!batchIds.length) {
      return res.json([]);
    }

    const batchDocs = await Batch.find({ _id: { $in: batchIds } })
      .select('name course programLabel')
      .lean()
      .exec();
    const batchMap = new Map(batchDocs.map((b) => [String(b._id), b]));

    const pathsByBatch = await lessonPath.buildLessonPathsForBatches({
      batchIds,
      studentId: tokenUser.id
    });

    const merged = [];
    for (const batchId of batchIds) {
      const path = pathsByBatch.get(String(batchId)) || [];
      const batch = batchMap.get(String(batchId)) || {};
      path.forEach((lesson) => {
        merged.push({
          ...lesson,
          batchId: String(batchId),
          batchName: batch.name || '',
          program: batch.course || batch.programLabel || lesson.course || '',
          notesFilePath: lesson.notesAvailable ? true : undefined
        });
      });
    }

    return res.json(merged);
  } catch (error) {
    logger.error('Error fetching classroom videos', { error: error.message });
    res.status(500).json({ message: 'Error fetching classroom videos' });
  }
});

// @route   GET /api/dashboard/stats
// @desc    Honest dashboard stats for the current student
router.get('/stats', async (req, res) => {
  try {
    const ActivityLog = require('../models/ActivityLog');
    const Certificate = require('../models/Certificate');
    const userId = req.user?.id;
    const batchIds = userId ? await resolveStudentBatchIds(userId) : [];
    const classroomForStats = batchIds.length
      ? await Classroom.find({ batchId: { $in: batchIds } })
          .select('videoSource driveId youtubeVideoId youtubeEmbedUrl youtubeVideoUrl')
          .lean()
          .exec()
      : [];
    const totalVideos = classroomForStats.filter((d) => !lessonPath.isUnplayableLiveStub(d)).length;
    const watchedIds =
      batchIds.length && userId
        ? await ActivityLog.distinct('videoId', {
            userId: String(userId),
            action: 'video_view',
            videoId: { $exists: true, $ne: null }
          })
        : [];

    const certificatesEarned = userId
      ? await Certificate.countDocuments({ studentId: String(userId) })
      : 0;

    const programCount = batchIds.length;

    res.json({
      enrolledCourses: programCount,
      completedCourses: 0,
      inProgressCourses: programCount,
      totalLearningHours: null,
      certificatesEarned,
      upcomingClasses: 0,
      totalVideos,
      watchedVideos: Math.min(watchedIds.length, totalVideos || watchedIds.length),
      hasBatch: programCount > 0,
      enrolledBatchIds: batchIds
    });
  } catch (err) {
    logger.error('Dashboard stats error', { error: err.message });
    res.status(500).send('Server error');
  }
});

// @route   GET /api/dashboard/activity
// @desc    Recent activity for the current student (no fake feed)
router.get('/activity', async (req, res) => {
  try {
    const ActivityLog = require('../models/ActivityLog');
    const userId = req.user?.id;
    if (!userId) {
      return res.json([]);
    }

    const logs = await ActivityLog.find({ userId: String(userId) })
      .sort({ timestamp: -1 })
      .limit(20)
      .lean()
      .exec();

    const activities = logs.map((log) => ({
      id: String(log._id),
      type: log.action,
      title: log.videoTitle || log.action,
      course: log.course || '',
      time: log.timestamp ? new Date(log.timestamp).toISOString() : null,
      icon: log.action === 'video_view' ? '🎥' : '•'
    }));

    res.json(activities);
  } catch (err) {
    logger.error('Dashboard activity error', { error: err.message });
    res.status(500).send('Server error');
  }
});

// @route   GET /api/dashboard/enrollments
// @desc    List current student's program enrollments (batch + SKY ID per program)
router.get('/enrollments', async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.json({ enrollments: [] });
    }
    const user = await User.findById(req.user.id)
      .select('batchId course enrollmentNumber enrollments oneToOneBatchId')
      .lean()
      .exec();
    if (!user) return res.status(404).json({ message: 'Student not found' });

    const list = activeEnrollments(user);
    const batchIds = list.map((e) => e.batchId);
    const batches = batchIds.length
      ? await Batch.find({ _id: { $in: batchIds } }).select('name course programLabel').lean().exec()
      : [];
    const batchMap = new Map(batches.map((b) => [String(b._id), b]));

    res.json({
      success: true,
      enrollments: list.map((e) => {
        const b = batchMap.get(e.batchId) || {};
        return {
          batchId: e.batchId,
          batchName: b.name || '',
          course: e.course || b.course || b.programLabel || '',
          enrollmentNumber: e.enrollmentNumber || '',
          enrolledAt: e.enrolledAt || null,
          status: e.status || 'active'
        };
      })
    });
  } catch (err) {
    logger.error('Dashboard enrollments error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
