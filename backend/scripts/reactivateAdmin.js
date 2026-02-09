const { connectMongo } = require('../config/mongo');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// Script to reactivate or ensure admin account in MongoDB
async function reactivateAdminAccount() {
  try {
    await connectMongo();

    console.log('🔍 Searching for admin accounts in MongoDB...');

    // Find all admin users
    const admins = await User.find({ role: 'admin' }).exec();

    if (!admins || admins.length === 0) {
      console.log('❌ No admin accounts found');

      // Check if there are any users at all
      console.log('🔍 Checking for any users in the database...');
      const allUsers = await User.find({}).exec();

      if (!allUsers || allUsers.length === 0) {
        console.log('❌ No users found in database. Creating a default admin account...');

        const defaultAdmin = new User({
          name: 'System Administrator',
          email: 'admin@sheflms.com',
          password: await bcrypt.hash('admin123', 10),
          role: 'admin',
          status: 'active',
          enrollmentNumber: 'ADMIN-001',
          course: 'System Administration',
          phone: '',
          address: '',
          createdAt: new Date(),
          updatedAt: new Date()
        });

        const saved = await defaultAdmin.save();
        console.log('✅ Default admin account created:');
        console.log(`   Email: ${defaultAdmin.email}`);
        console.log(`   Password: admin123`);
        console.log(`   ID: ${saved._id.toString()}`);
        console.log('\n⚠️ Please change the default password after first login!');

      } else {
        console.log('📋 Found users but no admin accounts. Listing all users:');
        allUsers.forEach(userData => {
          console.log(`   - ${userData.name} (${userData.email}) - Role: ${userData.role} - Status: ${userData.status}`);
        });

        const potentialAdmin = allUsers.find(userData => {
          const email = userData.email || '';
          return email.includes('admin') || email.includes('shef');
        });

        if (potentialAdmin) {
          console.log(`\n🔄 Promoting ${potentialAdmin.name} to admin role...`);
          potentialAdmin.role = 'admin';
          potentialAdmin.status = 'active';
          potentialAdmin.updatedAt = new Date();
          await potentialAdmin.save();
          console.log(`✅ ${potentialAdmin.name} is now an admin!`);
        } else {
          console.log('\n❌ No suitable user found to promote to admin.');
          console.log('Please manually create an admin account in MongoDB.');
        }
      }

      return;
    }

    console.log(`📋 Found ${admins.length} admin account(s):`);

    admins.forEach(admin => {
      console.log(`   - ${admin.name} (${admin.email}) - Status: ${admin.status}`);
    });

    const inactiveAdmins = admins.filter(admin => 
      admin.status === 'inactive' || admin.status === 'deactivated'
    );

    if (inactiveAdmins.length === 0) {
      console.log('✅ All admin accounts are already active');
      return;
    }

    console.log(`\n⚠️ Found ${inactiveAdmins.length} inactive admin account(s):`);
    inactiveAdmins.forEach(admin => {
      console.log(`   - ${admin.name} (${admin.email}) - Status: ${admin.status}`);
    });

    console.log('\n🔄 Reactivating admin accounts...');

    for (const admin of inactiveAdmins) {
      admin.status = 'active';
      admin.updatedAt = new Date();
      await admin.save();
      console.log(`✅ Reactivated: ${admin.name} (${admin.email})`);
    }

    console.log('\n🎉 All admin accounts have been reactivated!');
    console.log('Please try logging in again.');
    
  } catch (error) {
    console.error('❌ Error reactivating admin account:', error);
  }
}

// Run the script
reactivateAdminAccount().then(() => {
  console.log('\n📝 Script completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
