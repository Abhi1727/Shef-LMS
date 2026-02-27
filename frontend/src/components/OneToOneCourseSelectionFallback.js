import React from 'react';
import './OneToOneCourseSelection.css';

/**
 * Shown when One-to-One batch API is unavailable or errors.
 * Lets admins know the feature is temporarily unavailable.
 */
const OneToOneCourseSelectionFallback = () => (
  <div className="one-to-one-course-selection" style={{ padding: '2rem', textAlign: 'center' }}>
    <h2>One-to-One Batches</h2>
    <p style={{ color: '#666', marginTop: '1rem' }}>
      This section is temporarily unavailable. Please try again later or contact support.
    </p>
  </div>
);

export default OneToOneCourseSelectionFallback;
