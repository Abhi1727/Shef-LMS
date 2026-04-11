const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Batch = require('./models/Batch');
const OneToOneBatch = require('./models/OneToOneBatch');
const User = require('./models/User');

async function testCompleteFix() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || `mongodb+srv://${process.env.MONGODB_USERNAME}:${process.env.MONGODB_PASSWORD}@${process.env.MONGODB_CLUSTER}/${process.env.MONGODB_DATABASE}?retryWrites=true&w=majority&appName=Cluster0`);
    console.log('Connected to MongoDB');

    // Find the target batch
    const targetBatch = await Batch.findOne({ 
      name: { $regex: 'BATCH-10020TO1DS&AI', $options: 'i' }
    }).populate('students', 'name email');

    if (!targetBatch) {
      console.log('Target batch not found');
      return;
    }

    console.log(`=== BEFORE FIX ===`);
    console.log(`Batch: ${targetBatch.name}`);
    console.log(`Students in batch array: ${targetBatch.students?.length || 0}`);
    targetBatch.students?.forEach(student => {
      console.log(`  - ${student.name} (${student.email})`);
    });

    // Find orphaned students
    const orphanedStudents = await User.find({
      batchId: targetBatch._id,
      _id: { $nin: targetBatch.students.map(s => s._id) },
      role: 'student'
    }).lean();

    console.log(`\nOrphaned students found: ${orphanedStudents.length}`);
    orphanedStudents.forEach(student => {
      console.log(`  - ${student.name} (${student.email})`);
    });

    // Simulate the fix - add orphaned students to batch
    if (orphanedStudents.length > 0) {
      console.log(`\n=== APPLYING FIX ===`);
      await Batch.findByIdAndUpdate(targetBatch._id, {
        $addToSet: { students: { $each: orphanedStudents.map(s => s._id) } },
        updatedAt: new Date()
      });
      console.log('Batch updated with orphaned students');

      // Verify the fix
      const updatedBatch = await Batch.findById(targetBatch._id).populate('students', 'name email');
      console.log(`\n=== AFTER FIX ===`);
      console.log(`Students in batch array: ${updatedBatch.students?.length || 0}`);
      updatedBatch.students?.forEach(student => {
        console.log(`  - ${student.name} (${student.email})`);
      });
    }

    // Test the teacher endpoint logic
    console.log(`\n=== TESTING TEACHER ENDPOINT LOGIC ===`);
    
    // Simulate what the teacher endpoint would do
    let batch = await Batch.findById(targetBatch._id).populate('students', 'name email enrollmentNumber');
    let students = batch.students.map(student => ({
      id: student._id,
      name: student.name,
      email: student.email,
      enrollmentNumber: student.enrollmentNumber
    }));

    // Check for orphaned students
    const stillOrphaned = await User.find({
      batchId: targetBatch._id,
      _id: { $nin: batch.students.map(s => s._id) },
      role: 'student'
    }).lean();

    console.log(`Students from batch array: ${students.length}`);
    console.log(`Still orphaned students: ${stillOrphaned.length}`);
    
    if (stillOrphaned.length > 0) {
      console.log('Fix failed - still have orphaned students');
    } else {
      console.log('✅ Fix successful - no orphaned students remaining');
    }

  } catch (error) {
    console.error('Error testing complete fix:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

testCompleteFix();
