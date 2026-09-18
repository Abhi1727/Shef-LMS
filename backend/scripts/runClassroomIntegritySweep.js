#!/usr/bin/env node
/**
 * Manual classroom integrity sweep (publish hidden, fix batch, attach missing).
 *
 *   ENV_PATH=.env node scripts/runClassroomIntegritySweep.js
 */
require('dotenv').config({ path: process.env.ENV_PATH || '.env' });

const { runClassroomIntegritySweep } = require('../services/classroomIntegrity');

(async () => {
  const result = await runClassroomIntegritySweep({
    publish: { skipTestTitles: true, limit: 400 },
    batches: { limit: 600 },
    attach: { sinceDays: 60, limit: 200 }
  });
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
