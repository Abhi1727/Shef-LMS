// Bulk upsert students into MongoDB from a simple CSV file.
// Usage: node scripts/bulkUpsertStudents.js path/to/students.csv
// CSV format (no quoted commas):
// name,email,password,course,batchName,status,enrollmentNumber
// - email (required)
// - password (required, plain text; will be bcrypt-hashed)
// - others optional; status defaults to 'active', role is always 'student'

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { connectMongo } = require('../config/mongo');
const User = require('../models/User');
const Batch = require('../models/Batch');

function parseCSV(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) {
    throw new Error('CSV must have a header row and at least one data row');
  }

  const headers = lines[0].split(',').map(h => h.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    if (parts.length === 1 && !parts[0].trim()) continue; // skip empty lines

    const row = {};
    headers.forEach((h, idx) => {
      row[h] = (parts[idx] || '').trim();
    });
    rows.push(row);
  }

  return rows;
}

async function bulkUpsertStudents(csvPath) {
  await connectMongo();

  const absPath = path.resolve(csvPath);
  console.log('📄 Reading students from CSV:', absPath);
  const records = parseCSV(absPath);

  console.log(`🔍 Found ${records.length} rows to process`);

  for (const [index, rec] of records.entries()) {
    try {
      const email = (rec.email || '').trim().toLowerCase();
      const password = (rec.password || '').trim();

      if (!email || !password) {
        console.warn(`⚠️ Row ${index + 2}: missing email or password, skipping`);
        continue;
      }

      const name = rec.name && rec.name.trim() ? rec.name.trim() : 'Student';
      const course = rec.course && rec.course.trim() ? rec.course.trim() : undefined;
      const batchName = rec.batchName && rec.batchName.trim() ? rec.batchName.trim() : undefined;
      const status = rec.status && rec.status.trim() ? rec.status.trim() : 'active';
      const enrollmentNumber = rec.enrollmentNumber && rec.enrollmentNumber.trim()
        ? rec.enrollmentNumber.trim()
        : undefined;

      let batchId;
      if (batchName) {
        const batch = await Batch.findOne({ name: batchName }).exec();
        if (batch) {
          batchId = String(batch._id);
        } else {
          console.warn(`⚠️ Row ${index + 2}: batch '${batchName}' not found, leaving batchId empty`);
        }
      }

      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(password, salt);

      const now = new Date();
      const update = {
        name,
        email,
        password: hash,
        role: 'student',
        status,
        course,
        batchId,
        enrollmentNumber,
        updatedAt: now
      };

      const student = await User.findOneAndUpdate(
        { email },
        update,
        { upsert: true, new: true, setDefaultsOnInsert: true }
      ).exec();

      console.log(`✅ Upserted student [row ${index + 2}]: ${student.email} (id=${student._id.toString()})`);
    } catch (err) {
      console.error(`❌ Error processing row ${index + 2}:`, err.message || err);
    }
  }

  console.log('🎉 Bulk student upsert complete');
}

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error('Usage: node scripts/bulkUpsertStudents.js path/to/students.csv');
    process.exit(1);
  }

  try {
    await bulkUpsertStudents(csvPath);
    process.exit(0);
  } catch (err) {
    console.error('❌ Bulk upsert failed:', err);
    process.exit(1);
  }
}

main();
