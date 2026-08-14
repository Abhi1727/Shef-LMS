const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { isAdmin } = require('../middleware/roleAuth');
const auth = require('../middleware/auth');
const { isTeacherOrAdmin, isBatchOwnerOrAdmin } = require('../middleware/teacherAuth');
const Batch = require('../models/Batch');
const User = require('../models/User');
const Classroom = require('../models/Classroom');
const { sanitizeStudentsForViewer, sanitizeStudentForViewer } = require('../utils/studentPrivacy');
const {
  enrollStudentInBatch,
  unenrollStudentFromBatch
} = require('../utils/studentEnrollment');

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
// @desc    Get batches visible to the current user
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    let filter = {};
    const role = req.user?.role;

    if (role === 'admin') {
      filter = {};
    } else if (role === 'teacher' || role === 'mentor') {
      filter = { teacherId: String(req.user.id) };
    } else if (role === 'student') {
      filter = { _id: req.user.batchId || null };
    } else {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const batchesDocs = await Batch.find(filter).lean().exec();
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
// @desc    Add students to a batch (multi-program allowed; each program gets its own SKY ID)
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

    const results = [];
    for (const studentId of studentIds) {
      try {
        const { enrollment, created } = await enrollStudentInBatch(studentId, batchDoc);
        results.push({
          studentId: String(studentId),
          enrollmentNumber: enrollment.enrollmentNumber,
          created
        });
      } catch (err) {
        results.push({
          studentId: String(studentId),
          error: err.message || 'Failed to enroll'
        });
      }
    }

    res.json({
      success: true,
      message: 'Students enrolled in batch (multi-program supported)',
      results
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

    await unenrollStudentFromBatch(studentId, batchId);

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
// @access  Private (admin, owning teacher, or enrolled student)
router.get('/:id', auth, async (req, res) => {
  try {
    const batchId = req.params.id;
    const batchDoc = await Batch.findById(batchId).lean().exec();

    if (!batchDoc) {
      return res.status(404).json({ 
        success: false, 
        message: 'Batch not found' 
      });
    }

    const role = req.user?.role;
    const userId = String(req.user?.id || '');
    const isAdmin = role === 'admin';
    const isOwnerTeacher =
      (role === 'teacher' || role === 'mentor') &&
      String(batchDoc.teacherId) === userId;
    const isEnrolledStudent =
      role === 'student' &&
      (String(req.user?.batchId || '') === String(batchId) ||
        (batchDoc.students || []).some((s) => String(s) === userId));

    if (!isAdmin && !isOwnerTeacher && !isEnrolledStudent) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have permission to view this batch.'
      });
    }

    const batch = { id: String(batchDoc._id), ...batchDoc };
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

    // Get students from batch's students array (never return password hashes)
    const batchStudentIds = batchDoc.students || [];
    const batchStudents = await User.find({
      _id: { $in: batchStudentIds }
    }).select('-password').lean().exec();

    // Find orphaned students who have this batchId but aren't in the students array
    const orphanedStudents = await User.find({
      batchId: batchId,
      _id: { $nin: batchStudentIds },
      role: 'student'
    }).select('-password').lean().exec();

    // Log orphaned students for debugging
    if (orphanedStudents.length > 0) {
      console.log(`Found ${orphanedStudents.length} orphaned students for batch ${batchDoc.name} (${batchId})`);
      
      // Update the batch to include orphaned students for consistency
      await Batch.findByIdAndUpdate(batchId, {
        $addToSet: { students: { $each: orphanedStudents.map(s => s._id) } },
        updatedAt: new Date()
      });
    }

    // Merge both sets of students — teachers never receive email/phone
    const allStudents = [...batchStudents, ...orphanedStudents];
    const viewerRole = req.user?.role;

    res.json({
      success: true,
      students: sanitizeStudentsForViewer(allStudents, viewerRole)
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
// @desc    Add a single student to a batch (multi-program: existing students keep other enrollments)
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

    const batchDoc = await Batch.findById(batchId).exec();
    if (!batchDoc) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found'
      });
    }

    let user = await User.findOne({ email }).exec();

    if (!user) {
      const { allocateFormNumber } = require('../utils/reportFormNumber');
      const joinDate = new Date();
      const { formNumber } = await allocateFormNumber(User);
      user = new User({
        name,
        email,
        role: 'student',
        formNumber,
        joiningDate: joinDate,
        createdAt: joinDate,
        updatedAt: joinDate,
        enrollments: []
      });
      // Password required by schema — set a temporary hash the student must reset,
      // or generate random. Match prior behavior: teachers may create without password?
      // User schema requires password — check prior code... prior code didn't set password!
      // That might rely on Firestore not enforcing. Add a placeholder hashed password.
      const bcrypt = require('bcryptjs');
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(`Temp@${Date.now()}`, salt);
      await user.save();
    } else if (user.role === 'student' && !user.formNumber) {
      const { allocateFormNumber } = require('../utils/reportFormNumber');
      const { formNumber } = await allocateFormNumber(User);
      user.formNumber = formNumber;
      await user.save();
    }

    const { enrollment } = await enrollStudentInBatch(user, batchDoc);

    // Reload for response
    const refreshed = await User.findById(user._id).exec();

    res.json({
      success: true,
      message: 'Student enrolled in batch successfully',
      student: sanitizeStudentForViewer(refreshed, req.user?.role),
      enrollment
    });
  } catch (error) {
    console.error('Error adding student to batch:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to add student to batch'
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

    await unenrollStudentFromBatch(studentId, batchId);

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
