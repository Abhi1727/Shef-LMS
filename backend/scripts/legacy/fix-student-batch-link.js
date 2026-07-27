const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Batch = require('./models/Batch');
const OneToOneBatch = require('./models/OneToOneBatch');
const User = require('./models/User');

async function fixStudentBatchLink() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || `mongodb+srv://${process.env.MONGODB_USERNAME}:${process.env.MONGODB_PASSWORD}@${process.env.MONGODB_CLUSTER}/${process.env.MONGODB_DATABASE}?retryWrites=true&w=majority&appName=Cluster0`);
    console.log('Connected to MongoDB');

    // Find the target batch
    const targetBatch = await Batch.findOne({ 
      name: { $regex: 'BATCH-10020TO1DS&AI', $options: 'i' }
    });

    if (!targetBatch) {
      console.log('Target batch not found');
      return;
    }

    console.log(`Found target batch: ${targetBatch.name} (${targetBatch._id})`);
    console.log(`Current students count: ${targetBatch.students?.length || 0}`);

    // Find all students who should be in this batch
    const studentsForBatch = await User.find({
      $or: [
        { name: { $regex: 'Priya', $options: 'i' } },
        { name: { $regex: 'Nageshwari', $options: 'i' } }
      ],
      role: 'student'
    }).lean();

    console.log(`\nFound ${studentsForBatch.length} students who should be in this batch:`);
    studentsForBatch.forEach(student => {
      console.log(`- ${student.name} (${student.email})`);
      console.log(`  Current batchId: ${student.batchId}`);
      console.log(`  Should be in batch: ${targetBatch._id}`);
    });

    // Add students to the batch
    if (studentsForBatch.length > 0) {
      const studentIdsToAdd = studentsForBatch
        .filter(student => String(student.batchId) === String(targetBatch._id))
        .map(student => student._id);

      console.log(`\nAdding ${studentIdsToAdd.length} students to batch...`);
      
      // Update batch with new students
      await Batch.findByIdAndUpdate(targetBatch._id, {
        $addToSet: { students: { $each: studentIdsToAdd } },
        updatedAt: new Date()
      });

      console.log('Batch updated successfully!');
      
      // Verify the update
      const updatedBatch = await Batch.findById(targetBatch._id).populate('students', 'name email');
      console.log(`\nUpdated batch now has ${updatedBatch.students?.length || 0} students:`);
      updatedBatch.students?.forEach(student => {
        console.log(`- ${student.name} (${student.email})`);
      });
    } else {
      console.log('No students found to add to batch');
    }

  } catch (error) {
    console.error('Error fixing student-batch link:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

fixStudentBatchLink();
