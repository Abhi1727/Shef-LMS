import React from 'react';
import './VideoCard.css';

const VideoCard = ({ 
  videoId, 
  title, 
  description, 
  category, 
  views, 
  duration, 
  publishDate,
  onClick,
  className = ''
}) => {
  const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  
  const formatViews = (viewCount) => {
    if (!viewCount) return 'No views';
    if (viewCount >= 1000000) {
      return `${(viewCount / 1000000).toFixed(1)}M views`;
    } else if (viewCount >= 1000) {
      return `${(viewCount / 1000).toFixed(1)}K views`;
    }
    return `${viewCount} views`;
  };

  const formatDuration = (durationStr) => {
    if (!durationStr) return 'Unknown';
    return durationStr;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  const handleClick = () => {
    if (onClick) {
      onClick({ videoId, title, description, category, views, duration, publishDate });
    } else {
      window.open(videoUrl, '_blank');
    }
  };

  return (
    <div className={`video-card ${className}`} onClick={handleClick} role="button" tabIndex={0}>
      <div className="video-thumbnail">
        <img 
          src={thumbnailUrl} 
          alt={`${title} thumbnail`}
          loading="lazy"
        />
        {duration && (
          <div className="duration-badge">
            {formatDuration(duration)}
          </div>
        )}
      </div>
      
      <div className="video-content">
        {category && (
          <div className="category-badge">
            {category}
          </div>
        )}
        
        <h3 className="video-title">{title}</h3>
        
        {description && (
          <p className="video-description">{description}</p>
        )}
        
        <div className="video-metadata">
          {views && (
            <span className="metadata-item">
              {formatViews(views)}
            </span>
          )}
          {publishDate && (
            <span className="metadata-item">
              {formatDate(publishDate)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoCard;
