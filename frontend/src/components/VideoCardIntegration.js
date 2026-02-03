import React from 'react';
import VideoCard from './VideoCard';

/**
 * VideoCard Integration Component for LMS
 * 
 * This component demonstrates how to integrate the VideoCard component
 * into existing LMS pages like Dashboard, Course pages, or Learning Modules.
 * 
 * Usage Examples:
 * 
 * 1. In Dashboard.js - Show recommended videos:
 * <VideoCardGrid 
 *   videos={recommendedVideos}
 *   onVideoSelect={handleVideoSelection}
 *   layout="grid"
 * />
 * 
 * 2. In Course Module - Show module videos:
 * <VideoCardGrid 
 *   videos={moduleVideos}
 *   onVideoSelect={playVideoInModal}
 *   layout="list"
 *   showProgress={true}
 * />
 * 
 * 3. In Search Results - Display video search results:
 * <VideoCardGrid 
 *   videos={searchResults}
 *   onVideoSelect={navigateToVideo}
 *   layout="compact"
 * />
 */

const VideoCardGrid = ({ 
  videos = [], 
  onVideoSelect, 
  layout = 'grid',
  showProgress = false,
  userProgress = {},
  className = '',
  loading = false
}) => {
  if (loading) {
    return (
      <div className={`video-card-grid-loading ${className}`}>
        {[...Array(6)].map((_, index) => (
          <div key={`skeleton-${index}`} className="video-card-skeleton">
            <div className="skeleton-thumbnail"></div>
            <div className="skeleton-content">
              <div className="skeleton-category"></div>
              <div className="skeleton-title"></div>
              <div className="skeleton-description"></div>
              <div className="skeleton-metadata"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className={`video-card-empty ${className}`}>
        <div className="empty-state">
          <div className="empty-icon">📹</div>
          <h3>No videos available</h3>
          <p>Check back later for new learning content.</p>
        </div>
      </div>
    );
  }

  const gridClassName = layout === 'grid' ? 'video-card-grid' : 'video-list';
  const compactClassName = layout === 'compact' ? 'video-card-compact' : '';

  return (
    <div className={`video-card-container ${gridClassName} ${className}`}>
      {videos.map((video, index) => {
        const isCompleted = userProgress[video.videoId]?.completed || false;
        const watchTime = userProgress[video.videoId]?.watchTime || 0;
        
        return (
          <VideoCard
            key={`${video.videoId || index}-${video.title}`}
            videoId={video.videoId}
            title={video.title}
            description={video.description}
            category={video.category}
            views={video.views}
            duration={video.duration}
            publishDate={video.publishDate}
            onClick={() => onVideoSelect && onVideoSelect(video)}
            className={`${compactClassName} ${isCompleted ? 'completed' : ''}`}
          />
        );
      })}
    </div>
  );
};

// Sample data structure for YouTube videos in LMS
export const sampleYouTubeVideos = [
  {
    videoId: 'dQw4w9WgXcQ',
    title: 'Introduction to React Hooks',
    description: 'Learn the fundamentals of React Hooks including useState, useEffect, and custom hooks.',
    category: 'Frontend Development',
    views: 1250000,
    duration: '45:32',
    publishDate: '2024-01-15',
    difficulty: 'Beginner',
    tags: ['react', 'javascript', 'hooks', 'frontend']
  },
  {
    videoId: 'jNQXAC9IVRw',
    title: 'Node.js Backend Development',
    description: 'Build scalable backend applications with Node.js, Express, and MongoDB.',
    category: 'Backend Development',
    views: 890000,
    duration: '1:23:15',
    publishDate: '2024-02-01',
    difficulty: 'Intermediate',
    tags: ['nodejs', 'express', 'mongodb', 'backend']
  },
  {
    videoId: '9bZkp7q19f0',
    title: 'Python for Data Science',
    description: 'Master Python programming for data analysis, visualization, and machine learning.',
    category: 'Data Science',
    views: 2100000,
    duration: '2:15:45',
    publishDate: '2023-12-20',
    difficulty: 'Beginner',
    tags: ['python', 'data-science', 'pandas', 'numpy']
  }
];

// Integration helper functions
export const VideoCardHelpers = {
  // Transform YouTube API response to VideoCard props
  transformYouTubeData: (youtubeData) => ({
    videoId: youtubeData.id?.videoId || youtubeData.videoId,
    title: youtubeData.snippet?.title || youtubeData.title,
    description: youtubeData.snippet?.description || youtubeData.description,
    category: youtubeData.category || 'General',
    views: parseInt(youtubeData.statistics?.viewCount) || youtubeData.views || 0,
    duration: youtubeData.contentDetails?.duration || youtubeData.duration,
    publishDate: youtubeData.snippet?.publishedAt || youtubeData.publishDate
  }),

  // Format video data for different LMS contexts
  formatForCourse: (video, courseName, moduleId) => ({
    ...video,
    courseName,
    moduleId,
    type: 'course-video',
    required: true
  }),

  formatForRecommended: (video, userProfile) => ({
    ...video,
    type: 'recommended',
    recommendationScore: VideoCardHelpers.calculateRecommendationScore(video, userProfile)
  }),

  // Simple recommendation algorithm based on user profile
  calculateRecommendationScore: (video, userProfile) => {
    let score = 0;
    
    // Boost score for videos in user's interested categories
    if (userProfile?.interests?.includes(video.category)) {
      score += 30;
    }
    
    // Boost score for videos matching user's skill level
    if (userProfile?.skillLevel === video.difficulty) {
      score += 20;
    }
    
    // Boost score for videos with matching tags
    const matchingTags = video.tags?.filter(tag => 
      userProfile?.interests?.includes(tag)
    ).length || 0;
    score += matchingTags * 10;
    
    // Boost score for recent videos
    const daysSincePublished = (new Date() - new Date(video.publishDate)) / (1000 * 60 * 60 * 24);
    if (daysSincePublished < 30) score += 15;
    
    return score;
  }
};

export default VideoCardGrid;
