const Classroom = require('../models/Classroom');

class ClassroomService {
  // Direct file uploads and signed URLs are no longer supported in this
  // Firebase-free version. Admins should use YouTube/Drive links instead.
  async uploadVideo() {
    throw new Error('Direct video upload is disabled. Use YouTube/Drive links instead.');
  }

  async getSignedUrl() {
    throw new Error('Signed URL generation is disabled (no Firebase Storage).');
  }

  // Save lecture metadata to MongoDB Classroom collection
  async saveLectureMetadata(lectureData) {
    try {
      const doc = new Classroom({
        title: lectureData.title,
        instructor: lectureData.instructor,
        description: lectureData.description || '',
        courseId: lectureData.courseId,
        course: lectureData.course,
        batchId: lectureData.batchId || null,
        batchName: lectureData.batchName || null,
        domain: lectureData.domain || null,
        duration: lectureData.duration || null,
        courseType: lectureData.courseType,
        type: lectureData.type,
        date: lectureData.date,
        videoSource: lectureData.videoSource,
        zoomUrl: lectureData.zoomUrl,
        zoomPasscode: lectureData.zoomPasscode,
        driveId: lectureData.driveId,
        youtubeVideoId: lectureData.youtubeVideoId,
        youtubeVideoUrl: lectureData.youtubeVideoUrl,
        youtubeEmbedUrl: lectureData.youtubeEmbedUrl,
        storagePath: lectureData.firebaseStoragePath || lectureData.storagePath,
        uploadedBy: lectureData.uploadedBy
      });
      const saved = await doc.save();
      return String(saved._id);
    } catch (error) {
      console.error('Error saving lecture metadata (Mongo):', error);
      throw new Error('Failed to save lecture metadata');
    }
  }

  async getLectureById(lectureId) {
    try {
      const doc = await Classroom.findById(lectureId).lean().exec();
      if (!doc) {
        throw new Error('Lecture not found');
      }
      return { id: String(doc._id), ...doc };
    } catch (error) {
      console.error('Error fetching lecture (Mongo):', error);
      throw error;
    }
  }

  async getAccessibleLectures(user, courseId = null) {
    try {
      const query = {};
      if (courseId) {
        query.courseId = courseId;
      }

      const docs = await Classroom.find(query).lean().exec();

      return docs
        .filter(lecture => {
          if (user.role === 'admin') return true;

          if (user.role === 'teacher') {
            return (
              lecture.courseId === user.currentCourse ||
              lecture.courseId === user.course
            );
          }

          if (user.role === 'student') {
            const enrolledInCourse =
              lecture.courseId === user.currentCourse ||
              lecture.courseId === user.course;

            const batchMatch = lecture.batchId && lecture.batchId === user.batchId;

            if (lecture.batchId) {
              return !!batchMatch;
            }

            const domainMatch =
              lecture.domain &&
              (lecture.domain === user.domain ||
                user.domain?.toLowerCase().includes(lecture.domain?.toLowerCase()) ||
                lecture.domain?.toLowerCase().includes(user.domain?.toLowerCase()));

            return enrolledInCourse || domainMatch;
          }

          return false;
        })
        .map(doc => ({ id: String(doc._id), ...doc }));
    } catch (error) {
      console.error('Error fetching accessible lectures (Mongo):', error);
      throw new Error('Failed to fetch lectures');
    }
  }

  async deleteVideo() {
    // No-op: physical file deletion is not supported without Firebase Storage
    return;
  }

  async deleteLectureMetadata(lectureId) {
    try {
      await Classroom.findByIdAndDelete(lectureId).exec();
    } catch (error) {
      console.error('Error deleting lecture metadata (Mongo):', error);
      throw new Error('Failed to delete lecture metadata');
    }
  }
}

module.exports = new ClassroomService();
