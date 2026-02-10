// Moved legacy Firebase migration helper from backend/config/firebaseMigration.js

const admin = require('firebase-admin');

let appInitialized = false;
let db = null;

function initFirebaseAdmin() {
  if (appInitialized) {
    return { admin, db };
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Missing Firebase Admin environment variables');
  }

  privateKey = privateKey.replace(/\\n/g, '\n');

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
  }

  db = admin.firestore();
  appInitialized = true;
  return { admin, db };
}

module.exports = { initFirebaseAdmin };
