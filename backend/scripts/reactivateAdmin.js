const { db } = require('../config/firebase');
const bcrypt = require('bcryptjs');

// Script to reactivate admin account
async function reactivateAdminAccount() {
  try {
    console.log('🔍 Searching for admin accounts...');
    
    // Find all admin users
    const adminSnapshot = await db.collection('users')
      .where('role', '==', 'admin')
      .get();
    
    if (adminSnapshot.empty) {
      console.log('❌ No admin accounts found');
      
      // Check if there are any users at all
      console.log('🔍 Checking for any users in the database...');
      const allUsersSnapshot = await db.collection('users').get();
      
      if (allUsersSnapshot.empty) {
        console.log('❌ No users found in database. Creating a default admin account...');
        
        // Create default admin account
        const defaultAdmin = {
          name: 'System Administrator',
          email: 'admin@sheflms.com',
          password: await bcrypt.hash('admin123', 10),
          role: 'admin',
          status: 'active',
          enrollmentNumber: 'ADMIN-001',
          course: 'System Administration',
          phone: '',
          address: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        const docRef = await db.collection('users').add(defaultAdmin);
        console.log('✅ Default admin account created:');
        console.log(`   Email: ${defaultAdmin.email}`);
        console.log(`   Password: admin123`);
        console.log(`   ID: ${docRef.id}`);
        console.log('\n⚠️ Please change the default password after first login!');
        
      } else {
        console.log('📋 Found users but no admin accounts. Listing all users:');
        allUsersSnapshot.forEach(doc => {
          const userData = doc.data();
          console.log(`   - ${userData.name} (${userData.email}) - Role: ${userData.role} - Status: ${userData.status}`);
        });
        
        // Promote first user to admin if they have appropriate email
        const potentialAdmin = allUsersSnapshot.docs.find(doc => {
          const userData = doc.data();
          return userData.email && userData.email.includes('admin') || userData.email.includes('shef');
        });
        
        if (potentialAdmin) {
          const userData = potentialAdmin.data();
          console.log(`\n🔄 Promoting ${userData.name} to admin role...`);
          await db.collection('users').doc(potentialAdmin.id).update({
            role: 'admin',
            status: 'active',
            updatedAt: new Date().toISOString()
          });
          console.log(`✅ ${userData.name} is now an admin!`);
        } else {
          console.log('\n❌ No suitable user found to promote to admin.');
          console.log('Please manually create an admin account in Firebase Console.');
        }
      }
      
      return;
    }
    
    console.log(`📋 Found ${adminSnapshot.size} admin account(s):`);
    
    const admins = [];
    adminSnapshot.forEach(doc => {
      const adminData = doc.data();
      admins.push({
        id: doc.id,
        email: adminData.email,
        name: adminData.name,
        status: adminData.status,
        role: adminData.role
      });
      console.log(`   - ${adminData.name} (${adminData.email}) - Status: ${adminData.status}`);
    });
    
    // Find inactive/deactivated admins
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
    
    // Reactivate all inactive admins
    console.log('\n🔄 Reactivating admin accounts...');
    
    for (const admin of inactiveAdmins) {
      await db.collection('users').doc(admin.id).update({
        status: 'active',
        updatedAt: new Date().toISOString()
      });
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
