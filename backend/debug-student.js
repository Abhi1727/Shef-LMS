// Debug script to check student login and access
const axios = require('axios');

async function debugStudentLogin() {
  try {
    console.log('🔍 Debugging student login process...');
    
    // Test student login
    const loginResponse = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'lqdeleon@gmail.com',
      password: 'Admin@123'
    });
    
    const { token, user } = loginResponse.data;
    console.log('✅ Login successful');
    console.log('User data from login:', {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      currentCourse: user.currentCourse
    });
    
    // Test classroom access
    console.log('🎓 Testing classroom access...');
    const classroomResponse = await axios.get('http://localhost:5000/api/dashboard/classroom', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('✅ Classroom access successful');
    console.log('Videos found:', classroomResponse.data.length);
    
    // Test specific video access
    const cyber1Video = classroomResponse.data.find(v => v.title === 'cyber1');
    if (cyber1Video) {
      console.log('🎥 Found cyber1 video:', {
        id: cyber1Video.id,
        hasAccess: cyber1Video.hasAccess,
        accessDeniedReason: cyber1Video.accessDeniedReason
      });
      
      // Test the access validation endpoint
      console.log('🔐 Testing access validation...');
      const accessResponse = await axios.post(
        `http://localhost:5000/api/dashboard/classroom/${cyber1Video.id}/access`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('✅ Access validation result:', accessResponse.data);
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error.response?.data || error.message);
  }
}

debugStudentLogin();
