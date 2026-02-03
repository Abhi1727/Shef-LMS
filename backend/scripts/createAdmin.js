const { db } = require('../config/firebase');
const bcrypt = require('bcryptjs');

// Script to create a proper admin account
async function createAdminAccount() {
  try {
    console.log('🔧 Creating admin account...');
    
    // Check if admin already exists
    const existingAdmin = await db.collection('users')
      .where('email', '==', 'admin@sheflms.com')
      .get();
    
    if (!existingAdmin.empty) {
      console.log('⚠️ Admin account already exists. Updating to active status...');
      const adminDoc = existingAdmin.docs[0];
      await db.collection('users').doc(adminDoc.id).update({
        role: 'admin',
        status: 'active',
        updatedAt: new Date().toISOString()
      });
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const docRef = await db.collection('users').add(adminData);
    
    console.log('✅ Admin account created successfully!');
    console.log('   Email: admin@sheflms.com');
    console.log('   Password: admin123');
    console.log('   ID: ' + docRef.id);
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
