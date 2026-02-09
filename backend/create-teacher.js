// Create teacher record in MongoDB (no Firebase)
const { connectMongo } = require('./config/mongo');
const User = require('./models/User');

async function createTeacherRecord() {
  try {
    console.log('👨‍🏫 Creating teacher record in MongoDB...');

    await connectMongo();

    const teacherEmail = 'teacher@sheflms.com';

    const teacherData = {
      name: 'Dr. Sarah Mitchell',
      email: teacherEmail,
      // This is the bcrypt hash for "Admin@123"
      password: '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWDeBlkxiRlO.J4m',
      role: 'teacher',
      domain: 'Cyber Security & Ethical Hacking',
      experience: '8 years in cybersecurity education',
      age: 35,
      department: 'Cyber Security',
      phone: '+1-555-0123',
      address: '789 University Ave, Boston, MA',
      status: 'active',
      updatedAt: new Date()
    };

    let teacher = await User.findOne({ email: teacherEmail });

    if (!teacher) {
      teacher = await User.create({
        ...teacherData,
        createdAt: new Date(),
      });
      console.log('✅ Teacher record created with ID:', teacher._id.toString());
    } else {
      Object.assign(teacher, teacherData);
      await teacher.save();
      console.log('✅ Teacher record updated with ID:', teacher._id.toString());
    }

    console.log('🎉 Teacher setup complete!');
  } catch (error) {
    console.error('❌ Error creating teacher record:', error);
  } finally {
    // Let Node exit naturally
    process.exit(0);
  }
}

createTeacherRecord();
