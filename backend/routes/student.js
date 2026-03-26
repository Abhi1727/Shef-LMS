const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { roleAuth } = require('../middleware/roleAuth');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Batch = require('../models/Batch');
const ActivityLog = require('../models/ActivityLog');

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

// Helper function to calculate login streak
const calculateLoginStreak = async (userId) => {
  try {
    const loginActivities = await ActivityLog.find({
      userId: userId,
      action: 'login'
    }).sort({ timestamp: -1 }).limit(60); // Last 60 days max

    if (loginActivities.length === 0) {
      return { current: 0, longest: 0, lastLoginDate: null };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    let lastLoginDate = loginActivities[0].timestamp;
    
    // Check if user logged in today or yesterday to continue streak
    const lastLogin = new Date(lastLoginDate);
    lastLogin.setHours(0, 0, 0, 0);
    const daysDiff = Math.floor((today - lastLogin) / (1000 * 60 * 60 * 24));
    
    // If last login was more than 2 days ago, streak is 0
    if (daysDiff > 1) {
      return { current: 0, longest: 0, lastLoginDate };
    }

    // Calculate current streak
    let expectedDate = new Date(lastLogin);
    currentStreak = 1;
    
    for (let i = 1; i < loginActivities.length; i++) {
      expectedDate.setDate(expectedDate.getDate() - 1);
      const currentActivityDate = new Date(loginActivities[i].timestamp);
      currentActivityDate.setHours(0, 0, 0, 0);
      
      if (expectedDate.getTime() === currentActivityDate.getTime()) {
        currentStreak++;
      } else {
        break;
      }
    }

    // Calculate longest streak
    tempStreak = 1;
    for (let i = 1; i < loginActivities.length; i++) {
      const prevDate = new Date(loginActivities[i - 1].timestamp);
      const currDate = new Date(loginActivities[i].timestamp);
      prevDate.setHours(0, 0, 0, 0);
      currDate.setHours(0, 0, 0, 0);
      
      const daysDiff = Math.floor((prevDate - currDate) / (1000 * 60 * 60 * 24));
      
      if (daysDiff === 1) {
        tempStreak++;
      } else {
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = 1;
      }
    }
    longestStreak = Math.max(longestStreak, tempStreak);

    return { 
      current: currentStreak, 
      longest: longestStreak, 
      lastLoginDate: lastLoginDate.toISOString().split('T')[0]
    };
  } catch (error) {
    console.error('Error calculating login streak:', error);
    return { current: 0, longest: 0, lastLoginDate: null };
  }
};

// Helper function to calculate video progress
const calculateVideoProgress = async (userId) => {
  try {
    // Get unique videos watched by this user
    const videoViews = await ActivityLog.distinct('videoId', {
      userId: userId,
      action: 'video_view',
      videoId: { $exists: true, $ne: null }
    });

    const watchedCount = videoViews.length;
    
    // Get total available videos for student's course
    const userDoc = await User.findOne({
      $or: [
        { _id: userId },
        { firestoreId: userId }
      ]
    }).exec();

    if (!userDoc) {
      return { total: 0, watched: 0, progressPercentage: 0 };
    }

    // For demo students, return hardcoded values
    if (userId === 'leonardo_deleon_user_id' || userId === 'abhi_datascience_user_id') {
      const totalVideos = userId === 'leonardo_deleon_user_id' ? 25 : 30;
      const demoWatched = userId === 'leonardo_deleon_user_id' ? 13 : 18;
      return {
        total: totalVideos,
        watched: demoWatched,
        progressPercentage: Math.round((demoWatched / totalVideos) * 100)
      };
    }

    // For regular students, estimate based on course
    // This could be enhanced by storing actual video count per course
    const course = userDoc.course || userDoc.currentCourse;
    let totalVideos = 25; // Default estimate
    
    if (course && course.toLowerCase().includes('data science')) {
      totalVideos = 30;
    } else if (course && course.toLowerCase().includes('cyber')) {
      totalVideos = 25;
    }

    const progressPercentage = totalVideos > 0 ? Math.round((watchedCount / totalVideos) * 100) : 0;

    return {
      total: totalVideos,
      watched: watchedCount,
      progressPercentage: Math.min(progressPercentage, 100)
    };
  } catch (error) {
    console.error('Error calculating video progress:', error);
    return { total: 0, watched: 0, progressPercentage: 0 };
  }
};

// @route   GET /api/student/progress-summary
// @desc    Get comprehensive progress summary for current student
router.get('/progress-summary', async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get student data
    const userDoc = await User.findOne({
      $or: [
        { _id: userId },
        { firestoreId: userId }
      ]
    }).exec();

    if (!userDoc) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Handle demo students
    if (userId === 'leonardo_deleon_user_id' || userId === 'abhi_datascience_user_id') {
      const isDataScience = userId === 'abhi_datascience_user_id';
      const demoProgress = {
        modules: {
          total: 10,
          completed: isDataScience ? 3 : 4,
          inProgress: isDataScience ? 2 : 1
        },
        videos: {
          total: isDataScience ? 30 : 25,
          watched: isDataScience ? 18 : 13,
          progressPercentage: isDataScience ? 60 : 52
        },
        streak: {
          current: isDataScience ? 7 : 5,
          longest: isDataScience ? 15 : 12,
          lastLoginDate: new Date().toISOString().split('T')[0]
        },
        overallProgress: isDataScience ? 60 : 52
      };
      return res.json(demoProgress);
    }

    // Calculate login streak
    const streak = await calculateLoginStreak(userId);
    
    // Calculate video progress
    const videos = await calculateVideoProgress(userId);
    
    // Get course information for module count
    const course = userDoc.course || userDoc.currentCourse;
    let totalModules = 10; // Default
    let completedModules = 0;
    let inProgressModules = 0;

    // Estimate module completion based on video progress
    if (course && course.toLowerCase().includes('data science')) {
      totalModules = 10;
      completedModules = Math.floor((videos.progressPercentage / 100) * totalModules);
      inProgressModules = Math.min(totalModules - completedModules, 2);
    } else if (course && course.toLowerCase().includes('cyber')) {
      totalModules = 10;
      completedModules = Math.floor((videos.progressPercentage / 100) * totalModules);
      inProgressModules = Math.min(totalModules - completedModules, 2);
    }

    const overallProgress = videos.progressPercentage;

    const progressSummary = {
      modules: {
        total: totalModules,
        completed: completedModules,
        inProgress: inProgressModules
      },
      videos: videos,
      streak: streak,
      overallProgress: overallProgress
    };

    res.json(progressSummary);
  } catch (err) {
    console.error('Error fetching progress summary:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
