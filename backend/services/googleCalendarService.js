const { google } = require('googleapis');
const { randomUUID } = require('crypto');
const {
  isMeetEnabled,
  getAuthMode,
  getGoogleAuth
} = require('./googleAuth');

function assertConfigured() {
  if (!isMeetEnabled()) {
    const err = new Error(
      'Google Meet is disabled. Set GOOGLE_MEET_ENABLED=true in .env.dev after adding OAuth credentials.'
    );
    err.code = 'MEET_DISABLED';
    throw err;
  }

  const mode = getAuthMode();
  if (mode === 'none') {
    const err = new Error(
      'Google Meet is not configured. Prefer OAuth: set GOOGLE_MEET_CLIENT_ID, GOOGLE_MEET_CLIENT_SECRET, and GOOGLE_MEET_REFRESH_TOKEN. Run: node scripts/setup-meet-oauth.js'
    );
    err.code = 'MEET_NOT_CONFIGURED';
    throw err;
  }
  return mode;
}

async function getCalendarClient() {
  assertConfigured();
  const auth = await getGoogleAuth();
  return google.calendar({ version: 'v3', auth });
}

function calendarId() {
  return process.env.GOOGLE_CALENDAR_ID || 'primary';
}

/**
 * Create a Calendar event with an attached Google Meet conference.
 * @param {{ title: string, description?: string, start: Date, end: Date, timezone?: string, attendeeEmails?: string[] }} opts
 */
async function createMeetEvent(opts) {
  const calendar = await getCalendarClient();
  const timezone = opts.timezone || 'Asia/Kolkata';
  const requestId = randomUUID();

  const eventBody = {
    summary: opts.title,
    description: opts.description || '',
    start: {
      dateTime: new Date(opts.start).toISOString(),
      timeZone: timezone
    },
    end: {
      dateTime: new Date(opts.end).toISOString(),
      timeZone: timezone
    },
    conferenceData: {
      createRequest: {
        requestId,
        conferenceSolutionKey: { type: 'hangoutsMeet' }
      }
    }
  };

  if (Array.isArray(opts.attendeeEmails) && opts.attendeeEmails.length) {
    eventBody.attendees = opts.attendeeEmails
      .filter(Boolean)
      .slice(0, 50)
      .map((email) => ({ email }));
  }

  const res = await calendar.events.insert({
    calendarId: calendarId(),
    conferenceDataVersion: 1,
    requestBody: eventBody
  });

  const event = res.data || {};
  const meetLink =
    event.hangoutLink ||
    event.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')?.uri ||
    '';

  return {
    calendarEventId: event.id,
    meetLink,
    meetSpaceId: event.conferenceData?.conferenceId || '',
    htmlLink: event.htmlLink || '',
    raw: event
  };
}

async function cancelMeetEvent(calendarEventId) {
  if (!calendarEventId) return { cancelled: false };
  const calendar = await getCalendarClient();
  try {
    await calendar.events.delete({
      calendarId: calendarId(),
      eventId: calendarEventId
    });
    return { cancelled: true };
  } catch (error) {
    if (error?.code === 404 || error?.response?.status === 404) {
      return { cancelled: true, alreadyGone: true };
    }
    throw error;
  }
}

async function updateMeetEvent(calendarEventId, opts) {
  if (!calendarEventId) {
    throw new Error('calendarEventId is required');
  }
  const calendar = await getCalendarClient();
  const timezone = opts.timezone || 'Asia/Kolkata';
  const res = await calendar.events.patch({
    calendarId: calendarId(),
    eventId: calendarEventId,
    conferenceDataVersion: 1,
    requestBody: {
      summary: opts.title,
      description: opts.description,
      start: opts.start
        ? { dateTime: new Date(opts.start).toISOString(), timeZone: timezone }
        : undefined,
      end: opts.end
        ? { dateTime: new Date(opts.end).toISOString(), timeZone: timezone }
        : undefined
    }
  });
  const event = res.data || {};
  return {
    calendarEventId: event.id,
    meetLink:
      event.hangoutLink ||
      event.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')?.uri ||
      '',
    meetSpaceId: event.conferenceData?.conferenceId || ''
  };
}

function getMeetStatus() {
  const mode = getAuthMode();
  return {
    enabled: isMeetEnabled(),
    configured: mode !== 'none',
    authMode: mode,
    impersonate: mode === 'service_account' ? process.env.GOOGLE_WORKSPACE_IMPERSONATE || null : null,
    calendarId: calendarId(),
    hint:
      mode === 'none'
        ? 'Use OAuth (recommended when SA keys are blocked): GOOGLE_MEET_CLIENT_ID / SECRET / REFRESH_TOKEN. See docs/GOOGLE_MEET_DEV_SETUP.md'
        : null
  };
}

module.exports = {
  isMeetEnabled,
  getMeetStatus,
  getAuthMode,
  createMeetEvent,
  cancelMeetEvent,
  updateMeetEvent
};
