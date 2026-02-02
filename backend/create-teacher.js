// Create teacher record in Firestore
const { db } = require('./config/firebase');

async function createTeacherRecord() {
  try {
    console.log('👨‍🏫 Creating teacher record in Firestore...');
    
    const teacherData = {
      name: 'Dr. Sarah Mitchell',
      email: 'teacher@sheflms.com',
      password: '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWDeBlkxiRlO.J4m', // Admin@123
      role: 'teacher',
      domain: 'Cyber Security & Ethical Hacking',
      experience: '8 years in cybersecurity education',
      age: 35,
      assignedCourses: ['Cyber Security & Ethical Hacking'],
      department: 'Cyber Security',
      phone: '+1-555-0123',
      address: '789 University Ave, Boston, MA',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Check if teacher already exists
    const existingTeacher = await db.collection('users').where('email', '==', 'teacher@sheflms.com').get();
    
    if (existingTeacher.empty) {
      // Create new teacher record
      const docRef = await db.collection('users').add(teacherData);
      console.log('✅ Teacher record created with ID:', docRef.id);
    } else {
      // Update existing teacher record
      const teacherId = existingTeacher.docs[0].id;
      await db.collection('users').doc(teacherId).update(teacherData);
      console.log('✅ Teacher record updated with ID:', teacherId);
    }
    
    console.log('🎉 Teacher setup complete!');
    
  } catch (error) {
    console.error('❌ Error creating teacher record:', error);
  }
}

createTeacherRecord();
