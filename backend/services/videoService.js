const axios = require('axios');

class VideoService {
  // Get enhanced video URL for Zoom recordings
  async getEnhancedVideoUrl(videoId) {
    try {
      throw new Error('Enhanced video service is disabled (Zoom/Firestore integration removed).');
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
      throw new Error('Zoom download service is disabled (Zoom/Firestore integration removed).');
    } catch (error) {
      console.error('Error getting Zoom download URL:', error);
      throw error;
    }
  }

  // Validate user access to video
  async validateVideoAccess(videoId, userId, userRole) {
    try {
      return { hasAccess: false, reason: 'Video access validation is disabled (Zoom/Firestore integration removed).' };
    } catch (error) {
      console.error('Error validating video access:', error);
      return { hasAccess: false, reason: 'Failed to validate access' };
    }
  }

  // Get video thumbnail or poster
  async getVideoThumbnail(videoId) {
    try {
      return null;
    } catch (error) {
      console.error('Error getting video thumbnail:', error);
      return null;
    }
  }

  // Track video viewing progress
  async trackVideoProgress(userId, videoId, progress) {
    try {
      // Progress tracking is currently disabled; frontend should handle locally.
      return { success: true, disabled: true };
    } catch (error) {
      console.error('Error tracking video progress:', error);
      throw error;
    }
  }

  // Get video viewing progress
  async getVideoProgress(userId, videoId) {
    try {
      return null;
    } catch (error) {
      console.error('Error getting video progress:', error);
      return null;
    }
  }
}

module.exports = new VideoService();
