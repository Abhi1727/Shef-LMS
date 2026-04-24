/**
 * Activity Data Processor for Login and Video Views Timeline
 * Filters and processes activity data for the timeline chart
 */

export const processActivityData = (activities, startDate = null, endDate = null) => {
  if (!activities || !Array.isArray(activities)) {
    return {
      chartData: [],
      summary: {
        totalLogins: 0,
        totalVideoViews: 0,
        mostActiveDay: null,
        uniqueLoginDays: 0
      }
    };
  }

  // Filter for login and video_view activities only
  const filteredActivities = activities.filter(activity => 
    activity.action === 'login' || activity.action === 'video_view'
  );

  // Apply date range filter if provided
  const dateFilteredActivities = filteredActivities.filter(activity => {
    if (!activity.timestamp) return false;
    
    const activityDate = new Date(activity.timestamp);
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
    
    if (start && activityDate < start) return false;
    if (end && activityDate > end) return false;
    
    return true;
  });

  // Group activities by date
  const groupedByDate = {};
  const loginDates = new Set();

  dateFilteredActivities.forEach(activity => {
    const date = new Date(activity.timestamp);
    const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    if (!groupedByDate[dateKey]) {
      groupedByDate[dateKey] = {
        date: dateKey,
        logins: 0,
        videoViews: 0,
        activities: []
      };
    }

    if (activity.action === 'login') {
      groupedByDate[dateKey].logins++;
      loginDates.add(dateKey);
    } else if (activity.action === 'video_view') {
      groupedByDate[dateKey].videoViews++;
    }

    groupedByDate[dateKey].activities.push(activity);
  });

  // Convert to chart data format and sort by date
  const chartData = Object.values(groupedByDate)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map(item => ({
      ...item,
      displayDate: new Date(item.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      })
    }));

  // Calculate summary statistics
  const summary = {
    totalLogins: dateFilteredActivities.filter(a => a.action === 'login').length,
    totalVideoViews: dateFilteredActivities.filter(a => a.action === 'video_view').length,
    uniqueLoginDays: loginDates.size,
    mostActiveDay: null
  };

  // Find most active day
  if (chartData.length > 0) {
    const mostActive = chartData.reduce((max, day) => {
      const totalActivity = day.logins + day.videoViews;
      const maxActivity = max.logins + max.videoViews;
      return totalActivity > maxActivity ? day : max;
    });
    summary.mostActiveDay = mostActive.displayDate;
  }

  return {
    chartData,
    summary,
    rawFilteredData: dateFilteredActivities
  };
};

export const getActivityTypeCounts = (activities) => {
  if (!activities || !Array.isArray(activities)) {
    return { logins: 0, videoViews: 0, total: 0 };
  }

  const counts = activities.reduce((acc, activity) => {
    if (activity.action === 'login') {
      acc.logins++;
    } else if (activity.action === 'video_view') {
      acc.videoViews++;
    }
    acc.total++;
    return acc;
  }, { logins: 0, videoViews: 0, total: 0 });

  return counts;
};

export const filterActivitiesByType = (activities, showLogins = true, showVideoViews = true) => {
  if (!activities || !Array.isArray(activities)) return [];
  
  return activities.filter(activity => {
    if (activity.action === 'login' && !showLogins) return false;
    if (activity.action === 'video_view' && !showVideoViews) return false;
    return true;
  });
};

export const exportToCSV = (activities, filename = 'activity-data.csv') => {
  if (!activities || activities.length === 0) {
    return;
  }

  const headers = ['Date', 'Time', 'Action', 'User', 'Email', 'Video Title', 'IP Address', 'Location'];
  const csvContent = [
    headers.join(','),
    ...activities.map(activity => {
      const date = new Date(activity.timestamp);
      return [
        date.toLocaleDateString(),
        date.toLocaleTimeString(),
        activity.action || '',
        activity.userName || '',
        activity.userEmail || '',
        activity.videoTitle || '',
        activity.ipAddress || '',
        activity.city && activity.country ? `${activity.city}, ${activity.country}` : ''
      ].map(field => `"${field}"`).join(',');
    })
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};
