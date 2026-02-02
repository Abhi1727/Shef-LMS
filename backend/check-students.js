const { db } = require('./config/firebase');

(async () => {
  try {
    console.log('🔍 Checking student data in database...');
    
    const usersSnapshot = await db.collection('users').where('role', '==', 'student').get();
    console.log('📊 Total students in database:', usersSnapshot.size);
    
    if (usersSnapshot.size > 0) {
      console.log('👥 Student list:');
      usersSnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`  - ${data.name} (${data.email}) - ${data.course || 'No course'}`);
      });
    } else {
      console.log('❌ No students found in database');
    }

    // Also check all users to see what roles exist
    console.log('\n🔍 Checking all users...');
    const allUsersSnapshot = await db.collection('users').get();
    console.log('📊 Total users in database:', allUsersSnapshot.size);
    
    const roleCounts = {};
    allUsersSnapshot.forEach(doc => {
      const role = doc.data().role || 'unknown';
      roleCounts[role] = (roleCounts[role] || 0) + 1;
    });
    
    console.log('📈 Users by role:', roleCounts);
    
  } catch (error) {
    console.error('❌ Error checking students:', error.message);
  }
})();
