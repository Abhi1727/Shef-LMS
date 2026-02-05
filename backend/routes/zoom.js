const express = require('express');
const router = express.Router();
const zoomService = require('../services/zoomService');
const auth = require('../middleware/auth');
const { db } = require('../config/firebase');

// @route   POST /api/zoom/meetings
// @desc    Create a new Zoom meeting
// @access  Private (Admin only)
router.post('/meetings', auth, async (req, res) => {
  try {
    const { topic, startTime, duration, agenda, courseId, timezone } = req.body;

    // Validate required fields
    if (!topic || !startTime) {
      return res.status(400).json({ 
        success: false, 
        message: 'Topic and start time are required' 
      });
    }

    // Create Zoom meeting
    const result = await zoomService.createMeeting({
      topic,
      startTime,
      duration,
      agenda,
      timezone
    });

    if (result.success) {
      // Store meeting in Firestore
      const meetingRef = db.collection('liveClasses').doc();
      await meetingRef.set({
        id: meetingRef.id,
        zoomMeetingId: result.meeting.id,
        title: topic,
        instructor: req.user.name || 'Instructor',
        date: startTime,
        time: new Date(startTime).toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit' 
        }),
        duration: `${duration || 60} min`,
        students: 0,
        joinUrl: result.meeting.joinUrl,
        startUrl: result.meeting.startUrl,
        password: result.meeting.password,
        courseId: courseId || null,
        status: 'scheduled',
        createdBy: req.user.email,
        createdAt: new Date().toISOString()
      });

      res.json({
        success: true,
        message: 'Meeting created successfully',
        meeting: result.meeting,
        firestoreId: meetingRef.id
      });
    }
  } catch (error) {
    console.error('Error creating meeting:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to create meeting' 
    });
  }
});

// @route   GET /api/zoom/meetings
// @desc    Get all Zoom meetings
// @access  Private
router.get('/meetings', auth, async (req, res) => {
  try {
    // Get meetings from Firestore
    const snapshot = await db.collection('liveClasses')
      .orderBy('date', 'desc')
      .get();

    const meetings = [];
    snapshot.forEach(doc => {
      meetings.push({
        id: doc.id,
        ...doc.data()
      });
    });

    res.json({
      success: true,
      meetings
    });
  } catch (error) {
    console.error('Error fetching meetings:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch meetings' 
    });
  }
});

// @route   GET /api/zoom/meetings/:id
// @desc    Get meeting details
// @access  Private
router.get('/meetings/:id', auth, async (req, res) => {
  try {
    const doc = await db.collection('liveClasses').doc(req.params.id).get();

    if (!doc.exists) {
      return res.status(404).json({ 
        success: false, 
        message: 'Meeting not found' 
      });
    }

    const meeting = { id: doc.id, ...doc.data() };

    // Get latest info from Zoom if zoomMeetingId exists
    if (meeting.zoomMeetingId) {
      try {
        const zoomData = await zoomService.getMeeting(meeting.zoomMeetingId);
        if (zoomData.success) {
          meeting.zoomStatus = zoomData.meeting.status;
        }
      } catch (error) {
        console.log('Could not fetch live Zoom data:', error.message);
      }
    }

    res.json({
      success: true,
      meeting
    });
  } catch (error) {
    console.error('Error fetching meeting:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch meeting details' 
    });
  }
});

// @route   PUT /api/zoom/meetings/:id
// @desc    Update a meeting
// @access  Private (Admin only)
router.put('/meetings/:id', auth, async (req, res) => {
  try {
    const { topic, startTime, duration, agenda } = req.body;
    
    const doc = await db.collection('liveClasses').doc(req.params.id).get();

    if (!doc.exists) {
      return res.status(404).json({ 
        success: false, 
        message: 'Meeting not found' 
      });
    }

    const meeting = doc.data();

    // Update Zoom meeting if it has a zoomMeetingId
    if (meeting.zoomMeetingId) {
      const updateData = {};
      if (topic) updateData.topic = topic;
      if (startTime) updateData.start_time = startTime;
      if (duration) updateData.duration = duration;
      if (agenda) updateData.agenda = agenda;

      await zoomService.updateMeeting(meeting.zoomMeetingId, updateData);
    }

    // Update Firestore
    const firestoreUpdate = {};
    if (topic) firestoreUpdate.title = topic;
    if (startTime) {
      firestoreUpdate.date = startTime;
      firestoreUpdate.time = new Date(startTime).toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    }
    if (duration) firestoreUpdate.duration = `${duration} min`;
    firestoreUpdate.updatedAt = new Date().toISOString();

    await db.collection('liveClasses').doc(req.params.id).update(firestoreUpdate);

    res.json({
      success: true,
      message: 'Meeting updated successfully'
    });
  } catch (error) {
    console.error('Error updating meeting:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to update meeting' 
    });
  }
});

// @route   DELETE /api/zoom/meetings/:id
// @desc    Delete a meeting
// @access  Private (Admin only)
router.delete('/meetings/:id', auth, async (req, res) => {
  try {
    const doc = await db.collection('liveClasses').doc(req.params.id).get();

    if (!doc.exists) {
      return res.status(404).json({ 
        success: false, 
        message: 'Meeting not found' 
      });
    }

    const meeting = doc.data();

    // Delete from Zoom if it has a zoomMeetingId
    if (meeting.zoomMeetingId) {
      try {
        await zoomService.deleteMeeting(meeting.zoomMeetingId);
      } catch (error) {
        console.log('Could not delete from Zoom:', error.message);
        // Continue with Firestore deletion even if Zoom deletion fails
      }
    }

    // Delete from Firestore
    await db.collection('liveClasses').doc(req.params.id).delete();

    res.json({
      success: true,
      message: 'Meeting deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting meeting:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete meeting' 
    });
  }
});

// @route   GET /api/zoom/join/:id
// @desc    Get join URL for a meeting (students: must be enrolled; teachers: must own; admin: any)
// @access  Private
router.get('/join/:id', auth, async (req, res) => {
  try {
    const doc = await db.collection('liveClasses').doc(req.params.id).get();

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      });
    }

    const meeting = doc.data();
    const user = req.user;

    // Admin can join any meeting
    if (user.role === 'admin') {
      return res.json({
        success: true,
        joinUrl: meeting.joinUrl,
        password: meeting.password,
        title: meeting.title
      });
    }

    // Teacher can join if they own the class
    if (user.role === 'teacher') {
      if (meeting.teacherId === user.id) {
        return res.json({
          success: true,
          joinUrl: meeting.joinUrl,
          password: meeting.password,
          title: meeting.title
        });
      }
      return res.status(403).json({
        success: false,
        message: 'You can only join classes you teach'
      });
    }

    // Student: must be in enrolledStudents or in the batch
    if (user.role === 'student') {
      const enrolled = meeting.enrolledStudents && meeting.enrolledStudents.includes(user.id);
      const inBatch = meeting.batchId && user.batchId === meeting.batchId;
      // Legacy: meetings without enrolledStudents/batchId (e.g. admin-created) allow any student
      const legacyMeeting = !meeting.enrolledStudents && !meeting.batchId;
      if (enrolled || inBatch || legacyMeeting) {
        await db.collection('liveClasses').doc(req.params.id).update({
          students: (meeting.students || 0) + 1
        });
        return res.json({
          success: true,
          joinUrl: meeting.joinUrl,
          password: meeting.password,
          title: meeting.title
        });
      }
      return res.status(403).json({
        success: false,
        message: 'You are not enrolled in this class'
      });
    }

    res.status(403).json({ success: false, message: 'Access denied' });
  } catch (error) {
    console.error('Error getting join URL:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get join URL'
    });
  }
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
