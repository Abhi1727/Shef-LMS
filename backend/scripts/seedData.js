// MongoDB seeding script for core collections (courses / optional demo batch).
// Does NOT upsert real student accounts or hardcoded enrollment numbers.
// New students should be created via the admin enrollment form (SKY_MM_YYYY_####).

const { connectMongo } = require('../config/mongo');
const Course = require('../models/Course');
const Batch = require('../models/Batch');

async function seedData() {
  try {
    await connectMongo();
    console.log('🚀 Starting to seed MongoDB data...\n');

    const now = new Date();

    console.log('📚 Adding courses...');
    const courses = [
      {
        slug: 'cyber-security-ethical-hacking',
        title: 'Cyber Security & Ethical Hacking',
        description:
          'Master cybersecurity fundamentals, ethical hacking techniques, penetration testing, and security analysis. Learn to protect systems and networks from cyber threats.',
        duration: '6 months',
        status: 'active',
        instructor: 'Sky States Instructor',
        price: 49999,
      },
      {
        slug: 'data-science-ai',
        title: 'Data Science & AI',
        description:
          'Learn data analysis, machine learning, deep learning, and AI. Master Python, statistics, and build real-world AI applications.',
        duration: '6 months',
        status: 'active',
        instructor: 'Sky States Instructor',
        price: 59999,
      },
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

    console.log('\n👥 Ensuring demo batch (no student hardcodes)...');
    const primaryCourse = savedCourses[0];
    const batch = await Batch.findOneAndUpdate(
      { name: 'Batch 1' },
      {
        name: 'Batch 1',
        course: primaryCourse._id,
        status: 'active',
        updatedAt: now,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log(`  ✅ Ensured batch: ${batch.name}`);

    console.log('\nℹ️  Student accounts are not seeded here.');
    console.log('   Use Admin → Enroll Student (auto SKY_MM_YYYY_#### enrollment numbers).');
    console.log('\n🎉 MongoDB course/batch seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding MongoDB data:', error);
    process.exit(1);
  }
}

seedData();
