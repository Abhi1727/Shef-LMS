const { connectMongo } = require('./config/mongo');
const User = require('./models/User');

(async () => {
  try {
    console.log('🔍 Checking student data in database...');

    await connectMongo();

    const students = await User.find({ role: 'student' }).exec();
    console.log('📊 Total students in database:', students.length);

    if (students.length > 0) {
      console.log('👥 Student list:');
      students.forEach((student) => {
        console.log(`  - ${student.name} (${student.email}) - ${student.course || 'No course'}`);
      });
    } else {
      console.log('❌ No students found in database');
    }

    // Also check all users to see what roles exist
    console.log('\n🔍 Checking all users...');
    const allUsers = await User.find({}).exec();
    console.log('📊 Total users in database:', allUsers.length);

    const roleCounts = {};
    allUsers.forEach((user) => {
      const role = user.role || 'unknown';
      roleCounts[role] = (roleCounts[role] || 0) + 1;
    });
    
    console.log('📈 Users by role:', roleCounts);
    
  } catch (error) {
    console.error('❌ Error checking students:', error.message);
  }
})();
