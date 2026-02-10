// Normalize passwords for all users so they can log in.
// Default password: Admin@123

const { connectMongo } = require('../config/mongo');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

async function fixAllUserPasswords() {
  try {
    await connectMongo();

    const defaultPassword = 'Admin@123';
    const salt = await bcrypt.genSalt(10);
    const defaultHash = await bcrypt.hash(defaultPassword, salt);

    console.log('🔍 Finding users with missing or invalid passwords...');

    const users = await User.find({}).exec();
    let updatedCount = 0;

    for (const user of users) {
      // Never touch the explicit super admin; its password is managed separately
      if (user.email && user.email.toLowerCase() === 'admin@sheflms.com') {
        console.log(`⏭  Skipping super admin: ${user.email}`);
        continue;
      }

      const pwd = user.password;
      const needsFix = !pwd || typeof pwd !== 'string' || !pwd.startsWith('$2');

      if (needsFix) {
        user.password = defaultHash;
        if (!user.status) {
          user.status = 'active';
        }
        await user.save();
        updatedCount++;
        console.log(`✅ Fixed password for user: ${user.email} (role=${user.role})`);
      }
    }

    console.log(`\n🎉 Done. Updated ${updatedCount} user account(s).`);
    console.log(`📝 Default password for those users: ${defaultPassword}`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error fixing user passwords:', err);
    process.exit(1);
  }
}

fixAllUserPasswords();
