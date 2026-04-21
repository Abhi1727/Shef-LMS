/**
 * Enhanced API Service with caching optimizations
 * Provides cache-busting, request deduplication, and retry logic
 */
import cacheManager from './cacheManager.js';

class EnhancedApiService {
  constructor() {
    this.isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    this.pendingRequests = new Map();
    this.requestCache = new Map();
    this.freshnessThresholds = {
      dashboard: 30 * 1000,      // 30 seconds
      activity: 30 * 1000,      // 30 seconds
      courses: 5 * 60 * 1000,   // 5 minutes
      content: 5 * 60 * 1000,   // 5 minutes
      default: 0                // no cache by default
    };
  }

  /**
   * Get API base URL with localhost detection
   */
  getApiBaseUrl() {
    if (window.location.hostname === 'localhost') {
      return 'http://localhost:5000';
    }
    return process.env.REACT_APP_API_URL || '';
  }

  /**
   * Add cache-busting parameters to URL
   */
  addCacheBust(url, force = false) {
    if (!this.isDevelopment && !force) return url;
    
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}_cb=${Date.now()}`;
  }

  /**
   * Get cache key for request
   */
  getCacheKey(url, options = {}) {
    const method = options.method || 'GET';
    const body = options.body ? JSON.stringify(options.body) : '';
    return `${method}:${url}:${body}`;
  }

  /**
   * Check if cached data is fresh
   */
  isDataFresh(cacheKey, endpointType = 'default') {
    const cached = this.requestCache.get(cacheKey);
    if (!cached) return false;
    
    const threshold = this.freshnessThresholds[endpointType] || this.freshnessThresholds.default;
    return Date.now() - cached.timestamp < threshold;
  }

  /**
   * Store data in cache
   */
  storeInCache(cacheKey, data, endpointType = 'default') {
    this.requestCache.set(cacheKey, {
      data,
      timestamp: Date.now(),
      endpointType
    });
  }

  /**
   * Get data from cache
   */
  getFromCache(cacheKey) {
    const cached = this.requestCache.get(cacheKey);
    return cached ? cached.data : null;
  }

  /**
   * Determine endpoint type from URL
   */
  getEndpointType(url) {
    if (url.includes('/dashboard')) return 'dashboard';
    if (url.includes('/activity')) return 'activity';
    if (url.includes('/courses')) return 'courses';
    if (url.includes('/content')) return 'content';
    return 'default';
  }

  /**
   * Enhanced fetch with retry logic and cache management
   */
  async fetchWithRetry(url, options = {}, retries = 3) {
    const cacheKey = this.getCacheKey(url, options);
    const endpointType = this.getEndpointType(url);
    
    // Check cache first for GET requests
    if (!options.method || options.method === 'GET') {
      if (this.isDataFresh(cacheKey, endpointType)) {
        const cachedData = this.getFromCache(cacheKey);
        if (cachedData) {
          console.log(`Returning fresh cached data for ${url}`);
          return {
            ok: true,
            status: 200,
            json: async () => cachedData,
            text: async () => JSON.stringify(cachedData)
          };
        }
      }
    }

    // Check for pending request to avoid duplication
    if (this.pendingRequests.has(cacheKey)) {
      console.log(`Request deduplication: waiting for pending ${url}`);
      return this.pendingRequests.get(cacheKey);
    }

    // Create the request promise
    const requestPromise = this.executeRequest(url, options, retries, cacheKey, endpointType);
    
    // Store pending request
    this.pendingRequests.set(cacheKey, requestPromise);

    try {
      const response = await requestPromise;
      return response;
    } finally {
      // Clean up pending request
      this.pendingRequests.delete(cacheKey);
    }
  }

  /**
   * Execute the actual request with retry logic
   */
  async executeRequest(url, options, retries, cacheKey, endpointType) {
    const fullUrl = this.getApiBaseUrl() + this.addCacheBust(url);
    
    try {
      const response = await fetch(fullUrl, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          ...options.headers
        }
      });

      // Cache successful GET responses
      if (response.ok && (!options.method || options.method === 'GET')) {
        try {
          const data = await response.clone().json();
          this.storeInCache(cacheKey, data, endpointType);
        } catch (error) {
          console.warn('Failed to cache response data:', error);
        }
      }

      return response;
    } catch (error) {
      console.error(`Request failed for ${url}:`, error);
      
      // Retry logic
      if (retries > 0 && this.shouldRetry(error)) {
        const delay = Math.pow(2, 4 - retries) * 1000; // 1s, 2s, 4s
        console.log(`Retrying request for ${url} in ${delay}ms (${retries} retries left)`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.executeRequest(url, options, retries - 1, cacheKey, endpointType);
      }

      // Return cached data if available and network failed
      if (!options.method || options.method === 'GET') {
        const cachedData = this.getFromCache(cacheKey);
        if (cachedData) {
          console.log(`Network failed, returning cached data for ${url}`);
          return {
            ok: true,
            status: 200,
            json: async () => cachedData,
            text: async () => JSON.stringify(cachedData)
          };
        }
      }

      throw error;
    }
  }

  /**
   * Determine if request should be retried
   */
  shouldRetry(error) {
    // Don't retry on 4xx errors (except 429)
    if (error.response && error.response.status >= 400 && error.response.status < 500 && error.response.status !== 429) {
      return false;
    }
    // Retry on network errors and 5xx
    return true;
  }

  /**
   * Invalidate cache for specific endpoint
   */
  invalidateCache(urlPattern) {
    const keysToDelete = [];
    for (const key of this.requestCache.keys()) {
      if (key.includes(urlPattern)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.requestCache.delete(key));
    console.log(`Invalidated ${keysToDelete.length} cache entries for pattern: ${urlPattern}`);
  }

  /**
   * Clear all cache
   */
  clearCache() {
    this.requestCache.clear();
    console.log('All API cache cleared');
  }

  /**
   * Prefetch data for better performance
   */
  async prefetchData(urls) {
    const promises = urls.map(url => 
      this.fetchWithRetry(url, {}, 1).catch(error => 
        console.warn(`Prefetch failed for ${url}:`, error)
      )
    );
    await Promise.allSettled(promises);
  }

  /**
   * Get request statistics
   */
  getStats() {
    return {
      cacheSize: this.requestCache.size,
      pendingRequests: this.pendingRequests.size,
      cacheEntries: Array.from(this.requestCache.entries()).map(([key, value]) => ({
        key: key.split(':')[1], // Extract URL from cache key
        timestamp: value.timestamp,
        endpointType: value.endpointType,
        age: Date.now() - value.timestamp
      }))
    };
  }

  /**
   * Setup automatic cache invalidation
   */
  setupAutoInvalidation() {
    // Invalidate cache on user actions
    window.addEventListener('storage', (e) => {
      if (e.key === 'authToken') {
        this.clearCache();
        cacheManager.clearAllCaches();
      }
    });

    // Periodic cleanup of old cache entries
    setInterval(() => {
      const now = Date.now();
      const keysToDelete = [];
      
      for (const [key, value] of this.requestCache.entries()) {
        const threshold = this.freshnessThresholds[value.endpointType] || this.freshnessThresholds.default;
        if (threshold > 0 && now - value.timestamp > threshold * 2) {
          keysToDelete.push(key);
        }
      }
      
      keysToDelete.forEach(key => this.requestCache.delete(key));
      if (keysToDelete.length > 0) {
        console.log(`Cleaned up ${keysToDelete.length} expired cache entries`);
      }
    }, 5 * 60 * 1000); // Every 5 minutes
  }
}

// Create singleton instance
const enhancedApiService = new EnhancedApiService();
enhancedApiService.setupAutoInvalidation();

export default enhancedApiService;
