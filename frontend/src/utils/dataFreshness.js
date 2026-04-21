/**
 * Data Freshness Tracking Utilities
 * Tracks data age and provides automatic refetch for stale data
 */
import enhancedApiService from './enhancedApiService.js';

class DataFreshnessTracker {
  constructor() {
    this.dataTrackers = new Map();
    this.refreshIntervals = new Map();
    this.isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    // Default refresh intervals (shorter in development)
    this.defaultIntervals = {
      dashboard: this.isDevelopment ? 30 * 1000 : 60 * 1000,     // 30s dev, 60s prod
      activity: this.isDevelopment ? 30 * 1000 : 60 * 1000,     // 30s dev, 60s prod
      courses: this.isDevelopment ? 2 * 60 * 1000 : 5 * 60 * 1000,  // 2m dev, 5m prod
      batches: this.isDevelopment ? 30 * 1000 : 2 * 60 * 1000,  // 30s dev, 2m prod
      students: this.isDevelopment ? 30 * 1000 : 2 * 60 * 1000, // 30s dev, 2m prod
      default: this.isDevelopment ? 60 * 1000 : 5 * 60 * 1000    // 1m dev, 5m prod
    };
  }

  /**
   * Register a data tracker
   */
  registerTracker(key, config) {
    const tracker = {
      key,
      url: config.url,
      interval: config.interval || this.defaultIntervals[config.type] || this.defaultIntervals.default,
      type: config.type || 'default',
      lastFetch: null,
      isStale: true,
      refetchCallback: config.refetchCallback,
      staleCallback: config.staleCallback,
      freshCallback: config.freshCallback,
      autoRefresh: config.autoRefresh !== false,
      enabled: config.enabled !== false
    };

    this.dataTrackers.set(key, tracker);
    
    if (tracker.autoRefresh && tracker.enabled) {
      this.startAutoRefresh(key);
    }

    return tracker;
  }

  /**
   * Start automatic refresh for a tracker
   */
  startAutoRefresh(key) {
    const tracker = this.dataTrackers.get(key);
    if (!tracker || this.refreshIntervals.has(key)) return;

    const interval = setInterval(() => {
      this.refreshData(key);
    }, tracker.interval);

    this.refreshIntervals.set(key, interval);
  }

  /**
   * Stop automatic refresh for a tracker
   */
  stopAutoRefresh(key) {
    const interval = this.refreshIntervals.get(key);
    if (interval) {
      clearInterval(interval);
      this.refreshIntervals.delete(key);
    }
  }

  /**
   * Refresh data for a specific tracker
   */
  async refreshData(key) {
    const tracker = this.dataTrackers.get(key);
    if (!tracker || !tracker.enabled) return;

    try {
      console.log(`Refreshing data for ${key}`);
      
      if (tracker.refetchCallback) {
        await tracker.refetchCallback();
      } else {
        // Default fetch using enhanced API service
        await enhancedApiService.fetchWithRetry(tracker.url);
      }

      tracker.lastFetch = Date.now();
      tracker.isStale = false;

      if (tracker.freshCallback) {
        tracker.freshCallback();
      }

    } catch (error) {
      console.error(`Failed to refresh data for ${key}:`, error);
      tracker.isStale = true;

      if (tracker.staleCallback) {
        tracker.staleCallback(error);
      }
    }
  }

  /**
   * Mark data as fresh
   */
  markAsFresh(key) {
    const tracker = this.dataTrackers.get(key);
    if (tracker) {
      tracker.lastFetch = Date.now();
      tracker.isStale = false;
    }
  }

  /**
   * Mark data as stale
   */
  markAsStale(key) {
    const tracker = this.dataTrackers.get(key);
    if (tracker) {
      tracker.isStale = true;
    }
  }

  /**
   * Check if data is stale
   */
  isDataStale(key) {
    const tracker = this.dataTrackers.get(key);
    if (!tracker) return true;

    if (!tracker.lastFetch) return true;

    const age = Date.now() - tracker.lastFetch;
    return age > tracker.interval;
  }

  /**
   * Get data age
   */
  getDataAge(key) {
    const tracker = this.dataTrackers.get(key);
    if (!tracker || !tracker.lastFetch) return null;
    return Date.now() - tracker.lastFetch;
  }

  /**
   * Format data age for display
   */
  formatDataAge(age) {
    if (!age) return 'Never';
    
    const seconds = Math.floor(age / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ago`;
    } else if (minutes > 0) {
      return `${minutes}m ago`;
    } else {
      return `${seconds}s ago`;
    }
  }

  /**
   * Get freshness status for all trackers
   */
  getFreshnessStatus() {
    const status = {};
    for (const [key, tracker] of this.dataTrackers.entries()) {
      status[key] = {
        isStale: tracker.isStale,
        lastFetch: tracker.lastFetch,
        age: this.getDataAge(key),
        formattedAge: this.formatDataAge(this.getDataAge(key)),
        interval: tracker.interval,
        type: tracker.type,
        enabled: tracker.enabled
      };
    }
    return status;
  }

  /**
   * Refresh all stale data
   */
  async refreshAllStale() {
    const staleKeys = [];
    for (const [key, tracker] of this.dataTrackers.entries()) {
      if (tracker.enabled && this.isDataStale(key)) {
        staleKeys.push(key);
      }
    }

    const promises = staleKeys.map(key => this.refreshData(key));
    await Promise.allSettled(promises);

    return {
      refreshed: staleKeys.length,
      total: this.dataTrackers.size
    };
  }

  /**
   * Enable/disable tracker
   */
  setTrackerEnabled(key, enabled) {
    const tracker = this.dataTrackers.get(key);
    if (!tracker) return;

    tracker.enabled = enabled;

    if (enabled && tracker.autoRefresh) {
      this.startAutoRefresh(key);
    } else {
      this.stopAutoRefresh(key);
    }
  }

  /**
   * Remove tracker
   */
  removeTracker(key) {
    this.stopAutoRefresh(key);
    this.dataTrackers.delete(key);
  }

  /**
   * Clear all trackers
   */
  clearAll() {
    for (const key of this.refreshIntervals.keys()) {
      this.stopAutoRefresh(key);
    }
    this.dataTrackers.clear();
  }

  /**
   * Setup automatic stale data detection
   */
  setupAutoStaleDetection() {
    // Check for stale data every 30 seconds
    setInterval(() => {
      for (const [key, tracker] of this.dataTrackers.entries()) {
        if (tracker.enabled && this.isDataStale(key) && !tracker.isStale) {
          tracker.isStale = true;
          if (tracker.staleCallback) {
            tracker.staleCallback(new Error('Data became stale'));
          }
        }
      }
    }, 30 * 1000);
  }

  /**
   * Get freshness data for React hook consumption
   */
  getFreshnessData(key) {
    const tracker = this.dataTrackers.get(key);
    if (!tracker) {
      return {
        isStale: true,
        lastUpdate: null,
        age: null,
        formattedAge: 'Never'
      };
    }

    return {
      isStale: this.isDataStale(key),
      lastUpdate: tracker.lastFetch,
      age: this.getDataAge(key),
      formattedAge: this.formatDataAge(this.getDataAge(key))
    };
  }

  /**
   * Refresh data for React hook consumption
   */
  async refreshDataForHook(key) {
    return this.refreshData(key);
  }
}

// Create singleton instance
const dataFreshnessTracker = new DataFreshnessTracker();
dataFreshnessTracker.setupAutoStaleDetection();

export default dataFreshnessTracker;
