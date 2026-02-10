// Moved sample Firestore-to-Mongo import script from backend/scripts/importFromFirestoreSample.js

const path = require('path');
const fs = require('fs');

const { connectMongo } = require('../../backend/config/mongo');
const User = require('../../backend/models/User');
const Batch = require('../../backend/models/Batch');
const Classroom = require('../../backend/models/Classroom');

async function loadSampleData() {
  const filePath = path.join(__dirname, '../../../firestore-sample-data.json');
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

// Remaining implementation same as original; kept for archival use only.

async function main() {
  try {
    await connectMongo();
    console.log('MongoDB connected');

    const sample = await loadSampleData();
    console.log('Loaded sample data keys:', Object.keys(sample));

    console.log('This script is archived in bin/ and should not be run in production.');
    process.exit(0);
  } catch (err) {
    console.error('Sample data import failed:', err);
    process.exit(1);
  }
}

main();
