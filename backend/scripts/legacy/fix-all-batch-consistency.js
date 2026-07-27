const { connectMongo } = require('./config/mongo');
const Batch = require('./models/Batch');
const User = require('./models/User');

async function fixAllBatchConsistency() {
  try {
    console.log('Connecting to MongoDB...');
    await connectMongo();
    
    console.log('\n=== Fixing All Batch Consistency ===');
    
    // Get all batches
    const allBatches = await Batch.find({}).lean();
    console.log(`Found ${allBatches.length} batches to check`);
    
    let fixedBatches = 0;
    let totalInconsistencies = 0;
    
    for (const batch of allBatches) {
      const batchId = batch._id.toString();
      
      // Get all students who actually have this batchId
      const studentsWithCorrectBatchId = await User.find({ 
        batchId: batchId, 
        role: 'student' 
      }).lean();
      
      // Get students currently in batch array
      const batchStudentIds = batch.students || [];
      const studentsInBatchArray = await User.find({
        _id: { $in: batchStudentIds }
      }).lean();
      
      // Check for inconsistencies
      const studentsWithWrongBatchId = studentsInBatchArray.filter(student => 
        student.batchId !== batchId
      );
      
      const orphanedStudents = studentsWithCorrectBatchId.filter(student => 
        !batchStudentIds.includes(student._id.toString())
      );
      
      const hasInconsistency = studentsWithWrongBatchId.length > 0 || orphanedStudents.length > 0;
      
      if (hasInconsistency) {
        console.log(`\n--- Batch: ${batch.name} (${batchId}) ---`);
        console.log(`Students with correct batchId: ${studentsWithCorrectBatchId.length}`);
        console.log(`Students in batch array: ${studentsInBatchArray.length}`);
        console.log(`Students with wrong batchId: ${studentsWithWrongBatchId.length}`);
        console.log(`Orphaned students: ${orphanedStudents.length}`);
        
        // Fix: Update batch to only include students who actually have this batchId
        const correctStudentIds = studentsWithCorrectBatchId.map(s => s._id);
        
        await Batch.findByIdAndUpdate(batchId, {
          students: correctStudentIds,
          updatedAt: new Date()
        });
        
        console.log('✅ Fixed batch consistency');
        fixedBatches++;
        totalInconsistencies += studentsWithWrongBatchId.length + orphanedStudents.length;
      }
    }
    
    console.log(`\n=== Summary ===`);
    console.log(`Total batches checked: ${allBatches.length}`);
    console.log(`Batches fixed: ${fixedBatches}`);
    console.log(`Total inconsistencies resolved: ${totalInconsistencies}`);
    
    if (fixedBatches > 0) {
      console.log('\n✅ All batch consistency issues have been resolved!');
      console.log('Both admin and teacher views will now show consistent student data.');
    } else {
      console.log('\n✅ No inconsistencies found - all batches are already consistent!');
    }
    
  } catch (error) {
    console.error('Error fixing all batch consistency:', error);
  } finally {
    process.exit(0);
  }
}

fixAllBatchConsistency();
