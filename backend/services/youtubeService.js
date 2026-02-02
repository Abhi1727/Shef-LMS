const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

class YouTubeService {
  constructor() {
    this.youtube = google.youtube('v3');
    this.oauth2Client = null;
    this.initializeAuth();
  }

  /**
   * Initialize OAuth2 client with YouTube API credentials
   */
  initializeAuth() {
    try {
      this.oauth2Client = new google.auth.OAuth2(
        process.env.YOUTUBE_CLIENT_ID,
        process.env.YOUTUBE_CLIENT_SECRET,
        process.env.YOUTUBE_REDIRECT_URI || 'http://localhost:5000/auth/youtube/callback'
      );

      // Set credentials if refresh token is available
      if (process.env.YOUTUBE_REFRESH_TOKEN) {
        this.oauth2Client.setCredentials({
          refresh_token: process.env.YOUTUBE_REFRESH_TOKEN
        });
      }

      console.log('✅ YouTube OAuth2 client initialized');
    } catch (error) {
      console.error('❌ Failed to initialize YouTube auth:', error.message);
    }
  }

  /**
   * Get authorization URL for YouTube API access
   */
  getAuthUrl() {
    if (!this.oauth2Client) {
      throw new Error('YouTube OAuth2 client not initialized');
    }

    const scopes = [
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube.readonly'
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent'
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  async getTokens(code) {
    try {
      const { tokens } = await this.oauth2Client.getAccessToken(code);
      return tokens;
    } catch (error) {
      console.error('❌ Error getting YouTube tokens:', error.message);
      throw error;
    }
  }

  /**
   * Upload video to YouTube as private
   */
  async uploadVideo(videoPath, metadata) {
    try {
      if (!this.oauth2Client) {
        throw new Error('YouTube OAuth2 client not initialized');
      }

      // Refresh access token if needed
      if (process.env.YOUTUBE_REFRESH_TOKEN) {
        const { credentials } = await this.oauth2Client.refreshAccessToken();
        this.oauth2Client.setCredentials(credentials);
      }

      const fileSize = fs.statSync(videoPath).size;
      
      const youtubeMetadata = {
        snippet: {
          title: metadata.title || 'Untitled Video',
          description: metadata.description || `Educational video - ${metadata.courseType || 'Course'}`,
          tags: metadata.tags || ['education', 'shef-lms', metadata.courseType, metadata.instructor],
          categoryId: '27' // Education category
        },
        status: {
          privacyStatus: 'private', // Upload as private
          embeddable: true,
          license: 'youtube'
        }
      };

      console.log('📹 Starting YouTube upload:', metadata.title);

      const response = await this.youtube.videos.insert({
        part: 'snippet,status',
        requestBody: youtubeMetadata,
        media: {
          body: fs.createReadStream(videoPath),
          mimeType: 'video/*'
        },
        auth: this.oauth2Client
      });

      const videoId = response.data.id;
      console.log('✅ Video uploaded successfully to YouTube:', videoId);

      return {
        success: true,
        videoId: videoId,
        videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
        embedUrl: `https://www.youtube.com/embed/${videoId}`,
        privacyStatus: 'private'
      };

    } catch (error) {
      console.error('❌ Error uploading video to YouTube:', error.message);
      
      // Handle specific YouTube API errors
      if (error.code === 401) {
        throw new Error('YouTube authentication failed. Please re-authenticate.');
      } else if (error.code === 403) {
        throw new Error('YouTube API quota exceeded or insufficient permissions.');
      } else if (error.code === 400) {
        throw new Error('Invalid video metadata or file format.');
      }
      
      throw new Error('Failed to upload video to YouTube: ' + error.message);
    }
  }

  /**
   * Get video details from YouTube
   */
  async getVideoDetails(videoId) {
    try {
      const response = await this.youtube.videos.list({
        part: 'snippet,status,contentDetails',
        id: videoId,
        auth: this.oauth2Client
      });

      if (response.data.items.length === 0) {
        throw new Error('Video not found');
      }

      return response.data.items[0];
    } catch (error) {
      console.error('❌ Error fetching video details:', error.message);
      throw error;
    }
  }

  /**
   * Update video privacy status (useful for making videos public later)
   */
  async updateVideoPrivacy(videoId, privacyStatus = 'private') {
    try {
      const response = await this.youtube.videos.update({
        part: 'status',
        requestBody: {
          id: videoId,
          status: {
            privacyStatus: privacyStatus
          }
        },
        auth: this.oauth2Client
      });

      console.log(`✅ Video ${videoId} privacy updated to: ${privacyStatus}`);
      return response.data;
    } catch (error) {
      console.error('❌ Error updating video privacy:', error.message);
      throw error;
    }
  }

  /**
   * Delete video from YouTube
   */
  async deleteVideo(videoId) {
    try {
      await this.youtube.videos.delete({
        id: videoId,
        auth: this.oauth2Client
      });

      console.log(`✅ Video ${videoId} deleted from YouTube`);
      return { success: true };
    } catch (error) {
      console.error('❌ Error deleting video:', error.message);
      throw error;
    }
  }

  /**
   * Check if YouTube API is properly configured
   */
  isConfigured() {
    return !!(
      process.env.YOUTUBE_CLIENT_ID &&
      process.env.YOUTUBE_CLIENT_SECRET &&
      this.oauth2Client
    );
  }

  /**
   * Get YouTube embed URL from video ID
   */
  static getEmbedUrl(videoId) {
    return `https://www.youtube.com/embed/${videoId}`;
  }

  /**
   * Extract video ID from YouTube URL
   */
  static extractVideoId(url) {
    const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
  }
}

module.exports = new YouTubeService();
