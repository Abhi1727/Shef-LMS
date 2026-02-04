import React, { useState, useEffect } from 'react';
import './TimezoneClock.css';

const TimezoneClock = ({ timezone, label, showDate = true }) => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      timeZone: timezone,
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      timeZone: timezone,
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="timezone-clock">
      <div className="clock-label">{label}</div>
      <div className="clock-time">{formatTime(time)}</div>
      {showDate && (
        <div className="clock-date">{formatDate(time)}</div>
      )}
    </div>
  );
};

export default TimezoneClock;
