#!/usr/bin/env node
/**
 * Clone development MongoDB database to production database.
 * Copies all collections from shef-lms-dev (dev) to lms (prod).
 *
 * ⚠️  WARNING: This OVERWRITES production data. Run only when you intend to
 *     replace prod (lms) with dev (shef-lms-dev) data.
 *
 * Run from backend/: node scripts/cloneDevToProd.js --confirm
 * Or: npm run clone:dev-to-prod -- --confirm
 *
 * Uses .env.dev for SOURCE (dev) and .env for TARGET (prod).
 * Override DB names with --dev-db and --prod-db if needed.
 */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

const BACKEND_DIR = path.join(__dirname, '..');
const DEV_ENV = path.join(BACKEND_DIR, '.env.dev');
const PROD_ENV = path.join(BACKEND_DIR, '.env');

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
  const result = { devDb: null, prodDb: null, confirm: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dev-db' && args[i + 1]) result.devDb = args[++i];
    else if (args[i] === '--prod-db' && args[i + 1]) result.prodDb = args[++i];
    else if (args[i] === '--confirm') result.confirm = true;
  }
  return result;
}

async function copyCollection(sourceDb, targetDb, name) {
  const sourceCol = sourceDb.collection(name);
  const targetCol = targetDb.collection(name);

  const docs = await sourceCol.find({}).toArray();
  if (docs.length === 0) {
    console.log(`  ${name}: 0 documents (skipped)`);
    return 0;
  }

  await targetCol.deleteMany({});
  const result = await targetCol.insertMany(docs);
  console.log(`  ${name}: ${result.insertedCount} documents`);
  return result.insertedCount;
}

async function main() {
  const { devDb: devDbArg, prodDb: prodDbArg, confirm } = parseArgs();

  if (!confirm) {
    console.error('ERROR: This will OVERWRITE production database (lms) with dev data.');
    console.error('       Add --confirm to proceed.');
    console.error('');
    console.error('Usage: node scripts/cloneDevToProd.js --confirm');
    process.exit(1);
  }

  const devEnv = parseEnv(DEV_ENV);
  const prodEnv = parseEnv(PROD_ENV);

  const devDbName = devDbArg || devEnv.MONGO_DB_NAME || devEnv.MONGODB_DATABASE || 'shef-lms-dev';
  const prodDbName = prodDbArg || prodEnv.MONGODB_DATABASE || prodEnv.MONGO_DB_NAME || 'lms';

  if (devDbName === prodDbName) {
    console.error('ERROR: Source and target database names are the same:', devDbName);
    console.error('Refusing to overwrite. Use --dev-db and --prod-db to specify different databases.');
    process.exit(1);
  }

  const devUri = buildUri(devEnv, devDbName);
  const prodUri = buildUri(prodEnv, prodDbName);

  const mask = (u) => u.replace(/:([^:@]+)@/, ':****@');
  console.log('');
  console.log('Clone dev DB → prod DB');
  console.log('  SOURCE (dev):  ', devDbName, mask(devUri));
  console.log('  TARGET (prod): ', prodDbName, mask(prodUri));
  console.log('');
  console.log('Proceeding in 3 seconds... (Ctrl+C to cancel)');
  await new Promise((r) => setTimeout(r, 3000));

  const devConn = await mongoose.createConnection(devUri).asPromise();
  const prodConn = await mongoose.createConnection(prodUri).asPromise();

  try {
    const devDb = devConn.db;
    const prodDb = prodConn.db;

    const collections = await devDb.listCollections().toArray();
    const names = collections
      .map((c) => c.name)
      .filter((n) => !n.startsWith('system.'));

    if (names.length === 0) {
      console.log('No collections found in source (dev).');
      return;
    }

    console.log(`Copying ${names.length} collection(s) from dev to prod...`);
    let total = 0;
    for (const name of names) {
      total += await copyCollection(devDb, prodDb, name);
    }
    console.log('');
    console.log(`Done. Copied ${total} total documents to production (lms).`);
  } finally {
    await devConn.close();
    await prodConn.close();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error:', err.message);
    process.exit(1);
  });
