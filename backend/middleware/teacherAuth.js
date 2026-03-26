const jwt = require('jsonwebtoken');

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production' && !secret) {
    throw new Error('JWT_SECRET must be set in production');
  }
  return secret || (process.env.NODE_ENV === 'production' ? null : 'dev_only_fallback');
}

module.exports = function(req, res, next) {
  // Check for token in multiple header formats
  let token = req.header('x-auth-token');
  
  // Also check Authorization header (Bearer token)
  if (!token) {
    const authHeader = req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7); // Remove 'Bearer ' prefix
    }
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

// Middleware to check if user is teacher or admin
module.exports.isTeacherOrAdmin = function(req, res, next) {
  if (req.user && (req.user.role === 'teacher' || req.user.role === 'admin')) {
    return next();
  }
  res.status(403).json({ message: 'Access denied. Teacher or Admin role required.' });
};

// Middleware to check if user owns the batch or is admin
module.exports.isBatchOwnerOrAdmin = async function(req, res, next) {
  try {
    const Batch = require('../models/Batch');
    const batchId = req.params.id || req.params.batchId;
    
    const batch = await Batch.findById(batchId);
    if (!batch) {
      return res.status(404).json({ message: 'Batch not found' });
    }

    // Check if user is admin or the teacher of this batch
    if (req.user.role === 'admin' || 
        (req.user.role === 'teacher' && String(batch.teacherId) === String(req.user.id))) {
      return next();
    }

    res.status(403).json({ message: 'Access denied. You do not have permission to manage this batch.' });
  } catch (error) {
    console.error('Error in batch ownership check:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
