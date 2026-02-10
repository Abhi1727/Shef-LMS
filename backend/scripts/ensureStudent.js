// Ensure a specific student exists in MongoDB with active status and known credentials

const { connectMongo } = require('../config/mongo');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Batch = require('../models/Batch');

async function ensureStudent() {
  try {
    await connectMongo();

    const email = 'wilcherb2870@gmail.com';
    const passwordPlain = 'Admin@123'; // adjust if you want a different password

    console.log(`🔍 Ensuring student exists: ${email}`);

    // Use existing Batch 1 if present
    const batch = await Batch.findOne({ name: 'Batch 1' }).exec();

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(passwordPlain, salt);

    const now = new Date();

    const update = {
      name: 'Student',
      email: email.toLowerCase(),
      password: passwordHash,
      role: 'student',
      status: 'active',
      enrollmentNumber: 'SU-2025-CUSTOM',
      course: 'Cyber Security & Ethical Hacking',
      batchId: batch ? String(batch._id) : undefined,
      updatedAt: now
    };

    const student = await User.findOneAndUpdate(
      { email: email.toLowerCase() },
      update,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).exec();

    console.log('✅ Student ensured in MongoDB:');
    console.log('   ID:', student._id.toString());
    console.log('   Email:', student.email);
    console.log('   Password:', passwordPlain);
    console.log('   Role:', student.role);
    console.log('   Status:', student.status);
    console.log('   BatchId:', student.batchId || '(none)');

    process.exit(0);
  } catch (err) {
    console.error('❌ Error ensuring student:', err);
    process.exit(1);
  }
}

ensureStudent();
