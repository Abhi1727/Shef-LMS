/**
 * Cache Management Utilities
 * Handles service worker communication and cache invalidation
 */

class CacheManager {
  constructor() {
    this.registration = null;
    this.isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    this.init();
  }

  async init() {
    if ('serviceWorker' in navigator) {
      try {
        this.registration = await navigator.serviceWorker.ready;
        console.log('Cache Manager initialized');
      } catch (error) {
        console.warn('Cache Manager initialization failed:', error);
      }
    }
  }

  /**
   * Clear all caches via service worker
   */
  async clearAllCaches() {
    if (!this.registration) return false;

    try {
      const messageChannel = new MessageChannel();
      
      return new Promise((resolve) => {
        messageChannel.port1.onmessage = (event) => {
          if (event.data.type === 'CACHE_CLEARED') {
            console.log('All caches cleared successfully');
            resolve(true);
          } else {
            resolve(false);
          }
        };

        this.registration.active.postMessage(
          { type: 'CLEAR_CACHE' },
          [messageChannel.port2]
        );

        // Timeout after 5 seconds
        setTimeout(() => resolve(false), 5000);
      });
    } catch (error) {
      console.error('Failed to clear caches:', error);
      return false;
    }
  }

  /**
   * Clear stale caches only
   */
  async clearStaleCaches() {
    if (!this.registration) return false;

    try {
      const messageChannel = new MessageChannel();
      
      return new Promise((resolve) => {
        messageChannel.port1.onmessage = (event) => {
          if (event.data.type === 'STALE_CACHE_CLEARED') {
            console.log('Stale caches cleared successfully');
            resolve(true);
          } else {
            resolve(false);
          }
        };

        this.registration.active.postMessage(
          { type: 'CLEAR_STALE_CACHE' },
          [messageChannel.port2]
        );

        // Timeout after 5 seconds
        setTimeout(() => resolve(false), 5000);
      });
    } catch (error) {
      console.error('Failed to clear stale caches:', error);
      return false;
    }
  }

  /**
   * Trigger service worker update
   */
  async updateServiceWorker() {
    if (!this.registration) return false;

    try {
      await this.registration.update();
      console.log('Service worker update triggered');
      return true;
    } catch (error) {
      console.error('Failed to update service worker:', error);
      return false;
    }
  }

  /**
   * Force refresh with cache clearing
   */
  async forceRefresh() {
    const cleared = await this.clearAllCaches();
    if (cleared) {
      // Wait a moment for cache clearing to complete
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Force page reload
    window.location.reload(true);
  }

  /**
   * Add cache-busting timestamp to API requests
   */
  addCacheBust(url) {
    if (!this.isDevelopment) return url;
    
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}_cb=${Date.now()}`;
  }

  /**
   * Create cache-busted fetch wrapper
   */
  async fetchWithCacheBust(url, options = {}) {
    const bustUrl = this.addCacheBust(url);
    return fetch(bustUrl, options);
  }

  /**
   * Setup automatic cache clearing on user actions
   */
  setupAutoClear() {
    // Clear cache on login/logout
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    window.history.pushState = function(...args) {
      const result = originalPushState.apply(this, args);
      CacheManager.getInstance().handleNavigation();
      return result;
    };

    window.history.replaceState = function(...args) {
      const result = originalReplaceState.apply(this, args);
      CacheManager.getInstance().handleNavigation();
      return result;
    };

    window.addEventListener('popstate', () => {
      this.handleNavigation();
    });

    // Listen for storage changes (login/logout)
    window.addEventListener('storage', (e) => {
      if (e.key === 'authToken' || e.key === 'userRole') {
        this.handleAuthChange();
      }
    });
  }

  handleNavigation() {
    // In development, clear caches more frequently on navigation
    if (this.isDevelopment) {
      this.clearStaleCaches();
    }
  }

  handleAuthChange() {
    // Clear caches when authentication changes
    this.clearAllCaches();
  }

  /**
   * Singleton instance
   */
  static getInstance() {
    if (!window.cacheManagerInstance) {
      window.cacheManagerInstance = new CacheManager();
    }
    return window.cacheManagerInstance;
  }
}

// Export singleton instance
export default CacheManager.getInstance();
