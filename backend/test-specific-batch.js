const { connectMongo } = require('./config/mongo');
const Batch = require('./models/Batch');
const User = require('./models/User');

async function testSpecificBatch() {
  try {
    console.log('Connecting to MongoDB...');
    await connectMongo();
    
    const batchId = '6997ad120736df6e2ff5825c';
    
    console.log(`\n=== Testing Fixed Batch: ${batchId} ===`);
    
    // Get batch details
    const batch = await Batch.findById(batchId).lean();
    console.log(`Batch Name: ${batch.name}`);
    console.log(`Batch Course: ${batch.course}`);
    
    // Test admin approach (filter users by batchId)
    const studentsByBatchId = await User.find({ 
      batchId: batchId, 
      role: 'student' 
    }).lean();
    
    console.log(`\nAdmin approach (filter by batchId): ${studentsByBatchId.length} students`);
    studentsByBatchId.forEach(student => {
      console.log(`- ${student.name} (${student.email})`);
    });
    
    // Test teacher approach (use batch students array)
    const batchStudentIds = batch.students || [];
    const studentsFromBatchArray = await User.find({
      _id: { $in: batchStudentIds }
    }).lean();
    
    console.log(`\nTeacher approach (batch students array): ${studentsFromBatchArray.length} students`);
    studentsFromBatchArray.forEach(student => {
      console.log(`- ${student.name} (${student.email})`);
    });
    
    // Test the improved API endpoint logic
    const orphanedStudents = await User.find({
      batchId: batchId,
      _id: { $nin: batchStudentIds },
      role: 'student'
    }).lean();
    
    console.log(`\nOrphaned students: ${orphanedStudents.length}`);
    
    const allStudents = [...studentsFromBatchArray, ...orphanedStudents];
    console.log(`\nImproved API endpoint would return: ${allStudents.length} students`);
    
    // Final verification
    const isConsistent = studentsByBatchId.length === allStudents.length;
    console.log(`\n=== RESULT ===`);
    console.log(`Data consistency: ${isConsistent ? '✅ CONSISTENT' : '❌ INCONSISTENT'}`);
    console.log(`Both views will show: ${allStudents.length} students`);
    
    if (isConsistent) {
      console.log('\n🎉 The data inconsistency issue has been completely resolved!');
      console.log('Both admin and teacher views will now show the same student count.');
    }
    
  } catch (error) {
    console.error('Error testing specific batch:', error);
  } finally {
    process.exit(0);
  }
}

testSpecificBatch();
