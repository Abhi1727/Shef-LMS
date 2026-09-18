const cron = require('node-cron');
const { runClassroomIntegritySweep } = require('../services/classroomIntegrity');
const logger = require('../utils/logger');

async function runClassroomIntegrityJob() {
  // Allow ops to pause without code change
  if (String(process.env.CLASSROOM_INTEGRITY_SWEEP_ENABLED || 'true').toLowerCase() === 'false') {
    return { skipped: true };
  }
  return runClassroomIntegritySweep({
    publish: { skipTestTitles: true, limit: 250 },
    batches: { limit: 400 },
    attach: { sinceDays: 45, limit: 150 }
  });
}

function startClassroomIntegrityJob() {
  // Every 3 hours — cheap Firestore sweep vs full Zoom/Meet sync
  cron.schedule('25 */3 * * *', async () => {
    try {
      await runClassroomIntegrityJob();
    } catch (err) {
      logger.error('Classroom integrity sweep cron error', { error: err.message || String(err) });
    }
  });
  setTimeout(() => {
    runClassroomIntegrityJob().catch((err) =>
      logger.error('Classroom integrity sweep startup', { error: err.message || String(err) })
    );
  }, 180 * 1000);
  console.log('[Classroom integrity] cron scheduled (every 3h at :25)');
}

module.exports = {
  startClassroomIntegrityJob,
  runClassroomIntegrityJob
};
