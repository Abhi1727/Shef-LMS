import React from 'react';
import './OneToOneCourseSelection.css';

/**
 * Shown when One-to-One batch API is unavailable or errors.
 * Lets admins know the feature is temporarily unavailable.
 */
const OneToOneCourseSelectionFallback = ({ onRetry, errorMessage }) => (
  <div className="one-to-one-course-selection" style={{ padding: '2rem', textAlign: 'center' }}>
    <h2>One-to-One Batches</h2>
    <p style={{ color: '#666', marginTop: '1rem' }}>
      {errorMessage || 'This section is temporarily unavailable. Please try again later or contact support.'}
    </p>
    {onRetry && (
      <button
        className="btn-primary"
        onClick={onRetry}
        style={{ marginTop: '1rem', padding: '10px 24px', cursor: 'pointer' }}
      >
        Try Again
      </button>
    )}
  </div>
);

export default OneToOneCourseSelectionFallback;
