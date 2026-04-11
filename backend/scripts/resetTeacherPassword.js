#!/usr/bin/env node
/**
 * Reset a teacher's password (fixes 400 on prod when password hash is invalid/legacy)
 * Usage: ENV_PATH=.env node scripts/resetTeacherPassword.js <teacher-email> [new-password]
 *        ENV_PATH=.env node scripts/resetTeacherPassword.js teacher@sheflms.com SuperAdmin@123
 * For prod: ENV_PATH=.env (default)
 * For dev:  ENV_PATH=.env.dev node scripts/resetTeacherPassword.js teacher@sheflms.com SuperAdmin@123
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', process.env.ENV_PATH || '.env') });
const { connectMongo } = require('../config/mongo');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

async function main() {
  const email = process.argv[2];
  const newPassword = process.argv[3] || 'SuperAdmin@123';

  if (!email) {
    console.error('Usage: node scripts/resetTeacherPassword.js <teacher-email> [new-password]');
    console.error('       ENV_PATH=.env node scripts/resetTeacherPassword.js teacher@sheflms.com SuperAdmin@123');
    process.exit(1);
  }

  const normalizedEmail = (email || '').trim().toLowerCase();
  if (!normalizedEmail) {
    console.error('Invalid email');
    process.exit(1);
  }

  await connectMongo();
  const teacher = await User.findOne({ email: normalizedEmail, role: 'teacher' }).exec();
  if (!teacher) {
    console.error(`Teacher not found: ${email}`);
    const any = await User.findOne({ email: normalizedEmail }).exec();
    if (any) console.error(`  (Found user with role: ${any.role})`);
    process.exit(1);
  }

  const hash = await bcrypt.hash(newPassword, 10);
  teacher.password = hash;
  teacher.updatedAt = new Date();
  await teacher.save();

  console.log(`✅ Password reset for ${teacher.name} (${teacher.email})`);
  console.log(`   New password: ${newPassword}`);
  console.log('   Please try logging in again.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
