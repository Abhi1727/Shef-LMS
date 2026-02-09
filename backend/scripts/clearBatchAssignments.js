#!/usr/bin/env node

/**
 * Clear batch assignments for all students and batches in MongoDB.
 * - Sets batchId to null for all users with role === 'student'
 * - Empties students array for all Batch documents
 */

const { connectMongo } = require('../config/mongo');
const User = require('../models/User');
const Batch = require('../models/Batch');

async function clearStudentBatchIds() {
  console.log('🔄 Clearing batchId for all student users...');

  const result = await User.updateMany(
    { role: 'student' },
    { $set: { batchId: null } }
  );

  console.log(`✅ Cleared batchId for ${result.modifiedCount} student(s).`);
}

async function clearBatchStudentLists() {
  console.log('🔄 Clearing students arrays for all batches...');

  const result = await Batch.updateMany(
    {},
    { $set: { students: [] } }
  );

  console.log(`✅ Emptied students list for ${result.modifiedCount} batch(es).`);
}

async function main() {
  try {
    console.log('🚀 Starting batch cleanup (MongoDB)...');

    await connectMongo();

    await clearStudentBatchIds();
    await clearBatchStudentLists();
    console.log('🎉 Batch cleanup completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during batch cleanup:', error);
    process.exit(1);
  }
}

main();
