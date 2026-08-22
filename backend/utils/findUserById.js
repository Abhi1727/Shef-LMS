const User = require('../models/User');

/**
 * Resolve a user by document id or legacy firestoreId without scanning the full users collection.
 * At most 2 targeted reads (getDoc + optional firestoreId query).
 */
async function findUserById(userId, select, { lean = true } = {}) {
  const id = userId != null ? String(userId).trim() : '';
  if (!id) return null;

  let query = User.findById(id);
  if (select) query = query.select(select);
  if (lean) query = query.lean();
  let doc = await query.exec();
  if (doc) return doc;

  query = User.findOne({ firestoreId: id });
  if (select) query = query.select(select);
  if (lean) query = query.lean();
  return query.exec();
}

module.exports = { findUserById };
