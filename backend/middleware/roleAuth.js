const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const { assertValidSession } = require('./sessionGuard');

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production' && !secret) {
    throw new Error('JWT_SECRET must be set in production');
  }
  return secret || (process.env.NODE_ENV === 'production' ? null : 'dev_only_fallback');
}

// Middleware to check user role and permissions
const roleAuth = (...allowedRoles) => {
  return async (req, res, next) => {
    try {
      // If a prior auth middleware already validated the session, reuse it
      if (!req.user) {
        const token =
          req.header('Authorization')?.replace(/^Bearer\s+/i, '') || req.header('x-auth-token');

        if (!token) {
          return res.status(401).json({ message: 'No token, authorization denied' });
        }

        const decoded = jwt.verify(token, getJwtSecret());
        req.user = decoded.user;
      }

      const guard = await assertValidSession(req.user);
      if (!guard.ok) {
        return res.status(guard.status).json(guard.body);
      }

      // Mentors use teacher product surface
      const effectiveRole = req.user.role === 'mentor' ? 'teacher' : req.user.role;
      const allowed = allowedRoles.includes(req.user.role) || allowedRoles.includes(effectiveRole);

      if (!allowed) {
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
const isTeacher = roleAuth('teacher', 'mentor', 'admin');
const isStudent = roleAuth('student', 'teacher', 'mentor', 'admin');

module.exports = {
  roleAuth,
  isAdmin,
  isTeacher,
  isStudent
};
