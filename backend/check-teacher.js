// Check teacher data in MongoDB
const { connectMongo } = require('./config/mongo');
const User = require('./models/User');

async function checkTeacherData() {
  try {
    console.log('🔍 Checking teacher data in MongoDB...');

    await connectMongo();

    const teacher = await User.findOne({ email: 'teacher@sheflms.com' }).exec();

    if (teacher) {
      console.log('User doc:', teacher._id.toString(), teacher.toObject());
    } else {
      console.log('No teacher found with email teacher@sheflms.com');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkTeacherData();
