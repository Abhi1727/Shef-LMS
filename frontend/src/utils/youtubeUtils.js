// YouTube URL utilities for frontend — in-LMS embed (students never need youtube.com)
export class YouTubeUtils {
  /**
   * Extract video ID from a raw ID or any common YouTube URL
   */
  static extractVideoId(url) {
    if (!url) return null;
    const value = String(url).trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(value)) return value;

    const match = value.match(
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube-nocookie\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/
    );
    return match ? match[1] : null;
  }

  /**
   * Privacy-friendly embed URL for the LMS player (not a watch page).
   */
  static getEmbedUrl(videoId, extraParams = {}) {
    const id = this.extractVideoId(videoId);
    if (!id) return null;
    const params = new URLSearchParams({
      rel: '0',
      modestbranding: '1',
      playsinline: '1',
      enablejsapi: '1',
      iv_load_policy: '3',
      fs: '0',
      ...extraParams
    });
    if (typeof window !== 'undefined' && window.location?.origin) {
      params.set('origin', window.location.origin);
    }
    return `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`;
  }

  /**
   * True when a lecture object has a playable YouTube id (prefer over Drive).
   */
  static hasYouTube(lecture) {
    if (!lecture) return false;
    return Boolean(
      this.extractVideoId(lecture.youtubeVideoId) ||
        this.extractVideoId(lecture.youtubeEmbedUrl) ||
        this.extractVideoId(lecture.youtubeVideoUrl) ||
        this.extractVideoId(lecture.videoUrl) ||
        this.extractVideoId(lecture.zoomUrl)
    );
  }

  /**
   * Resolve best in-LMS source label when Drive + YouTube both exist.
   */
  static preferSource(lecture) {
    if (this.hasYouTube(lecture)) return 'youtube-url';
    if (lecture?.driveId || lecture?.videoSource === 'drive') return 'drive';
    if (lecture?.videoSource === 'meet-session' || lecture?.videoSource === 'pending') {
      return lecture.videoSource;
    }
    return lecture?.videoSource || 'unknown';
  }

  static getThumbnailUrl(videoId, quality = 'mqdefault') {
    const id = this.extractVideoId(videoId);
    if (!id) return '';
    const qualityMap = {
      default: 'default',
      medium: 'mqdefault',
      high: 'hqdefault',
      max: 'maxresdefault'
    };
    const selectedQuality = qualityMap[quality] || 'mqdefault';
    return `https://img.youtube.com/vi/${id}/${selectedQuality}.jpg`;
  }

  static async getVideoDuration(videoId, apiKey = null) {
    if (!apiKey) return 'Duration not available';
    try {
      const id = this.extractVideoId(videoId);
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?id=${id}&part=contentDetails&key=${apiKey}`
      );
      const data = await response.json();
      if (data.items && data.items.length > 0) {
        return this.formatDuration(data.items[0].contentDetails.duration);
      }
      return 'Duration not available';
    } catch (error) {
      console.error('Error fetching video duration:', error);
      return 'Duration not available';
    }
  }

  static formatDuration(isoDuration) {
    const match = isoDuration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    if (!match) return '0:00';
    const hours = parseInt(match[1], 10) || 0;
    const minutes = parseInt(match[2], 10) || 0;
    const seconds = parseInt(match[3], 10) || 0;
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  static convertToEmbedUrl(watchUrl) {
    const videoId = this.extractVideoId(watchUrl);
    return videoId ? this.getEmbedUrl(videoId) : null;
  }

  static isValidYouTubeUrl(url) {
    return this.extractVideoId(url) !== null;
  }
}
