const { db } = require('../config/firebase');

async function clearClassroomVideos() {
  try {
    console.log('Starting classroom videos cleanup...');

    const collectionRef = db.collection('classroom');
    const snapshot = await collectionRef.get();

    if (snapshot.empty) {
      console.log('No classroom videos found to delete.');
      return;
    }

    console.log(`Found ${snapshot.size} classroom video(s). Deleting...`);

    let batch = db.batch();
    let opCount = 0;

    snapshot.forEach((doc) => {
      batch.delete(doc.ref);
      opCount++;

      // Commit in chunks to respect Firestore batch limits
      if (opCount === 400) {
        batch.commit();
        batch = db.batch();
        opCount = 0;
      }
    });

    if (opCount > 0) {
      await batch.commit();
    }

    console.log('✅ Classroom videos cleanup completed successfully.');
  } catch (error) {
    console.error('Error clearing classroom videos:', error);
  }
}

clearClassroomVideos().then(() => {
  console.log('Done.');
  process.exit(0);
}).catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
