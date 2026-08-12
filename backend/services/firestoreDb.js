/**
 * Firestore REST client for DEV runtime (USE_FIRESTORE=true).
 * Auth: OAuth refresh token (org blocks SA keys) — same pattern as export scripts.
 */
const https = require('https');
const logger = require('../utils/logger');

const PROJECT = process.env.FIRESTORE_PROJECT || 'skystateslms';
const DATABASE = process.env.FIRESTORE_DATABASE || '(default)';

let cachedToken = null;
let tokenExpiresAt = 0;

function isFirestoreEnabled() {
  return String(process.env.USE_FIRESTORE || '').toLowerCase() === 'true';
}

function httpsRequest(method, hostname, path, headers, body) {
  const payload = body == null ? null : typeof body === 'string' ? body : JSON.stringify(body);
  const baseHeaders = { ...(headers || {}) };
  if (payload && !baseHeaders['Content-Type'] && !baseHeaders['content-type']) {
    baseHeaders['Content-Type'] = 'application/json';
  }
  if (payload && !baseHeaders['Content-Length'] && !baseHeaders['content-length']) {
    baseHeaders['Content-Length'] = Buffer.byteLength(payload);
  }
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname,
        path,
        method,
        headers: baseHeaders
      },
      (res) => {
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
          resolve({ status: res.statusCode, json, text });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function getAccessToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt - 60_000) return cachedToken;

  const clientId = process.env.FIRESTORE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.FIRESTORE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.FIRESTORE_OAUTH_REFRESH_TOKEN;

  if (clientId && clientSecret && refreshToken) {
    const form = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    }).toString();
    const res = await httpsRequest(
      'POST',
      'oauth2.googleapis.com',
      '/token',
      { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(form) },
      form
    );
    if (res.status >= 300 || !res.json?.access_token) {
      throw new Error(
        `Firestore OAuth refresh failed: ${res.status} ${JSON.stringify(res.json || res.text)}`
      );
    }
    cachedToken = res.json.access_token;
    tokenExpiresAt = now + (Number(res.json.expires_in) || 3500) * 1000;
    return cachedToken;
  }

  // Fallback: gcloud CLI (host / mounted config)
  try {
    const { execSync } = require('child_process');
    cachedToken = execSync(`gcloud auth print-access-token --project=${PROJECT}`, {
      encoding: 'utf8'
    }).trim();
    tokenExpiresAt = now + 3000 * 1000;
    return cachedToken;
  } catch (err) {
    throw new Error(
      'Firestore auth missing. Set FIRESTORE_OAUTH_CLIENT_ID/SECRET/REFRESH_TOKEN or gcloud auth login.'
    );
  }
}

async function firestoreJson(method, apiPath, body) {
  const token = await getAccessToken();
  const res = await httpsRequest(
    method,
    'firestore.googleapis.com',
    apiPath,
    { Authorization: `Bearer ${token}` },
    body
  );
  if (res.status >= 200 && res.status < 300) return res.json;
  const err = new Error(
    `Firestore HTTP ${res.status}: ${typeof res.json === 'object' ? JSON.stringify(res.json) : res.text}`
  );
  err.statusCode = res.status;
  err.body = res.json;
  throw err;
}

function basePath() {
  return `/v1/projects/${PROJECT}/databases/${encodeURIComponent(DATABASE)}/documents`;
}

function decodeValue(v) {
  if (v == null) return null;
  if ('nullValue' in v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return new Date(v.timestampValue);
  if ('bytesValue' in v) return Buffer.from(v.bytesValue, 'base64');
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(decodeValue);
  if ('mapValue' in v) {
    const out = {};
    for (const [k, val] of Object.entries(v.mapValue.fields || {})) {
      out[k] = decodeValue(val);
    }
    return out;
  }
  if ('geoPointValue' in v) return v.geoPointValue;
  if ('referenceValue' in v) return v.referenceValue;
  return null;
}

function encodeValue(value, depth = 0) {
  if (value === undefined) return undefined;
  if (value === null) return { nullValue: null };
  if (depth > 40) return { stringValue: String(value) };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Buffer.isBuffer(value)) return { bytesValue: value.toString('base64') };
  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map((x) => encodeValue(x, depth + 1)).filter((x) => x !== undefined)
      }
    };
  }
  if (typeof value === 'object') {
    // ObjectId-like
    if (value._bsontype || (value.constructor && value.constructor.name === 'ObjectId')) {
      return { stringValue: String(value) };
    }
    if (typeof value.toHexString === 'function') {
      return { stringValue: value.toHexString() };
    }
    const fields = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === '__v') continue;
      const enc = encodeValue(v, depth + 1);
      if (enc !== undefined) fields[k] = enc;
    }
    return { mapValue: { fields } };
  }
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return { nullValue: null };
    if (Number.isInteger(value)) return { integerValue: String(value) };
    return { doubleValue: value };
  }
  return { stringValue: String(value) };
}

function docFromFirestore(doc) {
  if (!doc || !doc.name) return null;
  const id = doc.name.split('/').pop();
  const data = {};
  for (const [k, v] of Object.entries(doc.fields || {})) {
    data[k] = decodeValue(v);
  }
  // Prefer original mongo id if present
  const mongoId = data._mongoId || id;
  data._id = mongoId;
  data.id = String(mongoId);
  return data;
}

function toFields(plain) {
  const fields = {};
  for (const [k, v] of Object.entries(plain)) {
    if (k === '_id' || k === 'id' || k === '__v') continue;
    const enc = encodeValue(v);
    if (enc !== undefined) fields[k] = enc;
  }
  return fields;
}

async function getDoc(collection, docId) {
  try {
    const json = await firestoreJson(
      'GET',
      `${basePath()}/${encodeURIComponent(collection)}/${encodeURIComponent(docId)}`
    );
    return docFromFirestore(json);
  } catch (err) {
    if (err.statusCode === 404) return null;
    throw err;
  }
}

async function listCollection(collection, { pageSize = 300 } = {}) {
  const out = [];
  let pageToken = '';
  do {
    let path = `${basePath()}/${encodeURIComponent(collection)}?pageSize=${pageSize}`;
    if (pageToken) path += `&pageToken=${encodeURIComponent(pageToken)}`;
    const json = await firestoreJson('GET', path);
    for (const d of json.documents || []) {
      const doc = docFromFirestore(d);
      if (doc) out.push(doc);
    }
    pageToken = json.nextPageToken || '';
  } while (pageToken);
  return out;
}

async function setDoc(collection, docId, data, { merge = false } = {}) {
  const fields = toFields(data);
  fields._mongoId = encodeValue(String(docId));
  fields._source = encodeValue(data._source || 'firestore-runtime');
  fields._exportedAt = encodeValue(new Date());

  let path = `${basePath()}?documentId=${encodeURIComponent(docId)}`;
  // PATCH existing
  const existing = await getDoc(collection, docId);
  if (existing) {
    const mask = Object.keys(fields)
      .map((f) => `updateMask.fieldPaths=${encodeURIComponent(f)}`)
      .join('&');
    path = `${basePath()}/${encodeURIComponent(collection)}/${encodeURIComponent(docId)}?${mask}`;
    await firestoreJson('PATCH', path, { fields });
  } else {
    // create under collection
    path = `${basePath()}/${encodeURIComponent(collection)}?documentId=${encodeURIComponent(docId)}`;
    await firestoreJson('POST', path, { fields });
  }
  return getDoc(collection, docId);
}

async function deleteDoc(collection, docId) {
  try {
    await firestoreJson(
      'DELETE',
      `${basePath()}/${encodeURIComponent(collection)}/${encodeURIComponent(docId)}`
    );
    return true;
  } catch (err) {
    if (err.statusCode === 404) return false;
    throw err;
  }
}

async function batchGet(collection, ids) {
  const unique = [...new Set(ids.map(String).filter(Boolean))];
  if (!unique.length) return [];
  const out = [];
  const CHUNK = 50;
  for (let i = 0; i < unique.length; i += CHUNK) {
    const slice = unique.slice(i, i + CHUNK);
    const json = await firestoreJson('POST', `${basePath()}:batchGet`, {
      documents: slice.map(
        (id) =>
          `projects/${PROJECT}/databases/${DATABASE}/documents/${collection}/${id}`
      )
    });
    for (const item of json || []) {
      if (item.found) {
        const doc = docFromFirestore(item.found);
        if (doc) out.push(doc);
      }
    }
  }
  return out;
}

async function ping() {
  const token = await getAccessToken();
  if (!token) throw new Error('No Firestore access token');
  // light read of meta
  try {
    await firestoreJson('GET', `${basePath()}/_meta/mongo_dev_export`);
  } catch (err) {
    if (err.statusCode !== 404) throw err;
  }
  logger.info('Firestore connected', { project: PROJECT });
  return true;
}

module.exports = {
  isFirestoreEnabled,
  getAccessToken,
  getDoc,
  setDoc,
  deleteDoc,
  listCollection,
  batchGet,
  encodeValue,
  decodeValue,
  docFromFirestore,
  toFields,
  ping,
  PROJECT
};
