const { connectMongo } = require('./config/mongo');
const Batch = require('./models/Batch');
const User = require('./models/User');

async function debugBatchData() {
  try {
    console.log('Connecting to MongoDB...');
    await connectMongo();
    
    const batchId = '6997ad120736df6e2ff5825c';
    
    console.log(`\n=== Detailed Debug for Batch: ${batchId} ===`);
    
    // Get batch details
    const batch = await Batch.findById(batchId).lean();
    console.log(`Batch Name: ${batch.name}`);
    console.log(`Batch students array: ${JSON.stringify(batch.students, null, 2)}`);
    
    // Get all students with this batchId
    const studentsByBatchId = await User.find({ 
      batchId: batchId, 
      role: 'student' 
    }).lean();
    
    console.log(`\n=== Students with batchId field (${studentsByBatchId.length}) ===`);
    studentsByBatchId.forEach(student => {
      console.log(`- ${student.name} (${student.email}) - ID: ${student._id}`);
    });
    
    // Get students currently in batch array
    const batchStudentIds = batch.students || [];
    console.log(`\n=== Students in batch array (${batchStudentIds.length}) ===`);
    for (const studentId of batchStudentIds) {
      const student = await User.findById(studentId).lean();
      if (student) {
        console.log(`- ${student.name} (${student.email}) - ID: ${student._id}`);
      } else {
        console.log(`- Invalid student ID: ${studentId}`);
      }
    }
    
    // Find which students with batchId are NOT in batch array
    const orphanedStudents = studentsByBatchId.filter(student => 
      !batchStudentIds.includes(student._id.toString())
    );
    
    console.log(`\n=== Orphaned students (${orphanedStudents.length}) ===`);
    orphanedStudents.forEach(student => {
      console.log(`- ${student.name} (${student.email}) - ID: ${student._id}`);
    });
    
    // Check if there are students in batch array that don't have this batchId
    const mismatchedStudents = [];
    for (const studentId of batchStudentIds) {
      const student = await User.findById(studentId).lean();
      if (student && student.batchId !== batchId) {
        mismatchedStudents.push(student);
      }
    }
    
    if (mismatchedStudents.length > 0) {
      console.log(`\n=== Students in batch array but with wrong batchId (${mismatchedStudents.length}) ===`);
      mismatchedStudents.forEach(student => {
        console.log(`- ${student.name} (${student.email}) - batchId: ${student.batchId}`);
      });
    }
    
  } catch (error) {
    console.error('Error debugging batch data:', error);
  } finally {
    process.exit(0);
  }
}

debugBatchData();
