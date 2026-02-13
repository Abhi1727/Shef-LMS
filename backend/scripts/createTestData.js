const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { connectMongo } = require('../config/mongo');
const User = require('../models/User');
const Batch = require('../models/Batch');

async function createTestData() {
  try {
    await connectMongo();
    console.log('✅ Connected to MongoDB');

    // Clear existing test data
    await User.deleteMany({});
    await Batch.deleteMany({});
    console.log('🗑️ Cleared existing data');

    // Hash password
    const password = 'Admin@123';
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create teachers first
    const teachers = [
      {
        name: 'Dr. Sarah Johnson',
        email: 'sarah.johnson@shef.com',
        password: hashedPassword,
        role: 'teacher',
        status: 'active',
        course: 'Cyber Security & Ethical Hacking',
        title: 'Senior Security Expert',
        company: 'Shef Institute',
        phone: '+1-555-0101',
        address: '123 Tech Street, Silicon Valley, CA',
        domain: 'cybersecurity',
        specialization: 'Penetration Testing',
        experience: '10 years',
        bio: 'Expert in ethical hacking and security audits'
      },
      {
        name: 'Prof. Michael Chen',
        email: 'michael.chen@shef.com',
        password: hashedPassword,
        role: 'teacher',
        status: 'active',
        course: 'Cyber Security & Ethical Hacking',
        title: 'Network Security Specialist',
        company: 'Shef Institute',
        phone: '+1-555-0102',
        address: '456 Security Ave, San Francisco, CA',
        domain: 'network-security',
        specialization: 'Network Defense',
        experience: '8 years',
        bio: 'Specialized in network security and infrastructure protection'
      },
      {
        name: 'Dr. Emily Rodriguez',
        email: 'emily.rodriguez@shef.com',
        password: hashedPassword,
        role: 'teacher',
        status: 'active',
        course: 'Full Stack Web Development',
        title: 'Full Stack Developer',
        company: 'Shef Institute',
        phone: '+1-555-0103',
        address: '789 Dev Road, Austin, TX',
        domain: 'web-development',
        specialization: 'React & Node.js',
        experience: '7 years',
        bio: 'Passionate about modern web technologies and teaching'
      },
      {
        name: 'Prof. David Kim',
        email: 'david.kim@shef.com',
        password: hashedPassword,
        role: 'teacher',
        status: 'active',
        course: 'Full Stack Web Development',
        title: 'Backend Architect',
        company: 'Shef Institute',
        phone: '+1-555-0104',
        address: '321 Code Blvd, Seattle, WA',
        domain: 'backend-development',
        specialization: 'Database Design & APIs',
        experience: '12 years',
        bio: 'Expert in scalable backend systems and database architecture'
      }
    ];

    const createdTeachers = await User.insertMany(teachers);
    console.log(`✅ Created ${createdTeachers.length} teachers`);

    // Now create batches with teacher assignments
    const batches = [
      {
        name: 'Batch Alpha - Cyber Security',
        description: 'Advanced cyber security and ethical hacking batch',
        startDate: new Date('2025-01-15'),
        endDate: new Date('2025-06-15'),
        status: 'active',
        course: 'Cyber Security & Ethical Hacking',
        schedule: 'Mon-Wed-Fri, 6:00 PM - 8:00 PM',
        maxStudents: 25,
        teacherId: String(createdTeachers[0]._id), // Dr. Sarah Johnson
        teacherName: createdTeachers[0].name
      },
      {
        name: 'Batch Beta - Web Development',
        description: 'Full stack web development batch',
        startDate: new Date('2025-02-01'),
        endDate: new Date('2025-07-01'),
        status: 'active',
        course: 'Full Stack Web Development',
        schedule: 'Tue-Thu-Sat, 7:00 PM - 9:00 PM',
        maxStudents: 30,
        teacherId: String(createdTeachers[2]._id), // Dr. Emily Rodriguez
        teacherName: createdTeachers[2].name
      }
    ];

    const createdBatches = await Batch.insertMany(batches);
    console.log(`✅ Created ${createdBatches.length} batches`);

    // Create students
    const students = [
      {
        name: 'Alex Thompson',
        email: 'alex.thompson@student.com',
        password: hashedPassword,
        role: 'student',
        status: 'active',
        course: 'Cyber Security & Ethical Hacking',
        batchId: createdBatches[0]._id,
        enrollmentNumber: 'CS2025001',
        phone: '+1-555-1001',
        address: '101 Student Lane, Boston, MA'
      },
      {
        name: 'Priya Patel',
        email: 'priya.patel@student.com',
        password: hashedPassword,
        role: 'student',
        status: 'active',
        course: 'Cyber Security & Ethical Hacking',
        batchId: createdBatches[0]._id,
        enrollmentNumber: 'CS2025002',
        phone: '+1-555-1002',
        address: '102 Student Lane, Boston, MA'
      },
      {
        name: 'James Wilson',
        email: 'james.wilson@student.com',
        password: hashedPassword,
        role: 'student',
        status: 'active',
        course: 'Cyber Security & Ethical Hacking',
        batchId: createdBatches[0]._id,
        enrollmentNumber: 'CS2025003',
        phone: '+1-555-1003',
        address: '103 Student Lane, Boston, MA'
      },
      {
        name: 'Maria Garcia',
        email: 'maria.garcia@student.com',
        password: hashedPassword,
        role: 'student',
        status: 'active',
        course: 'Cyber Security & Ethical Hacking',
        batchId: createdBatches[0]._id,
        enrollmentNumber: 'CS2025004',
        phone: '+1-555-1004',
        address: '104 Student Lane, Boston, MA'
      },
      {
        name: 'Robert Lee',
        email: 'robert.lee@student.com',
        password: hashedPassword,
        role: 'student',
        status: 'active',
        course: 'Cyber Security & Ethical Hacking',
        batchId: createdBatches[0]._id,
        enrollmentNumber: 'CS2025005',
        phone: '+1-555-1005',
        address: '105 Student Lane, Boston, MA'
      },
      {
        name: 'Sophie Martin',
        email: 'sophie.martin@student.com',
        password: hashedPassword,
        role: 'student',
        status: 'active',
        course: 'Full Stack Web Development',
        batchId: createdBatches[1]._id,
        enrollmentNumber: 'WD2025001',
        phone: '+1-555-2001',
        address: '201 Developer Ave, Portland, OR'
      },
      {
        name: 'Ahmed Hassan',
        email: 'ahmed.hassan@student.com',
        password: hashedPassword,
        role: 'student',
        status: 'active',
        course: 'Full Stack Web Development',
        batchId: createdBatches[1]._id,
        enrollmentNumber: 'WD2025002',
        phone: '+1-555-2002',
        address: '202 Developer Ave, Portland, OR'
      },
      {
        name: 'Lisa Anderson',
        email: 'lisa.anderson@student.com',
        password: hashedPassword,
        role: 'student',
        status: 'active',
        course: 'Full Stack Web Development',
        batchId: createdBatches[1]._id,
        enrollmentNumber: 'WD2025003',
        phone: '+1-555-2003',
        address: '203 Developer Ave, Portland, OR'
      },
      {
        name: 'Carlos Rodriguez',
        email: 'carlos.rodriguez@student.com',
        password: hashedPassword,
        role: 'student',
        status: 'active',
        course: 'Full Stack Web Development',
        batchId: createdBatches[1]._id,
        enrollmentNumber: 'WD2025004',
        phone: '+1-555-2004',
        address: '204 Developer Ave, Portland, OR'
      },
      {
        name: 'Nina Petrov',
        email: 'nina.petrov@student.com',
        password: hashedPassword,
        role: 'student',
        status: 'active',
        course: 'Full Stack Web Development',
        batchId: createdBatches[1]._id,
        enrollmentNumber: 'WD2025005',
        phone: '+1-555-2005',
        address: '205 Developer Ave, Portland, OR'
      }
    ];

    const createdStudents = await User.insertMany(students);
    console.log(`✅ Created ${createdStudents.length} students`);

    // Create admin user
    const admin = {
      name: 'System Administrator',
      email: 'admin@shef.com',
      password: hashedPassword,
      role: 'admin',
      status: 'active',
      title: 'System Administrator',
      company: 'Shef Institute',
      phone: '+1-555-0000',
      address: '999 Admin Tower, New York, NY'
    };

    await User.create(admin);
    console.log('✅ Created admin user');

    console.log('\n🎉 Test data created successfully!');
    console.log('\n📋 Login Credentials (Password: Admin@123):');
    console.log('\n👨‍💼 Admin:');
    console.log('   Email: admin@shef.com');
    
    console.log('\n👨‍🏫 Teachers:');
    teachers.forEach(teacher => {
      console.log(`   ${teacher.name}: ${teacher.email}`);
    });
    
    console.log('\n👨‍🎓 Students:');
    students.forEach(student => {
      console.log(`   ${student.name}: ${student.email} (${student.enrollmentNumber})`);
    });

    console.log('\n📚 Batches:');
    createdBatches.forEach(batch => {
      console.log(`   ${batch.name} (${batch.course})`);
    });

  } catch (error) {
    console.error('❌ Error creating test data:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

createTestData();
