/**
 * Asset Versioning Utilities
 * Provides cache-busting and version management for static assets
 */

class AssetVersioning {
  constructor() {
    this.isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    this.version = this.getVersion();
    this.assetCache = new Map();
  }

  /**
   * Get current application version
   */
  getVersion() {
    // Try to get version from various sources
    return (
      process.env.REACT_APP_VERSION ||
      process.env.npm_package_version ||
      this.getBuildTimestamp() ||
      '1.0.0'
    );
  }

  /**
   * Generate build timestamp
   */
  getBuildTimestamp() {
    const buildDate = document.querySelector('meta[name="build-date"]');
    if (buildDate) {
      return buildDate.content;
    }
    
    // Fallback to current time in development
    if (this.isDevelopment) {
      return Date.now().toString();
    }
    
    return null;
  }

  /**
   * Add version parameter to asset URLs
   */
  versionAsset(url, customVersion = null) {
    if (!url) return url;
    
    const version = customVersion || this.version;
    const separator = url.includes('?') ? '&' : '?';
    
    // Don't version external URLs
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    
    // Don't version data URLs
    if (url.startsWith('data:')) {
      return url;
    }
    
    return `${url}${separator}v=${version}`;
  }

  /**
   * Add cache-busting timestamp for development
   */
  cacheBust(url) {
    if (!this.isDevelopment) return url;
    
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}_cb=${Date.now()}`;
  }

  /**
   * Get versioned asset URL
   */
  getAssetUrl(url, options = {}) {
    if (!url) return url;
    
    let versionedUrl = url;
    
    if (options.cacheBust && this.isDevelopment) {
      versionedUrl = this.cacheBust(url);
    } else if (options.version !== false) {
      versionedUrl = this.versionAsset(url, options.version);
    }
    
    return versionedUrl;
  }

  /**
   * Create cache-busted fetch wrapper
   */
  async fetchAsset(url, options = {}) {
    const versionedUrl = this.getAssetUrl(url, options);
    return fetch(versionedUrl, options);
  }

  /**
   * Generate ETag-like hash for content
   */
  generateETag(content) {
    const hash = this.simpleHash(JSON.stringify(content) + this.version);
    return `"${hash}"`;
  }

  /**
   * Simple hash function for ETag generation
   */
  simpleHash(str) {
    let hash = 0;
    if (str.length === 0) return hash;
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(16);
  }

  /**
   * Cache asset data with version tracking
   */
  cacheAsset(key, data, ttl = 5 * 60 * 1000) { // 5 minutes default TTL
    this.assetCache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
      version: this.version
    });
  }

  /**
   * Get cached asset data
   */
  getCachedAsset(key) {
    const cached = this.assetCache.get(key);
    if (!cached) return null;
    
    // Check if cache is still valid
    const age = Date.now() - cached.timestamp;
    if (age > cached.ttl) {
      this.assetCache.delete(key);
      return null;
    }
    
    // Check if version has changed
    if (cached.version !== this.version) {
      this.assetCache.delete(key);
      return null;
    }
    
    return cached.data;
  }

  /**
   * Clear asset cache
   */
  clearCache() {
    this.assetCache.clear();
  }

  /**
   * Clean up expired cache entries
   */
  cleanupCache() {
    const now = Date.now();
    const keysToDelete = [];
    
    for (const [key, cached] of this.assetCache.entries()) {
      const age = now - cached.timestamp;
      if (age > cached.ttl || cached.version !== this.version) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.assetCache.delete(key));
    
    return keysToDelete.length;
  }

  /**
   * Setup periodic cache cleanup
   */
  setupCleanup() {
    setInterval(() => {
      const cleaned = this.cleanupCache();
      if (cleaned > 0) {
        console.log(`Cleaned up ${cleaned} expired asset cache entries`);
      }
    }, 60 * 1000); // Every minute
  }

  /**
   * Create versioned image URLs
   */
  getImageUrl(imagePath, options = {}) {
    if (!imagePath) return imagePath;
    
    // Handle different image path formats
    let baseUrl = imagePath;
    
    // Add base URL for relative paths
    if (!imagePath.startsWith('http') && !imagePath.startsWith('/')) {
      baseUrl = `/uploads/${imagePath}`;
    }
    
    return this.getAssetUrl(baseUrl, options);
  }

  /**
   * Create versioned API URLs for static data
   */
  getStaticDataUrl(endpoint, options = {}) {
    const baseUrl = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return this.getAssetUrl(baseUrl, {
      ...options,
      version: this.isDevelopment ? false : options.version // Don't version in dev
    });
  }

  /**
   * Batch version multiple assets
   */
  versionAssets(urls, options = {}) {
    return urls.map(url => this.getAssetUrl(url, options));
  }

  /**
   * Get cache information
   */
  getCacheInfo() {
    return {
      version: this.version,
      isDevelopment: this.isDevelopment,
      cacheSize: this.assetCache.size,
      cacheEntries: Array.from(this.assetCache.entries()).map(([key, value]) => ({
        key,
        timestamp: value.timestamp,
        age: Date.now() - value.timestamp,
        ttl: value.ttl,
        version: value.version
      }))
    };
  }

  /**
   * Force refresh by incrementing version
   */
  forceRefresh() {
    this.version = this.getBuildTimestamp() || Date.now().toString();
    this.clearCache();
    console.log('Asset version updated:', this.version);
  }

  /**
   * Check if asset should be reloaded
   */
  shouldReload(assetUrl, lastKnownVersion) {
    return lastKnownVersion !== this.version;
  }
}

// Create singleton instance
const assetVersioning = new AssetVersioning();
assetVersioning.setupCleanup();

export default assetVersioning;
