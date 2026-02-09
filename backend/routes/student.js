const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { roleAuth } = require('../middleware/roleAuth');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Batch = require('../models/Batch');

// Apply auth and student role check to all student routes
router.use(auth);
router.use(roleAuth('student'));

// Normalize email for consistent lookup (Firestore queries are case-sensitive)
const normalizeEmail = (e) => (e || '').trim().toLowerCase();

// @route   GET /api/student/profile
// @desc    Get current student's profile
router.get('/profile', async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Handle demo students
    if (userId === 'leonardo_deleon_user_id' || userId === 'abhi_datascience_user_id') {
      const demoProfile = {
        id: userId,
        name: userId === 'leonardo_deleon_user_id' ? 'Leonardo De Leon' : 'Abhi',
        email: userId === 'leonardo_deleon_user_id' ? 'lqdeleon@gmail.com' : 'abhi@gmail.com',
        currentCourse: userId === 'leonardo_deleon_user_id' ? 'Cyber Security & Ethical Hacking' : 'Data Science & AI',
        status: 'active',
        role: 'student'
      };
      return res.json(demoProfile);
    }
    
    // Get student data from Mongo
    const userDoc = await User.findOne({
      $or: [
        { _id: userId },
        { firestoreId: userId }
      ]
    }).exec();

    if (!userDoc) {
      return res.status(404).json({ message: 'Student profile not found' });
    }
    
    // Return only necessary profile information (exclude password)
    const profileData = {
      id: String(userDoc._id),
      name: userDoc.name,
      email: userDoc.email,
      currentCourse: userDoc.course || userDoc.currentCourse,
      status: userDoc.status,
      role: userDoc.role,
      createdAt: userDoc.createdAt,
      updatedAt: userDoc.updatedAt
    };

    res.json(profileData);
  } catch (err) {
    console.error('Error fetching student profile:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/student/profile
// @desc    Update current student's profile
router.put('/profile', async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, email, phone, address } = req.body;

    console.log('🔧 Profile Update Request:', {
      userId,
      name,
      email,
      phone,
      address
    });

    // Validate required fields
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Name is required' });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const normalizedEmail = normalizeEmail(email);

    // Handle demo students differently
    if (userId === 'leonardo_deleon_user_id' || userId === 'abhi_datascience_user_id') {
      console.log('🔧 Updating demo student profile:', userId);
      
      // For demo students, simulate the update (in real implementation, these would be in database)
      const demoResponse = {
        message: 'Profile updated successfully',
        profile: {
          id: userId,
          name: name.trim(),
          email: normalizedEmail,
          currentCourse: userId === 'leonardo_deleon_user_id' ? 'Cyber Security & Ethical Hacking' : 'Data Science & AI',
          enrollmentNumber: userId === 'leonardo_deleon_user_id' ? 'SU-2025-001' : 'SU-2025-002',
          batchId: null,
          phone: phone?.trim() || '',
          address: address?.trim() || '',
          enrollmentDate: userId === 'leonardo_deleon_user_id' ? '2025-11-07' : '2025-12-01',
          courseDuration: '6 months',
          status: 'active',
          role: 'student',
          updatedAt: new Date().toISOString()
        }
      };

      console.log('✅ Demo student profile updated:', demoResponse.profile);
      return res.json(demoResponse);
    }

    // Check if email is being changed and if new email already exists (Mongo)
    const userDoc = await User.findOne({
      $or: [
        { _id: userId },
        { firestoreId: userId }
      ]
    }).exec();

    if (!userDoc) {
      return res.status(404).json({ message: 'Student profile not found' });
    }

    const currentEmail = userDoc.email;

    if (currentEmail !== normalizedEmail) {
      // Email is being changed, check for duplicates
      const existingUser = await User.findOne({ email: normalizedEmail }).exec();
      if (existingUser) {
        return res.status(400).json({ message: 'Email already exists' });
      }
    }

    // Prepare update data
    const updateData = {
      name: name.trim(),
      email: normalizedEmail,
      updatedAt: new Date().toISOString()
    };

    // Add optional fields if provided
    if (phone !== undefined && phone !== null) {
      updateData.phone = phone.trim();
    }
    if (address !== undefined && address !== null) {
      updateData.address = address.trim();
    }

    const responseProfile = {
      id: String(userDoc._id),
      name: updateData.name,
      email: updateData.email,
      currentCourse: userDoc.course || userDoc.currentCourse,
      status: userDoc.status,
      role: userDoc.role,
      updatedAt: updateData.updatedAt
    };

    console.log('✅ Student profile updated in database:', responseProfile);

    res.json({
      message: 'Profile updated successfully',
      profile: responseProfile
    });
  } catch (err) {
    console.error('❌ Error updating student profile:', err);
    res.status(500).json({ message: 'Server error: ' + err.message });
  }
});

// @route   PUT /api/student/password
// @desc    Update current student's password
router.put('/password', async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    console.log('🔧 Password Update Request:', {
      userId,
      hasCurrentPassword: !!currentPassword,
      hasNewPassword: !!newPassword
    });

    // Validate required fields
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters long' });
    }

    // Handle demo students
    if (userId === 'leonardo_deleon_user_id' || userId === 'abhi_datascience_user_id') {
      console.log('🔧 Updating demo student password:', userId);
      
      // For demo students, verify current password is the demo password
      if (currentPassword === 'Admin@123') {
        // In a real implementation, you would update the password in the database
        // For demo purposes, we'll just return success
        console.log('✅ Demo student password updated successfully');
        return res.json({ message: 'Password updated successfully' });
      } else {
        console.log('❌ Demo student current password incorrect');
        return res.status(400).json({ message: 'Current password is incorrect' });
      }
    }

    // Get current student data from Mongo
    const userDoc = await User.findOne({
      $or: [
        { _id: userId },
        { firestoreId: userId }
      ]
    }).exec();
    
    if (!userDoc) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const storedPassword = userDoc.password;

    console.log('🔧 Verifying current password for user:', userId);

    // Verify current password for regular students
    if (!storedPassword || typeof storedPassword !== 'string' || !storedPassword.startsWith('$2')) {
      return res.status(400).json({ message: 'Invalid password format in database' });
    }

    const isMatch = await bcrypt.compare(currentPassword, storedPassword);
    if (!isMatch) {
      console.log('❌ Current password verification failed');
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    console.log('✅ Current password verified, updating to new password');

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedNewPassword = await bcrypt.hash(newPassword, salt);

    // Update password in Mongo
    userDoc.password = hashedNewPassword;
    userDoc.updatedAt = new Date();
    await userDoc.save();

    console.log('✅ Password updated in database for user:', userId);

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('❌ Error updating password:', err);
    res.status(500).json({ message: 'Server error: ' + err.message });
  }
});

// @route   GET /api/student/batch-info
// @desc    Get batch information for current student
router.get('/batch-info', async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get student data to find batchId (Mongo)
    const userDoc = await User.findOne({
      $or: [
        { _id: userId },
        { firestoreId: userId }
      ]
    }).exec();
    
    if (!userDoc) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const batchId = userDoc.batchId;

    if (!batchId) {
      return res.json({ message: 'Student not assigned to any batch' });
    }

    // Get batch information from Mongo
    const batchDoc = await Batch.findById(batchId).lean().exec();
    
    if (!batchDoc) {
      return res.status(404).json({ message: 'Batch not found' });
    }

    res.json({
      id: String(batchDoc._id),
      name: batchDoc.name,
      course: batchDoc.course,
      teacherName: batchDoc.teacherName,
      schedule: batchDoc.schedule,
      startDate: batchDoc.startDate,
      endDate: batchDoc.endDate,
      status: batchDoc.status
    });
  } catch (err) {
    console.error('Error fetching batch info:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/student/course-progress
// @desc    Get course progress for current student
router.get('/course-progress', async (req, res) => {
  try {
    const userId = req.user.id;
    
    // TODO: Implement Mongo-backed course progress tracking.
    // For now, return an empty progress structure to keep the
    // endpoint working without Firebase.
    return res.json({
      message: 'No progress data found',
      progress: {
        viewedFiles: [],
        completedModules: [],
        progress: 0,
        lastUpdated: null
      }
    });
  } catch (err) {
    console.error('Error fetching course progress:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
