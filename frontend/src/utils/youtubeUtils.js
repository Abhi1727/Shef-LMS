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
