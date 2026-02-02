// Test script to add a sample Zoom recording to the classroom
const axios = require('axios');

const testVideo = {
  title: 'Introduction to Ethical Hacking - Zoom Recording',
  instructor: 'Shubham',
  duration: '1 hr 45 min',
  date: '2025-12-20',
  courseType: 'Cyber Security',
  type: 'Live Class',
  instructorColor: '#E91E63',
  videoSource: 'zoom',
  zoomUrl: 'https://zoom.us/rec/share/sample-recording-link',
  zoomPasscode: 'Demo123'
};

async function testZoomVideo() {
  try {
    console.log('🎥 Testing Zoom video feature...');
    
    // First, login as admin to get token
    const loginResponse = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'admin@sheflms.com',
      password: 'admin123'
    });
    
    const token = loginResponse.data.token;
    console.log('✅ Admin login successful');
    
    // Add the Zoom recording
    const addVideoResponse = await axios.post(
      'http://localhost:5000/api/admin/classroom',
      testVideo,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ Zoom recording added successfully:', addVideoResponse.data);
    
    // Test student access
    const studentLoginResponse = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'lqdeleon@gmail.com',
      password: 'student123'
    });
    
    const studentToken = studentLoginResponse.data.token;
    console.log('✅ Student login successful');
    
    // Get classroom videos for student
    const classroomResponse = await axios.get('http://localhost:5000/api/dashboard/classroom', {
      headers: {
        'Authorization': `Bearer ${studentToken}`
      }
    });
    
    console.log('✅ Student can access classroom videos');
    console.log('📹 Found', classroomResponse.data.length, 'videos');
    
    if (classroomResponse.data.length > 0) {
      const video = classroomResponse.data[0];
      console.log('🎥 Sample video:', {
        title: video.title,
        videoSource: video.videoSource,
        hasAccess: video.hasAccess
      });
      
      // Test video access validation
      if (video.id) {
        const accessResponse = await axios.post(
          `http://localhost:5000/api/dashboard/classroom/${video.id}/access`,
          {},
          {
            headers: {
              'Authorization': `Bearer ${studentToken}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        console.log('✅ Video access validation successful:', accessResponse.data);
      }
    }
    
    console.log('🎉 All tests passed! Zoom video feature is working correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

testZoomVideo();
