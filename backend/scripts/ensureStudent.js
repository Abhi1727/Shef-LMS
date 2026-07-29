// Ensure a generic demo student exists (for local/dev smoke tests only).
// Does not overwrite enrollment numbers on existing users.
// Prefer Admin → Enroll Student for real Sky States enrollments.

const { connectMongo } = require('../config/mongo');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Batch = require('../models/Batch');
const { allocateEnrollmentNumber } = require('../utils/enrollmentNumber');

async function ensureStudent() {
  try {
    await connectMongo();

    const email = (process.env.DEMO_STUDENT_EMAIL || 'demo.student@skystates.local').toLowerCase();
    const passwordPlain = process.env.DEMO_STUDENT_PASSWORD || 'Student@123';
    const name = process.env.DEMO_STUDENT_NAME || 'Demo Student';

    console.log(`🔍 Ensuring demo student exists: ${email}`);

    const existing = await User.findOne({ email }).exec();
    if (existing) {
      console.log('✅ Student already exists — leaving enrollment number unchanged:');
      console.log('   ID:', existing._id.toString());
      console.log('   Email:', existing.email);
      console.log('   Enrollment:', existing.enrollmentNumber || '(none)');
      console.log('   Status:', existing.status);
      process.exit(0);
    }

    const batch = await Batch.findOne({ name: 'Batch 1' }).exec();
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(passwordPlain, salt);
    const joinDate = new Date();
    const { enrollmentNumber } = await allocateEnrollmentNumber(User, joinDate);

    const student = await User.create({
      name,
      email,
      password: passwordHash,
      role: 'student',
      status: 'active',
      enrollmentNumber,
      joiningDate: joinDate,
      course: 'Data Science & AI',
      batchId: batch ? String(batch._id) : undefined,
      createdAt: joinDate,
    });

    console.log('✅ Demo student created:');
    console.log('   ID:', student._id.toString());
    console.log('   Email:', student.email);
    console.log('   Password:', passwordPlain);
    console.log('   Enrollment:', student.enrollmentNumber);
    console.log('   BatchId:', student.batchId || '(none)');

    process.exit(0);
  } catch (err) {
    console.error('❌ Error ensuring student:', err);
    process.exit(1);
  }
}

ensureStudent();
