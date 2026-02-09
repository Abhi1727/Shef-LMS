const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

// Jitsi-based live class features are temporarily disabled while
// Firebase/Jitsi integrations are removed.

// Create a new Jitsi room for live class
router.post('/rooms', auth, async (req, res) => {
  return res.status(503).json({
    success: false,
    message: 'Jitsi live-class rooms are temporarily disabled while Firebase/Jitsi integration is removed.'
  });
});

// Get room details
router.get('/rooms/:roomId', auth, async (req, res) => {
  return res.status(503).json({
    success: false,
    message: 'Jitsi room details are temporarily disabled while Firebase/Jitsi integration is removed.'
  });
});

// Get active rooms for a batch
router.get('/batches/:batchId/rooms', auth, async (req, res) => {
  return res.status(503).json({
    success: false,
    message: 'Jitsi batch rooms are temporarily disabled while Firebase/Jitsi integration is removed.'
  });
});

// Join a room (generate join URL with participant name)
router.post('/rooms/:roomId/join', auth, async (req, res) => {
  return res.status(503).json({
    success: false,
    message: 'Jitsi join URLs are temporarily disabled while Firebase/Jitsi integration is removed.'
  });
});

// Update room status
router.patch('/rooms/:roomId/status', auth, async (req, res) => {
  return res.status(503).json({
    success: false,
    message: 'Jitsi room status updates are temporarily disabled while Firebase/Jitsi integration is removed.'
  });
});

// End a room
router.post('/rooms/:roomId/end', auth, async (req, res) => {
  return res.status(503).json({
    success: false,
    message: 'Jitsi room end is temporarily disabled while Firebase/Jitsi integration is removed.'
  });
});

// Delete a room
router.delete('/rooms/:roomId', auth, async (req, res) => {
  return res.status(503).json({
    success: false,
    message: 'Jitsi room deletion is temporarily disabled while Firebase/Jitsi integration is removed.'
  });
});

// List all rooms (admin only)
router.get('/rooms', auth, async (req, res) => {
  return res.status(503).json({
    success: false,
    message: 'Jitsi room listing is temporarily disabled while Firebase/Jitsi integration is removed.'
  });
});

module.exports = router;
