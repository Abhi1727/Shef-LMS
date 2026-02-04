# YouTube Video Card Component

A fully functional, responsive YouTube video card component designed for the LMS platform.

## 📁 Files Created

- `VideoCard.js` - Main component
- `VideoCard.css` - Component styles
- `VideoCardExample.js` - Example implementation with mock data
- `VideoCardExample.css` - Example styles
- `VideoCardIntegration.js` - Integration helper and utilities
- `VideoCardIntegration.css` - Integration styles

## 🎯 Features

- **Responsive Design**: Adapts to list, grid, and compact layouts
- **YouTube Integration**: Auto-generates thumbnails from video IDs
- **Accessibility**: Keyboard navigation, semantic HTML, alt text
- **LMS Integration**: Follows existing design patterns and styling
- **Dark Mode**: Built-in dark mode support
- **Loading States**: Skeleton loading animations
- **Progress Tracking**: Visual indicators for completed videos

## 🚀 Quick Start

### Basic Usage

```jsx
import VideoCard from './components/VideoCard';

<VideoCard
  videoId="dQw4w9WgXcQ"
  title="Introduction to React"
  description="Learn React fundamentals"
  category="Frontend Development"
  views={1250000}
  duration="45:32"
  publishDate="2024-01-15"
  onClick={handleVideoClick}
/>
```

### Grid Layout

```jsx
import VideoCardGrid, { sampleYouTubeVideos } from './components/VideoCardIntegration';

<VideoCardGrid
  videos={sampleYouTubeVideos}
  onVideoSelect={handleVideoSelection}
  layout="grid"
/>
```

## 📱 Layout Options

### List Layout (Default)
- Horizontal card layout
- Thumbnail on left, content on right
- Ideal for course modules and search results

### Grid Layout
- Vertical card layout
- Responsive grid columns
- Best for video galleries and recommendations

### Compact Layout
- Smaller horizontal layout
- Reduced padding and font sizes
- Perfect for sidebars and tight spaces

## 🔧 Integration Points

### 1. Dashboard Integration
Add to `Dashboard.js` to show recommended videos:

```jsx
// In Dashboard.js component
import VideoCardGrid from './components/VideoCardIntegration';

const Dashboard = ({ user }) => {
  const [recommendedVideos, setRecommendedVideos] = useState([]);

  return (
    <div className="dashboard-section">
      <h2>Recommended Videos</h2>
      <VideoCardGrid
        videos={recommendedVideos}
        onVideoSelect={playVideoInModal}
        layout="grid"
      />
    </div>
  );
};
```

### 2. Course Module Integration
Add to course pages to show module videos:

```jsx
// In course component
import VideoCardGrid from './components/VideoCardIntegration';

const CourseModule = ({ moduleVideos, userProgress }) => {
  return (
    <div className="module-content">
      <VideoCardGrid
        videos={moduleVideos}
        onVideoSelect={handleVideoPlay}
        layout="list"
        showProgress={true}
        userProgress={userProgress}
      />
    </div>
  );
};
```

### 3. Search Results Integration
Add to search functionality:

```jsx
// In search component
import VideoCardGrid from './components/VideoCardIntegration';

const VideoSearchResults = ({ searchResults }) => {
  return (
    <div className="search-results">
      <VideoCardGrid
        videos={searchResults}
        onVideoSelect={navigateToVideo}
        layout="compact"
        loading={searching}
      />
    </div>
  );
};
```

## 🎨 Styling

The component uses CSS classes that integrate with the existing LMS design system:

- **Colors**: Matches LMS color palette (`#667eea`, `#764ba2`)
- **Typography**: Uses system fonts consistent with existing components
- **Spacing**: Follows LMS spacing patterns
- **Shadows**: Consistent with existing card components

### Custom CSS Variables

You can override styles using CSS variables:

```css
.video-card {
  --card-border-radius: 12px;
  --card-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  --primary-color: #667eea;
  --text-primary: #2d3748;
  --text-secondary: #718096;
}
```

## 📊 Data Structure

### Required Props

```jsx
{
  videoId: "dQw4w9WgXcQ",     // YouTube video ID
  title: "Video Title",       // Video title
  description: "Description", // Short description
  category: "Category",       // Category/subject
  views: 1250000,            // View count
  duration: "45:32",         // Video duration
  publishDate: "2024-01-15"  // Publish date
}
```

### Optional Props

```jsx
{
  onClick: (videoData) => {}, // Click handler
  className: "custom-class",   // Additional CSS classes
  loading: false,             // Loading state
  completed: false,           // Completion status
  progress: 75                // Watch progress percentage
}
```

## 🔌 YouTube API Integration

Use the helper functions to transform YouTube API responses:

```jsx
import { VideoCardHelpers } from './components/VideoCardIntegration';

// Transform YouTube API response
const videoData = VideoCardHelpers.transformYouTubeData(youtubeApiResponse);

// Format for specific LMS contexts
const courseVideo = VideoCardHelpers.formatForCourse(videoData, 'React Course', 'module-1');
const recommendedVideo = VideoCardHelpers.formatForRecommended(videoData, userProfile);
```

## ♿ Accessibility Features

- **Keyboard Navigation**: Tab and Enter key support
- **Screen Reader**: Proper ARIA labels and semantic HTML
- **Focus Management**: Visible focus indicators
- **Alt Text**: Descriptive alt text for thumbnails
- **Reduced Motion**: Respects user's motion preferences

## 🌙 Dark Mode

The component automatically adapts to system dark mode preferences. You can also manually control it:

```css
.video-card {
  /* Force dark mode */
  color-scheme: dark;
}

.video-card {
  /* Force light mode */
  color-scheme: light;
}
```

## 📱 Responsive Breakpoints

- **Desktop** (>1024px): Full grid layout
- **Tablet** (768px-1024px): Adjusted grid columns
- **Mobile** (<768px): Single column, vertical layout

## 🚀 Performance Optimizations

- **Lazy Loading**: Images load only when visible
- **Skeleton Screens**: Loading states for better UX
- **CSS Animations**: Hardware-accelerated transforms
- **Minimal Re-renders**: Optimized React component structure

## 🔧 Customization

### Custom Category Colors

```css
.video-card .category-badge[data-category="data-science"] {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.video-card .category-badge[data-category="web-development"] {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
}
```

### Custom Hover Effects

```css
.video-card.custom-hover:hover {
  transform: translateY(-4px) scale(1.02);
  box-shadow: 0 12px 30px rgba(102, 126, 234, 0.2);
}
```

## 📝 Example Implementation

See `VideoCardExample.js` for a complete working example with:
- Multiple layout demonstrations
- Modal video player integration
- Mock YouTube data
- Responsive design examples

Run the example by adding it to your App.js:

```jsx
import VideoCardExample from './components/VideoCardExample';

function App() {
  return (
    <div className="App">
      <VideoCardExample />
    </div>
  );
}
```

## 🐛 Troubleshooting

### Common Issues

1. **Thumbnails not loading**: Verify YouTube video ID is correct
2. **Layout breaking**: Check container width and responsive breakpoints
3. **Click not working**: Ensure onClick handler is properly bound
4. **Styles not applying**: Verify CSS import order and specificity

### Debug Mode

Enable debug mode for additional console logging:

```jsx
<VideoCard
  {...videoProps}
  debug={true}
/>
```

## 📈 Analytics Integration

Track video interactions:

```jsx
const handleVideoClick = (videoData) => {
  // Track analytics
  analytics.track('video_clicked', {
    videoId: videoData.videoId,
    title: videoData.title,
    category: videoData.category
  });
  
  // Handle video play
  playVideo(videoData);
};
```

## 🔄 Migration from Existing Components

To replace existing video components:

1. Import VideoCard component
2. Map existing data structure to VideoCard props
3. Update click handlers to use new component
4. Replace CSS classes with VideoCard classes
5. Test responsive behavior

## 📞 Support

For issues or questions:
1. Check the console for error messages
2. Verify all required props are provided
3. Ensure YouTube video IDs are valid
4. Test with different screen sizes
5. Check CSS import order
