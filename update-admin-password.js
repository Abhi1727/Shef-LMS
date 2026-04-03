const bcrypt = require('bcryptjs');
const { connectMongo } = require('./backend/config/mongo');
const User = require('./backend/models/User');

async function updateAdminPassword() {
  try {
    await connectMongo();
    
    const email = 'admin@sheflms.com';
    const newPassword = 'SuperAdmin@123';
    
    // Find the admin user
    const admin = await User.findOne({ email: email });
    
    if (!admin) {
      console.log('Admin user not found');
      return;
    }
    
    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    // Update the password
    await User.updateOne(
      { email: email },
      { password: hashedPassword }
    );
    
    console.log('✅ Admin password updated successfully!');
    console.log(`Email: ${email}`);
    console.log(`Password: ${newPassword}`);
    
  } catch (error) {
    console.error('Error updating admin password:', error);
  } finally {
    process.exit(0);
  }
}

updateAdminPassword();
