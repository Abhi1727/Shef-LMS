const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('./backend/shef-lms-firebase-adminsdk-b8k4b-e50c2cb405.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function testInstantMeeting() {
  try {
    console.log('Creating instant meeting...');
    
    // Set current date and time
    const now = new Date();
    const scheduledDate = now.toISOString().split('T')[0];
    const scheduledTime = now.toTimeString().slice(0, 5);
    
    // Create meeting data
    const meetingData = {
      title: 'Test Instant Meeting',
      course: 'Data Science',
      scheduledDate: scheduledDate,
      scheduledTime: scheduledTime,
      duration: '120 mins',
      instructor: 'Test Instructor',
      description: 'Instant live session',
      roomName: 'batch-default-test123',
      moderatorUrl: 'https://meet.learnwithus.sbs/batch-default-test123#config.startWithAudioMuted=false',
      zoomLink: 'https://meet.learnwithus.sbs/batch-default-test123',
      batchId: 'default',
      status: 'scheduled',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      participants: []
    };
    
    // Add to Firestore
    const result = await admin.firestore().collection('liveClasses').add(meetingData);
    
    console.log('✅ Meeting created successfully!');
    console.log('Meeting ID:', result.id);
    console.log('Meeting URL:', meetingData.zoomLink);
    console.log('\nMeeting details:');
    console.log(JSON.stringify(meetingData, null, 2));
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testInstantMeeting();
