// Check teacher data in Firestore
const { db } = require('./config/firebase');

async function checkTeacherData() {
  try {
    console.log('🔍 Checking teacher data in Firestore...');
    
    // Check users collection for teacher
    const usersSnapshot = await db.collection('users').where('email', '==', 'teacher@sheflms.com').get();
    console.log('Users collection results:', usersSnapshot.size);
    
    usersSnapshot.forEach(doc => {
      console.log('User doc:', doc.id, doc.data());
    });
    
    // Check if teacher exists in any other collection
    const allCollections = ['users', 'teachers', 'mentors'];
    for (const collectionName of allCollections) {
      const snapshot = await db.collection(collectionName).where('email', '==', 'teacher@sheflms.com').get();
      if (snapshot.size > 0) {
        console.log(`Found in ${collectionName}:`, snapshot.size);
        snapshot.forEach(doc => {
          console.log(`  ${doc.id}:`, doc.data());
        });
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkTeacherData();
