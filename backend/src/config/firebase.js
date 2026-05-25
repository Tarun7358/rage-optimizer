const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

let db = null;
let rtdb = null;
let auth = null;
let storage = null;
let messaging = null;
let isFirebaseMock = false;

try {
  let serviceAccount = null;

  // Priority 1: JSON string in env var
  if (process.env.FIREBASE_SERVICE_ACCOUNT && process.env.FIREBASE_SERVICE_ACCOUNT.trim().startsWith('{')) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    console.log('[Firebase] Loaded service account from FIREBASE_SERVICE_ACCOUNT env var.');
  }
  // Priority 2: File path in env var
  else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const filePath = path.resolve(__dirname, '../../', process.env.FIREBASE_SERVICE_ACCOUNT);
    if (fs.existsSync(filePath)) {
      serviceAccount = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      console.log(`[Firebase] Loaded service account from file: ${filePath}`);
    } else {
      throw new Error(`Service account file not found: ${filePath}`);
    }
  }
  // Priority 3: GOOGLE_APPLICATION_CREDENTIALS env var (default credentials)
  else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.log('[Firebase] Using GOOGLE_APPLICATION_CREDENTIALS for auth.');
  }
  else {
    throw new Error('No Firebase credentials provided.');
  }

  const config = {
    credential: serviceAccount
      ? admin.credential.cert(serviceAccount)
      : admin.credential.applicationDefault(),
    databaseURL: process.env.FIREBASE_DATABASE_URL ||
      `https://${serviceAccount?.project_id || 'rage-optimizer'}-default-rtdb.firebaseio.com`,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET ||
      `${serviceAccount?.project_id || 'rage-optimizer'}.appspot.com`
  };

  admin.initializeApp(config);
  db = admin.firestore();
  db.settings({ ignoreUndefinedProperties: true });
  rtdb = admin.database();
  auth = admin.auth();
  storage = admin.storage();
  messaging = admin.messaging();

  console.log('[Firebase] Admin SDK initialized successfully.');
} catch (err) {
  console.warn(`[Firebase Warning] Initialization failed: ${err.message}. Running in MOCK mode.`);
  isFirebaseMock = true;
}

module.exports = { admin, db, rtdb, auth, storage, messaging, isFirebaseMock };
