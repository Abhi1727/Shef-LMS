const jwt = require('jsonwebtoken');

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production' && !secret) {
    throw new Error('JWT_SECRET must be set in production');
  }
  return secret || (process.env.NODE_ENV === 'production' ? null : 'dev_only_fallback');
}

module.exports = function(req, res, next) {
  // Check for token in multiple header formats (and query for media/download links)
  let token = req.header('x-auth-token');
  
  // Also check Authorization header (Bearer token)
  if (!token) {
    const authHeader = req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7); // Remove 'Bearer ' prefix
    }
  }

  // Allow ?token= ONLY for file downloads / static uploads (never for general API)
  const pathForToken = String(req.originalUrl || req.url || '');
  const allowQueryToken =
    pathForToken.startsWith('/uploads') ||
    pathForToken.startsWith('/api/uploads/') ||
    /\/notes(\/|\?|$)/.test(pathForToken);
  if (!token && allowQueryToken && req.query && req.query.token) {
    token = String(req.query.token);
  }

  if (!token) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    req.user = decoded.user;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};
