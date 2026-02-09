const { connectMongo } = require('../config/mongo');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// Script to create or update an admin account in MongoDB
async function createAdminAccount() {
  try {
    console.log('🔧 Creating admin account...');

    await connectMongo();

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: 'admin@sheflms.com' }).exec();

    if (existingAdmin) {
      console.log('⚠️ Admin account already exists. Updating to active status in MongoDB...');
      existingAdmin.role = 'admin';
      existingAdmin.status = 'active';
      existingAdmin.updatedAt = new Date();
      await existingAdmin.save();
      console.log('✅ Admin account updated successfully!');
      console.log('   Email: admin@sheflms.com');
      console.log('   Status: Active');
      return;
    }

    // Create new admin account
    const hashedPassword = await bcrypt.hash('admin123', 10);

    const adminData = {
      name: 'System Administrator',
      email: 'admin@sheflms.com',
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
    console.log('   Email: admin@sheflms.com');
    console.log('   Password: admin123');
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
