import React from 'react';
import TimezoneClock from './TimezoneClock';
import './TimezoneClocks.css';

const TimezoneClocks = () => {
  const timezones = [
    { id: 'est', timezone: 'America/New_York', label: 'EST' },
    { id: 'pst', timezone: 'America/Los_Angeles', label: 'PST' },
    { id: 'ist', timezone: 'Asia/Kolkata', label: 'IST' },
    { id: 'cst', timezone: 'America/Chicago', label: 'CST' }
  ];

  return (
    <div className="timezone-clocks-container">
      <div className="clocks-wrapper">
        {timezones.map((tz) => (
          <TimezoneClock
            key={tz.id}
            timezone={tz.timezone}
            label={tz.label}
            showDate={true}
          />
        ))}
      </div>
    </div>
  );
};

export default TimezoneClocks;
