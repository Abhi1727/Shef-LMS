const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const oneToOneBatchController = require('../controllers/oneToOneBatchController');
const { isAdmin } = require('../middleware/roleAuth');

// All routes require auth
router.use(auth);

// Specific paths MUST come before /:id to avoid "course" and "unassigned-students" matching as ids
// @route   GET /api/one-to-one-batches/course/:courseName
// @desc    Get batches by course
// @access  Private
router.get('/course/:courseName', oneToOneBatchController.getBatchesByCourse);

// @route   GET /api/one-to-one-batches/unassigned-students/:course
// @desc    Get unassigned students for a course (for one-to-one batches)
// @access  Admin only
router.get('/unassigned-students/:course', isAdmin, oneToOneBatchController.getUnassignedStudents);

// @route   POST /api/one-to-one-batches
// @desc    Create new one-to-one batch
// @access  Admin only
router.post('/', isAdmin, oneToOneBatchController.createBatch);

// @route   GET /api/one-to-one-batches
// @desc    Get all one-to-one batches
// @access  Private
router.get('/', oneToOneBatchController.getAllBatches);

// @route   GET /api/one-to-one-batches/:id
// @desc    Get specific one-to-one batch
// @access  Private
router.get('/:id', oneToOneBatchController.getBatchById);

// @route   PUT /api/one-to-one-batches/:id
// @desc    Update one-to-one batch
// @access  Admin only
router.put('/:id', isAdmin, oneToOneBatchController.updateBatch);

// @route   DELETE /api/one-to-one-batches/:id
// @desc    Delete one-to-one batch
// @access  Admin only
router.delete('/:id', isAdmin, oneToOneBatchController.deleteBatch);

// @route   POST /api/one-to-one-batches/:id/videos
// @desc    Add video to batch
// @access  Admin only
router.post('/:id/videos', isAdmin, oneToOneBatchController.addVideo);

// @route   PUT /api/one-to-one-batches/:id/videos/:videoId
// @desc    Update video in batch
// @access  Admin only
router.put('/:id/videos/:videoId', isAdmin, oneToOneBatchController.updateVideo);

// @route   DELETE /api/one-to-one-batches/:id/videos/:videoId
// @desc    Remove video from batch
// @access  Admin only
router.delete('/:id/videos/:videoId', isAdmin, oneToOneBatchController.removeVideo);

// @route   DELETE /api/one-to-one-batches/:id/videos/:videoIndex/index
// @desc    Remove video from batch by index
// @access  Admin only
router.delete('/:id/videos/:videoIndex/index', isAdmin, oneToOneBatchController.removeVideoByIndex);

// @route   POST /api/one-to-one-batches/:id/students
// @desc    Add/update student
// @access  Admin only
router.post('/:id/students', isAdmin, oneToOneBatchController.updateStudent);

// @route   DELETE /api/one-to-one-batches/:id/students
// @desc    Remove student from batch
// @access  Admin only
router.delete('/:id/students', isAdmin, oneToOneBatchController.removeStudent);

// @route   PUT /api/one-to-one-batches/:id/progress
// @desc    Update progress
// @access  Admin only
router.put('/:id/progress', isAdmin, oneToOneBatchController.updateProgress);

module.exports = router;
