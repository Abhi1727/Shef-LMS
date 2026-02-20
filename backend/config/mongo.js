const mongoose = require('mongoose');
const dns = require('dns').promises;
const dotenv = require('dotenv');
const logger = require('../utils/logger');

dotenv.config({ path: process.env.ENV_PATH || '.env' });

let isConnected = false;

/**
 * Convert mongodb+srv:// URI to mongodb:// format for environments where
 * SRV lookups fail (e.g. some Docker/restricted networks - querySrv ECONNREFUSED).
 * Falls back to Google DNS (8.8.8.8) if system DNS fails.
 */
async function srvToStandardUri(srvUri) {
  const match = srvUri.match(/^mongodb\+srv:\/\/([^/]+)\/([^?]*)(\?.*)?$/);
  if (!match) return srvUri;

  const [, userInfo, dbPath, queryString = ''] = match;
  const srvHost = userInfo.includes('@') ? userInfo.split('@')[1] : userInfo;

  const resolveWithDns = async (servers) => {
    const previous = dns.getServers();
    try {
      if (servers) dns.setServers(servers);
      const records = await dns.resolveSrv(`_mongodb._tcp.${srvHost}`);
      if (!records || records.length === 0) throw new Error('No SRV records');
      const primary = records[0];
      const host = primary.name.replace(/\.$/, '');
      const port = primary.port || 27017;
      const auth = userInfo.includes('@') ? userInfo.split('@')[0] + '@' : '';
      return `mongodb://${auth}${host}:${port}/${dbPath}${queryString}`;
    } finally {
      dns.setServers(previous);
    }
  };

  try {
    return await resolveWithDns(null);
  } catch (err) {
    logger.warn('SRV lookup failed, retrying with Google DNS', { error: err.message });
    return await resolveWithDns(['8.8.8.8', '8.8.4.4']);
  }
}

function encodePassword(password) {
  if (!password) return '';
  return encodeURIComponent(password);
}

async function getConnectionUri() {
  if (process.env.MONGODB_URI_STANDARD) {
    return process.env.MONGODB_URI_STANDARD;
  }
  // Prefer Option 2 (components) when set - avoids placeholder issues
  if (process.env.MONGODB_USERNAME && process.env.MONGODB_PASSWORD && process.env.MONGODB_CLUSTER) {
    const user = encodeURIComponent(process.env.MONGODB_USERNAME);
    const pass = encodePassword(process.env.MONGODB_PASSWORD);
    const db = process.env.MONGODB_DATABASE || process.env.MONGO_DB_NAME || 'lms';
    const uri = `mongodb+srv://${user}:${pass}@${process.env.MONGODB_CLUSTER}/${db}?retryWrites=true&w=majority&appName=Cluster0`;
    return uri;
  }
  const uri = process.env.MONGODB_URI || process.env.MONGO_URL;
  if (uri && !uri.includes('<') && uri.startsWith('mongodb+srv://')) {
    return await srvToStandardUri(uri);
  }
  if (uri && uri.startsWith('mongodb://') && !uri.includes('<')) {
    return uri;
  }
  throw new Error('MongoDB config: set MONGODB_USERNAME, MONGODB_PASSWORD, MONGODB_CLUSTER, or MONGODB_URI (no placeholders) in .env');
}

async function connectMongo() {
  if (isConnected) {
    return mongoose.connection;
  }

  try {
    const uri = await getConnectionUri();
    await mongoose.connect(uri, {
      dbName: process.env.MONGO_DB_NAME || undefined,
    });

    isConnected = true;
    logger.info('MongoDB connected');
    return mongoose.connection;
  } catch (err) {
    logger.error('MongoDB connection error', {
      error: err.message,
      name: err.name,
      code: err.code,
      reason: err.reason?.message
    });
    throw err;
  }
}

module.exports = { mongoose, connectMongo };
