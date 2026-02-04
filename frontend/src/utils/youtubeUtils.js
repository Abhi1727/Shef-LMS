// YouTube URL utilities for frontend
export class YouTubeUtils {
  /**
   * Extract video ID from YouTube URL
   */
  static extractVideoId(url) {
    if (!url) return null;
    
    const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
  }

  /**
   * Get YouTube embed URL from video ID
   */
  static getEmbedUrl(videoId) {
    return `https://www.youtube.com/embed/${videoId}`;
  }

  /**
   * Get YouTube thumbnail URL from video ID
   */
  static getThumbnailUrl(videoId, quality = 'mqdefault') {
    const qualityMap = {
      'default': 'default',
      'medium': 'mqdefault', 
      'high': 'hqdefault',
      'max': 'maxresdefault'
    };
    
    const selectedQuality = qualityMap[quality] || 'mqdefault';
    return `https://img.youtube.com/vi/${videoId}/${selectedQuality}.jpg`;
  }

  /**
   * Get YouTube video duration from video ID using YouTube API
   * Note: This requires API key, for now we'll return placeholder
   */
  static async getVideoDuration(videoId, apiKey = null) {
    if (!apiKey) {
      // Return placeholder duration when API key is not available
      return 'Duration not available';
    }
    
    try {
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=contentDetails&key=${apiKey}`
      );
      const data = await response.json();
      
      if (data.items && data.items.length > 0) {
        const duration = data.items[0].contentDetails.duration;
        // Convert ISO 8601 duration to readable format
        return this.formatDuration(duration);
      }
      
      return 'Duration not available';
    } catch (error) {
      console.error('Error fetching video duration:', error);
      return 'Duration not available';
    }
  }

  /**
   * Convert ISO 8601 duration to readable format
   */
  static formatDuration(isoDuration) {
    const match = isoDuration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    
    if (!match) return '0:00';
    
    const hours = parseInt(match[1]) || 0;
    const minutes = parseInt(match[2]) || 0;
    const seconds = parseInt(match[3]) || 0;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
  }

  /**
   * Convert YouTube watch URL to embed URL
   */
  static convertToEmbedUrl(watchUrl) {
    const videoId = this.extractVideoId(watchUrl);
    return videoId ? this.getEmbedUrl(videoId) : null;
  }

  /**
   * Validate YouTube URL
   */
  static isValidYouTubeUrl(url) {
    return this.extractVideoId(url) !== null;
  }
}
