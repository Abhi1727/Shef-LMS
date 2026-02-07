#!/usr/bin/env node

/**
 * Clear batch assignments for all students and batches in Firestore.
 * - Sets batchId to null for all users with role === 'student'
 * - Empties students array for all documents in 'batches' collection
 *
 * Usage:
 *   node scripts/clearBatchAssignments.js
 */

const { db } = require('../config/firebase');

async function clearStudentBatchIds() {
  console.log('🔄 Clearing batchId for all student users...');
  const usersRef = db.collection('users');
  const snapshot = await usersRef.where('role', '==', 'student').get();

  if (snapshot.empty) {
    console.log('ℹ️ No student users found.');
    return;
  }

  const batch = db.batch();
  let count = 0;

  snapshot.forEach(doc => {
    batch.update(doc.ref, { batchId: null });
    count += 1;
  });

  await batch.commit();
  console.log(`✅ Cleared batchId for ${count} student(s).`);
}

async function clearBatchStudentLists() {
  console.log('🔄 Clearing students arrays for all batches...');
  const batchesRef = db.collection('batches');
  const snapshot = await batchesRef.get();

  if (snapshot.empty) {
    console.log('ℹ️ No batches found.');
    return;
  }

  const batch = db.batch();
  let count = 0;

  snapshot.forEach(doc => {
    batch.update(doc.ref, { students: [] });
    count += 1;
  });

  await batch.commit();
  console.log(`✅ Emptied students list for ${count} batch(es).`);
}

async function main() {
  try {
    console.log('🚀 Starting batch cleanup...');
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
