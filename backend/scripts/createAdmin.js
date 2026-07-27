const { connectMongo } = require('../config/mongo');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// Script to create or update an admin account in MongoDB
async function createAdminAccount() {
  try {
    console.log('🔧 Creating admin account...');

    await connectMongo();

    const ADMIN_EMAIL = 'support@skystates.us';
    const ADMIN_NAME = 'Upendra';
    const ADMIN_PASSWORD = 'Modi@123';

    // Prefer canonical admin email; also migrate legacy admin@sheflms.com
    let existingAdmin =
      (await User.findOne({ email: ADMIN_EMAIL }).exec()) ||
      (await User.findOne({ email: 'admin@sheflms.com' }).exec());

    if (existingAdmin) {
      console.log('⚠️ Admin account already exists. Updating details in MongoDB...');
      existingAdmin.name = ADMIN_NAME;
      existingAdmin.email = ADMIN_EMAIL;
      existingAdmin.role = 'admin';
      existingAdmin.status = 'active';
      existingAdmin.updatedAt = new Date();

      // Ensure super admin uses the requested password
      const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
      existingAdmin.password = hashedPassword;

      await existingAdmin.save();
      console.log('✅ Admin account updated successfully!');
      console.log(`   Name: ${ADMIN_NAME}`);
      console.log(`   Email: ${ADMIN_EMAIL}`);
      console.log('   Status: Active');
      console.log(`   Password: ${ADMIN_PASSWORD}`);
      return;
    }

    // Create new admin account
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);

    const adminData = {
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      password: hashedPassword,
      role: 'admin',
      status: 'active',
      enrollmentNumber: 'ADMIN-001',
      course: 'System Administration',
      phone: '',
      address: '',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const adminUser = new User(adminData);
    const saved = await adminUser.save();

    console.log('✅ Admin account created successfully!');
    console.log(`   Name: ${ADMIN_NAME}`);
    console.log(`   Email: ${ADMIN_EMAIL}`);
    console.log(`   Password: ${ADMIN_PASSWORD}`);
    console.log('   ID: ' + saved._id.toString());
    console.log('\n⚠️ IMPORTANT: Please change the default password after first login!');
    console.log('🔗 Login URL: http://localhost:3000/login');
    
  } catch (error) {
    console.error('❌ Error creating admin account:', error);
  }
}

// Run the script
createAdminAccount().then(() => {
  console.log('\n📝 Admin creation completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
