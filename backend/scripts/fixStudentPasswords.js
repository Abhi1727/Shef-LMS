// Normalize all student accounts to have a valid bcrypt password
// and active status so they can log in.
// Default password used: Admin@123

const { connectMongo } = require('../config/mongo');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

async function fixStudentPasswords() {
  try {
    await connectMongo();

    const defaultPassword = 'Admin@123';
    const salt = await bcrypt.genSalt(10);
    const defaultHash = await bcrypt.hash(defaultPassword, salt);

    console.log('🔍 Finding student users with missing or invalid passwords...');

    const students = await User.find({ role: 'student' }).exec();
    let updatedCount = 0;

    for (const student of students) {
      const pwd = student.password;
      const needsFix = !pwd || typeof pwd !== 'string' || !pwd.startsWith('$2');

      if (needsFix) {
        student.password = defaultHash;
        if (!student.status) {
          student.status = 'active';
        }
        if (student.status !== 'active') {
          student.status = 'active';
        }
        await student.save();
        updatedCount++;
        console.log(`✅ Fixed password for student: ${student.email}`);
      }
    }

    console.log(`\n🎉 Done. Updated ${updatedCount} student account(s).`);
    console.log(`📝 Default student password: ${defaultPassword}`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error fixing student passwords:', err);
    process.exit(1);
  }
}

fixStudentPasswords();
