const { connectMongo } = require('../config/mongo');
const Classroom = require('../models/Classroom');

async function clearClassroomVideos() {
  try {
    console.log('Starting classroom videos cleanup...');

    await connectMongo();

    const documents = await Classroom.find({}).exec();

    if (!documents.length) {
      console.log('No classroom videos found to delete.');
      return;
    }

    console.log(`Found ${documents.length} classroom video(s). Deleting...`);

    let deletedCount = 0;
    let failedCount = 0;

    for (const doc of documents) {
      try {
        await Classroom.findByIdAndDelete(doc._id);
        console.log(`✅ Deleted: ${doc._id.toString()}`);
        deletedCount++;
      } catch (error) {
        console.error(`❌ Failed to delete ${doc._id.toString()}:`, error);
        failedCount++;
      }
    }

    console.log(`✅ Classroom videos cleanup completed. Deleted: ${deletedCount}, Failed: ${failedCount}`);
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
