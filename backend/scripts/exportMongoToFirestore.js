#!/usr/bin/env node
/**
 * Export MongoDB → Firestore project skystateslms (REST + gcloud access tokens).
 *
 * Usage (from backend/):
 *   node scripts/exportMongoToFirestore.js --db=shef-lms-dev --env=.env.dev
 *   node scripts/exportMongoToFirestore.js --db=lms --env=.env --prefix=prod_ --meta=mongo_prod_export
 *   node scripts/exportMongoToFirestore.js --both
 *   node scripts/exportMongoToFirestore.js --both --clear
 *   node scripts/exportMongoToFirestore.js --dry-run --both
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

const BACKEND_DIR = path.join(__dirname, '..');

function parseArgs(argv) {
  const out = {
    dryRun: false,
    project: process.env.FIRESTORE_EXPORT_PROJECT || 'skystateslms',
    db: null,
    envFile: null,
    prefix: '',
    meta: null,
    clear: false,
    both: false,
  };
  for (const a of argv) {
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--clear') out.clear = true;
    else if (a === '--both') out.both = true;
    else if (a.startsWith('--project=')) out.project = a.slice('--project='.length);
    else if (a.startsWith('--db=')) out.db = a.slice('--db='.length);
    else if (a.startsWith('--env=')) out.envFile = a.slice('--env='.length);
    else if (a.startsWith('--prefix=')) out.prefix = a.slice('--prefix='.length);
    else if (a.startsWith('--meta=')) out.meta = a.slice('--meta='.length);
  }
  return out;
}

function parseEnv(filePath) {
  const abs = path.isAbsolute(filePath) ? filePath : path.join(BACKEND_DIR, filePath);
  if (!fs.existsSync(abs)) throw new Error(`Env file not found: ${abs}`);
  return dotenv.parse(fs.readFileSync(abs, 'utf8'));
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
  throw new Error('No Mongo connection settings in env file');
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

function docToFirestoreFields(doc, sourceTag) {
  const plain = { ...doc };
  const id = plain._id != null ? String(plain._id) : undefined;
  delete plain._id;
  delete plain.__v;
  plain._mongoId = id || null;
  plain._exportedAt = new Date();
  plain._source = sourceTag;
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

async function exportOne({
  project,
  db,
  envFile,
  prefix,
  meta,
  clear,
  dryRun,
  sourceTag,
}) {
  const env = parseEnv(envFile);
  const mongoUri = buildUri(env, db);
  let token = getAccessToken(project);
  if (!token) throw new Error('Could not get gcloud access token');

  console.log(`\n======== ${sourceTag} ========`);
  console.log(`Mongo: ${db} (env ${envFile})`);
  console.log(`Firestore: ${project}${prefix ? ` prefix=${prefix}` : ''}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'WRITE'}${clear ? ' (clear existing)' : ''}`);

  await mongoose.connect(mongoUri);
  const collections = (await mongoose.connection.db.listCollections().toArray())
    .map((c) => c.name)
    .sort();

  const summary = [];
  for (const name of collections) {
    token = getAccessToken(project);
    const fsName = `${prefix}${name}`;
    const raw = await mongoose.connection.db.collection(name).find({}).toArray();
    const docs = raw.map((d) => docToFirestoreFields(d, sourceTag));
    console.log(`${name} → ${fsName}: ${docs.length} docs`);

    if (dryRun) {
      summary.push({ collection: fsName, mongo: docs.length, firestore: 0 });
      continue;
    }

    if (clear) {
      const deleted = await clearCollection(project, fsName, token);
      if (deleted) console.log(`  cleared ${deleted} existing Firestore docs`);
    }

    const written = await writeDocs(project, fsName, docs, token);
    summary.push({ collection: fsName, mongo: docs.length, firestore: written });
  }

  if (!dryRun) {
    token = getAccessToken(project);
    const metaId = meta || (prefix ? 'mongo_prod_export' : 'mongo_dev_export');
    const metaFields = toFirestoreFields({
      sourceDatabase: db,
      projectId: project,
      prefix: prefix || '',
      exportedAt: new Date(),
      collections: summary,
      exportedBy: 'exportMongoToFirestore.js',
      sourceTag,
    }).mapValue.fields;
    await httpsJson(
      'POST',
      `/v1/projects/${project}/databases/(default)/documents:batchWrite`,
      token,
      {
        writes: [
          {
            update: {
              name: docName(project, '_meta', metaId),
              fields: metaFields,
            },
          },
        ],
      }
    );
    console.log(`Wrote _meta/${metaId}`);
  }

  console.log(`\n=== Summary (${sourceTag}) ===`);
  console.table(summary);
  await mongoose.disconnect();
  return summary;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // Probe auth early
  try {
    getAccessToken(args.project);
  } catch (e) {
    console.error(
      'gcloud auth failed. On this server run:\n  gcloud auth login\n  gcloud config set project skystateslms\nThen re-run this script.'
    );
    throw e;
  }

  if (args.both) {
    await exportOne({
      project: args.project,
      db: 'shef-lms-dev',
      envFile: '.env.dev',
      prefix: '',
      meta: 'mongo_dev_export',
      clear: args.clear,
      dryRun: args.dryRun,
      sourceTag: 'shef-lms-dev',
    });
    await exportOne({
      project: args.project,
      db: 'lms',
      envFile: '.env',
      prefix: 'prod_',
      meta: 'mongo_prod_export',
      clear: args.clear,
      dryRun: args.dryRun,
      sourceTag: 'lms-prod',
    });
    console.log('\nDone: DEV (default collections) + PROD (prod_* collections).');
    process.exit(0);
  }

  const db = args.db || 'shef-lms-dev';
  const envFile = args.envFile || (db === 'lms' ? '.env' : '.env.dev');
  const prefix = args.prefix || (db === 'lms' ? 'prod_' : '');
  const meta =
    args.meta || (prefix || db === 'lms' ? 'mongo_prod_export' : 'mongo_dev_export');

  await exportOne({
    project: args.project,
    db,
    envFile,
    prefix,
    meta,
    clear: args.clear,
    dryRun: args.dryRun,
    sourceTag: db,
  });
  process.exit(0);
}

main().catch((err) => {
  console.error('Export failed:', err.message || err);
  process.exit(1);
});
