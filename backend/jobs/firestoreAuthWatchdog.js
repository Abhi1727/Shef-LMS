/**
 * Watchdog: detect Firestore OAuth expiry before users hit login 500s.
 * Emails ADMIN_ALERT_EMAILS at most once per 6 hours while unhealthy.
 */
const cron = require('node-cron');
const {
  isFirestoreEnabled,
  checkAuthHealth,
  getAuthHealth
} = require('../services/firestoreDb');
const { sendTransactionalEmail } = require('../services/emailService');
const logger = require('../utils/logger');

let lastAlertAt = 0;
const ALERT_COOLDOWN_MS = 6 * 60 * 60 * 1000;

function adminEmails() {
  return String(process.env.ADMIN_ALERT_EMAILS || '')
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);
}

async function runFirestoreAuthCheck() {
  if (!isFirestoreEnabled()) return { skipped: true };
  const health = await checkAuthHealth();
  if (health.ok) {
    logger.info('Firestore auth health OK');
    return health;
  }

  logger.error('Firestore auth health FAILED', { error: health.error });
  const now = Date.now();
  if (now - lastAlertAt < ALERT_COOLDOWN_MS) return health;
  lastAlertAt = now;

  const emails = adminEmails();
  if (!emails.length) {
    logger.warn('Firestore auth failed but ADMIN_ALERT_EMAILS is empty');
    return health;
  }

  const envLabel = process.env.NODE_ENV || 'unknown';
  const db = process.env.FIRESTORE_DATABASE || '(default)';
  try {
    await sendTransactionalEmail({
      to: emails.join(', '),
      subject: `[Sky States LMS] Firestore OAuth failed (${envLabel} / ${db})`,
      text: `Firestore OAuth refresh failed on ${envLabel} / ${db}.\n\nError: ${health.error}\n\nRe-auth: ENV_PATH=.env node scripts/setup-firestore-oauth.js --auth\nThen recreate the backend container.`,
      html: `<p>Firestore OAuth refresh failed. Login will use Mongo fallback if configured, but the app may be degraded.</p>
        <p><b>Error:</b> ${String(health.error || '').replace(/</g, '&lt;')}</p>
        <p>Re-auth with:</p>
        <pre>ENV_PATH=.env node scripts/setup-firestore-oauth.js --auth</pre>
        <p>Then recreate the backend container.</p>`
    });
    logger.info('Firestore auth failure alert emailed', { to: emails.length });
  } catch (err) {
    logger.error('Failed to email Firestore auth alert', { error: err.message });
  }
  return health;
}

function startFirestoreAuthWatchdog() {
  if (!isFirestoreEnabled()) {
    console.log('[Firestore Auth Watchdog] skipped (USE_FIRESTORE!=true)');
    return;
  }
  // Every 15 minutes
  cron.schedule('*/15 * * * *', () => {
    runFirestoreAuthCheck().catch((err) => {
      logger.error('Firestore auth watchdog error', { error: err.message });
    });
  });
  // Run once shortly after boot
  setTimeout(() => {
    runFirestoreAuthCheck().catch(() => {});
  }, 20_000);
  console.log('[Firestore Auth Watchdog] cron scheduled (every 15 minutes)');
}

module.exports = {
  startFirestoreAuthWatchdog,
  runFirestoreAuthCheck,
  getAuthHealth
};
