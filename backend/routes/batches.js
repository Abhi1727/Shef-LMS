const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const { isAdmin } = require('../middleware/roleAuth');

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

    const batchData = {
      name,
      course,
      startDate: startDate || new Date().toISOString().split('T')[0],
      endDate,
      teacherId,
      teacherName,
      students: [],
      schedule: schedule || { days: [], time: '' },
      status: 'active',
      createdAt: new Date().toISOString()
    };

    const batchRef = await db.collection('batches').add(batchData);

    res.json({
      success: true,
      message: 'Batch created successfully',
      batch: {
        id: batchRef.id,
        ...batchData
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
    const batchesSnapshot = await db.collection('batches').get();

    const batches = [];
    batchesSnapshot.forEach(doc => {
      batches.push({ id: doc.id, ...doc.data() });
    });

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

    const batchDoc = await db.collection('batches').doc(batchId).get();
    
    if (!batchDoc.exists) {
      return res.status(404).json({ 
        success: false, 
        message: 'Batch not found' 
      });
    }

    const batchData = batchDoc.data();

    // Remove these students from any other batches first so
    // that no student ends up in multiple batches.
    const allBatchesSnapshot = await db.collection('batches').get();
    const removalPromises = [];

    allBatchesSnapshot.forEach(doc => {
      if (doc.id === batchId) return; // Skip current batch

      const data = doc.data();
      const existingStudents = data.students || [];

      const hasOverlap = studentIds.some(id => existingStudents.includes(id));
      if (hasOverlap) {
        const filteredStudents = existingStudents.filter(id => !studentIds.includes(id));
        removalPromises.push(doc.ref.update({ students: filteredStudents }));
      }
    });

    await Promise.all(removalPromises);

    // Now add students to the target batch (avoid duplicates)
    const currentStudents = batchData.students || [];
    const updatedStudents = [...new Set([...currentStudents, ...studentIds])];

    await db.collection('batches').doc(batchId).update({
      students: updatedStudents
    });

    // Update students with their new batchId and align course
    const batchCourse = batchData.course || null;
    const updatePromises = studentIds.map(studentId => {
      const updatePayload = { batchId };
      if (batchCourse) {
        updatePayload.course = batchCourse;
      }
      return db.collection('users').doc(studentId).update(updatePayload);
    });
    await Promise.all(updatePromises);

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

    const batchRef = db.collection('batches').doc(batchId);
    const batchDoc = await batchRef.get();

    if (!batchDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found'
      });
    }

    const batchData = batchDoc.data();
    const currentStudents = batchData.students || [];
    const updatedStudents = currentStudents.filter(id => id !== studentId);

    await batchRef.update({ students: updatedStudents });

    // Clear batch assignment on the student document, if it still exists
    const studentRef = db.collection('users').doc(studentId);
    const studentDoc = await studentRef.get();
    if (studentDoc.exists) {
      await studentRef.update({ batchId: null });
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

    const batchRef = db.collection('batches').doc(batchId);
    const batchDoc = await batchRef.get();

    if (!batchDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found'
      });
    }

    // Remove video from batch by clearing its batchId in the classroom collection
    const videoRef = db.collection('classroom').doc(videoId);
    const videoDoc = await videoRef.get();
    
    if (!videoDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Video not found'
      });
    }

    // Clear the batchId for this video (disassociate from batch)
    await videoRef.update({ batchId: null });

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
