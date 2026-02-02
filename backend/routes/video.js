const express = require('express');
const router = express.Router();
const videoService = require('../services/videoService');
const auth = require('../middleware/auth');

// @route   GET /api/video/:id/enhanced
// @desc    Get enhanced video URL for better playback
// @access  Private
router.get('/:id/enhanced', auth, async (req, res) => {
  try {
    const enhancedVideo = await videoService.getEnhancedVideoUrl(req.params.id);
    
    res.json({
      success: true,
      video: enhancedVideo
    });
  } catch (error) {
    console.error('Error getting enhanced video:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get enhanced video URL'
    });
  }
});

// @route   GET /api/video/:id/download
// @desc    Get download URL for video (if available)
// @access  Private
router.get('/:id/download', auth, async (req, res) => {
  try {
    const downloadInfo = await videoService.getZoomDownloadUrl(req.params.id);
    
    res.json({
      success: true,
      downloadInfo
    });
  } catch (error) {
    console.error('Error getting download URL:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Download URL not available'
    });
  }
});

// @route   GET /api/video/:id/thumbnail
// @desc    Get video thumbnail
// @access  Private
router.get('/:id/thumbnail', auth, async (req, res) => {
  try {
    const thumbnail = await videoService.getVideoThumbnail(req.params.id);
    
    if (thumbnail) {
      res.json({
        success: true,
        thumbnail
      });
    } else {
      res.json({
        success: true,
        thumbnail: null
      });
    }
  } catch (error) {
    console.error('Error getting thumbnail:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get thumbnail'
    });
  }
});

// @route   POST /api/video/:id/progress
// @desc    Track video viewing progress
// @access  Private
router.post('/:id/progress', auth, async (req, res) => {
  try {
    const { currentTime, duration, percentageWatched, completed } = req.body;
    
    const result = await videoService.trackVideoProgress(
      req.user.id,
      req.params.id,
      {
        currentTime,
        duration,
        percentageWatched,
        completed
      }
    );
    
    res.json(result);
  } catch (error) {
    console.error('Error tracking progress:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to track progress'
    });
  }
});

// @route   GET /api/video/:id/progress
// @desc    Get video viewing progress
// @access  Private
router.get('/:id/progress', auth, async (req, res) => {
  try {
    const progress = await videoService.getVideoProgress(
      req.user.id,
      req.params.id
    );
    
    res.json({
      success: true,
      progress
    });
  } catch (error) {
    console.error('Error getting progress:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get progress'
    });
  }
});

module.exports = router;
