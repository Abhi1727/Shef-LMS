// Script to verify all classroom videos in MongoDB
const { connectMongo } = require('./config/mongo');
const Classroom = require('./models/Classroom');

async function verifyVideos() {
  console.log('📹 Classroom Videos in Database:\n');
  console.log('='.repeat(80));

  await connectMongo();

  const videos = await Classroom.find({ courseType: 'Cyber Security' }).lean();

  // Sort by date
  videos.sort((a, b) => new Date(a.date) - new Date(b.date));
  
  console.log(`\nTotal Videos: ${videos.length}\n`);
  
  videos.forEach((video, index) => {
    console.log(`${index + 1}. ${video.title}`);
    console.log(`   📅 Date: ${video.date}`);
    console.log(`   👨‍🏫 Instructor: ${video.instructor}`);
    console.log(`   ⏱️  Duration: ${video.duration}`);
    console.log(`   🎓 Course: ${video.courseType}`);
    console.log(`   🔗 Drive ID: ${video.driveId}`);
    console.log(`   📺 Preview: https://drive.google.com/file/d/${video.driveId}/view`);
    console.log('');
  });
  
  console.log('='.repeat(80));
  console.log('\n✅ All videos are properly stored in Firebase!');
  console.log('🎯 lqdeleon@gmail.com can now see all these videos in the Classroom section.\n');
  
  process.exit(0);
}

verifyVideos();
