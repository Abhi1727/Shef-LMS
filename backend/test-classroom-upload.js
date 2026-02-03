// Test script for classroom upload functionality
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Configuration
const API_BASE = 'http://localhost:5000/api';
const ADMIN_CREDENTIALS = {
  email: 'admin@sheflms.com',
  password: 'SuperAdmin@123'
};

// Create a small test video file (simulated)
function createTestVideoFile() {
  const testVideoPath = path.join(__dirname, 'test-video.mp4');
  
  // Create a small dummy file (in reality, this would be a real video)
  const dummyVideoContent = Buffer.alloc(1024 * 1024, 'test video data'); // 1MB dummy file
  
  fs.writeFileSync(testVideoPath, dummyVideoContent);
  console.log('✅ Test video file created:', testVideoPath);
  
  return testVideoPath;
}

async function testClassroomUpload() {
  try {
    console.log('🚀 Testing Firebase Storage Classroom Upload...\n');
    
    // Step 1: Login as admin
    console.log('📝 Step 1: Admin login...');
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, ADMIN_CREDENTIALS);
    const token = loginResponse.data.token;
    
    if (!token) {
      throw new Error('Login failed - no token received');
    }
    
    console.log('✅ Admin login successful');
    
    // Step 2: Create test video file
    const testVideoPath = createTestVideoFile();
    
    // Step 3: Upload video
    console.log('📹 Step 2: Uploading video...');
    
    const FormData = require('form-data');
    const form = new FormData();
    
    form.append('video', fs.createReadStream(testVideoPath), {
      filename: 'test-lecture.mp4',
      contentType: 'video/mp4'
    });
    
    form.append('title', 'Test Lecture - Firebase Storage');
    form.append('description', 'This is a test lecture uploaded to Firebase Storage');
    form.append('courseId', 'test-course-123');
    form.append('batchId', 'batch-001');
    form.append('domain', 'computer-science');
    form.append('duration', '45 min');
    
    const uploadResponse = await axios.post(
      `${API_BASE}/admin/classroom/upload`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          'Authorization': `Bearer ${token}`
        },
        maxContentLength: 2 * 1024 * 1024 * 1024, // 2GB
        maxBodyLength: 2 * 1024 * 1024 * 1024
      }
    );
    
    console.log('✅ Video upload successful:', uploadResponse.data);
    const lectureId = uploadResponse.data.lecture.id;
    
    // Step 4: Test lecture listing
    console.log('\n📚 Step 3: Testing lecture listing...');
    const listResponse = await axios.get(
      `${API_BASE}/classroom/test-course-123`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    console.log('✅ Lecture listing successful:', listResponse.data);
    
    // Step 5: Test video playback URL generation
    console.log('\n▶️ Step 4: Testing video playback URL...');
    const playResponse = await axios.get(
      `${API_BASE}/classroom/play/${lectureId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    console.log('✅ Playback URL generated:', {
      lectureId: playResponse.data.lectureId,
      title: playResponse.data.title,
      signedUrl: playResponse.data.signedUrl.substring(0, 100) + '...', // Truncate for display
      expiresAt: playResponse.data.expiresAt
    });
    
    // Step 6: Cleanup - Delete test lecture
    console.log('\n🗑️ Step 5: Cleaning up test data...');
    await axios.delete(
      `${API_BASE}/admin/classroom/${lectureId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    console.log('✅ Test lecture deleted');
    
    // Cleanup test file
    fs.unlinkSync(testVideoPath);
    console.log('✅ Test video file deleted');
    
    console.log('\n🎉 All tests passed! Firebase Storage integration is working correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
    
    process.exit(1);
  }
}

// Check if form-data is available
try {
  require('form-data');
  testClassroomUpload();
} catch (error) {
  console.log('❌ form-data package not found. Installing...');
  const { execSync } = require('child_process');
  execSync('npm install form-data', { stdio: 'inherit' });
  testClassroomUpload();
}
