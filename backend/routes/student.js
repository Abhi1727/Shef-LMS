const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const auth = require('../middleware/auth');
const { roleAuth } = require('../middleware/roleAuth');
const bcrypt = require('bcryptjs');

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
    
    // Get student data from Firestore
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ message: 'Student profile not found' });
    }

    const userData = userDoc.data();
    
    // Return only necessary profile information (exclude password)
    const profileData = {
      id: userDoc.id,
      name: userData.name,
      email: userData.email,
      currentCourse: userData.course || userData.currentCourse,
      status: userData.status,
      role: userData.role,
      createdAt: userData.createdAt,
      updatedAt: userData.updatedAt
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

    // Check if email is being changed and if new email already exists
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ message: 'Student profile not found' });
    }

    const currentEmail = userDoc.data()?.email;

    if (currentEmail !== normalizedEmail) {
      // Email is being changed, check for duplicates
      const existingUserSnapshot = await db.collection('users')
        .where('email', '==', normalizedEmail)
        .get();
      
      if (!existingUserSnapshot.empty) {
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

    console.log('🔧 Updating Firestore with data:', updateData);

    // Update student profile in Firestore
    await db.collection('users').doc(userId).update(updateData);

    // Get updated profile data to return
    const updatedDoc = await db.collection('users').doc(userId).get();
    const updatedData = updatedDoc.data();

    const responseProfile = {
      id: userId,
      name: updatedData.name,
      email: updatedData.email,
      currentCourse: updatedData.course || updatedData.currentCourse,
      status: updatedData.status,
      role: updatedData.role,
      updatedAt: updatedData.updatedAt
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

    // Get current student data
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const userData = userDoc.data();
    const storedPassword = userData.password;

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

    // Update password in Firestore
    await db.collection('users').doc(userId).update({
      password: hashedNewPassword,
      updatedAt: new Date().toISOString()
    });

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
    
    // Get student data to find batchId
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const userData = userDoc.data();
    const batchId = userData.batchId;

    if (!batchId) {
      return res.json({ message: 'Student not assigned to any batch' });
    }

    // Get batch information
    const batchDoc = await db.collection('batches').doc(batchId).get();
    
    if (!batchDoc.exists) {
      return res.status(404).json({ message: 'Batch not found' });
    }

    const batchData = batchDoc.data();

    res.json({
      id: batchId,
      name: batchData.name,
      course: batchData.course,
      teacherName: batchData.teacherName,
      schedule: batchData.schedule,
      startDate: batchData.startDate,
      endDate: batchData.endDate,
      status: batchData.status
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
    
    // Get progress data from userProgress collection
    const progressDoc = await db.collection('userProgress').doc(userId).get();
    
    if (!progressDoc.exists) {
      return res.json({
        message: 'No progress data found',
        progress: {
          viewedFiles: [],
          completedModules: [],
          progress: 0,
          lastUpdated: null
        }
      });
    }

    const progressData = progressDoc.data();

    res.json({
      viewedFiles: progressData.viewedFiles || [],
      completedModules: progressData.completedModules || [],
      progress: progressData.progress || 0,
      lastUpdated: progressData.lastUpdated,
      enrollmentDate: progressData.enrollmentDate,
      currentCourse: progressData.currentCourse,
      courseSlug: progressData.courseSlug,
      status: progressData.status || 'active'
    });
  } catch (err) {
    console.error('Error fetching course progress:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
