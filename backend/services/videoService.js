const axios = require('axios');
const { db } = require('../config/firebase');

class VideoService {
  // Get enhanced video URL for Zoom recordings
  async getEnhancedVideoUrl(videoId) {
    try {
      // Get video from classroom collection
      const videoDoc = await db.collection('classroom').doc(videoId).get();
      
      if (!videoDoc.exists) {
        throw new Error('Video not found');
      }

      const video = videoDoc.data();

      if (video.source === 'zoom' && video.videoUrl) {
        // For Zoom videos, try to get a better playback URL
        return await this.processZoomVideo(video);
      } else if (video.driveId) {
        // For Drive videos, return the enhanced preview URL
        return {
          ...video,
          enhancedUrl: `https://drive.google.com/file/d/${video.driveId}/preview`,
          type: 'drive'
        };
      }

      return video;
    } catch (error) {
      console.error('Error getting enhanced video URL:', error);
      throw error;
    }
  }

  // Process Zoom video to get better playback URL
  async processZoomVideo(video) {
    try {
      const zoomUrl = video.videoUrl;
      
      // If it's already a Zoom recording play URL, enhance it
      if (zoomUrl.includes('zoom.us/rec/play/')) {
        // Add parameters for better embedding
        const separator = zoomUrl.includes('?') ? '&' : '?';
        const enhancedUrl = `${zoomUrl}${separator}autoplay=true&showChat=false`;
        
        return {
          ...video,
          enhancedUrl: enhancedUrl,
          type: 'zoom',
          embedOptions: {
            allow: 'autoplay; fullscreen; encrypted-media',
            allowFullScreen: true,
            sandbox: 'allow-scripts allow-same-origin allow-forms allow-popups allow-modals'
          }
        };
      }

      // For other Zoom URLs, return as-is
      return {
        ...video,
        enhancedUrl: zoomUrl,
        type: 'zoom'
      };
    } catch (error) {
      console.error('Error processing Zoom video:', error);
      throw error;
    }
  }

  // Get direct download URL for Zoom recordings (if available)
  async getZoomDownloadUrl(videoId) {
    try {
      const videoDoc = await db.collection('classroom').doc(videoId).get();
      
      if (!videoDoc.exists) {
        throw new Error('Video not found');
      }

      const video = videoDoc.data();

      if (video.source === 'zoom' && video.downloadUrl) {
        return {
          downloadUrl: video.downloadUrl,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
        };
      }

      throw new Error('Download URL not available for this video');
    } catch (error) {
      console.error('Error getting Zoom download URL:', error);
      throw error;
    }
  }

  // Validate user access to video
  async validateVideoAccess(videoId, userId, userRole) {
    try {
      const videoDoc = await db.collection('classroom').doc(videoId).get();
      
      if (!videoDoc.exists) {
        return { hasAccess: false, reason: 'Video not found' };
      }

      const video = videoDoc.data();

      // Check if video is accessible to this user
      // This logic should match your existing access control
      if (video.courseRestriction) {
        // Check if user is enrolled in the course
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();
        
        if (userData.currentCourse !== video.courseRestriction) {
          return { 
            hasAccess: false, 
            reason: 'You are not enrolled in this course' 
          };
        }
      }

      return { 
        hasAccess: true, 
        video: {
          id: video.id,
          title: video.title,
          videoUrl: video.videoUrl,
          zoomPasscode: video.zoomPasscode,
          videoSource: video.source || 'zoom',
          instructor: video.instructor,
          date: video.date,
          duration: video.duration
        }
      };
    } catch (error) {
      console.error('Error validating video access:', error);
      return { hasAccess: false, reason: 'Failed to validate access' };
    }
  }

  // Get video thumbnail or poster
  async getVideoThumbnail(videoId) {
    try {
      const videoDoc = await db.collection('classroom').doc(videoId).get();
      
      if (!videoDoc.exists) {
        return null;
      }

      const video = videoDoc.data();

      // For Zoom videos, we might need to generate a thumbnail
      if (video.source === 'zoom') {
        // You could implement thumbnail generation here
        // For now, return a placeholder
        return {
          thumbnailUrl: '/api/thumbnails/zoom-placeholder.jpg',
          generatedAt: new Date().toISOString()
        };
      }

      return null;
    } catch (error) {
      console.error('Error getting video thumbnail:', error);
      return null;
    }
  }

  // Track video viewing progress
  async trackVideoProgress(userId, videoId, progress) {
    try {
      const progressRef = db.collection('videoProgress').doc(`${userId}_${videoId}`);
      
      await progressRef.set({
        userId,
        videoId,
        progress: {
          currentTime: progress.currentTime,
          duration: progress.duration,
          percentageWatched: progress.percentageWatched,
          lastWatchedAt: new Date().toISOString(),
          completed: progress.completed || false
        },
        updatedAt: new Date().toISOString()
      }, { merge: true });

      return { success: true };
    } catch (error) {
      console.error('Error tracking video progress:', error);
      throw error;
    }
  }

  // Get video viewing progress
  async getVideoProgress(userId, videoId) {
    try {
      const progressDoc = await db.collection('videoProgress')
        .doc(`${userId}_${videoId}`)
        .get();

      if (progressDoc.exists) {
        return progressDoc.data().progress;
      }

      return null;
    } catch (error) {
      console.error('Error getting video progress:', error);
      return null;
    }
  }
}

module.exports = new VideoService();
