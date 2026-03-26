const { connectMongo } = require('./config/mongo');
const Batch = require('./models/Batch');
const User = require('./models/User');

async function fixBatchConsistency() {
  try {
    console.log('Connecting to MongoDB...');
    await connectMongo();
    
    const batchId = '6997ad120736df6e2ff5825c';
    
    console.log(`\n=== Fixing Batch Consistency: ${batchId} ===`);
    
    // Get batch details
    const batch = await Batch.findById(batchId).lean();
    console.log(`Batch Name: ${batch.name}`);
    
    // Get all students who actually have this batchId
    const studentsWithCorrectBatchId = await User.find({ 
      batchId: batchId, 
      role: 'student' 
    }).lean();
    
    console.log(`Students with correct batchId: ${studentsWithCorrectBatchId.length}`);
    
    // Update batch to only include students who actually have this batchId
    const correctStudentIds = studentsWithCorrectBatchId.map(s => s._id);
    
    console.log('Updating batch students array...');
    await Batch.findByIdAndUpdate(batchId, {
      students: correctStudentIds,
      updatedAt: new Date()
    });
    
    // Verify the fix
    const updatedBatch = await Batch.findById(batchId).lean();
    const finalStudentCount = (updatedBatch.students || []).length;
    
    console.log(`\n=== Fix Result ===`);
    console.log(`Students in batch array: ${finalStudentCount}`);
    console.log(`Students with batchId field: ${studentsWithCorrectBatchId.length}`);
    console.log(`Data consistency: ${finalStudentCount === studentsWithCorrectBatchId.length ? '✅ FIXED' : '❌ STILL INCONSISTENT'}`);
    
    // Test the API endpoint
    console.log(`\n=== Testing API Endpoint ===`);
    const studentsInBatchArray = await User.find({
      _id: { $in: updatedBatch.students || [] }
    }).lean();
    
    const orphanedStudents = await User.find({
      batchId: batchId,
      _id: { $nin: updatedBatch.students || [] },
      role: 'student'
    }).lean();
    
    console.log(`Students from batch array: ${studentsInBatchArray.length}`);
    console.log(`Orphaned students: ${orphanedStudents.length}`);
    
    if (orphanedStudents.length === 0) {
      console.log('✅ API endpoint will now return consistent data!');
    } else {
      console.log('❌ Still have orphaned students');
    }
    
  } catch (error) {
    console.error('Error fixing batch consistency:', error);
  } finally {
    process.exit(0);
  }
}

fixBatchConsistency();
