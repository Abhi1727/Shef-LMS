// Script to check and fix classroom video data in MongoDB
const { connectMongo } = require('./config/mongo');
const Classroom = require('./models/Classroom');

async function fixClassroomData() {
  console.log('Checking classroom collection...');

  await connectMongo();

  const documents = await Classroom.find({}).exec();

  if (!documents.length) {
    console.log('No videos found in classroom collection.');
    return;
  }

  console.log(`Found ${documents.length} videos. Checking data...`);

  for (const doc of documents) {
    const data = doc.toObject();
    console.log('\nVideo ID:', doc._id.toString());
    console.log('Title:', data.title);
    console.log('Drive ID:', data.driveId);
    console.log('Course Type:', data.courseType);
    console.log('Course:', data.course);
    
    // If it has 'course' but not 'courseType', fix it
    if (data.course && !data.courseType) {
      console.log('  → Fixing: Moving "course" to "courseType"');
      doc.courseType = data.course;
      await doc.save();
    }

    // If driveId contains a URL, extract just the ID
    if (data.driveId && data.driveId.includes('drive.google.com')) {
      const match = data.driveId.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (match) {
        const extractedId = match[1];
        console.log('  → Fixing Drive ID: Extracting from URL');
        console.log('    Old:', data.driveId);
        console.log('    New:', extractedId);
        doc.driveId = extractedId;
        await doc.save();
      }
    }
  }
  
  console.log('\n✅ Done checking and fixing data!');
}

fixClassroomData()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
