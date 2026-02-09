const cron = require('node-cron');
const zoomService = require('../services/zoomService');
const { connectMongo } = require('../config/mongo');
const Classroom = require('../models/Classroom');
const LiveClass = require('../models/LiveClass');

// Function to sync Zoom recordings to classroom
async function syncZoomRecordings() {
  try {
    console.log('[Zoom Sync] Starting recording sync...');

    await connectMongo();

    // Get all recordings from last 7 days (to catch recent classes)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];
    const today = new Date().toISOString().split('T')[0];

    const result = await zoomService.listAllRecordings(sevenDaysAgo, today);

    if (!result.success || !result.meetings || result.meetings.length === 0) {
      console.log('[Zoom Sync] No recordings found');
      return { synced: 0, skipped: 0 };
    }

    let syncedCount = 0;
    let skippedCount = 0;

    // Process each meeting with recordings
    for (const meeting of result.meetings) {
      if (!meeting.recordingFiles || meeting.recordingFiles.length === 0) {
        continue;
      }

      // Find MP4 video recordings (skip audio, transcript, chat files)
      const videoRecordings = meeting.recordingFiles.filter(
        file => file.fileType === 'MP4' && 
               file.recordingType !== 'audio_only' &&
               file.status === 'completed'
      );

      if (videoRecordings.length === 0) {
        continue;
      }

      // Check if this meeting is in our liveClasses collection (Mongo)
      const liveClass = await LiveClass.findOne({
        zoomMeetingId: meeting.id.toString(),
      });

      let classTitle = meeting.topic;
      let instructor = 'Instructor';
      let courseId = null;

      if (liveClass) {
        classTitle = liveClass.title || meeting.topic;
        instructor = liveClass.instructor || 'Instructor';
        courseId = liveClass.courseId || null;
      }

      // Add each video recording to classroom collection
      for (const recording of videoRecordings) {
        // Check if recording already exists in Mongo classroom collection
        const existing = await Classroom.findOne({ zoomRecordingId: recording.id });

        if (!existing) {
          await Classroom.create({
            title: classTitle,
            instructor: instructor,
            duration: `${Math.floor(meeting.duration / 60)} min`,
            date: meeting.startTime,
            videoSource: 'zoom',
            zoomUrl: recording.playUrl,
            zoomPasscode: meeting.password || '',
            zoomRecordingId: recording.id,
            zoomMeetingId: meeting.id.toString(),
            courseId: courseId,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          console.log(`[Zoom Sync] Added recording: ${classTitle}`);
          syncedCount++;
        } else {
          skippedCount++;
        }
      }
    }

    console.log(`[Zoom Sync] Completed: ${syncedCount} synced, ${skippedCount} skipped`);
    return { synced: syncedCount, skipped: skippedCount };
  } catch (error) {
    console.error('[Zoom Sync] Error:', error.message);
    return { error: error.message };
  }
}

// Schedule the job to run every hour
function startRecordingSync() {
  // Run every hour
  cron.schedule('0 * * * *', async () => {
    console.log('[Zoom Sync] Running scheduled sync...');
    await syncZoomRecordings();
  });

  // Also run on startup (after 2 minutes to let server stabilize)
  setTimeout(async () => {
    console.log('[Zoom Sync] Running initial sync...');
    await syncZoomRecordings();
  }, 120000);

  console.log('[Zoom Sync] Scheduler started - will run every hour');
}

module.exports = {
  startRecordingSync,
  syncZoomRecordings
};
