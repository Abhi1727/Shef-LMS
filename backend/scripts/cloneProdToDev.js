#!/usr/bin/env node
/**
 * Clone production MongoDB database to development database.
 * Copies all collections from shef-lms (prod) to shef-lms-dev (dev).
 *
 * Run from backend/: node scripts/cloneProdToDev.js
 * Or: npm run clone:prod-to-dev
 *
 * Uses .env for production connection and .env.dev for dev connection.
 * Override DB names with --prod-db and --dev-db if needed.
 */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

const BACKEND_DIR = path.join(__dirname, '..');
const PROD_ENV = path.join(BACKEND_DIR, '.env');
const DEV_ENV = path.join(BACKEND_DIR, '.env.dev');

function parseEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Env file not found: ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  return dotenv.parse(raw);
}

function encodePassword(password) {
  if (!password) return '';
  return encodeURIComponent(password);
}

function buildUri(env, dbName) {
  if (env.MONGODB_URI_STANDARD) {
    const u = new URL(env.MONGODB_URI_STANDARD);
    u.pathname = '/' + dbName;
    return u.toString();
  }
  if (env.MONGODB_USERNAME && env.MONGODB_PASSWORD && env.MONGODB_CLUSTER) {
    const user = encodeURIComponent(env.MONGODB_USERNAME);
    const pass = encodePassword(env.MONGODB_PASSWORD);
    return `mongodb+srv://${user}:${pass}@${env.MONGODB_CLUSTER}/${dbName}?retryWrites=true&w=majority&appName=Cluster0`;
  }
  if (env.MONGODB_URI && !env.MONGODB_URI.includes('<')) {
    const uri = env.MONGODB_URI;
    const match = uri.match(/^(mongodb(\+srv)?:\/\/[^/]+)\/([^?]*)(\?.*)?$/);
    if (match) {
      return `${match[1]}/${dbName}${match[4] || '?retryWrites=true&w=majority'}`;
    }
    return uri;
  }
  throw new Error('MongoDB config: set MONGODB_USERNAME/PASSWORD/CLUSTER or MONGODB_URI in env file');
}

function parseArgs() {
  const args = process.argv.slice(2);
  const result = { prodDb: null, devDb: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--prod-db' && args[i + 1]) result.prodDb = args[++i];
    else if (args[i] === '--dev-db' && args[i + 1]) result.devDb = args[++i];
  }
  return result;
}

async function copyCollection(prodDb, devDb, name) {
  const prodCol = prodDb.collection(name);
  const devCol = devDb.collection(name);

  const docs = await prodCol.find({}).toArray();
  if (docs.length === 0) {
    console.log(`  ${name}: 0 documents (skipped)`);
    return 0;
  }

  await devCol.deleteMany({});
  const result = await devCol.insertMany(docs);
  console.log(`  ${name}: ${result.insertedCount} documents`);
  return result.insertedCount;
}

async function main() {
  const { prodDb: prodDbArg, devDb: devDbArg } = parseArgs();

  const prodEnv = parseEnv(PROD_ENV);
  const devEnv = parseEnv(DEV_ENV);

  const prodDbName = prodDbArg || prodEnv.MONGO_DB_NAME || prodEnv.MONGODB_DATABASE || 'shef-lms';
  const devDbName = devDbArg || devEnv.MONGO_DB_NAME || devEnv.MONGODB_DATABASE || 'shef-lms-dev';

  if (prodDbName === devDbName) {
    console.error('ERROR: Source and target database names are the same:', prodDbName);
    console.error('Refusing to overwrite. Use --prod-db and --dev-db to specify different databases.');
    process.exit(1);
  }

  const prodUri = buildUri(prodEnv, prodDbName);
  const devUri = buildUri(devEnv, devDbName);

  const mask = (u) => u.replace(/:([^:@]+)@/, ':****@');
  console.log('Clone production DB → dev DB');
  console.log('  Source:', mask(prodUri));
  console.log('  Target:', mask(devUri));
  console.log('');

  const prodConn = await mongoose.createConnection(prodUri).asPromise();
  const devConn = await mongoose.createConnection(devUri).asPromise();

  try {
    const prodDb = prodConn.db;
    const devDb = devConn.db;

    const collections = await prodDb.listCollections().toArray();
    const names = collections
      .map((c) => c.name)
      .filter((n) => !n.startsWith('system.'));

    if (names.length === 0) {
      console.log('No collections found in source.');
      return;
    }

    console.log(`Copying ${names.length} collection(s)...`);
    let total = 0;
    for (const name of names) {
      total += await copyCollection(prodDb, devDb, name);
    }
    console.log('');
    console.log(`Done. Copied ${total} total documents.`);
  } finally {
    await prodConn.close();
    await devConn.close();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error:', err.message);
    process.exit(1);
  });
