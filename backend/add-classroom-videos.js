// Script to add classroom videos directly to MongoDB Classroom collection
const { connectMongo } = require('./config/mongo');
const Classroom = require('./models/Classroom');

const videos = [
  // Original 6 videos (Nov 8-23, 2025) - Found in git history
  {
    title: 'Phases of Ethical Hacking, Security & Risk Management',
    driveId: '1SBjP2SNFJgvXDa2z1ho2vBKmUewO0NUp',
    instructor: 'Shubham',
    duration: '1 hr 59 min',
    date: '2025-11-08',
    courseType: 'Cyber Security',
    type: 'Live Class',
    instructorColor: '#E91E63'
  },
  {
    title: 'Phases of Ethical Hacking',
    driveId: '18r_lBdxphW8fGzF4aLuRrzpSeCSSxVgg',
    instructor: 'Shubham',
    duration: '1 hr 47 min',
    date: '2025-11-09',
    courseType: 'Cyber Security',
    type: 'Live Class',
    instructorColor: '#E91E63'
  },
  {
    title: 'Ports & Protocols',
    driveId: '1pn6h4EGyWK-c5sPCkTMaJiFLXUFvpOWP',
    instructor: 'Shubham',
    duration: '1 hr 49 min',
    date: '2025-11-15',
    courseType: 'Cyber Security',
    type: 'Live Class',
    instructorColor: '#E91E63'
  },
  {
    title: 'Ports & Protocols',
    driveId: '1Ewl8ZVOB9g-4VrH9ZA97CcLxDDdbibQz',
    instructor: 'Shubham',
    duration: '2 hr 07 min',
    date: '2025-11-16',
    courseType: 'Cyber Security',
    type: 'Live Class',
    instructorColor: '#E91E63'
  },
  {
    title: 'IP Address',
    driveId: '1Ta5P35aWj4vyi6OPMiBk-1pA6BX8NrYW',
    instructor: 'Shubham',
    duration: '1 hr 51 min',
    date: '2025-11-22',
    courseType: 'Cyber Security',
    type: 'Live Class',
    instructorColor: '#E91E63'
  },
  {
    title: 'IP Addressing & Subnetting',
    driveId: '1Yb-ndaqMLbmAyMqJ0Knhjdj4YrgGzHV5',
    instructor: 'Shubham',
    duration: '1 hr 56 min',
    date: '2025-11-23',
    courseType: 'Cyber Security',
    type: 'Live Class',
    instructorColor: '#E91E63'
  },
  // Current 6 videos (Nov 29 - Dec 14, 2025)
  {
    title: 'Wireshark Packet Analyzer',
    driveId: '1kmtUSrgCSvT-HC6Q66Ys85rKu7TxZ0Pt',
    instructor: 'Shubham',
    duration: '1 hr 53 min',
    date: '2025-11-29',
    courseType: 'Cyber Security',
    type: 'Live Class',
    instructorColor: '#E91E63'
  },
  {
    title: 'How a website is running full descriptional',
    driveId: '1-VQgKiNRRPNU8KvTYgXn-XYtUK9LR-7a',
    instructor: 'Shubham',
    duration: '1 hr 53 min',
    date: '2025-11-30',
    courseType: 'Cyber Security',
    type: 'Live Class',
    instructorColor: '#E91E63'
  },
  {
    title: 'Project 2 assignment discussion and set up the lab',
    driveId: '1LfZfiEaDqzBYszizHvqlwBjF0A3LnlOu',
    instructor: 'Shubham',
    duration: '2 hr 07 min',
    date: '2025-12-06',
    courseType: 'Cyber Security',
    type: 'Live Class',
    instructorColor: '#E91E63'
  },
  {
    title: 'Project 2 assignment discussion continued and Linux basics',
    driveId: '1Xy7iUr45U3yuKQRNTL8fckau9tV_8HJl',
    instructor: 'Shubham',
    duration: '2 hr 07 min',
    date: '2025-12-07',
    courseType: 'Cyber Security',
    type: 'Live Class',
    instructorColor: '#E91E63'
  },
  {
    title: 'Linux Introduction',
    driveId: '1T4ZkrEdvyl7nMCv2HL2k511a_KatFRSP',
    instructor: 'Shubham',
    duration: '2 hr 28 min',
    date: '2025-12-12',
    courseType: 'Cyber Security',
    type: 'Live Class',
    instructorColor: '#E91E63'
  },
  {
    title: 'Linux Commands',
    driveId: '15RZYXsS3Hxm2IuuKiw5ylhp1NFTfIU5k',
    instructor: 'Shubham',
    duration: '1 hr 57 min',
    date: '2025-12-14',
    courseType: 'Cyber Security',
    type: 'Live Class',
    instructorColor: '#E91E63'
  }
];

async function addVideos() {
  console.log('Adding classroom videos to MongoDB classroom collection...\n');

  try {
    await connectMongo();

    const existingDocs = await Classroom.find({}).select('title driveId').lean();
    const existingTitles = new Set(existingDocs.map(v => v.title));
    const existingDriveIds = new Set(existingDocs.map(v => v.driveId));

    console.log(`Found ${existingDocs.length} existing videos in database\n`);

    let addedCount = 0;
    let skippedCount = 0;
    
    for (const video of videos) {
      // Check if video already exists by title or drive ID
      if (existingTitles.has(video.title) || existingDriveIds.has(video.driveId)) {
        console.log(`⏭️  Skipped (already exists): ${video.title}`);
        skippedCount++;
        continue;
      }
      
      // Add timestamp fields
      const videoDoc = new Classroom({
        ...video,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const saved = await videoDoc.save();
      console.log(`✅ Added: ${video.title} (ID: ${saved._id.toString()})`);
      addedCount++;
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Added: ${addedCount} videos`);
    console.log(`   ⏭️  Skipped: ${skippedCount} videos (already exist)`);
    console.log(`   📹 Total: ${videos.length} videos processed`);
    
  } catch (error) {
    console.error('❌ Error adding videos:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

addVideos();
