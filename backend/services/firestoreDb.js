/**
 * Firestore REST client (USE_FIRESTORE=true for DEV + PROD).
 * Auth preference:
 *   1) Impersonate FIRESTORE_IMPERSONATE_SA via OAuth refresh (GCP Blaze / no SA JSON keys)
 *   2) Direct OAuth access token
 *   3) gcloud CLI (host only)
 * Databases: lms-dev (DEV) / lms-prod (PROD) via FIRESTORE_DATABASE.
 */
const https = require('https');
const logger = require('../utils/logger');

const PROJECT = process.env.FIRESTORE_PROJECT || 'skystateslms';
const DATABASE = process.env.FIRESTORE_DATABASE || '(default)';
const IMPERSONATE_SA =
  process.env.FIRESTORE_IMPERSONATE_SA ||
  'firestore-lms-runtime@skystateslms.iam.gserviceaccount.com';

let cachedToken = null;
let tokenExpiresAt = 0;
let authMode = null;

function isFirestoreEnabled() {
  return String(process.env.USE_FIRESTORE || '').toLowerCase() === 'true';
}

/** True when error is expired/revoked OAuth or Firestore auth failure. */
function isFirestoreAuthError(err) {
  const msg = String(err?.message || err || '');
  return /invalid_grant|invalid_rapt|OAuth refresh failed|insufficient.*(scope|auth)|UNAUTHENTICATED|401|impersonat/i.test(
    msg
  );
}

let lastAuthHealth = { ok: true, checkedAt: null, error: null, mode: null };

async function checkAuthHealth() {
  try {
    cachedToken = null;
    tokenExpiresAt = 0;
    await getAccessToken();
    lastAuthHealth = {
      ok: true,
      checkedAt: new Date().toISOString(),
      error: null,
      mode: authMode
    };
    return lastAuthHealth;
  } catch (err) {
    lastAuthHealth = {
      ok: false,
      checkedAt: new Date().toISOString(),
      error: err.message || String(err),
      mode: authMode
    };
    return lastAuthHealth;
  }
}

function getAuthHealth() {
  return { ...lastAuthHealth };
}

function oauthQuotaProject() {
  if (process.env.FIRESTORE_OAUTH_QUOTA_PROJECT) return process.env.FIRESTORE_OAUTH_QUOTA_PROJECT;
  const clientId = process.env.FIRESTORE_OAUTH_CLIENT_ID || '';
  const prefix = clientId.split('-')[0];
  return /^\d+$/.test(prefix) ? prefix : PROJECT;
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

async function getUserAccessToken() {
  const clientId = process.env.FIRESTORE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.FIRESTORE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.FIRESTORE_OAUTH_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('FIRESTORE_OAUTH_CLIENT_ID/SECRET/REFRESH_TOKEN required');
  }
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
  return {
    accessToken: res.json.access_token,
    expiresIn: Number(res.json.expires_in) || 3500
  };
}

async function getImpersonatedAccessToken() {
  const { OAuth2Client, Impersonated } = require('google-auth-library');
  const clientId = process.env.FIRESTORE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.FIRESTORE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.FIRESTORE_OAUTH_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken || !IMPERSONATE_SA) {
    throw new Error('Impersonation requires OAuth env + FIRESTORE_IMPERSONATE_SA');
  }

  // IAM Credentials API is billed/quotad against the OAuth client project.
  process.env.GOOGLE_CLOUD_QUOTA_PROJECT = oauthQuotaProject();

  const oauth2 = new OAuth2Client(clientId, clientSecret);
  oauth2.setCredentials({ refresh_token: refreshToken });
  const imp = new Impersonated({
    sourceClient: oauth2,
    targetPrincipal: IMPERSONATE_SA,
    lifetime: 3600,
    delegates: [],
    targetScopes: [
      'https://www.googleapis.com/auth/cloud-platform',
      'https://www.googleapis.com/auth/datastore'
    ]
  });
  const res = await imp.getAccessToken();
  const token = res?.token || res;
  if (!token || typeof token !== 'string') {
    throw new Error('SA impersonation returned no access token');
  }
  return { accessToken: token, expiresIn: 3500 };
}

async function getAccessToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt - 60_000) return cachedToken;

  // Prefer GCP service-account impersonation (Blaze / no JSON keys).
  if (IMPERSONATE_SA && process.env.FIRESTORE_OAUTH_REFRESH_TOKEN) {
    try {
      const { accessToken, expiresIn } = await getImpersonatedAccessToken();
      cachedToken = accessToken;
      tokenExpiresAt = now + expiresIn * 1000;
      authMode = 'sa-impersonation';
      return cachedToken;
    } catch (err) {
      logger.warn('SA impersonation failed; falling back to user OAuth token', {
        error: err.message,
        sa: IMPERSONATE_SA
      });
    }
  }

  if (process.env.FIRESTORE_OAUTH_CLIENT_ID && process.env.FIRESTORE_OAUTH_REFRESH_TOKEN) {
    const { accessToken, expiresIn } = await getUserAccessToken();
    cachedToken = accessToken;
    tokenExpiresAt = now + expiresIn * 1000;
    authMode = 'user-oauth';
    return cachedToken;
  }

  // Fallback: gcloud CLI (host / mounted config)
  try {
    const { execSync } = require('child_process');
    cachedToken = execSync(`gcloud auth print-access-token --project=${PROJECT}`, {
      encoding: 'utf8'
    }).trim();
    tokenExpiresAt = now + 3000 * 1000;
    authMode = 'gcloud';
    return cachedToken;
  } catch (err) {
    throw new Error(
      'Firestore auth missing. Set FIRESTORE_OAUTH_* (+ FIRESTORE_IMPERSONATE_SA) or gcloud auth login.'
    );
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function firestoreJson(method, apiPath, body, { retries = 5 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const token = await getAccessToken();
    const res = await httpsRequest(
      method,
      'firestore.googleapis.com',
      apiPath,
      {
        Authorization: `Bearer ${token}`,
        'x-goog-user-project': PROJECT
      },
      body
    );
    if (res.status >= 200 && res.status < 300) return res.json;
    const err = new Error(
      `Firestore HTTP ${res.status}: ${typeof res.json === 'object' ? JSON.stringify(res.json) : res.text}`
    );
    err.statusCode = res.status;
    err.body = res.json;
    lastErr = err;
    // Retry transient quota / rate-limit responses with backoff
    if (res.status === 429 || res.status === 503 || res.status === 500) {
      const delay = Math.min(15000, 400 * 2 ** attempt + Math.floor(Math.random() * 200));
      logger.warn('Firestore request retry', { status: res.status, attempt, delay, apiPath });
      await sleep(delay);
      continue;
    }
    throw err;
  }
  throw lastErr;
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
  logger.info('Firestore connected', { project: PROJECT, database: DATABASE, authMode });
  return true;
}

module.exports = {
  isFirestoreEnabled,
  isFirestoreAuthError,
  checkAuthHealth,
  getAuthHealth,
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
