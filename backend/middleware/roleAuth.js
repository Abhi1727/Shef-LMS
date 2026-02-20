const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production' && !secret) {
    throw new Error('JWT_SECRET must be set in production');
  }
  return secret || 'shef_lms_secret_key_2025';
}

// Middleware to check user role and permissions
const roleAuth = (...allowedRoles) => {
  return (req, res, next) => {
    try {
      const token = req.header('Authorization')?.replace('Bearer ', '') || 
                    req.header('x-auth-token');

      if (!token) {
        return res.status(401).json({ message: 'No token, authorization denied' });
      }

      const decoded = jwt.verify(token, getJwtSecret());

      req.user = decoded.user;

      // Check if user account is active - ONLY for students
      // Admins and teachers can access even if account is inactive
      if (req.user.role === 'student' && req.user.status !== 'active') {
        return res.status(403).json({ 
          message: 'Account is deactivated. Please contact administrator.' 
        });
      }

      // Commented out: This was blocking admins and teachers too
      // if (req.user.status !== 'active') {
      //   return res.status(403).json({ 
      //     message: 'Account is deactivated. Please contact administrator.' 
      //   });
      // }

      // Check if user's role is in the allowed roles
      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ 
          message: 'Access denied. Insufficient permissions.',
          requiredRole: allowedRoles,
          userRole: req.user.role
        });
      }

      next();
    } catch (err) {
      logger.warn('Role auth failed', { error: err.message });
      res.status(401).json({ message: 'Token is not valid' });
    }
  };
};

// Specific role checkers
const isAdmin = roleAuth('admin');
const isTeacher = roleAuth('teacher', 'admin');
const isStudent = roleAuth('student', 'teacher', 'admin');

module.exports = {
  roleAuth,
  isAdmin,
  isTeacher,
  isStudent
};
