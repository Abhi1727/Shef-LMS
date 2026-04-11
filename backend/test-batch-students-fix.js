const { connectMongo } = require('./config/mongo');
const Batch = require('./models/Batch');
const User = require('./models/User');

async function testBatchStudentsFix() {
  try {
    console.log('Connecting to MongoDB...');
    await connectMongo();
    
    // Test with the problematic batch ID mentioned by user
    const batchId = '6997ad120736df6e2ff5825c';
    
    console.log(`\n=== Testing Batch: ${batchId} ===`);
    
    // Get batch details
    const batch = await Batch.findById(batchId).lean();
    if (!batch) {
      console.log('Batch not found');
      return;
    }
    
    console.log(`Batch Name: ${batch.name}`);
    console.log(`Batch Course: ${batch.course}`);
    console.log(`Students in batch array: ${(batch.students || []).length}`);
    
    // Get students by batchId (like admin page does)
    const studentsByBatchId = await User.find({ 
      batchId: batchId, 
      role: 'student' 
    }).lean();
    
    console.log(`Students with batchId field: ${studentsByBatchId.length}`);
    
    // Get students from batch array (like old teacher page does)
    const batchStudentIds = batch.students || [];
    const studentsInBatchArray = await User.find({
      _id: { $in: batchStudentIds }
    }).lean();
    
    console.log(`Students in batch array: ${studentsInBatchArray.length}`);
    
    // Find orphaned students
    const orphanedStudents = await User.find({
      batchId: batchId,
      _id: { $nin: batchStudentIds },
      role: 'student'
    }).lean();
    
    console.log(`Orphaned students: ${orphanedStudents.length}`);
    
    if (orphanedStudents.length > 0) {
      console.log('\nOrphaned students found:');
      orphanedStudents.forEach(student => {
        console.log(`- ${student.name} (${student.email})`);
      });
      
      // Update batch to include orphaned students
      console.log('\nUpdating batch to include orphaned students...');
      await Batch.findByIdAndUpdate(batchId, {
        $addToSet: { students: { $each: orphanedStudents.map(s => s._id) } },
        updatedAt: new Date()
      });
      
      console.log('Batch updated successfully!');
    }
    
    // Test the final result
    const updatedBatch = await Batch.findById(batchId).lean();
    const finalStudentCount = (updatedBatch.students || []).length;
    
    console.log(`\n=== Final Result ===`);
    console.log(`Total students in batch array: ${finalStudentCount}`);
    console.log(`Students with batchId field: ${studentsByBatchId.length}`);
    console.log(`Data consistency: ${finalStudentCount === studentsByBatchId.length ? '✅ FIXED' : '❌ STILL INCONSISTENT'}`);
    
  } catch (error) {
    console.error('Error testing batch students fix:', error);
  } finally {
    process.exit(0);
  }
}

testBatchStudentsFix();
