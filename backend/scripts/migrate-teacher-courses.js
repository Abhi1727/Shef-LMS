const mongoose = require('mongoose');
require('dotenv').config();

// Import User model
const User = require('./models/User');

async function migrateTeacherCourseData() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/shef-lms', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('🔗 Connected to MongoDB');

    // Find all teachers who have domain but no assignedCourses
    const teachersNeedingMigration = await User.find({
      role: 'teacher',
      $or: [
        { assignedCourses: { $exists: false } },
        { assignedCourses: { $eq: null } },
        { assignedCourses: { $eq: [] } },
        { assignedCourses: { $size: 0 } }
      ],
      domain: { $exists: true, $ne: null, $ne: '' }
    });

    console.log(`📊 Found ${teachersNeedingMigration.length} teachers needing migration`);

    if (teachersNeedingMigration.length === 0) {
      console.log('✅ All teachers already have proper assignedCourses data');
      return;
    }

    // Migrate each teacher
    for (const teacher of teachersNeedingMigration) {
      const updateData = {
        assignedCourses: [teacher.domain]
      };

      await User.findByIdAndUpdate(teacher._id, updateData, { new: true });
      
      console.log(`✅ Migrated teacher: ${teacher.name} (${teacher.email})`);
      console.log(`   - Domain: ${teacher.domain}`);
      console.log(`   - assignedCourses set to: [${teacher.domain}]`);
    }

    console.log('🎉 Migration completed successfully');

    // Verify migration
    const teachersStillNeedingMigration = await User.find({
      role: 'teacher',
      $or: [
        { assignedCourses: { $exists: false } },
        { assignedCourses: { $eq: null } },
        { assignedCourses: { $eq: [] } },
        { assignedCourses: { $size: 0 } }
      ],
      domain: { $exists: true, $ne: null, $ne: '' }
    });

    console.log(`📊 Verification: ${teachersStillNeedingMigration.length} teachers still need migration`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateTeacherCourseData();
}

module.exports = migrateTeacherCourseData;
