/**
 * Cache Manager Component
 * Integrates all caching utilities and provides user interface for cache control
 */
import React, { useState, useEffect } from 'react';
import cacheManager from '../utils/cacheManager';
import enhancedApiService from '../utils/enhancedApiService';
import dataFreshnessTracker from '../utils/dataFreshness';
import assetVersioning from '../utils/assetVersioning';

const CacheManager = ({ showDebug = false }) => {
  const [cacheInfo, setCacheInfo] = useState({});
  const [freshnessStatus, setFreshnessStatus] = useState({});
  const [apiStats, setApiStats] = useState({});
  const [isClearing, setIsClearing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);

  // Update cache information periodically
  useEffect(() => {
    const updateInfo = () => {
      setCacheInfo(assetVersioning.getCacheInfo());
      setFreshnessStatus(dataFreshnessTracker.getFreshnessStatus());
      setApiStats(enhancedApiService.getStats());
      setLastRefresh(new Date().toLocaleTimeString());
    };

    updateInfo();
    const interval = setInterval(updateInfo, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  // Handle cache clearing
  const handleClearAllCaches = async () => {
    setIsClearing(true);
    try {
      await cacheManager.clearAllCaches();
      enhancedApiService.clearCache();
      assetVersioning.clearCache();
      dataFreshnessTracker.clearAll();
      console.log('All caches cleared successfully');
    } catch (error) {
      console.error('Failed to clear caches:', error);
    } finally {
      setIsClearing(false);
    }
  };

  // Handle force refresh
  const handleForceRefresh = () => {
    cacheManager.forceRefresh();
  };

  // Refresh stale data
  const handleRefreshStale = async () => {
    try {
      const result = await dataFreshnessTracker.refreshAllStale();
      console.log(`Refreshed ${result.refreshed} of ${result.total} data sources`);
    } catch (error) {
      console.error('Failed to refresh stale data:', error);
    }
  };

  // Format age for display
  const formatAge = (age) => {
    if (!age) return 'Never';
    const seconds = Math.floor(age / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  // Don't render in production unless explicitly requested
  if (process.env.NODE_ENV === 'production' && !showDebug) {
    return null;
  }

  return (
    <div className="cache-manager" style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      background: 'rgba(0, 0, 0, 0.8)',
      color: 'white',
      padding: '15px',
      borderRadius: '8px',
      fontSize: '12px',
      fontFamily: 'monospace',
      zIndex: 9999,
      minWidth: '300px',
      maxHeight: '80vh',
      overflow: 'auto'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h4 style={{ margin: 0, color: '#4CAF50' }}>Cache Manager</h4>
        <span style={{ fontSize: '10px', opacity: 0.7 }}>Last: {lastRefresh}</span>
      </div>

      {/* Control Buttons */}
      <div style={{ marginBottom: '15px' }}>
        <button
          onClick={handleClearAllCaches}
          disabled={isClearing}
          style={{
            marginRight: '5px',
            padding: '5px 10px',
            fontSize: '11px',
            background: isClearing ? '#666' : '#f44336',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: isClearing ? 'not-allowed' : 'pointer'
          }}
        >
          {isClearing ? 'Clearing...' : 'Clear All'}
        </button>
        <button
          onClick={handleForceRefresh}
          style={{
            marginRight: '5px',
            padding: '5px 10px',
            fontSize: '11px',
            background: '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer'
          }}
        >
          Force Refresh
        </button>
        <button
          onClick={handleRefreshStale}
          style={{
            padding: '5px 10px',
            fontSize: '11px',
            background: '#FF9800',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer'
          }}
        >
          Refresh Stale
        </button>
      </div>

      {/* Asset Versioning Info */}
      <div style={{ marginBottom: '15px' }}>
        <h5 style={{ margin: '0 0 5px 0', color: '#03A9F4' }}>Asset Versioning</h5>
        <div>Version: {cacheInfo.version}</div>
        <div>Mode: {cacheInfo.isDevelopment ? 'Development' : 'Production'}</div>
        <div>Cached Assets: {cacheInfo.cacheSize}</div>
      </div>

      {/* API Stats */}
      <div style={{ marginBottom: '15px' }}>
        <h5 style={{ margin: '0 0 5px 0', color: '#03A9F4' }}>API Service</h5>
        <div>Cache Size: {apiStats.cacheSize}</div>
        <div>Pending Requests: {apiStats.pendingRequests}</div>
      </div>

      {/* Data Freshness */}
      <div style={{ marginBottom: '15px' }}>
        <h5 style={{ margin: '0 0 5px 0', color: '#03A9F4' }}>Data Freshness</h5>
        {Object.entries(freshnessStatus).map(([key, status]) => (
          <div key={key} style={{ 
            marginBottom: '3px',
            color: status.isStale ? '#ff9800' : '#4CAF50',
            fontSize: '11px'
          }}>
            <span style={{ display: 'inline-block', width: '80px' }}>{key}:</span>
            <span>{status.formattedAge}</span>
            {status.isStale && <span style={{ marginLeft: '5px', color: '#f44336' }}>(STALE)</span>}
          </div>
        ))}
      </div>

      {/* Detailed Cache Entries (Development Only) */}
      {process.env.NODE_ENV !== 'production' && cacheInfo.cacheEntries && cacheInfo.cacheEntries.length > 0 && (
        <div>
          <h5 style={{ margin: '0 0 5px 0', color: '#03A9F4' }}>Cache Entries</h5>
          {cacheInfo.cacheEntries.slice(0, 5).map((entry, index) => (
            <div key={index} style={{ fontSize: '10px', opacity: 0.8, marginBottom: '2px' }}>
              {entry.key} - {formatAge(entry.age)} old
            </div>
          ))}
          {cacheInfo.cacheEntries.length > 5 && (
            <div style={{ fontSize: '10px', opacity: 0.6 }}>
              ... and {cacheInfo.cacheEntries.length - 5} more
            </div>
          )}
        </div>
      )}

      {/* Close Button */}
      <button
        onClick={() => window.cacheManagerVisible = false}
        style={{
          position: 'absolute',
          top: '5px',
          right: '5px',
          background: 'transparent',
          color: 'white',
          border: 'none',
          fontSize: '16px',
          cursor: 'pointer',
          opacity: 0.7
        }}
      >
        ×
      </button>
    </div>
  );
};

// Global toggle function
window.toggleCacheManager = () => {
  window.cacheManagerVisible = !window.cacheManagerVisible;
  if (window.cacheManagerVisible) {
    // Render cache manager if not already rendered
    if (!document.getElementById('cache-manager-root')) {
      const root = document.createElement('div');
      root.id = 'cache-manager-root';
      document.body.appendChild(root);
      
      // This would need to be properly integrated with React
      console.log('Cache Manager toggle - requires React integration');
    }
  }
};

// Keyboard shortcut (Ctrl+Shift+C)
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'C') {
      e.preventDefault();
      window.toggleCacheManager();
    }
  });
}

export default CacheManager;
