#!/usr/bin/env node
/**
 * Test MongoDB Atlas connection from this environment.
 * Run: node scripts/test-atlas-connection.js
 * Uses MONGODB_URI, or builds from MONGODB_USERNAME/MONGODB_PASSWORD/MONGODB_CLUSTER/MONGODB_DATABASE
 */
require('dotenv').config();
const mongoose = require('mongoose');

function getUri() {
  if (process.env.MONGODB_URI_STANDARD) {
    return process.env.MONGODB_URI_STANDARD;
  }
  if (process.env.MONGODB_USERNAME && process.env.MONGODB_PASSWORD && process.env.MONGODB_CLUSTER) {
    const user = encodeURIComponent(process.env.MONGODB_USERNAME);
    const pass = encodeURIComponent(process.env.MONGODB_PASSWORD);
    const db = process.env.MONGODB_DATABASE || process.env.MONGO_DB_NAME || 'lms';
    return `mongodb+srv://${user}:${pass}@${process.env.MONGODB_CLUSTER}/${db}?retryWrites=true&w=majority&appName=Cluster0`;
  }
  return process.env.MONGODB_URI || process.env.MONGO_URL;
}

const uri = getUri();
if (!uri || uri.includes('<db_username>') || uri.includes('<db_password>')) {
  console.error('ERROR: Set MongoDB credentials in .env');
  console.error('  Option 1: MONGODB_URI=mongodb+srv://user:pass@cluster...');
  console.error('  Option 2: MONGODB_USERNAME, MONGODB_PASSWORD, MONGODB_CLUSTER, MONGODB_DATABASE');
  process.exit(1);
}

const maskedUri = uri.replace(/:([^:@]+)@/, ':****@');
console.log('Testing connection to:', maskedUri);
console.log('');

mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 })
  .then(() => {
    console.log('SUCCESS: Connected to MongoDB Atlas');
    process.exit(0);
  })
  .catch((err) => {
    console.error('FAILED:', err.message);
    console.error('');
    console.error('Common causes:');
    console.error('  1. IP not whitelisted in Atlas → Network Access → Add 0.0.0.0/0');
    console.error('  2. Wrong password → URL-encode special chars (@ → %40, # → %23)');
    console.error('  3. Wrong cluster/database name in URI');
    process.exit(1);
  });
