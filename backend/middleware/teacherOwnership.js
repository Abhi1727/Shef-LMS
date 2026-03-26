/**
 * Teacher ownership verification helpers.
 * Validates that teachers can only access their own data.
 */

const Course = require('../models/Course');
const Batch = require('../models/Batch');
const Classroom = require('../models/Classroom');

async function verifyCourseOwnership(teacherId, courseId) {
  try {
    const course = await Course.findById(courseId);
    if (!course) {
      return { allowed: false, error: 'Course not found' };
    }
    
    if (String(course.teacherId) !== String(teacherId)) {
      return { allowed: false, error: 'Access denied: You do not own this course' };
    }
    
    return { allowed: true };
  } catch (error) {
    console.error('Error verifying course ownership:', error);
    return { allowed: false, error: 'Server error' };
  }
}

async function verifyBatchOwnership(teacherId, batchId) {
  try {
    const batch = await Batch.findById(batchId);
    if (!batch) {
      return { allowed: false, error: 'Batch not found' };
    }
    
    if (String(batch.teacherId) !== String(teacherId)) {
      return { allowed: false, error: 'Access denied: You do not own this batch' };
    }
    
    return { allowed: true };
  } catch (error) {
    console.error('Error verifying batch ownership:', error);
    return { allowed: false, error: 'Server error' };
  }
}

async function verifyVideoOwnership(teacherId, videoId) {
  try {
    const video = await Classroom.findById(videoId);
    if (!video) {
      return { allowed: false, error: 'Video not found' };
    }
    
    // Verify the batch belongs to this teacher
    const batchOwnership = await verifyBatchOwnership(teacherId, video.batchId);
    if (!batchOwnership.allowed) {
      return batchOwnership;
    }
    
    return { allowed: true };
  } catch (error) {
    console.error('Error verifying video ownership:', error);
    return { allowed: false, error: 'Server error' };
  }
}

async function verifyModuleOwnership(teacherId, moduleId) {
  try {
    // For now, modules are tied to courses, so verify course ownership
    const Module = require('../models/Module');
    const module = await Module.findById(moduleId);
    
    if (!module) {
      return { allowed: false, error: 'Module not found' };
    }
    
    return await verifyCourseOwnership(teacherId, module.courseId);
  } catch (error) {
    console.error('Error verifying module ownership:', error);
    return { allowed: false, error: 'Server error' };
  }
}

async function verifyLessonOwnership(teacherId, lessonId) {
  try {
    // Lessons are tied to modules, which are tied to courses
    const Lesson = require('../models/Lesson');
    const lesson = await Lesson.findById(lessonId);
    
    if (!lesson) {
      return { allowed: false, error: 'Lesson not found' };
    }
    
    return await verifyModuleOwnership(teacherId, lesson.moduleId);
  } catch (error) {
    console.error('Error verifying lesson ownership:', error);
    return { allowed: false, error: 'Server error' };
  }
}

async function verifyProjectOwnership(teacherId, projectId) {
  try {
    // Projects are tied to courses
    const Project = require('../models/Project');
    const project = await Project.findById(projectId);
    
    if (!project) {
      return { allowed: false, error: 'Project not found' };
    }
    
    return await verifyCourseOwnership(teacherId, project.courseId);
  } catch (error) {
    console.error('Error verifying project ownership:', error);
    return { allowed: false, error: 'Server error' };
  }
}

async function verifyAssessmentOwnership(teacherId, assessmentId) {
  try {
    // Assessments are tied to courses
    const Assessment = require('../models/Assessment');
    const assessment = await Assessment.findById(assessmentId);
    
    if (!assessment) {
      return { allowed: false, error: 'Assessment not found' };
    }
    
    return await verifyCourseOwnership(teacherId, assessment.courseId);
  } catch (error) {
    console.error('Error verifying assessment ownership:', error);
    return { allowed: false, error: 'Server error' };
  }
}

module.exports = {
  verifyCourseOwnership,
  verifyBatchOwnership,
  verifyVideoOwnership,
  verifyModuleOwnership,
  verifyLessonOwnership,
  verifyProjectOwnership,
  verifyAssessmentOwnership
};
