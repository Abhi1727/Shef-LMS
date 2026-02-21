/**
 * User activity logging endpoints.
 * Students/teachers call these to record video views, etc.
 */
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Classroom = require('../models/Classroom');
const { logActivity } = require('../utils/activityLogger');

router.use(auth);

// @route   POST /api/activity/video-view
// @desc    Log when a user views a classroom video (YouTube, Zoom, Drive)
// @access  Private
router.post('/video-view', async (req, res) => {
  try {
    const { videoId } = req.body;
    const user = req.user;

    if (!videoId || !String(videoId).trim()) {
      return res.status(400).json({ message: 'videoId is required' });
    }

    const video = await Classroom.findById(videoId).select('title').lean().exec();
    const videoTitle = video ? video.title : null;

    await logActivity({
      action: 'video_view',
      userId: user.id,
      userName: user.name || '',
      userEmail: user.email || '',
      userRole: user.role || 'student',
      videoId: String(videoId),
      videoTitle
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Error logging video view:', err);
    res.status(500).json({ message: 'Failed to log activity' });
  }
});

// @route   POST /api/activity/assessment-submit
// @desc    Log when a user submits an assessment (for future use)
// @access  Private
router.post('/assessment-submit', async (req, res) => {
  try {
    const { assessmentId, assessmentTitle, score } = req.body;
    const user = req.user;

    if (!assessmentId || !String(assessmentId).trim()) {
      return res.status(400).json({ message: 'assessmentId is required' });
    }

    await logActivity({
      action: 'assessment_submit',
      userId: user.id,
      userName: user.name || '',
      userEmail: user.email || '',
      userRole: user.role || 'student',
      assessmentId: String(assessmentId),
      assessmentTitle: assessmentTitle || null,
      score: score != null ? Number(score) : null
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Error logging assessment submit:', err);
    res.status(500).json({ message: 'Failed to log activity' });
  }
});

module.exports = router;
