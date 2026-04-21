/**
 * React Hook for Data Freshness
 * Provides React hooks for consuming data freshness tracking
 */
import { useState, useEffect, useCallback } from 'react';
import dataFreshnessTracker from '../utils/dataFreshness';

/**
 * Hook for tracking data freshness
 * @param {string} key - The data tracker key
 * @returns {Object} Freshness data and controls
 */
export function useDataFreshness(key) {
  const [freshnessData, setFreshnessData] = useState(() => 
    dataFreshnessTracker.getFreshnessData(key)
  );

  // Update freshness data periodically
  useEffect(() => {
    const updateStatus = () => {
      setFreshnessData(dataFreshnessTracker.getFreshnessData(key));
    };

    // Initial status
    updateStatus();

    // Update status every second
    const interval = setInterval(updateStatus, 1000);

    return () => clearInterval(interval);
  }, [key]);

  // Refresh data
  const refresh = useCallback(async () => {
    return dataFreshnessTracker.refreshDataForHook(key);
  }, [key]);

  return {
    ...freshnessData,
    refresh
  };
}

/**
 * Hook for multiple data freshness trackers
 * @param {string[]} keys - Array of data tracker keys
 * @returns {Object} All freshness data and controls
 */
export function useMultipleDataFreshness(keys) {
  const [freshnessData, setFreshnessData] = useState(() => {
    const data = {};
    keys.forEach(key => {
      data[key] = dataFreshnessTracker.getFreshnessData(key);
    });
    return data;
  });

  // Update freshness data periodically
  useEffect(() => {
    const updateStatus = () => {
      const data = {};
      keys.forEach(key => {
        data[key] = dataFreshnessTracker.getFreshnessData(key);
      });
      setFreshnessData(data);
    };

    // Initial status
    updateStatus();

    // Update status every second
    const interval = setInterval(updateStatus, 1000);

    return () => clearInterval(interval);
  }, [keys]);

  // Refresh all data
  const refreshAll = useCallback(async () => {
    const promises = keys.map(key => 
      dataFreshnessTracker.refreshDataForHook(key)
    );
    return Promise.allSettled(promises);
  }, [keys]);

  // Refresh specific data
  const refresh = useCallback(async (key) => {
    return dataFreshnessTracker.refreshDataForHook(key);
  }, []);

  // Check if any data is stale
  const hasStaleData = Object.values(freshnessData).some(data => data.isStale);

  return {
    freshnessData,
    refreshAll,
    refresh,
    hasStaleData
  };
}

/**
 * Hook for global freshness status
 * @returns {Object} Global freshness information
 */
export function useGlobalFreshness() {
  const [globalStatus, setGlobalStatus] = useState(() => 
    dataFreshnessTracker.getFreshnessStatus()
  );

  // Update global status periodically
  useEffect(() => {
    const updateStatus = () => {
      setGlobalStatus(dataFreshnessTracker.getFreshnessStatus());
    };

    // Initial status
    updateStatus();

    // Update status every 5 seconds
    const interval = setInterval(updateStatus, 5000);

    return () => clearInterval(interval);
  }, []);

  // Refresh all stale data
  const refreshAllStale = useCallback(async () => {
    return dataFreshnessTracker.refreshAllStale();
  }, []);

  // Count stale trackers
  const staleCount = Object.values(globalStatus).filter(status => status.isStale).length;
  const totalCount = Object.keys(globalStatus).length;

  return {
    globalStatus,
    refreshAllStale,
    staleCount,
    totalCount,
    hasStaleData: staleCount > 0
  };
}

const hooks = {
  useDataFreshness,
  useMultipleDataFreshness,
  useGlobalFreshness
};

export default hooks;
