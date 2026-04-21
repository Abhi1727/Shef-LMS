/**
 * Cache Headers Middleware
 * Provides proper caching headers for different types of content
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * Generate ETag for static files
 */
function generateETag(filePath) {
  try {
    const stats = fs.statSync(filePath);
    const hash = crypto.createHash('md5');
    hash.update(`${stats.size}-${stats.mtime.getTime()}`);
    return `"${hash.digest('hex')}"`;
  } catch (error) {
    return null;
  }
}

/**
 * Check if file has been modified
 */
function isNotModified(req, etag) {
  const noneMatch = req.headers['if-none-match'];
  return noneMatch && noneMatch === etag;
}

/**
 * Cache headers middleware for static assets
 */
function staticAssetCache(req, res, next) {
  const filePath = path.join(__dirname, '..', 'uploads', req.path.replace('/uploads/', ''));
  
  // Set basic cache headers
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isProduction) {
    // Production: cache for 1 year with validation
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.set('Vary', 'Accept-Encoding');
  } else {
    // Development: cache for 1 hour with validation
    res.set('Cache-Control', 'public, max-age=3600, must-revalidate');
    res.set('Vary', 'Accept-Encoding');
  }

  // Add ETag if file exists
  if (fs.existsSync(filePath)) {
    const etag = generateETag(filePath);
    if (etag) {
      res.set('ETag', etag);
      
      // Return 304 if not modified
      if (isNotModified(req, etag)) {
        return res.status(304).end();
      }
    }
  }

  next();
}

/**
 * Cache headers middleware for API responses
 */
function apiCacheHeaders(req, res, next) {
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Different cache strategies based on endpoint type
  if (req.path.includes('/dashboard') || req.path.includes('/activity')) {
    // Dashboard and activity data: short cache in production, no cache in dev
    if (isProduction) {
      res.set('Cache-Control', 'private, max-age=30, must-revalidate');
      res.set('Vary', 'Accept, Authorization');
    } else {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
    }
  } else if (req.path.includes('/courses') || req.path.includes('/content')) {
    // Course content: medium cache
    if (isProduction) {
      res.set('Cache-Control', 'public, max-age=300, must-revalidate');
      res.set('Vary', 'Accept, Authorization');
    } else {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
    }
  } else {
    // Default: no cache for all other API endpoints
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }

  // Add version header for cache invalidation
  res.set('X-API-Version', process.env.API_VERSION || '1.0.0');
  
  next();
}

/**
 * Conditional request middleware for static files
 */
function conditionalRequest(req, res, next) {
  const filePath = path.join(__dirname, '..', 'uploads', req.path.replace('/uploads/', ''));
  
  if (!fs.existsSync(filePath)) {
    return next();
  }

  const etag = generateETag(filePath);
  if (etag && isNotModified(req, etag)) {
    return res.status(304).end();
  }

  next();
}

/**
 * Cache busting middleware for development
 */
function developmentCacheBust(req, res, next) {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  if (isDevelopment && req.path.startsWith('/uploads/')) {
    // Add cache-busting query parameter for development
    const url = new URL(req.url, `http://${req.headers.host}`);
    url.searchParams.set('_v', Date.now());
    req.url = url.pathname + url.search;
  }
  
  next();
}

module.exports = {
  staticAssetCache,
  apiCacheHeaders,
  conditionalRequest,
  developmentCacheBust,
  generateETag,
  isNotModified
};
