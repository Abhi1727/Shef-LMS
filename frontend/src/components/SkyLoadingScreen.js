import React from 'react';
import './SkyLoadingScreen.css';

/**
 * Sky States branded full-screen loading state.
 * @param {{ message?: string; subtext?: string; compact?: boolean }} props
 */
function SkyLoadingScreen({
  message = 'Loading',
  subtext = 'Preparing your Sky States workspace',
  compact = false,
}) {
  return (
    <div
      className={`sky-load ${compact ? 'sky-load--compact' : ''}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="sky-load__atmosphere" aria-hidden="true" />
      <div className="sky-load__panel">
        <div className="sky-load__brand">
          <span className="sky-load__mark" aria-hidden="true">
            <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M8 34c8-2 14-8 18-16 3 7 8 12 16 16"
                stroke="currentColor"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M12 38c7-1.5 12-6 15-12 2.5 5.5 7 10 13 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                opacity="0.45"
              />
            </svg>
          </span>
          <div className="sky-load__wordmark">
            <span className="sky-load__sky">SKY</span>
            <span className="sky-load__states">STATES</span>
          </div>
        </div>

        <div className="sky-load__spinner" aria-hidden="true">
          <span className="sky-load__ring sky-load__ring--outer" />
          <span className="sky-load__ring sky-load__ring--inner" />
        </div>

        <p className="sky-load__message">{message}</p>
        {subtext ? <p className="sky-load__subtext">{subtext}</p> : null}

        <div className="sky-load__bar" aria-hidden="true">
          <span className="sky-load__bar-fill" />
        </div>
      </div>
    </div>
  );
}

export default SkyLoadingScreen;
