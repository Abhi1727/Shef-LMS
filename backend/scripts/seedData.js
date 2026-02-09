// MongoDB seeding script for core collections
// Previously this file seeded Firestore via Firebase Admin.
// It now seeds Mongo using the existing Mongoose models.

const { connectMongo } = require('../config/mongo');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Batch = require('../models/Batch');
const Course = require('../models/Course');

async function seedData() {
  try {
    await connectMongo();
    console.log('🚀 Starting to seed MongoDB data...\n');

    const now = new Date();

    // 1. Add Courses (upsert by title)
    console.log('📚 Adding courses...');
    const courses = [
      {
        slug: 'cyber-security-ethical-hacking',
        title: 'Cyber Security & Ethical Hacking',
        description: 'Master cybersecurity fundamentals, ethical hacking techniques, penetration testing, and security analysis. Learn to protect systems and networks from cyber threats.',
        duration: '6 months',
        status: 'active',
        instructor: 'Shubham',
        price: 49999
      },
      {
        slug: 'data-science-ai',
        title: 'Data Science & AI',
        description: 'Learn data analysis, machine learning, deep learning, and AI. Master Python, statistics, and build real-world AI applications.',
        duration: '6 months',
        status: 'active',
        instructor: 'SHEF Instructor',
        price: 59999
      }
    ];

    const savedCourses = [];
    for (const course of courses) {
      const saved = await Course.findOneAndUpdate(
        { slug: course.slug },
        { ...course, updatedAt: now },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      savedCourses.push(saved);
      console.log(`  ✅ Ensured course: ${saved.title}`);
    }

    // 2. Add a demo batch linked to first course
    console.log('\n👥 Adding batch and students...');
    const primaryCourse = savedCourses[0];

    const batch = await Batch.findOneAndUpdate(
      { name: 'Batch 1' },
      {
        name: 'Batch 1',
        course: primaryCourse._id,
        status: 'active',
        updatedAt: now
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log(`  ✅ Ensured batch: ${batch.name}`);

    // 3. Add Students
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('Admin@123', salt);

    const students = [
      {
        name: 'Leonardo De Leon',
        email: 'lqdeleon@gmail.com',
        password: hashedPassword,
        role: 'student',
        status: 'active',
        enrollmentNumber: 'SU-2025-001',
        course: primaryCourse.title,
        batchId: batch._id,
        phone: '',
        address: ''
      },
      {
        name: 'Abhi',
        email: 'abhi@gmail.com',
        password: hashedPassword,
        role: 'student',
        status: 'active',
        enrollmentNumber: 'SU-2025-002',
        course: 'Data Science & AI',
        batchId: batch._id,
        phone: '',
        address: ''
      }
    ];

    for (const student of students) {
      const saved = await User.findOneAndUpdate(
        { email: student.email },
        { ...student, updatedAt: now },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      console.log(`  ✅ Ensured student: ${saved.name} (${saved.email})`);
    }

    console.log('\n🎉 MongoDB data seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding MongoDB data:', error);
    process.exit(1);
  }
}

seedData();
