const { connectMongo } = require('../config/mongo');
const { getAllClassroomFirestore } = require('../repositories/classroomRepository');
const Classroom = require('../models/Classroom');

async function migrateClassroom() {
  await connectMongo();

  const firestoreItems = await getAllClassroomFirestore();
  console.log(`Found ${firestoreItems.length} classroom items in Firestore`);

  let migrated = 0;

  for (const v of firestoreItems) {
    try {
      // Use Firestore id + source as a loose uniqueness check
      const existing = await Classroom.findOne({
        title: v.title,
        date: v.date,
        videoSource: v.videoSource,
        zoomUrl: v.zoomUrl || undefined,
        youtubeVideoUrl: v.youtubeVideoUrl || undefined,
      }).exec();

      if (existing) {
        continue;
      }

      const item = new Classroom({
        title: v.title,
        instructor: v.instructor,
        description: v.description,
        courseId: v.courseId,
        course: v.course,
        batchId: v.batchId,
        batchName: v.batchName,
        domain: v.domain,
        duration: v.duration,
        courseType: v.courseType,
        type: v.type,
        date: v.date,
        videoSource: v.videoSource,
        zoomUrl: v.zoomUrl,
        zoomPasscode: v.zoomPasscode,
        driveId: v.driveId,
        youtubeVideoId: v.youtubeVideoId,
        youtubeVideoUrl: v.youtubeVideoUrl,
        youtubeEmbedUrl: v.youtubeEmbedUrl,
        storagePath: v.storagePath,
        uploadedBy: v.uploadedBy,
        createdAt: v.createdAt ? new Date(v.createdAt) : undefined,
        updatedAt: v.updatedAt ? new Date(v.updatedAt) : undefined,
      });

      await item.save();
      migrated += 1;
    } catch (err) {
      console.error('Error migrating classroom item', v.id, err.message);
    }
  }

  console.log(`Migrated ${migrated} classroom items to MongoDB`);
}

migrateClassroom()
  .then(() => {
    console.log('Classroom migration complete');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Classroom migration failed', err);
    process.exit(1);
  });
