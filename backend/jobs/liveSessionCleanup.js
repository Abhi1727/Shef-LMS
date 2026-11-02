const cron = require('node-cron');
const { cleanupStaleSessions, reconcileZoomLiveSessions } = require('../utils/liveClassSessionGuard');

/**
 * Per-trainer cleanup only runs when that trainer opens the LMS, so a class the trainer never
 * ended stayed "LIVE NOW" for students until the trainer came back. Sweep all trainers instead.
 */
async function runLiveSessionCleanup() {
  const stale = await cleanupStaleSessions();
  const zoomEnded = await reconcileZoomLiveSessions({ onlyPastScheduledEnd: true });
  const closed = [...stale, ...zoomEnded];
  if (closed.length) {
    console.log(
      `[Live session cleanup] closed=${closed.length}`,
      closed.map((c) => `${c.title} (${c.reason})`).join('; ')
    );
  }
  return closed;
}

function startLiveSessionCleanupJob() {
  cron.schedule('*/15 * * * *', async () => {
    try {
      await runLiveSessionCleanup();
    } catch (err) {
      console.error('[Live session cleanup] cron error:', err.message || err);
    }
  });
  console.log('[Live session cleanup] cron scheduled (every 15 minutes)');
}

module.exports = {
  startLiveSessionCleanupJob,
  runLiveSessionCleanup
};
