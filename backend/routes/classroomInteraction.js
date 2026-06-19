const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { StudentQuestion, StudentNote, StudentBookmark } = require('../models/ClassroomInteraction');
const User = require('../models/User');

// --- PRIVATE Q&A THREADS ---

// @route   GET /api/classroom-interaction/qa/:classroomId
// @desc    Get Q&A threads for a specific classroom video
// @access  Private
router.get('/qa/:classroomId', auth, async (req, res) => {
  try {
    const { classroomId } = req.params;
    let query = { classroomId };

    if (req.user.role === 'student') {
      query.studentId = req.user.id;
    }

    const threads = await StudentQuestion.find(query)
      .populate('studentId', 'name email')
      .populate('teacherId', 'name email')
      .sort({ updatedAt: -1 });

    res.json(threads);
  } catch (err) {
    res.status(500).json({ message: 'Error retrieving Q&A threads' });
  }
});

// @route   POST /api/classroom-interaction/qa
// @desc    Post a query or message inside a private QA thread
// @access  Private
router.post('/qa', auth, async (req, res) => {
  try {
    const { classroomId, text, threadId } = req.body;

    if (!text || !classroomId) {
      return res.status(400).json({ message: 'Message text and classroomId are required' });
    }

    const sender = await User.findById(req.user.id);
    const newMessage = {
      senderId: req.user.id,
      senderName: sender.name,
      role: req.user.role,
      text,
      timestamp: Date.now()
    };

    let thread;
    if (threadId) {
      thread = await StudentQuestion.findById(threadId);
      if (!thread) return res.status(404).json({ message: 'Thread not found' });
      
      thread.messages.push(newMessage);
      thread.updatedAt = Date.now();
      await thread.save();
    } else {
      // Create new QA Thread
      thread = new StudentQuestion({
        studentId: req.user.role === 'student' ? req.user.id : req.body.studentId,
        classroomId,
        messages: [newMessage],
        updatedAt: Date.now()
      });
      await thread.save();
    }

    res.status(201).json(thread);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error saving message' });
  }
});

// @route   PUT /api/classroom-interaction/qa/:id/resolve
// @desc    Mark Q&A thread as resolved
// @access  Private (Teacher & Admin)
router.put('/qa/:id/resolve', auth, async (req, res) => {
  try {
    const thread = await StudentQuestion.findByIdAndUpdate(
      req.params.id,
      { status: 'resolved', updatedAt: Date.now() },
      { new: true }
    );
    res.json(thread);
  } catch (err) {
    res.status(500).json({ message: 'Error resolving thread' });
  }
});


// --- PRIVATE STUDENT NOTES ---

// @route   GET /api/classroom-interaction/notes/:classroomId
// @desc    Get student's private notes for a classroom video
// @access  Private (Student)
router.get('/notes/:classroomId', auth, async (req, res) => {
  try {
    const notes = await StudentNote.find({
      studentId: req.user.id,
      classroomId: req.params.classroomId
    }).sort({ videoTimestamp: 1 });
    res.json(notes);
  } catch (err) {
    res.status(500).json({ message: 'Error retrieving notes' });
  }
});

// @route   POST /api/classroom-interaction/notes
// @desc    Create/Save a timestamped note
// @access  Private (Student)
router.post('/notes', auth, async (req, res) => {
  try {
    const { classroomId, noteText, videoTimestamp } = req.body;

    if (!noteText || !classroomId) {
      return res.status(400).json({ message: 'Note text and classroomId are required' });
    }

    const note = new StudentNote({
      studentId: req.user.id,
      classroomId,
      noteText,
      videoTimestamp: Number(videoTimestamp || 0),
      updatedAt: Date.now()
    });

    await note.save();
    res.status(201).json(note);
  } catch (err) {
    res.status(500).json({ message: 'Error saving note' });
  }
});

// @route   DELETE /api/classroom-interaction/notes/:id
// @desc    Delete a student note
// @access  Private (Student)
router.delete('/notes/:id', auth, async (req, res) => {
  try {
    const note = await StudentNote.findOneAndDelete({
      _id: req.params.id,
      studentId: req.user.id
    });
    if (!note) return res.status(404).json({ message: 'Note not found' });
    res.json({ message: 'Note deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting note' });
  }
});


// --- BOOKMARKS & REVISION QUEUE ---

// @route   GET /api/classroom-interaction/bookmarks
// @desc    Get student's bookmarks
// @access  Private (Student)
router.get('/bookmarks', auth, async (req, res) => {
  try {
    const bookmarks = await StudentBookmark.find({ studentId: req.user.id })
      .populate('classroomId', 'title instructor course')
      .sort({ createdAt: -1 });
    res.json(bookmarks);
  } catch (err) {
    res.status(500).json({ message: 'Error retrieving bookmarks' });
  }
});

// @route   POST /api/classroom-interaction/bookmarks
// @desc    Bookmark a lecture / topic
// @access  Private (Student)
router.post('/bookmarks', auth, async (req, res) => {
  try {
    const { classroomId, topicName, notes } = req.body;

    if (!classroomId) {
      return res.status(400).json({ message: 'classroomId is required' });
    }

    // Check if already bookmarked
    const existing = await StudentBookmark.findOne({ studentId: req.user.id, classroomId });
    if (existing) {
      return res.status(400).json({ message: 'Lecture already bookmarked' });
    }

    const bookmark = new StudentBookmark({
      studentId: req.user.id,
      classroomId,
      topicName,
      notes
    });

    await bookmark.save();
    res.status(201).json(bookmark);
  } catch (err) {
    res.status(500).json({ message: 'Error saving bookmark' });
  }
});

// @route   DELETE /api/classroom-interaction/bookmarks/:id
// @desc    Remove a bookmark
// @access  Private (Student)
router.delete('/bookmarks/:id', auth, async (req, res) => {
  try {
    const bookmark = await StudentBookmark.findOneAndDelete({
      _id: req.params.id,
      studentId: req.user.id
    });
    if (!bookmark) return res.status(404).json({ message: 'Bookmark not found' });
    res.json({ message: 'Bookmark removed successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error removing bookmark' });
  }
});

module.exports = router;
