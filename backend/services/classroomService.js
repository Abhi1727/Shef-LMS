const { storage, db } = require('../config/firebase');
const path = require('path');
const crypto = require('crypto');

class ClassroomService {
  /**
   * Upload video file to Firebase Storage
   * @param {Object} file - Multer file object
   * @param {Object} metadata - Lecture metadata
   * @returns {Promise<Object>} - Storage file info
   */
  async uploadVideo(file, metadata) {
    try {
      // Generate unique filename
      const fileExtension = path.extname(file.originalname);
      const uniqueFilename = `lecture_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${fileExtension}`;
      
      // Define storage path (organized by course/year)
      const storagePath = `lectures/${metadata.courseId}/${new Date().getFullYear()}/${uniqueFilename}`;
      
      // Get reference to Firebase Storage bucket
      const bucket = storage.bucket();
      const fileRef = bucket.file(storagePath);
      
      // Upload file to Firebase Storage
      await fileRef.save(file.buffer, {
        metadata: {
          contentType: file.mimetype,
          metadata: {
            originalName: file.originalname,
            uploadedBy: metadata.uploadedBy,
            courseId: metadata.courseId,
            title: metadata.title
          }
        }
      });
      
      // Make file publicly accessible (but we'll use signed URLs)
      await fileRef.makePublic();
      
      return {
        filename: uniqueFilename,
        storagePath: storagePath,
        size: file.size,
        contentType: file.mimetype,
        originalName: file.originalname
      };
    } catch (error) {
      console.error('Error uploading video to Firebase Storage:', error);
      throw new Error('Failed to upload video to storage');
    }
  }

  /**
   * Generate signed URL for video playback
   * @param {string} storagePath - Firebase Storage file path
   * @param {number} expiresIn - URL expiration time in seconds (default: 2 hours)
   * @returns {Promise<string>} - Signed URL
   */
  async getSignedUrl(storagePath, expiresIn = 7200) {
    try {
      const bucket = storage.bucket();
      const fileRef = bucket.file(storagePath);
      
      // Check if file exists
      const [exists] = await fileRef.exists();
      if (!exists) {
        throw new Error('Video file not found in storage');
      }
      
      // Generate signed URL
      const [signedUrl] = await fileRef.getSignedUrl({
        action: 'read',
        expires: Date.now() + (expiresIn * 1000)
      });
      
      return signedUrl;
    } catch (error) {
      console.error('Error generating signed URL:', error);
      throw new Error('Failed to generate video access URL');
    }
  }

  /**
   * Save lecture metadata to Firestore
   * @param {Object} lectureData - Lecture metadata
   * @returns {Promise<string>} - Lecture document ID
   */
  async saveLectureMetadata(lectureData) {
    try {
      const lectureRef = db.collection('classroom').doc();
      await lectureRef.set({
        id: lectureRef.id,
        title: lectureData.title,
        description: lectureData.description || '',
        courseId: lectureData.courseId,
        batchId: lectureData.batchId || null,
        batchName: lectureData.batchName || null,
        domain: lectureData.domain || null,
        firebaseStoragePath: lectureData.firebaseStoragePath,
        duration: lectureData.duration || null,
        uploadedBy: lectureData.uploadedBy,
        createdAt: new Date().toISOString(),
        videoSource: 'firebase',
        isActive: true
      });
      
      return lectureRef.id;
    } catch (error) {
      console.error('Error saving lecture metadata:', error);
      throw new Error('Failed to save lecture metadata');
    }
  }

  /**
   * Get lecture metadata by ID
   * @param {string} lectureId - Lecture document ID
   * @returns {Promise<Object>} - Lecture metadata
   */
  async getLectureById(lectureId) {
    try {
      const lectureDoc = await db.collection('classroom').doc(lectureId).get();
      
      if (!lectureDoc.exists) {
        throw new Error('Lecture not found');
      }
      
      return { id: lectureDoc.id, ...lectureDoc.data() };
    } catch (error) {
      console.error('Error fetching lecture:', error);
      throw error;
    }
  }

  /**
   * Get lectures accessible to user based on role and enrollment
   * @param {Object} user - User object
   * @param {string} courseId - Filter by course ID (optional)
   * @returns {Promise<Array>} - Array of accessible lectures
   */
  async getAccessibleLectures(user, courseId = null) {
    try {
      // Get both Firebase and YouTube videos
      let firebaseQuery = db.collection('classroom').where('videoSource', '==', 'firebase');
      let youtubeQuery = db.collection('classroom').where('videoSource', '==', 'youtube-url');
      
      // Apply course filter if specified
      if (courseId) {
        firebaseQuery = firebaseQuery.where('courseId', '==', courseId);
        youtubeQuery = youtubeQuery.where('course', '==', courseId);
      }
      
      const [firebaseSnapshot, youtubeSnapshot] = await Promise.all([
        firebaseQuery.get(),
        youtubeQuery.get()
      ]);
      
      const lectures = [];
      
      firebaseSnapshot.forEach(doc => {
        lectures.push({ id: doc.id, ...doc.data() });
      });
      
      youtubeSnapshot.forEach(doc => {
        lectures.push({ id: doc.id, ...doc.data() });
      });
      
      // Filter based on user role and access permissions
      const filteredLectures = [];
      for (const lecture of lectures) {
        // Admin can access all lectures
        if (user.role === 'admin') {
          filteredLectures.push(lecture);
          continue;
        }
        
        // Teacher can access lectures for their courses
        if (user.role === 'teacher') {
          if (lecture.courseId === user.currentCourse || 
              lecture.courseId === user.course ||
              lecture.course === user.currentCourse || 
              lecture.course === user.course) {
            filteredLectures.push(lecture);
          }
          continue;
        }
        
        // Student access logic
        if (user.role === 'student') {
          // Get student's batch information to check batch name
          const studentBatchId = user.batchId;
          let studentBatchName = null;
          
          if (studentBatchId) {
            try {
              const batchDoc = await db.collection('batches').doc(studentBatchId).get();
              if (batchDoc.exists) {
                const batchData = batchDoc.data();
                studentBatchName = batchData.name;
              }
            } catch (error) {
              console.error('Error fetching student batch info:', error);
            }
          }
          
          // Check if enrolled in course (handle both courseId and course fields)
          const enrolledInCourse = lecture.courseId === user.currentCourse || 
                                 lecture.courseId === user.course ||
                                 lecture.course === user.currentCourse || 
                                 lecture.course === user.course;
          
          // Check batch match - require both batchId AND batch name to match
          let batchMatch = false;
          if (lecture.batchId && studentBatchId) {
            batchMatch = lecture.batchId === studentBatchId;
            
            // Additional check: verify batch names match if we have batch data
            if (batchMatch && studentBatchName && lecture.batchName) {
              batchMatch = lecture.batchName === studentBatchName;
            }
          }
          
          // Student must be enrolled in course AND have matching batch
          // Domain match alone is not sufficient for access
          if (enrolledInCourse && batchMatch) {
            filteredLectures.push(lecture);
          }
        }
      }
      
      return filteredLectures;
    } catch (error) {
      console.error('Error fetching accessible lectures:', error);
      throw new Error('Failed to fetch lectures');
    }
  }

  /**
   * Delete video from Firebase Storage
   * @param {string} storagePath - Firebase Storage file path
   * @returns {Promise<void>}
   */
  async deleteVideo(storagePath) {
    try {
      const bucket = storage.bucket();
      const fileRef = bucket.file(storagePath);
      
      // Check if file exists before deleting
      const [exists] = await fileRef.exists();
      if (exists) {
        await fileRef.delete();
        console.log('Video deleted from storage:', storagePath);
      }
    } catch (error) {
      console.error('Error deleting video from storage:', error);
      throw new Error('Failed to delete video from storage');
    }
  }

  /**
   * Delete lecture metadata from Firestore
   * @param {string} lectureId - Lecture document ID
   * @returns {Promise<void>}
   */
  async deleteLectureMetadata(lectureId) {
    try {
      await db.collection('classroom').doc(lectureId).delete();
    } catch (error) {
      console.error('Error deleting lecture metadata:', error);
      throw new Error('Failed to delete lecture metadata');
    }
  }
}

module.exports = new ClassroomService();
