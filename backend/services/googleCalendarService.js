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

async function getMeetClient() {
  assertConfigured();
  const auth = await getGoogleAuth();
  return google.meet({ version: 'v2', auth });
}

function hostWorkspaceDomain() {
  const host = process.env.GOOGLE_MEET_HOST_EMAIL || '';
  const at = host.indexOf('@');
  return at > 0 ? host.slice(at + 1).toLowerCase() : '';
}

function isCalendarQuotaError(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  const errors = err?.errors || err?.response?.data?.error?.errors || [];
  return (
    msg.includes('calendar usage limits exceeded') ||
    msg.includes('quotaexceeded') ||
    errors.some(
      (e) =>
        e?.reason === 'quotaExceeded' &&
        (e?.domain === 'usageLimits' || String(e?.message || '').toLowerCase().includes('calendar'))
    )
  );
}

function calendarQuotaMessage() {
  return (
    'Google Calendar blocked sending more class invites today (Workspace anti-spam limit). ' +
    'The Meet was not created. Wait about an hour and try again, or schedule without mass Calendar invites — students still see classes in the LMS.'
  );
}

function calendarId() {
  return process.env.GOOGLE_CALENDAR_ID || 'primary';
}

/**
 * Prefer Meet Spaces API so we can open access (no host waiting room knock)
 * and request auto-recording when Workspace allows it.
 * Falls back silently when scope/token is missing.
 */
async function createOpenMeetSpace({ title } = {}) {
  try {
    const meet = await getMeetClient();
    const res = await meet.spaces.create({
      requestBody: {
        config: {
          accessType: 'OPEN',
          entryPointAccess: 'ALL',
          artifactConfig: {
            recordingConfig: {
              autoRecordingGeneration: 'ON'
            }
          }
        }
      }
    });
    const space = res.data || {};
    return {
      meetLink: space.meetingUri || '',
      meetSpaceId: space.name || '',
      meetingCode: space.meetingCode || '',
      raw: space
    };
  } catch (err) {
    console.warn(
      '[Meet] spaces.create unavailable (re-run setup-meet-oauth.js with meetings.space.created):',
      err?.message || err
    );
    return null;
  }
}

/**
 * Best-effort: open access + auto-record on an existing Calendar-created Meet.
 */
async function configureMeetSpaceOpen(meetSpaceNameOrCode) {
  if (!meetSpaceNameOrCode) return false;
  const name = String(meetSpaceNameOrCode).startsWith('spaces/')
    ? String(meetSpaceNameOrCode)
    : `spaces/${meetSpaceNameOrCode}`;
  try {
    const meet = await getMeetClient();
    await meet.spaces.patch({
      name,
      updateMask:
        'config.accessType,config.entryPointAccess,config.artifactConfig.recordingConfig.autoRecordingGeneration',
      requestBody: {
        config: {
          accessType: 'OPEN',
          entryPointAccess: 'ALL',
          artifactConfig: {
            recordingConfig: {
              autoRecordingGeneration: 'ON'
            }
          }
        }
      }
    });
    return true;
  } catch (err) {
    console.warn('[Meet] spaces.patch skipped:', err?.message || err);
    return false;
  }
}

/**
 * Create a Calendar event with an attached Google Meet conference.
 * @param {{ title: string, description?: string, start: Date, end: Date, timezone?: string, attendeeEmails?: string[] }} opts
 */
async function createMeetEvent(opts) {
  const calendar = await getCalendarClient();
  const timezone = opts.timezone || 'Asia/Kolkata';
  const requestId = randomUUID();

  // Calendar invite spam limits hit quickly when emailing whole batches.
  // Students join via LMS schedule + reminder emails — not Google Calendar invites.
  const hostDomain = hostWorkspaceDomain();
  const attendeeEmails = Array.isArray(opts.attendeeEmails)
    ? [
        ...new Set(
          opts.attendeeEmails
            .filter(Boolean)
            .map((e) => String(e).trim().toLowerCase())
            .filter((email) => {
              if (!hostDomain) return true;
              return email.endsWith(`@${hostDomain}`);
            })
        )
      ].slice(0, 3)
    : [];

  // Prefer Meet Spaces API (OPEN + auto-record) when OAuth includes meetings.space.created
  const space = await createOpenMeetSpace({ title: opts.title });

  const eventBody = {
    summary: opts.title,
    description:
      (opts.description || '') +
      '\n\nMic and camera start muted on the pre-join screen. Host: start recording from Meet → Activities → Recording if it does not auto-start.',
    start: {
      dateTime: new Date(opts.start).toISOString(),
      timeZone: timezone
    },
    end: {
      dateTime: new Date(opts.end).toISOString(),
      timeZone: timezone
    },
    guestsCanModify: true,
    guestsCanInviteOthers: false,
    guestsCanSeeOtherGuests: true
  };

  if (space?.meetLink) {
    eventBody.location = space.meetLink;
    eventBody.description = `${eventBody.description}\n\nJoin: ${space.meetLink}`;
    eventBody.conferenceData = {
      conferenceId: space.meetingCode || undefined,
      conferenceSolution: {
        key: { type: 'hangoutsMeet' },
        name: 'Google Meet'
      },
      entryPoints: [
        {
          entryPointType: 'video',
          uri: space.meetLink,
          label: space.meetingCode || 'Meet'
        }
      ]
    };
  } else {
    eventBody.conferenceData = {
      createRequest: {
        requestId,
        conferenceSolutionKey: { type: 'hangoutsMeet' }
      }
    };
  }

  if (attendeeEmails.length) {
    eventBody.attendees = attendeeEmails.map((email) => ({ email, responseStatus: 'needsAction' }));
  }

  const res = await calendar.events.insert({
    calendarId: calendarId(),
    conferenceDataVersion: 1,
    sendUpdates: 'none',
    requestBody: eventBody
  });

  const event = res.data || {};
  let meetLink =
    space?.meetLink ||
    event.hangoutLink ||
    event.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')?.uri ||
    '';

  let meetSpaceId =
    space?.meetSpaceId || event.conferenceData?.conferenceId || '';

  // Calendar-created Meet: try opening access / auto-record when Meet scope exists
  if (!space?.meetLink && meetSpaceId) {
    await configureMeetSpaceOpen(meetSpaceId);
  }

  return {
    calendarEventId: event.id,
    meetLink,
    meetSpaceId,
    htmlLink: event.htmlLink || '',
    openAccess: Boolean(space?.meetLink),
    raw: event
  };
}

async function cancelMeetEvent(calendarEventId) {
  if (!calendarEventId) return { cancelled: false };
  const calendar = await getCalendarClient();
  try {
    await calendar.events.delete({
      calendarId: calendarId(),
      eventId: calendarEventId,
      sendUpdates: 'none'
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
  updateMeetEvent,
  createOpenMeetSpace,
  configureMeetSpaceOpen,
  isCalendarQuotaError,
  calendarQuotaMessage
};
