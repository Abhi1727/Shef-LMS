// Force-reset passwords for all non-admin users so they can log in.
// New default password: Admin@123

const { connectMongo } = require('../config/mongo');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Batch = require('../models/Batch');

async function resetNonAdminPasswords() {
  try {
    await connectMongo();

    const defaultPassword = 'Admin@123';
    const salt = await bcrypt.genSalt(10);
    const defaultHash = await bcrypt.hash(defaultPassword, salt);

    console.log('🔍 Resetting passwords for all non-admin users...');

    const users = await User.find({}).exec();
    let updatedCount = 0;

    for (const user of users) {
      // Keep explicit super admin password unchanged
      if (user.email && user.email.toLowerCase() === 'admin@sheflms.com') {
        console.log(`⏭  Skipping super admin: ${user.email}`);
        continue;
      }

      user.password = defaultHash;

      // Ensure students are active and have a default batch if missing
      if (user.role === 'student') {
        if (user.status !== 'active') {
          user.status = 'active';
        }

        if (!user.batchId) {
          const batch = await Batch.findOne({ name: 'Batch 1' }).exec();
          if (batch) {
            user.batchId = String(batch._id);
          }
        }
      }

      await user.save();
      updatedCount++;
      console.log(`✅ Reset password for: ${user.email} (role=${user.role})`);
    }

    console.log(`\n🎉 Done. Updated ${updatedCount} user account(s).`);
    console.log(`📝 New default password for all non-admin users: ${defaultPassword}`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error resetting passwords:', err);
    process.exit(1);
  }
}

resetNonAdminPasswords();
