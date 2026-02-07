// Check if admin user exists and create if needed
const { db } = require('./backend/config/firebase');
const bcrypt = require('bcryptjs');

const ADMIN_EMAIL = 'admin@sheflms.com';
const ADMIN_PASSWORD = 'admin123';

async function checkAdminUser() {
  try {
    console.log('🔍 Checking for existing admin user...');
    
    // Check if admin user exists
    const adminSnapshot = await db.collection('users')
      .where('email', '==', ADMIN_EMAIL)
      .where('role', '==', 'admin')
      .get();
    
    if (!adminSnapshot.empty) {
      console.log('❌ Admin user not found. Creating admin user...');
      
      // Hash password
      const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
      
      // Create admin user
      const adminData = {
        name: 'Admin',
        email: ADMIN_EMAIL,
        password: hashedPassword,
        role: 'admin',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await db.collection('users').add(adminData);
      console.log('✅ Admin user created successfully');
      console.log(`📧 Email: ${ADMIN_EMAIL}`);
      console.log(`🔑 Password: ${ADMIN_PASSWORD}`);
    } else {
      console.log('✅ Admin user exists');
      const adminData = adminSnapshot.docs[0].data();
      console.log(`📧 Email: ${adminData.email}`);
      console.log(`🔑 Status: ${adminData.status}`);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error checking admin user:', error.message);
    return false;
  }
}

checkAdminUser();
