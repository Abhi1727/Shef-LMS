const cron = require('node-cron');
const { isMeetEnabled } = require('../services/googleAuth');
const { syncMeetRecordings } = require('../services/meetRecordingSync');
const { isMeetLiveEnabled } = require('../services/liveClassSettings');

async function runMeetRecordingSync() {
  // Meet classroom recording pipeline — off unless Meet live is enabled (env + admin)
  const meetOn = await isMeetLiveEnabled().catch(() => isMeetEnabled());
  if (!meetOn) return { skipped: true, reason: 'meet-disabled' };
  return syncMeetRecordings();
}

function startMeetRecordingSyncJob() {
  // Hourly — avoids scanning LiveClass every 10 minutes when Meet is rarely used.
  cron.schedule('20 * * * *', async () => {
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
  console.log('[Meet recording sync] cron scheduled (hourly at :20; no-op when Meet is off)');
}

module.exports = {
  startMeetRecordingSyncJob,
  runMeetRecordingSync
};
