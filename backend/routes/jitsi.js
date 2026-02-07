const express = require('express');
const router = express.Router();
const jitsiService = require('../services/jitsiService');
const auth = require('../middleware/auth');
const admin = require('firebase-admin');

// Create a new Jitsi room for live class
router.post('/rooms', auth, async (req, res) => {
  try {
    const { courseId, batchId, topic, scheduledDate, scheduledTime, duration } = req.body;

    // Validate required fields
    if (!courseId || !batchId || !topic || !scheduledDate || !scheduledTime) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: courseId, batchId, topic, scheduledDate, scheduledTime'
      });
    }

    // Create room
    const result = await jitsiService.createRoom({
      courseId,
      batchId,
      topic,
      scheduledDate,
      scheduledTime,
      duration,
      createdBy: req.userId
    });

    res.json(result);
  } catch (error) {
    console.error('Error creating Jitsi room:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create room'
    });
  }
});

// Get room details
router.get('/rooms/:roomId', auth, async (req, res) => {
  try {
    const { roomId } = req.params;
    const result = await jitsiService.getRoom(roomId);
    res.json(result);
  } catch (error) {
    console.error('Error getting room:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get room'
    });
  }
});

// Get active rooms for a batch
router.get('/batches/:batchId/rooms', auth, async (req, res) => {
  try {
    const { batchId } = req.params;
    const result = await jitsiService.getActiveBatchRooms(batchId);
    res.json(result);
  } catch (error) {
    console.error('Error getting batch rooms:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get batch rooms'
    });
  }
});

// Join a room (generate join URL with participant name)
router.post('/rooms/:roomId/join', auth, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { displayName } = req.body;

    // Get room details
    const roomResult = await jitsiService.getRoom(roomId);
    
    if (!roomResult.success) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    const room = roomResult.room;

    // Get user details
    const userDoc = await admin.firestore().collection('users').doc(req.userId).get();
    const userData = userDoc.data();

    // Add participant
    await jitsiService.addParticipant(room.roomName, {
      userId: req.userId,
      name: displayName || userData?.name || 'Anonymous',
      email: userData?.email,
      joinedAt: new Date().toISOString()
    });

    // Generate join URL with user name
    const isModerator = userData?.role === 'admin' || userData?.role === 'teacher';
    const joinUrl = `${jitsiService.generateJoinUrl(room.roomName, isModerator)}#userInfo.displayName="${displayName || userData?.name}"`;

    res.json({
      success: true,
      joinUrl,
      roomName: room.roomName,
      displayName: displayName || userData?.name
    });
  } catch (error) {
    console.error('Error joining room:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to join room'
    });
  }
});

// Update room status
router.patch('/rooms/:roomId/status', auth, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { status } = req.body;

    if (!['scheduled', 'active', 'ended', 'cancelled'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be: scheduled, active, ended, or cancelled'
      });
    }

    const result = await jitsiService.updateRoomStatus(roomId, status);
    res.json(result);
  } catch (error) {
    console.error('Error updating room status:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update room status'
    });
  }
});

// End a room
router.post('/rooms/:roomId/end', auth, async (req, res) => {
  try {
    const { roomId } = req.params;
    const result = await jitsiService.endRoom(roomId);
    res.json(result);
  } catch (error) {
    console.error('Error ending room:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to end room'
    });
  }
});

// Delete a room
router.delete('/rooms/:roomId', auth, async (req, res) => {
  try {
    const { roomId } = req.params;
    
    // Check if user is admin
    const userDoc = await admin.firestore().collection('users').doc(req.userId).get();
    const userData = userDoc.data();
    
    if (userData?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can delete rooms'
      });
    }

    const result = await jitsiService.deleteRoom(roomId);
    res.json(result);
  } catch (error) {
    console.error('Error deleting room:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete room'
    });
  }
});

// List all rooms (admin only)
router.get('/rooms', auth, async (req, res) => {
  try {
    // Check if user is admin
    const userDoc = await admin.firestore().collection('users').doc(req.userId).get();
    const userData = userDoc.data();
    
    if (userData?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can list all rooms'
      });
    }

    const limit = parseInt(req.query.limit) || 50;
    const result = await jitsiService.listAllRooms(limit);
    res.json(result);
  } catch (error) {
    console.error('Error listing rooms:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to list rooms'
    });
  }
});

module.exports = router;
