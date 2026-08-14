const cron = require('node-cron');
const { isMeetEnabled } = require('../services/googleAuth');
const { syncMeetRecordings } = require('../services/meetRecordingSync');

async function runMeetRecordingSync() {
  if (!isMeetEnabled()) return { skipped: true };
  return syncMeetRecordings();
}

function startMeetRecordingSyncJob() {
  cron.schedule('*/10 * * * *', async () => {
    try {
      await runMeetRecordingSync();
    } catch (err) {
      console.error('[Meet recording sync] cron error:', err.message || err);
    }
  });
  setTimeout(() => {
    runMeetRecordingSync().catch((err) =>
      console.error('[Meet recording sync] startup:', err.message || err)
    );
  }, 90 * 1000);
  console.log('[Meet recording sync] cron scheduled (every 10 minutes)');
}

module.exports = {
  startMeetRecordingSyncJob,
  runMeetRecordingSync
};
