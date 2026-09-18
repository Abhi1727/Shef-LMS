/**
 * Shared session security for JWT auth middlewares.
 * - Enforces tokenVersion (logout-other-devices / password revoke)
 * - Blocks inactive accounts for all roles
 */
const tokenVersionCache = new Map();
const SESSION_CACHE_MS = 30 * 1000;

function invalidateSessionCache(userId) {
  if (userId) tokenVersionCache.delete(String(userId));
}

async function getSessionSnapshot(userId) {
  const key = String(userId || '');
  if (!key) return null;
  const cached = tokenVersionCache.get(key);
  if (cached && Date.now() - cached.at < SESSION_CACHE_MS) {
    return cached.snap;
  }
  const User = require('../models/User');
  const dbUser = await User.findById(key).select('tokenVersion status role').lean().exec();
  if (!dbUser) return null;
  const snap = {
    tokenVersion: Number(dbUser.tokenVersion || 0),
    status: String(dbUser.status || 'active').toLowerCase(),
    role: dbUser.role || ''
  };
  tokenVersionCache.set(key, { snap, at: Date.now() });
  return snap;
}

function isAccountAllowed(role, status) {
  const s = String(status || 'active').toLowerCase();
  if (s === 'inactive') return false;
  // Students must be explicitly active (legacy: completed/other blocked)
  if (role === 'student' && s !== 'active') return false;
  return true;
}

/**
 * @param {{ id?: string, tv?: number, role?: string, status?: string }} reqUser
 * @returns {Promise<{ ok: true, snap: object } | { ok: false, status: number, body: object }>}
 */
async function assertValidSession(reqUser) {
  if (!reqUser?.id) {
    return {
      ok: false,
      status: 401,
      body: { message: 'Token is not valid' }
    };
  }

  const snap = await getSessionSnapshot(reqUser.id);
  if (!snap) {
    return {
      ok: false,
      status: 401,
      body: { message: 'Token is not valid' }
    };
  }

  const role = reqUser.role || snap.role;
  if (!isAccountAllowed(role, snap.status)) {
    return {
      ok: false,
      status: 403,
      body: {
        code: 'ACCOUNT_INACTIVE',
        message: 'Account is deactivated. Please contact administrator.'
      }
    };
  }

  const claimed = Number(reqUser.tv || 0);
  if (Number(snap.tokenVersion || 0) !== claimed) {
    return {
      ok: false,
      status: 401,
      body: {
        code: 'SESSION_REVOKED',
        message: 'Session revoked. Please sign in again.'
      }
    };
  }

  return { ok: true, snap };
}

async function bumpTokenVersion(userDoc) {
  userDoc.tokenVersion = Number(userDoc.tokenVersion || 0) + 1;
  invalidateSessionCache(userDoc._id || userDoc.id);
  return userDoc.tokenVersion;
}

module.exports = {
  assertValidSession,
  bumpTokenVersion,
  invalidateSessionCache,
  isAccountAllowed,
  getSessionSnapshot
};
