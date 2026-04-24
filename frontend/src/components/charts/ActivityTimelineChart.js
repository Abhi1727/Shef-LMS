import React, { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Bar,
  BarChart
} from 'recharts';
import './ActivityTimelineChart.css';

const ActivityTimelineChart = ({
  data = [],
  showLogins = true,
  showVideoViews = true,
  onDateRangeChange,
  summary = {}
}) => {
  const [hoveredPoint, setHoveredPoint] = useState(null);

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="custom-tooltip bar-tooltip">
          <div className="tooltip-header">
            <strong>{data.displayDate}</strong>
          </div>
          <div className="tooltip-content">
            {showLogins && (
              <div className="tooltip-item">
                <div className="tooltip-indicator login"></div>
                <span className="tooltip-label">Logins:</span>
                <span className="tooltip-value login">{data.logins}</span>
              </div>
            )}
            {showVideoViews && (
              <div className="tooltip-item">
                <div className="tooltip-indicator video"></div>
                <span className="tooltip-label">Video Views:</span>
                <span className="tooltip-value video">{data.videoViews}</span>
              </div>
            )}
            <div className="tooltip-total">
              <span className="tooltip-label">Total:</span>
              <span className="tooltip-value">{data.logins + data.videoViews}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  // Process data for chart display
  const chartData = useMemo(() => {
    return data.map(item => ({
      ...item,
      total: item.logins + item.videoViews
    }));
  }, [data]);

  if (!data || data.length === 0) {
    return (
      <div className="no-data-container">
        <div className="no-data-message">
          <div className="no-data-icon">📊</div>
          <h3>No Activity Data</h3>
          <p>No login or video view activity found in the selected time period.</p>
          <small>Try adjusting the date range or filters.</small>
        </div>
      </div>
    );
  }

  return (
    <div className="activity-timeline-chart">
      {/* Summary Cards */}
      <div className="chart-summary">
        <div className="summary-card">
          <div className="summary-icon">👤</div>
          <div className="summary-content">
            <div className="summary-label">Total Logins</div>
            <div className="summary-value login">{summary.totalLogins || 0}</div>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon">🎥</div>
          <div className="summary-content">
            <div className="summary-label">Video Views</div>
            <div className="summary-value video">{summary.totalVideoViews || 0}</div>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon">📅</div>
          <div className="summary-content">
            <div className="summary-label">Active Days</div>
            <div className="summary-value days">{summary.uniqueLoginDays || 0}</div>
          </div>
        </div>
        {summary.mostActiveDay && (
          <div className="summary-card">
            <div className="summary-icon">⭐</div>
            <div className="summary-content">
              <div className="summary-label">Most Active</div>
              <div className="summary-value active">{summary.mostActiveDay}</div>
            </div>
          </div>
        )}
      </div>

      {/* Chart Container */}
      <div className="chart-container">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={chartData}
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis 
              dataKey="displayDate" 
              stroke="#6B7280"
              fontSize={12}
              tickLine={false}
            />
            <YAxis 
              stroke="#6B7280"
              fontSize={12}
              tickLine={false}
            />
            
            <Tooltip content={<CustomTooltip />} />
            
            {showLogins && (
              <Bar
                dataKey="logins"
                fill="#3B82F6"
                name="Logins"
                radius={[4, 4, 0, 0]}
              />
            )}
            
            {showVideoViews && (
              <Bar
                dataKey="videoViews"
                fill="#10B981"
                name="Video Views"
                radius={[4, 4, 0, 0]}
              />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="chart-legend">
        {showLogins && (
          <div className="legend-item">
            <div className="legend-color login"></div>
            <span>Logins</span>
          </div>
        )}
        {showVideoViews && (
          <div className="legend-item">
            <div className="legend-color video"></div>
            <span>Video Views</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityTimelineChart;
