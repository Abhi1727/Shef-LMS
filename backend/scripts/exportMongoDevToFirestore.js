#!/usr/bin/env node
/**
 * Export DEV MongoDB (shef-lms-dev) → Firestore project skystateslms.
 *
 * Uses Firestore REST API + gcloud access tokens (org policy blocks SA JSON keys).
 *
 * Usage (from backend/):
 *   node scripts/exportMongoDevToFirestore.js
 *   node scripts/exportMongoDevToFirestore.js --dry-run
 *   node scripts/exportMongoDevToFirestore.js --project=skystateslms --db=shef-lms-dev
 *   node scripts/exportMongoDevToFirestore.js --clear
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

const BACKEND_DIR = path.join(__dirname, '..');
const DEV_ENV = path.join(BACKEND_DIR, '.env.dev');

function parseArgs(argv) {
  const out = {
    dryRun: false,
    project: process.env.FIRESTORE_EXPORT_PROJECT || 'skystateslms',
    db: process.env.MONGO_DB_NAME || 'shef-lms-dev',
    clear: false,
  };
  for (const a of argv) {
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--clear') out.clear = true;
    else if (a.startsWith('--project=')) out.project = a.slice('--project='.length);
    else if (a.startsWith('--db=')) out.db = a.slice('--db='.length);
  }
  return out;
}

function parseEnv(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Env file not found: ${filePath}`);
  return dotenv.parse(fs.readFileSync(filePath, 'utf8'));
}

function buildUri(env, dbName) {
  if (env.MONGODB_URI_STANDARD) {
    const u = new URL(env.MONGODB_URI_STANDARD);
    u.pathname = '/' + dbName;
    return u.toString();
  }
  if (env.MONGODB_USERNAME && env.MONGODB_PASSWORD && env.MONGODB_CLUSTER) {
    const user = encodeURIComponent(env.MONGODB_USERNAME);
    const pass = encodeURIComponent(env.MONGODB_PASSWORD);
    return `mongodb+srv://${user}:${pass}@${env.MONGODB_CLUSTER}/${dbName}?retryWrites=true&w=majority`;
  }
  throw new Error('No Mongo connection settings in .env.dev');
}

function getAccessToken(projectId) {
  return execSync(`gcloud auth print-access-token --project=${projectId}`, {
    encoding: 'utf8',
  }).trim();
}

function httpsJson(method, urlPath, token, body) {
  const payload = body ? JSON.stringify(body) : null;
  const opts = {
    hostname: 'firestore.googleapis.com',
    path: urlPath,
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
    },
  };
  return new Promise((resolve, reject) => {
    const req = https.request(opts, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let json = null;
        try {
          json = text ? JSON.parse(text) : null;
        } catch {
          json = { raw: text };
        }
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(json);
        else {
          const err = new Error(
            `Firestore HTTP ${res.statusCode}: ${typeof json === 'object' ? JSON.stringify(json) : text}`
          );
          err.statusCode = res.statusCode;
          err.body = json;
          reject(err);
        }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function toFirestoreFields(value, depth = 0) {
  if (value === undefined) return undefined;
  if (value === null) return { nullValue: null };
  if (depth > 40) return { stringValue: String(value) };

  if (value instanceof mongoose.Types.ObjectId) {
    return { stringValue: value.toString() };
  }
  if (value && typeof value === 'object' && value._bsontype === 'ObjectID') {
    return { stringValue: value.toString() };
  }
  if (value instanceof Date) {
    return { timestampValue: value.toISOString() };
  }
  if (Buffer.isBuffer(value)) {
    return { bytesValue: value.toString('base64') };
  }
  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value
          .map((v) => toFirestoreFields(v, depth + 1))
          .filter((v) => v !== undefined),
      },
    };
  }
  if (typeof value === 'object') {
    if (typeof value.toString === 'function' && value._bsontype) {
      return { stringValue: value.toString() };
    }
    const fields = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === '__v') continue;
      const converted = toFirestoreFields(v, depth + 1);
      if (converted !== undefined) fields[k] = converted;
    }
    return { mapValue: { fields } };
  }
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return { nullValue: null };
    if (Number.isInteger(value)) return { integerValue: String(value) };
    return { doubleValue: value };
  }
  if (typeof value === 'string') return { stringValue: value };
  return { stringValue: String(value) };
}

function docToFirestoreFields(doc) {
  const plain = { ...doc };
  const id = plain._id != null ? String(plain._id) : undefined;
  delete plain._id;
  delete plain.__v;
  plain._mongoId = id || null;
  plain._exportedAt = new Date();
  plain._source = 'shef-lms-dev';
  const wrapped = toFirestoreFields(plain);
  return { id, fields: wrapped.mapValue.fields };
}

function docName(projectId, collection, docId) {
  return `projects/${projectId}/databases/(default)/documents/${collection}/${docId}`;
}

async function listDocumentNames(projectId, collection, token) {
  const names = [];
  let pageToken = '';
  do {
    let path = `/v1/projects/${projectId}/databases/(default)/documents/${encodeURIComponent(collection)}?pageSize=300`;
    if (pageToken) path += `&pageToken=${encodeURIComponent(pageToken)}`;
    const res = await httpsJson('GET', path, token);
    for (const d of res.documents || []) names.push(d.name);
    pageToken = res.nextPageToken || '';
  } while (pageToken);
  return names;
}

async function clearCollection(projectId, collection, token) {
  const names = await listDocumentNames(projectId, collection, token);
  const CHUNK = 400;
  let deleted = 0;
  for (let i = 0; i < names.length; i += CHUNK) {
    const slice = names.slice(i, i + CHUNK);
    await httpsJson(
      'POST',
      `/v1/projects/${projectId}/databases/(default)/documents:batchWrite`,
      token,
      { writes: slice.map((name) => ({ delete: name })) }
    );
    deleted += slice.length;
  }
  return deleted;
}

async function writeDocs(projectId, collection, docs, token) {
  const CHUNK = 400;
  let written = 0;
  for (let i = 0; i < docs.length; i += CHUNK) {
    const slice = docs.slice(i, i + CHUNK);
    const writes = slice.map(({ id, fields }) => {
      const docId = id || `auto_${Date.now()}_${written}`;
      return {
        update: {
          name: docName(projectId, collection, docId),
          fields,
        },
      };
    });
    await httpsJson(
      'POST',
      `/v1/projects/${projectId}/databases/(default)/documents:batchWrite`,
      token,
      { writes }
    );
    written += slice.length;
    process.stdout.write(`  ${collection}: ${written}/${docs.length}\r`);
  }
  if (docs.length) process.stdout.write('\n');
  return written;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const env = parseEnv(DEV_ENV);
  const mongoUri = buildUri(env, args.db);

  console.log(`Mongo: ${args.db}`);
  console.log(`Firestore project: ${args.project}`);
  console.log(`Mode: ${args.dryRun ? 'DRY RUN' : 'WRITE'}${args.clear ? ' (clear existing)' : ''}`);

  let token = getAccessToken(args.project);
  if (!token) throw new Error('Could not get gcloud access token');

  await mongoose.connect(mongoUri);
  const collections = (await mongoose.connection.db.listCollections().toArray())
    .map((c) => c.name)
    .sort();

  const summary = [];
  for (const name of collections) {
    // Refresh token periodically for long runs
    token = getAccessToken(args.project);

    const raw = await mongoose.connection.db.collection(name).find({}).toArray();
    const docs = raw.map((d) => docToFirestoreFields(d));
    console.log(`${name}: ${docs.length} docs`);

    if (args.dryRun) {
      summary.push({ collection: name, mongo: docs.length, firestore: 0 });
      continue;
    }

    if (args.clear) {
      const deleted = await clearCollection(args.project, name, token);
      if (deleted) console.log(`  cleared ${deleted} existing Firestore docs`);
    }

    const written = await writeDocs(args.project, name, docs, token);
    summary.push({ collection: name, mongo: docs.length, firestore: written });
  }

  if (!args.dryRun) {
    token = getAccessToken(args.project);
    const metaFields = toFirestoreFields({
      sourceDatabase: args.db,
      projectId: args.project,
      exportedAt: new Date(),
      collections: summary,
      exportedBy: 'exportMongoDevToFirestore.js',
    }).mapValue.fields;
    await httpsJson(
      'POST',
      `/v1/projects/${args.project}/databases/(default)/documents:batchWrite`,
      token,
      {
        writes: [
          {
            update: {
              name: docName(args.project, '_meta', 'mongo_dev_export'),
              fields: metaFields,
            },
          },
        ],
      }
    );
  }

  console.log('\n=== Export summary ===');
  console.table(summary);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('Export failed:', err.message || err);
  process.exit(1);
});
