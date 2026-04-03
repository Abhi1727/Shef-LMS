const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { isAdmin } = require('../middleware/roleAuth');
const auth = require('../middleware/auth');
const { isTeacherOrAdmin, isBatchOwnerOrAdmin } = require('../middleware/teacherAuth');
const Batch = require('../models/Batch');
const User = require('../models/User');
const Classroom = require('../models/Classroom');

// @route   POST /api/batches
// @desc    Create a new batch
// @access  Admin or Teacher
router.post('/', auth, isTeacherOrAdmin, async (req, res) => {
  try {
    const { name, course, startDate, endDate, teacherId, teacherName, schedule } = req.body;

    if (!name || !course || !teacherId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Name, course, and teacher are required' 
      });
    }

    // If user is a teacher, they can only create batches for themselves
    if (req.user.role === 'teacher' && String(req.user.id) !== String(teacherId)) {
      return res.status(403).json({
        success: false,
        message: 'Teachers can only create batches for themselves'
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

// @route   PUT /api/batches/:batchId/videos/:videoId
// @desc    Assign a video to a batch
// @access  Admin only
router.put('/:batchId/videos/:videoId', isAdmin, async (req, res) => {
  try {
    const { batchId, videoId } = req.params;
    const batchDoc = await Batch.findById(batchId).lean().exec();
    if (!batchDoc) {
      return res.status(404).json({ success: false, message: 'Batch not found' });
    }
    const videoDoc = await Classroom.findById(videoId).exec();
    if (!videoDoc) {
      return res.status(404).json({ success: false, message: 'Video not found' });
    }
    // Prevent duplicate: same YouTube video already in this batch
    const ytId = videoDoc.youtubeVideoId;
    if (ytId) {
      const existing = await Classroom.findOne({
        youtubeVideoId: ytId,
        batchId: batchId,
        _id: { $ne: videoId }
      }).lean().exec();
      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'This video is already assigned to this batch.'
        });
      }
    }
    videoDoc.batchId = batchId;
    videoDoc.course = videoDoc.course || batchDoc.course;
    await videoDoc.save();
    res.json({ success: true, message: 'Video assigned to batch successfully' });
  } catch (error) {
    console.error('Error assigning video to batch:', error);
    res.status(500).json({ success: false, message: 'Failed to assign video to batch' });
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

// @route   GET /api/batches/:id
// @desc    Get batch details by ID
// @access  Private (teacher/admin)
router.get('/:id', auth, async (req, res) => {
  try {
    const batchId = req.params.id;
    console.log('Fetching batch with ID:', batchId);
    console.log('User making request:', req.user);
    
    const batchDoc = await Batch.findById(batchId).lean().exec();
    console.log('Batch found:', !!batchDoc);
    console.log('Batch teacherId:', batchDoc?.teacherId);
    console.log('Request user ID:', req.user?.id);
    console.log('Request user role:', req.user?.role);
    console.log('Ownership check:', req.user?.role === 'admin' || String(batchDoc?.teacherId) === String(req.user?.id));
    
    if (!batchDoc) {
      return res.status(404).json({ 
        success: false, 
        message: 'Batch not found' 
      });
    }

    // Temporarily skip ownership check for debugging
    // if (req.user.role === 'admin' || 
    //     (req.user.role === 'teacher' && String(batchDoc.teacherId) === String(req.user.id))) {
    //   return next();
    // }

    const batch = { id: String(batchDoc._id), ...batchDoc };
    console.log('Returning batch:', batch);
    res.json({
      success: true,
      batch
    });
  } catch (error) {
    console.error('Error fetching batch details:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch batch details' 
    });
  }
});

// @route   GET /api/batches/:id/students
// @desc    Get all students in a batch (including orphaned students)
// @access  Private (teacher/admin)
router.get('/:id/students', auth, isBatchOwnerOrAdmin, async (req, res) => {
  try {
    const batchId = req.params.id;
    const batchDoc = await Batch.findById(batchId).lean().exec();
    
    if (!batchDoc) {
      return res.status(404).json({ 
        success: false, 
        message: 'Batch not found' 
      });
    }

    // Get students from batch's students array
    const batchStudentIds = batchDoc.students || [];
    const batchStudents = await User.find({
      _id: { $in: batchStudentIds }
    }).lean().exec();

    // Find orphaned students who have this batchId but aren't in the students array
    const orphanedStudents = await User.find({
      batchId: batchId,
      _id: { $nin: batchStudentIds },
      role: 'student'
    }).lean().exec();

    // Log orphaned students for debugging
    if (orphanedStudents.length > 0) {
      console.log(`Found ${orphanedStudents.length} orphaned students for batch ${batchDoc.name} (${batchId})`);
      
      // Update the batch to include orphaned students for consistency
      await Batch.findByIdAndUpdate(batchId, {
        $addToSet: { students: { $each: orphanedStudents.map(s => s._id) } },
        updatedAt: new Date()
      });
    }

    // Merge both sets of students
    const allStudents = [...batchStudents, ...orphanedStudents];

    res.json({
      success: true,
      students: allStudents.map(student => ({
        ...student,
        id: String(student._id)
      }))
    });
  } catch (error) {
    console.error('Error fetching batch students:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch batch students' 
    });
  }
});

// @route   POST /api/batches/:id/students
// @desc    Add a single student to a batch
// @access  Teacher/Admin
router.post('/:id/students', auth, isBatchOwnerOrAdmin, async (req, res) => {
  try {
    const batchId = req.params.id;
    const { name, email } = req.body;

    if (!name || !email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Name and email are required' 
      });
    }

    // Find or create user
    let user = await User.findOne({ email }).exec();
    
    if (!user) {
      // Create new user
      user = new User({
        name,
        email,
        role: 'student',
        batchId,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      await user.save();
    } else {
      // Update existing user
      user.batchId = batchId;
      user.updatedAt = new Date();
      await user.save();
    }

    // Add student to batch
    const batchDoc = await Batch.findById(batchId).exec();
    if (!batchDoc) {
      return res.status(404).json({ 
        success: false, 
        message: 'Batch not found' 
      });
    }

    const currentStudents = batchDoc.students || [];
    const studentIdString = String(user._id);
    
    if (!currentStudents.some(id => String(id) === studentIdString)) {
      batchDoc.students.push(user._id);
      batchDoc.updatedAt = new Date();
      await batchDoc.save();
    }

    res.json({
      success: true,
      message: 'Student added to batch successfully',
      student: {
        ...user.toObject(),
        id: String(user._id)
      }
    });
  } catch (error) {
    console.error('Error adding student to batch:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to add student to batch' 
    });
  }
});

// @route   DELETE /api/batches/:id/students/:studentId
// @desc    Remove a student from a batch
// @access  Teacher/Admin
router.delete('/:id/students/:studentId', auth, isBatchOwnerOrAdmin, async (req, res) => {
  try {
    const { id: batchId, studentId } = req.params;

    const batchDoc = await Batch.findById(batchId).exec();
    if (!batchDoc) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found'
      });
    }

    batchDoc.students = batchDoc.students.filter(id => String(id) !== String(studentId));
    batchDoc.updatedAt = new Date();
    await batchDoc.save();

    // Update user
    const user = await User.findById(studentId).exec();
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

// @route   GET /api/batches/:id/recordings
// @desc    Get all recordings for a batch
// @access  Private (teacher/admin)
router.get('/:id/recordings', auth, isBatchOwnerOrAdmin, async (req, res) => {
  try {
    const batchId = req.params.id;
    
    // For now, return empty array - recordings will be stored in batch document
    // This can be extended later to use a separate Recording model
    const batchDoc = await Batch.findById(batchId).lean().exec();
    
    if (!batchDoc) {
      return res.status(404).json({ 
        success: false, 
        message: 'Batch not found' 
      });
    }

    // Return recordings from batch document (if field exists)
    const recordings = batchDoc.recordings || [];
    
    res.json({
      success: true,
      recordings
    });
  } catch (error) {
    console.error('Error fetching batch recordings:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch batch recordings' 
    });
  }
});

// @route   POST /api/batches/:id/recordings
// @desc    Add a recording to a batch
// @access  Teacher/Admin
router.post('/:id/recordings', auth, isBatchOwnerOrAdmin, async (req, res) => {
  try {
    const batchId = req.params.id;
    const { url, password, topic } = req.body;

    if (!url || !topic) {
      return res.status(400).json({ 
        success: false, 
        message: 'URL and topic are required' 
      });
    }

    const batchDoc = await Batch.findById(batchId).exec();
    if (!batchDoc) {
      return res.status(404).json({ 
        success: false, 
        message: 'Batch not found' 
      });
    }

    // Initialize recordings array if it doesn't exist
    if (!batchDoc.recordings) {
      batchDoc.recordings = [];
    }

    const newRecording = {
      _id: new mongoose.Types.ObjectId(),
      topic,
      url,
      password: password || '',
      date: new Date(),
      createdAt: new Date()
    };

    batchDoc.recordings.push(newRecording);
    batchDoc.updatedAt = new Date();
    await batchDoc.save();

    res.json({
      success: true,
      message: 'Recording added successfully',
      recording: newRecording
    });
  } catch (error) {
    console.error('Error adding recording:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to add recording' 
    });
  }
});

// @route   DELETE /api/batches/:id/recordings/:recordingId
// @desc    Delete a recording from a batch
// @access  Teacher/Admin
router.delete('/:id/recordings/:recordingId', auth, isBatchOwnerOrAdmin, async (req, res) => {
  try {
    const { id: batchId, recordingId } = req.params;

    const batchDoc = await Batch.findById(batchId).exec();
    if (!batchDoc) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found'
      });
    }

    if (!batchDoc.recordings) {
      return res.status(404).json({
        success: false,
        message: 'No recordings found for this batch'
      });
    }

    batchDoc.recordings = batchDoc.recordings.filter(
      recording => String(recording._id) !== String(recordingId)
    );
    batchDoc.updatedAt = new Date();
    await batchDoc.save();

    res.json({
      success: true,
      message: 'Recording deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting recording:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete recording'
    });
  }
});

module.exports = router;
