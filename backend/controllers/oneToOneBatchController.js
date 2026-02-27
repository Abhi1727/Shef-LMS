const oneToOneBatchRepository = require('../repositories/oneToOneBatchRepository');
const { isAdmin } = require('../middleware/roleAuth');

class OneToOneBatchController {
    // Create new one-to-one batch
    async createBatch(req, res) {
        try {
            const { name, course, courseId, studentId, studentName, studentEmail, teacherId, teacherName, startDate, endDate, schedule, notes } = req.body;

            // Validation
            if (!name || !course || !teacherId) {
                return res.status(400).json({
                    success: false,
                    message: 'Name, course, and teacher ID are required'
                });
            }

            // For two-step process, student fields are optional during creation
            if (studentId) {
                // Validate student exists only if studentId is provided
                const student = await oneToOneBatchRepository.validateStudent(studentId);
                if (!student) {
                    return res.status(404).json({
                        success: false,
                        message: 'Student not found'
                    });
                }
            }

            // Validate teacher exists
            const teacher = await oneToOneBatchRepository.validateTeacher(teacherId);
            if (!teacher) {
                return res.status(404).json({
                    success: false,
                    message: 'Teacher not found'
                });
            }

            const batchData = {
                name,
                course,
                courseId,
                studentId,
                studentName,
                studentEmail,
                teacherId,
                teacherName: teacherName || teacher.name,
                startDate: startDate ? new Date(startDate) : new Date(),
                endDate: endDate ? new Date(endDate) : null,
                schedule: schedule || {},
                notes: notes || '',
                status: 'active'
            };

            const batch = await oneToOneBatchRepository.create(batchData);

            // If a student was assigned during creation, update their course and batchId
            if (studentId && batch) {
                await oneToOneBatchRepository.updateStudentCourse(batch._id, studentId, course);
            }

            res.status(201).json({
                success: true,
                message: 'One-to-one batch created successfully',
                batch: {
                    id: String(batch._id),
                    ...batch
                }
            });
        } catch (error) {
            console.error('Error creating one-to-one batch:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to create one-to-one batch'
            });
        }
    }

    // Get all one-to-one batches
    async getAllBatches(req, res) {
        try {
            const batches = await oneToOneBatchRepository.findAll();
            const formattedBatches = batches.map(batch => ({
                id: String(batch._id),
                ...batch
            }));

            res.json({
                success: true,
                batches: formattedBatches
            });
        } catch (error) {
            console.error('Error fetching one-to-one batches:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch one-to-one batches'
            });
        }
    }

    // Get specific one-to-one batch
    async getBatchById(req, res) {
        try {
            const { id } = req.params;
            const batch = await oneToOneBatchRepository.findById(id);

            if (!batch) {
                return res.status(404).json({
                    success: false,
                    message: 'One-to-one batch not found'
                });
            }

            res.json({
                success: true,
                batch: {
                    id: String(batch._id),
                    ...batch
                }
            });
        } catch (error) {
            console.error('Error fetching one-to-one batch:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch one-to-one batch'
            });
        }
    }

    // Update one-to-one batch
    async updateBatch(req, res) {
        try {
            const { id } = req.params;
            const updateData = req.body;

            // Remove fields that shouldn't be updated directly
            delete updateData.id;
            delete updateData.createdAt;

            const batch = await oneToOneBatchRepository.update(id, updateData);

            if (!batch) {
                return res.status(404).json({
                    success: false,
                    message: 'One-to-one batch not found'
                });
            }

            res.json({
                success: true,
                message: 'One-to-one batch updated successfully',
                batch: {
                    id: String(batch._id),
                    ...batch
                }
            });
        } catch (error) {
            console.error('Error updating one-to-one batch:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update one-to-one batch'
            });
        }
    }

    // Delete one-to-one batch
    async deleteBatch(req, res) {
        try {
            const { id } = req.params;
            const batch = await oneToOneBatchRepository.delete(id);

            if (!batch) {
                return res.status(404).json({
                    success: false,
                    message: 'One-to-one batch not found'
                });
            }

            res.json({
                success: true,
                message: 'One-to-one batch deleted successfully'
            });
        } catch (error) {
            console.error('Error deleting one-to-one batch:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to delete one-to-one batch'
            });
        }
    }

    // Add video to batch
    async addVideo(req, res) {
        try {
            const { id } = req.params;
            const { title, url, duration, thumbnail, order, classDate, classTime, description } = req.body;

            if (!title || !url) {
                return res.status(400).json({
                    success: false,
                    message: 'Title and URL are required'
                });
            }

            const videoData = {
                title,
                url,
                description: description || '',
                duration: duration || '',
                thumbnail: thumbnail || '',
                order: order || 0,
                classDate: classDate || '',
                classTime: classTime || ''
            };
            
            console.log('🔍 Backend Debug - Adding video with data:', videoData);

            const batch = await oneToOneBatchRepository.addVideo(id, videoData);

            if (!batch) {
                return res.status(404).json({
                    success: false,
                    message: 'One-to-one batch not found'
                });
            }

            res.json({
                success: true,
                message: 'Video added successfully',
                batch: {
                    id: String(batch._id),
                    ...batch
                }
            });
        } catch (error) {
            console.error('Error adding video:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to add video'
            });
        }
    }

    // Update video in batch
    async updateVideo(req, res) {
        try {
            const { id, videoId } = req.params;
            const videoData = req.body;
            
            console.log('Backend updateVideo called with:', { id, videoId, videoData });

            const batch = await oneToOneBatchRepository.updateVideo(id, videoId, videoData);
            console.log('Repository result:', batch);

            if (!batch) {
                console.log('Batch or video not found');
                return res.status(404).json({
                    success: false,
                    message: 'One-to-one batch or video not found'
                });
            }

            res.json({
                success: true,
                message: 'Video updated successfully',
                batch: {
                    id: String(batch._id),
                    ...batch
                }
            });
        } catch (error) {
            console.error('Error updating video:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update video'
            });
        }
    }

    // Remove video from batch
    async removeVideo(req, res) {
        try {
            const { id, videoId } = req.params;

            const batch = await oneToOneBatchRepository.removeVideo(id, videoId);

            if (!batch) {
                return res.status(404).json({
                    success: false,
                    message: 'One-to-one batch not found'
                });
            }

            res.json({
                success: true,
                message: 'Video removed successfully',
                batch: {
                    id: String(batch._id),
                    ...batch
                }
            });
        } catch (error) {
            console.error('Error removing video:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to remove video'
            });
        }
    }

    // Remove video from batch by index
    async removeVideoByIndex(req, res) {
        try {
            const { id, videoIndex } = req.params;
            const index = parseInt(videoIndex);

            if (isNaN(index) || index < 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid video index'
                });
            }

            const batch = await oneToOneBatchRepository.removeVideoByIndex(id, index);

            if (!batch) {
                return res.status(404).json({
                    success: false,
                    message: 'One-to-one batch not found'
                });
            }

            res.json({
                success: true,
                message: 'Video removed successfully',
                batch: {
                    id: String(batch._id),
                    ...batch.toObject()
                }
            });
        } catch (error) {
            console.error('Error removing video by index:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to remove video'
            });
        }
    }

    // Add/update student
    async updateStudent(req, res) {
        try {
            const { id } = req.params;
            const { studentId, studentName, studentEmail } = req.body;

            if (!studentId || !studentName || !studentEmail) {
                return res.status(400).json({
                    success: false,
                    message: 'Student ID, name, and email are required'
                });
            }

            // Validate student exists
            const student = await oneToOneBatchRepository.validateStudent(studentId);
            if (!student) {
                return res.status(404).json({
                    success: false,
                    message: 'Student not found'
                });
            }

            const studentData = { studentId, studentName, studentEmail };
            const batch = await oneToOneBatchRepository.updateStudent(id, studentData);

            if (!batch) {
                return res.status(404).json({
                    success: false,
                    message: 'One-to-one batch not found'
                });
            }

            res.json({
                success: true,
                message: 'Student updated successfully',
                batch: {
                    id: String(batch._id),
                    ...batch
                }
            });
        } catch (error) {
            console.error('Error updating student:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update student'
            });
        }
    }

    // Remove student from batch
    async removeStudent(req, res) {
        try {
            const { id } = req.params;

            const batch = await oneToOneBatchRepository.removeStudent(id);

            if (!batch) {
                return res.status(404).json({
                    success: false,
                    message: 'One-to-one batch not found'
                });
            }

            res.json({
                success: true,
                message: 'Student removed successfully',
                batch: {
                    id: String(batch._id),
                    ...batch
                }
            });
        } catch (error) {
            console.error('Error removing student:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to remove student'
            });
        }
    }

    // Get batches by course
    async getBatchesByCourse(req, res) {
        try {
            const { courseName } = req.params;
            const batches = await oneToOneBatchRepository.findByCourse(courseName);
            const formattedBatches = batches.map(batch => ({
                id: String(batch._id),
                ...batch
            }));

            res.json({
                success: true,
                batches: formattedBatches
            });
        } catch (error) {
            console.error('Error fetching batches by course:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch batches by course'
            });
        }
    }

    // Update progress
    async updateProgress(req, res) {
        try {
            const { id } = req.params;
            const { progress } = req.body;

            if (typeof progress !== 'number') {
                return res.status(400).json({
                    success: false,
                    message: 'Progress must be a number'
                });
            }

            const batch = await oneToOneBatchRepository.updateProgress(id, progress);

            if (!batch) {
                return res.status(404).json({
                    success: false,
                    message: 'One-to-one batch not found'
                });
            }

            res.json({
                success: true,
                message: 'Progress updated successfully',
                batch: {
                    id: String(batch._id),
                    ...batch
                }
            });
        } catch (error) {
            console.error('Error updating progress:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update progress'
            });
        }
    }

    // Get unassigned students for a course (for one-to-one batches)
    async getUnassignedStudents(req, res) {
        try {
            const { course } = req.params;
            const { currentBatchId } = req.query;

            const students = await oneToOneBatchRepository.findUnassignedStudents(course, currentBatchId);

            res.json({
                success: true,
                students: students
            });
        } catch (error) {
            console.error('Error fetching unassigned students:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch unassigned students'
            });
        }
    }
}

module.exports = new OneToOneBatchController();
