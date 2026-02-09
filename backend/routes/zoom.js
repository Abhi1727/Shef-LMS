const express = require('express');
const router = express.Router();
const zoomService = require('../services/zoomService');
const auth = require('../middleware/auth');

// All Zoom-based features are temporarily disabled while Firebase/Zoom
// integrations are removed. Keep routes but return a clear message.

// @route   POST /api/zoom/meetings
// @desc    Create a new Zoom meeting
// @access  Private (Admin only)
router.post('/meetings', auth, async (req, res) => {
  return res.status(503).json({
    success: false,
    message: 'Zoom meeting creation is temporarily disabled while Zoom/Firebase integration is removed.'
  });
});

// @route   GET /api/zoom/meetings
// @desc    Get all Zoom meetings
// @access  Private
router.get('/meetings', auth, async (req, res) => {
  return res.status(503).json({
    success: false,
    message: 'Zoom meetings listing is temporarily disabled while Zoom/Firebase integration is removed.'
  });
});

// @route   GET /api/zoom/meetings/:id
// @desc    Get meeting details
// @access  Private
router.get('/meetings/:id', auth, async (req, res) => {
  return res.status(503).json({
    success: false,
    message: 'Zoom meeting details are temporarily disabled while Zoom/Firebase integration is removed.'
  });
});

// @route   PUT /api/zoom/meetings/:id
// @desc    Update a meeting
// @access  Private (Admin only)
router.put('/meetings/:id', auth, async (req, res) => {
  return res.status(503).json({
    success: false,
    message: 'Zoom meeting update is temporarily disabled while Zoom/Firebase integration is removed.'
  });
});

// @route   DELETE /api/zoom/meetings/:id
// @desc    Delete a meeting
// @access  Private (Admin only)
router.delete('/meetings/:id', auth, async (req, res) => {
  return res.status(503).json({
    success: false,
    message: 'Zoom meeting deletion is temporarily disabled while Zoom/Firebase integration is removed.'
  });
});

// @route   GET /api/zoom/join/:id
// @desc    Get join URL for a meeting (students: must be enrolled; teachers: must own; admin: any)
// @access  Private
router.get('/join/:id', auth, async (req, res) => {
  return res.status(503).json({
    success: false,
    message: 'Zoom join URLs are temporarily disabled while Zoom/Firebase integration is removed.'
  });
});

// @route   GET /api/zoom/recordings/:meetingId
// @desc    Get cloud recordings for a meeting
// @access  Private
router.get('/recordings/:meetingId', auth, async (req, res) => {
  try {
    const result = await zoomService.getRecordings(req.params.meetingId);

    res.json(result);
  } catch (error) {
    console.error('Error fetching recordings:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to fetch recordings' 
    });
  }
});

// @route   GET /api/zoom/recordings
// @desc    Get all cloud recordings (last 30 days by default)
// @access  Private (Admin/Teacher)
router.get('/recordings', auth, async (req, res) => {
  try {
    const { from, to } = req.query;
    const result = await zoomService.listAllRecordings(from, to);

    res.json(result);
  } catch (error) {
    console.error('Error fetching all recordings:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to fetch recordings' 
    });
  }
});

// COMMENTED OUT - This was adding unwanted Zoom recordings to classroom
/*router.post('/sync-recordings', auth, async (req, res) => {
  try {
    // Get all recordings from last 30 days
    const result = await zoomService.listAllRecordings();
    
    if (!result.success || !result.meetings || result.meetings.length === 0) {
      return res.json({
        success: true,
        message: 'No recordings found to sync',
        synced: 0
      });
    }
    
    let syncedCount = 0;
    
    // Process each meeting with recordings
    for (const meeting of result.meetings) {
      if (!meeting.recordingFiles || meeting.recordingFiles.length === 0) {
        continue;
      }
      
      // Find MP4 video recordings (skip audio, transcript, chat files)
      const videoRecordings = meeting.recordingFiles.filter(
        file => file.fileType === 'MP4' && file.recordingType !== 'audio_only'
      );
      
      if (videoRecordings.length === 0) {
        continue;
      }
      
      // Check if this meeting is in our liveClasses collection
      const liveClassSnapshot = await db.collection('liveClasses')
        .where('zoomMeetingId', '==', meeting.id.toString())
        .limit(1)
        .get();
      
      let classTitle = meeting.topic;
      let instructor = 'Instructor';
      
      if (!liveClassSnapshot.empty) {
        const classData = liveClassSnapshot.docs[0].data();
        classTitle = classData.title || meeting.topic;
        instructor = classData.instructor || 'Instructor';
      }
      
      // Add each video recording to classroom collection
      for (const recording of videoRecordings) {
        // Check if recording already exists
        const existingSnapshot = await db.collection('classroom')
          .where('zoomRecordingId', '==', recording.id)
          .limit(1)
          .get();
        
        if (existingSnapshot.empty) {
          // Add new recording to classroom
          const classroomRef = db.collection('classroom').doc();
          await classroomRef.set({
            id: classroomRef.id,
            title: classTitle,
            instructor: instructor,
            duration: `${Math.floor(meeting.duration / 60)} min`,
            date: meeting.startTime,
            videoUrl: recording.playUrl, // Zoom video URL
            zoomRecordingId: recording.id,
            zoomMeetingId: meeting.id.toString(),
            fileSize: recording.fileSize,
            recordingStart: recording.recordingStart,
            recordingEnd: recording.recordingEnd,
            downloadUrl: recording.downloadUrl,
            source: 'zoom',
            createdAt: new Date().toISOString()
          });
          
          syncedCount++;
        }
      }
    }
    
    res.json({
      success: true,
      message: `Successfully synced ${syncedCount} recording(s)`,
      synced: syncedCount,
      totalMeetingsChecked: result.meetings.length
    });
  } catch (error) {
    console.error('Error syncing recordings:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to sync recordings' 
    });
  }
});*/

module.exports = router;
