/**
 * Pre-deploy check: classes running right now. Asks Zoom about every LiveClass marked live
 * (zoomService.listLiveMeetings needs a Zoom user id, so it can't answer "anything live?").
 * Exit code 0 = nothing running, 1 = classes running, 2 = error.
 *
 *   docker exec -w /app shef-lms-backend node scripts/liveClassesNow.js
 */
const { connectMongo } = require('../config/mongo');
const LiveClass = require('../models/LiveClass');
const zoomService = require('../services/zoomService');

async function main() {
  await connectMongo();
  const rows = await LiveClass.find({ status: 'live' })
    .select('title teacherName conferenceProvider zoomMeetingId actualStartedAt')
    .lean()
    .exec();
  const running = [];
  for (const row of rows) {
    if (row.conferenceProvider === 'zoom' && row.zoomMeetingId) {
      const { status } = await zoomService.getMeetingRoomStatus(row.zoomMeetingId);
      if (status === 'started') running.push(`${row.title} (${String(row.teacherName || '').trim()}, Zoom)`);
    } else {
      running.push(`${row.title} (${String(row.teacherName || '').trim()}, ${row.conferenceProvider || 'meet'} — status not checkable)`);
    }
  }
  console.log(running.length ? `LIVE ${running.length}:\n  ${running.join('\n  ')}` : 'NONE LIVE');
  process.exit(running.length ? 1 : 0);
}

main().catch((err) => {
  console.error('live check failed:', err.message || err);
  process.exit(2);
});
