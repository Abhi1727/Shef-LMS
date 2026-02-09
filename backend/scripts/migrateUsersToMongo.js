const { connectMongo } = require('../config/mongo');
const { getAllUsersFirestore } = require('../repositories/userRepository');
const User = require('../models/User');

async function migrateUsers() {
  await connectMongo();

  const firestoreUsers = await getAllUsersFirestore();
  console.log(`Found ${firestoreUsers.length} users in Firestore`);

  let migrated = 0;

  for (const u of firestoreUsers) {
    try {
      const existing = await User.findOne({ email: u.email }).exec();
      if (existing) {
        continue;
      }

      const user = new User({
        name: u.name || u.fullName || '',
        email: u.email,
        firestoreId: u.id,
        password: u.password || 'NA',
        role: u.role || 'student',
        status: u.status || 'active',
        course: u.course || u.currentCourse || '',
        enrollmentNumber: u.enrollmentNumber || '',
        batchId: u.batchId || '',
        domain: u.domain || '',
        title: u.title || '',
        company: u.company || '',
        enrolledCourses: [],
        lastLoginIP: u.lastLoginIP || null,
        lastLoginTimestamp: u.lastLoginTimestamp ? new Date(u.lastLoginTimestamp) : null,
      });

      await user.save();
      migrated += 1;
    } catch (err) {
      console.error('Error migrating user', u.id, err.message);
    }
  }

  console.log(`Migrated ${migrated} users to MongoDB`);
}

migrateUsers()
  .then(() => {
    console.log('User migration complete');
    process.exit(0);
  })
  .catch((err) => {
    console.error('User migration failed', err);
    process.exit(1);
  });
