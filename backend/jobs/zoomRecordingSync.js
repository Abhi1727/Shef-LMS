const cron = require('node-cron');
const { syncZoomRecordings } = require('../services/zoomRecordingSync');
const { isZoomRecordingPipelineEnabled } = require('../services/liveClassSettings');

async function runZoomRecordingSync() {
  if (!(await isZoomRecordingPipelineEnabled())) return { skipped: true };
  return syncZoomRecordings();
}

function startZoomRecordingSyncJob() {
  // Hourly — frequent full LiveClass scans were a major Firestore read cost.
  cron.schedule('15 * * * *', async () => {
    try {
      await runZoomRecordingSync();
    } catch (err) {
      console.error('[Zoom recording sync] cron error:', err.message || err);
    }
  });
  setTimeout(() => {
    runZoomRecordingSync().catch((err) =>
      console.error('[Zoom recording sync] startup:', err.message || err)
    );
  }, 120 * 1000);
  console.log('[Zoom recording sync] cron scheduled (hourly at :15)');
}

module.exports = {
  startZoomRecordingSyncJob,
  runZoomRecordingSync
};
