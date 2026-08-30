const { google } = require('googleapis');
const fs = require('fs');

function resolveYouTubeCredentials() {
  // Prefer explicit YOUTUBE_* ; fall back to the shared GCP OAuth client (Meet/Drive)
  const clientId =
    process.env.YOUTUBE_CLIENT_ID ||
    process.env.GOOGLE_MEET_CLIENT_ID ||
    process.env.GOOGLE_OAUTH_CLIENT_ID ||
    '';
  const clientSecret =
    process.env.YOUTUBE_CLIENT_SECRET ||
    process.env.GOOGLE_MEET_CLIENT_SECRET ||
    process.env.GOOGLE_OAUTH_CLIENT_SECRET ||
    '';
  const redirectUri =
    process.env.YOUTUBE_REDIRECT_URI ||
    process.env.GOOGLE_MEET_REDIRECT_URI ||
    process.env.GOOGLE_OAUTH_REDIRECT_URI ||
    'http://localhost:5000/auth/youtube/callback';
  // YouTube needs youtube.upload — Meet token alone is not enough unless re-consented
  const refreshToken =
    process.env.YOUTUBE_REFRESH_TOKEN ||
    process.env.GOOGLE_YOUTUBE_REFRESH_TOKEN ||
    '';
  return { clientId, clientSecret, redirectUri, refreshToken };
}

class YouTubeService {
  constructor() {
    this.youtube = google.youtube('v3');
    this.oauth2Client = null;
    this.creds = resolveYouTubeCredentials();
    this.initializeAuth();
  }

  /**
   * Initialize OAuth2 client with YouTube API credentials
   */
  initializeAuth() {
    try {
      this.creds = resolveYouTubeCredentials();
      if (!this.creds.clientId || !this.creds.clientSecret) {
        console.warn('⚠️ YouTube OAuth client id/secret missing (set YOUTUBE_* or GOOGLE_MEET_*)');
        return;
      }

      this.oauth2Client = new google.auth.OAuth2(
        this.creds.clientId,
        this.creds.clientSecret,
        this.creds.redirectUri
      );

      if (this.creds.refreshToken) {
        this.oauth2Client.setCredentials({
          refresh_token: this.creds.refreshToken
        });
      }

      console.log(
        this.creds.refreshToken
          ? '✅ YouTube OAuth2 client initialized (refresh token present)'
          : '⚠️ YouTube OAuth2 client ready — missing YOUTUBE_REFRESH_TOKEN (run setup-youtube-oauth.js)'
      );
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
      prompt: 'consent',
      login_hint: process.env.GOOGLE_MEET_HOST_EMAIL || process.env.YOUTUBE_UPLOAD_ACCOUNT || ''
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  async getTokens(code) {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      return tokens;
    } catch (error) {
      console.error('❌ Error getting YouTube tokens:', error.message);
      throw error;
    }
  }

  async ensureFreshCredentials() {
    if (!this.oauth2Client) {
      throw new Error('YouTube OAuth2 client not initialized');
    }
    const refresh =
      this.creds.refreshToken ||
      process.env.YOUTUBE_REFRESH_TOKEN ||
      process.env.GOOGLE_YOUTUBE_REFRESH_TOKEN;
    if (!refresh) {
      throw new Error(
        'YOUTUBE_REFRESH_TOKEN missing. Run: ENV_PATH=.env.dev node scripts/setup-youtube-oauth.js'
      );
    }
    this.oauth2Client.setCredentials({ refresh_token: refresh });
    const { credentials } = await this.oauth2Client.refreshAccessToken();
    this.oauth2Client.setCredentials({ ...credentials, refresh_token: refresh });
  }

  /**
   * Upload video to YouTube as unlisted (Classroom player)
   */
  async uploadVideo(videoPath, metadata) {
    try {
      if (!this.oauth2Client) {
        throw new Error('YouTube OAuth2 client not initialized');
      }
      if (!videoPath || !fs.existsSync(videoPath)) {
        throw new Error('Video file not found for YouTube upload');
      }

      await this.ensureFreshCredentials();

      const privacyStatus = String(
        metadata.privacyStatus || process.env.YOUTUBE_PRIVACY_STATUS || 'unlisted'
      ).toLowerCase();
      const allowed = ['private', 'unlisted', 'public'];
      const privacy = allowed.includes(privacyStatus) ? privacyStatus : 'unlisted';

      const youtubeMetadata = {
        snippet: {
          title: String(metadata.title || 'Untitled Video').slice(0, 100),
          description:
            metadata.description || `Educational video - ${metadata.courseType || 'Course'}`,
          tags: (metadata.tags || [
            'education',
            'sky-states-lms',
            metadata.courseType,
            metadata.instructor
          ]).filter(Boolean),
          categoryId: '27' // Education category
        },
        status: {
          privacyStatus: privacy,
          embeddable: true,
          license: 'youtube',
          selfDeclaredMadeForKids: false
        }
      };

      console.log('📹 Starting YouTube upload:', metadata.title);

      const response = await this.youtube.videos.insert({
        part: 'snippet,status',
        requestBody: youtubeMetadata,
        media: {
          body: fs.createReadStream(videoPath),
          mimeType: 'video/mp4'
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
        privacyStatus: privacy
      };
    } catch (error) {
      console.error('❌ Error uploading video to YouTube:', error.message);

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

  async getVideoDetails(videoId) {
    try {
      await this.ensureFreshCredentials();
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

  async updateVideoPrivacy(videoId, privacyStatus = 'unlisted') {
    try {
      await this.ensureFreshCredentials();
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

  async deleteVideo(videoId) {
    try {
      await this.ensureFreshCredentials();
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

  isConfigured() {
    this.creds = resolveYouTubeCredentials();
    return !!(this.creds.clientId && this.creds.clientSecret && this.creds.refreshToken && this.oauth2Client);
  }

  getCredentialSource() {
    this.creds = resolveYouTubeCredentials();
    return {
      clientFrom:
        process.env.YOUTUBE_CLIENT_ID
          ? 'YOUTUBE_CLIENT_ID'
          : process.env.GOOGLE_MEET_CLIENT_ID
            ? 'GOOGLE_MEET_CLIENT_ID'
            : 'none',
      hasRefreshToken: Boolean(this.creds.refreshToken),
      configured: this.isConfigured()
    };
  }

  static getEmbedUrl(videoId) {
    return `https://www.youtube.com/embed/${videoId}`;
  }

  static extractVideoId(url) {
    const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
  }
}

module.exports = new YouTubeService();
