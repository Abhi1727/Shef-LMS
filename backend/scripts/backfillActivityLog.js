/**
 * Backfill ActivityLog from existing User.loginHistory.
 * Run once to migrate historical login data into the centralized ActivityLog.
 *
 * Usage: node scripts/backfillActivityLog.js
 */

const { connectMongo } = require('../config/mongo');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');

async function main() {
  await connectMongo();

  const users = await User.find({
    $or: [
      { 'loginHistory.0': { $exists: true } },
      { lastLogin: { $exists: true, $ne: null } }
    ]
  })
    .select('name email role loginHistory lastLogin lastLoginIP lastLoginTimestamp')
    .lean()
    .exec();

  let inserted = 0;
  let skipped = 0;

  for (const u of users) {
    const userId = String(u._id);
    const userName = u.name || '';
    const userEmail = u.email || '';
    const userRole = u.role || 'student';

    const history = Array.isArray(u.loginHistory) ? u.loginHistory : [];

    for (const h of history) {
      const ts = h.timestamp ? new Date(h.timestamp) : null;
      if (!ts || isNaN(ts.getTime())) continue;

      const exists = await ActivityLog.findOne({
        userId,
        action: 'login',
        timestamp: { $gte: new Date(ts.getTime() - 5000), $lte: new Date(ts.getTime() + 5000) }
      }).exec();

      if (exists) {
        skipped++;
        continue;
      }

      await ActivityLog.create({
        action: 'login',
        userId,
        userName,
        userEmail,
        userRole,
        timestamp: ts,
        ipAddress: h.ipAddress || null,
        city: h.city || null,
        country: h.country || null,
        isp: h.isp || null
      });
      inserted++;
    }

    // Fallback: lastLogin if no history
    if (history.length === 0 && u.lastLogin) {
      const lastTs = u.lastLogin.timestamp ? new Date(u.lastLogin.timestamp) : (u.lastLoginTimestamp ? new Date(u.lastLoginTimestamp) : null);
      if (lastTs && !isNaN(lastTs.getTime())) {
        const exists = await ActivityLog.findOne({
          userId,
          action: 'login',
          timestamp: { $gte: new Date(lastTs.getTime() - 5000), $lte: new Date(lastTs.getTime() + 5000) }
        }).exec();

        if (!exists) {
          await ActivityLog.create({
            action: 'login',
            userId,
            userName,
            userEmail,
            userRole,
            timestamp: lastTs,
            ipAddress: u.lastLogin.ipAddress || u.lastLoginIP || null,
            city: u.lastLogin.city || null,
            country: u.lastLogin.country || null,
            isp: u.lastLogin.isp || null
          });
          inserted++;
        } else {
          skipped++;
        }
      }
    }
  }

  console.log(`Backfill complete. Inserted: ${inserted}, Skipped (duplicates): ${skipped}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
