import React, { useState } from 'react';
import VideoCard from './VideoCard';
import './VideoCardExample.css';

const VideoCardExample = () => {
  const [selectedVideo, setSelectedVideo] = useState(null);

  const mockYouTubeVideos = [
    {
      videoId: 'dQw4w9WgXcQ',
      title: 'Introduction to Data Science: Complete Course for Beginners',
      description: 'Learn the fundamentals of data science including statistics, programming, and machine learning basics.',
      category: 'Data Science',
      views: 1250000,
      duration: '45:32',
      publishDate: '2024-01-15'
    },
    {
      videoId: 'jNQXAC9IVRw',
      title: 'Web Development Bootcamp 2024 - Full Stack Course',
      description: 'Master HTML, CSS, JavaScript, React, Node.js and more in this comprehensive web development course.',
      category: 'Web Development',
      views: 890000,
      duration: '1:23:15',
      publishDate: '2024-02-01'
    },
    {
      videoId: '9bZkp7q19f0',
      title: 'Machine Learning A-Z: Hands-On Python & R',
      description: 'Complete guide to machine learning with practical examples in Python and R programming languages.',
      category: 'Machine Learning',
      views: 2100000,
      duration: '2:15:45',
      publishDate: '2023-12-20'
    },
    {
      videoId: 'hT_nvWreIhg',
      title: 'Python for Data Science - Complete Tutorial',
      description: 'Learn Python programming specifically for data science applications including pandas, numpy, and matplotlib.',
      category: 'Programming',
      views: 567000,
      duration: '38:20',
      publishDate: '2024-01-28'
    },
    {
      videoId: 'fJ9rUzIMcZQ',
      title: 'React.js Complete Guide - Build Modern Web Apps',
      description: 'Master React.js from scratch including hooks, context API, Redux, and modern development practices.',
      category: 'Frontend Development',
      views: 1450000,
      duration: '1:45:30',
      publishDate: '2024-01-10'
    },
    {
      videoId: 'rfscVS0vtbw',
      title: 'Cloud Computing Fundamentals - AWS, Azure & GCP',
      description: 'Understanding cloud computing concepts and major platforms including Amazon Web Services, Azure, and Google Cloud.',
      category: 'Cloud Computing',
      views: 432000,
      duration: '52:18',
      publishDate: '2024-02-05'
    }
  ];

  const handleVideoClick = (videoData) => {
    setSelectedVideo(videoData);
    console.log('Video clicked:', videoData);
    // Here you could open a modal, navigate to a video player, or integrate with existing LMS video player
  };

  const closeModal = () => {
    setSelectedVideo(null);
  };

  return (
    <div className="video-card-example">
      <div className="example-header">
        <h1>YouTube Video Cards Example</h1>
        <p>Demonstration of the VideoCard component with different layouts</p>
      </div>

      {/* Standard List Layout */}
      <section className="example-section">
        <h2>List Layout</h2>
        <div className="video-list">
          {mockYouTubeVideos.slice(0, 3).map((video, index) => (
            <VideoCard
              key={`list-${index}`}
              {...video}
              onClick={handleVideoClick}
            />
          ))}
        </div>
      </section>

      {/* Grid Layout */}
      <section className="example-section">
        <h2>Grid Layout</h2>
        <div className="video-card-grid">
          {mockYouTubeVideos.slice(3, 6).map((video, index) => (
            <VideoCard
              key={`grid-${index}`}
              {...video}
              onClick={handleVideoClick}
            />
          ))}
        </div>
      </section>

      {/* Compact Layout */}
      <section className="example-section">
        <h2>Compact Layout</h2>
        <div className="video-list">
          {mockYouTubeVideos.slice(0, 2).map((video, index) => (
            <VideoCard
              key={`compact-${index}`}
              {...video}
              onClick={handleVideoClick}
              className="video-card-compact"
            />
          ))}
        </div>
      </section>

      {/* Modal for selected video */}
      {selectedVideo && (
        <div className="video-modal-overlay" onClick={closeModal}>
          <div className="video-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{selectedVideo.title}</h3>
              <button className="close-button" onClick={closeModal}>×</button>
            </div>
            <div className="modal-content">
              <div className="modal-video">
                <iframe
                  width="100%"
                  height="315"
                  src={`https://www.youtube.com/embed/${selectedVideo.videoId}`}
                  title={selectedVideo.title}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
              <div className="modal-info">
                <span className="category-badge">{selectedVideo.category}</span>
                <p>{selectedVideo.description}</p>
                <div className="modal-metadata">
                  <span>{selectedVideo.views?.toLocaleString()} views</span>
                  <span>•</span>
                  <span>{selectedVideo.duration}</span>
                  <span>•</span>
                  <span>{new Date(selectedVideo.publishDate).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoCardExample;
