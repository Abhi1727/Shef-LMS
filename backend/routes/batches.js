const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { isAdmin } = require('../middleware/roleAuth');
const Batch = require('../models/Batch');
const User = require('../models/User');
const Classroom = require('../models/Classroom');

// @route   POST /api/batches
// @desc    Create a new batch
// @access  Admin only
router.post('/', isAdmin, async (req, res) => {
  try {
    const { name, course, startDate, endDate, teacherId, teacherName, schedule } = req.body;

    if (!name || !course || !teacherId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Name, course, and teacher are required' 
      });
    }

    const batch = new Batch({
      name,
      course,
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: endDate ? new Date(endDate) : null,
      teacherId,
      teacherName,
      students: [],
      schedule: schedule || { days: [], time: '' },
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const savedBatch = await batch.save();

    res.json({
      success: true,
      message: 'Batch created successfully',
      batch: {
        id: String(savedBatch._id),
        ...savedBatch.toObject()
      }
    });
  } catch (error) {
    console.error('Error creating batch:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create batch' 
    });
  }
});

// @route   GET /api/batches
// @desc    Get all batches
// @access  Private
router.get('/', async (req, res) => {
  try {
    const batchesDocs = await Batch.find({}).lean().exec();

    const batches = batchesDocs.map(doc => ({ id: String(doc._id), ...doc }));
    res.json({
      success: true,
      batches
    });
  } catch (error) {
    console.error('Error fetching batches:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch batches' 
    });
  }
});

// @route   PUT /api/batches/:id/students
// @desc    Add students to a batch (ensure single-batch membership)
// @access  Admin only
router.put('/:id/students', isAdmin, async (req, res) => {
  try {
    const batchId = req.params.id;
    const { studentIds } = req.body;

    if (!studentIds || !Array.isArray(studentIds)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Student IDs array is required' 
      });
    }

    const batchDoc = await Batch.findById(batchId).exec();
    
    if (!batchDoc) {
      return res.status(404).json({ 
        success: false, 
        message: 'Batch not found' 
      });
    }

    // Remove these students from any other batches first so
    // that no student ends up in multiple batches.
    // Remove these students from any other batches first so
    // that no student ends up in multiple batches.
    const allBatches = await Batch.find({}).exec();

    // Normalize provided student IDs to string form once for comparisons
    const studentIdStrings = (studentIds || []).map(id => String(id));

    await Promise.all(
      allBatches
        .filter(doc => String(doc._id) !== String(batchId))
        .map(doc => {
          const existingStudents = doc.students || [];
          const existingStudentStrings = existingStudents.map(id => String(id));

          const hasOverlap = existingStudentStrings.some(id => studentIdStrings.includes(id));
          if (!hasOverlap) return Promise.resolve();

          doc.students = existingStudents.filter(id => !studentIdStrings.includes(String(id)));
          doc.updatedAt = new Date();
          return doc.save();
        })
    );

    // Now add students to the target batch (avoid duplicates)
    const currentStudents = batchDoc.students || [];
    const currentStudentStrings = currentStudents.map(id => String(id));
    const mergedStudentStrings = Array.from(new Set([...currentStudentStrings, ...studentIdStrings]));

    batchDoc.students = mergedStudentStrings.map(id => new mongoose.Types.ObjectId(id));
    batchDoc.updatedAt = new Date();
    await batchDoc.save();

    // Update students with their new batchId and align course in Mongo
    const batchCourse = batchDoc.course || null;
    await Promise.all(
      studentIds.map(async (studentId) => {
        const user = await User.findOne({
          $or: [
            { _id: studentId },
            { firestoreId: studentId }
          ]
        }).exec();

        if (!user) return;

        user.batchId = String(batchDoc._id);
        if (batchCourse) {
          user.course = batchCourse;
        }
        user.updatedAt = new Date();
        await user.save();
      })
    );

    res.json({
      success: true,
      message: 'Students added to batch successfully'
    });
  } catch (error) {
    console.error('Error adding students to batch:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to add students to batch' 
    });
  }
});

// @route   DELETE /api/batches/:batchId/students/:studentId
// @desc    Remove a student from a batch (does NOT delete the student account)
// @access  Admin only
router.delete('/:batchId/students/:studentId', isAdmin, async (req, res) => {
  try {
    const { batchId, studentId } = req.params;

    const batchDoc = await Batch.findById(batchId).exec();

    if (!batchDoc) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found'
      });
    }

    const currentStudents = batchDoc.students || [];
    batchDoc.students = currentStudents.filter(id => String(id) !== String(studentId));
    batchDoc.updatedAt = new Date();
    await batchDoc.save();

    // Clear batch assignment on the student document in Mongo, if it still exists
    const user = await User.findOne({
      $or: [
        { _id: studentId },
        { firestoreId: studentId }
      ]
    }).exec();

    if (user) {
      user.batchId = null;
      user.updatedAt = new Date();
      await user.save();
    }

    res.json({
      success: true,
      message: 'Student removed from batch successfully'
    });
  } catch (error) {
    console.error('Error removing student from batch:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove student from batch'
    });
  }
});

// @route   DELETE /api/batches/:batchId/videos/:videoId
// @desc    Remove a video from a batch (does NOT delete the video from database)
// @access  Admin only
router.delete('/:batchId/videos/:videoId', isAdmin, async (req, res) => {
  try {
    const { batchId, videoId } = req.params;
    // Ensure the batch exists in MongoDB
    const batchDoc = await Batch.findById(batchId).lean().exec();

    if (!batchDoc) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found'
      });
    }

    // Find the classroom video document
    const videoDoc = await Classroom.findById(videoId).exec();

    if (!videoDoc) {
      return res.status(404).json({
        success: false,
        message: 'Video not found'
      });
    }

    // Clear the batchId for this video (disassociate from batch)
    videoDoc.batchId = null;
    await videoDoc.save();

    res.json({
      success: true,
      message: 'Video removed from batch successfully'
    });
  } catch (error) {
    console.error('Error removing video from batch:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove video from batch'
    });
  }
});

module.exports = router;
