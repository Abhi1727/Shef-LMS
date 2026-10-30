const axios = require('axios');
const zoomConfig = require('../config/zoom');

class ZoomService {
  constructor() {
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  isConfigured() {
    return zoomConfig.isConfigured();
  }

  getStatus() {
    const enabled = zoomConfig.isEnabled();
    const configured = this.isConfigured();
    let hint = 'Zoom live classes are disabled on this server.';
    if (enabled && !configured) {
      hint = 'Add ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET to backend env.';
    } else if (configured) {
      hint = 'Server-to-Server OAuth ready. Set each trainer zoomUserId in Admin → Teachers.';
    } else if (!enabled) {
      hint = 'Set ZOOM_ENABLED=true in backend env (DEV only until tested).';
    }
    return {
      enabled,
      configured,
      defaultUserId: zoomConfig.defaultUserId(),
      hint,
      embedded: zoomConfig.isEmbeddedEnabled(),
      meetingSdk: {
        configured: zoomConfig.isMeetingSdkConfigured(),
        enabled: zoomConfig.isEmbeddedEnabled()
      }
    };
  }

  // Get OAuth access token
  async getAccessToken() {
    if (!this.isConfigured()) {
      const err = new Error('Zoom API is not configured');
      err.code = 'ZOOM_NOT_CONFIGURED';
      throw err;
    }

    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const authString = Buffer.from(
        `${zoomConfig.clientId}:${zoomConfig.clientSecret}`
      ).toString('base64');

      const response = await axios.post(
        `${zoomConfig.oauthUrl}?grant_type=account_credentials&account_id=${zoomConfig.accountId}`,
        {},
        {
          headers: {
            Authorization: `Basic ${authString}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + 50 * 60 * 1000;

      return this.accessToken;
    } catch (error) {
      console.error('Error getting Zoom access token:', error.response?.data || error.message);
      throw new Error('Failed to authenticate with Zoom API');
    }
  }

  userMeetingsPath(zoomUserId) {
    const id = String(zoomUserId || '').trim();
    if (!id) {
      const err = new Error('Zoom user id is required for this trainer');
      err.code = 'ZOOM_USER_REQUIRED';
      throw err;
    }
    return `${zoomConfig.apiBaseUrl}/users/${encodeURIComponent(id)}/meetings`;
  }

  static FIXED_ROOM_TOPIC = 'Sky States LMS — Personal room';

  fixedRoomSettings() {
    return {
      host_video: true,
      participant_video: true,
      join_before_host: true,
      mute_upon_entry: true,
      waiting_room: false,
      audio: 'both',
      auto_recording: 'cloud',
      approval_type: 2,
      allow_multiple_devices: true,
      who_can_share_screen: 'host',
      who_can_share_screen_when_someone_is_sharing: 'host',
      allow_participants_to_rename: false,
      private_meeting: false,
      // Enable in-meeting chat for everyone (honored when account allows chat).
      allow_participants_chat_with: 4
    };
  }

  meetingLinkPayload(meeting, meetingData = {}) {
    const meetingId = String(meeting.id || meeting.meetingId || '').trim();
    const password = meeting.password || '';
    let joinUrl = String(meeting.join_url || meeting.joinUrl || '').trim();
    if (!joinUrl && meetingId) {
      joinUrl = `https://zoom.us/j/${meetingId}`;
    }
    if (password && joinUrl && !joinUrl.includes('pwd=')) {
      joinUrl += `${joinUrl.includes('?') ? '&' : '?'}pwd=${encodeURIComponent(password)}`;
    }
    let startUrl = meeting.start_url || meeting.startUrl || '';
    if (!startUrl && meetingId) {
      startUrl = `https://zoom.us/s/${meetingId}`;
      if (password) {
        startUrl += `?pwd=${encodeURIComponent(password)}`;
      }
    }
    return {
      success: true,
      meeting: {
        id: meetingId,
        meetingId,
        topic: meeting.topic || meetingData.topic || 'Live Class',
        startTime: meetingData.startTime,
        duration: meeting.duration || meetingData.duration || 60,
        joinUrl,
        startUrl,
        password,
        timezone: meeting.timezone || meetingData.timezone || 'Asia/Kolkata',
        // meetingLinkPayload is only used for PMI / fixed recurring rooms (shared).
        isPMR: meeting.isPMR !== false
      }
    };
  }

  /** Stable type-3 recurring room when Zoom PMI is not enabled on the account user. */
  async listFixedMeetingRooms(zoomUserId) {
    const token = await this.getAccessToken();
    const response = await axios.get(
      `${this.userMeetingsPath(zoomUserId)}?type=scheduled&page_size=50`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return (response.data.meetings || []).filter((m) => Number(m.type) === 3);
  }

  async createFixedMeetingRoom(zoomUserId) {
    const token = await this.getAccessToken();
    const password = this.generatePassword();
    const response = await axios.post(
      this.userMeetingsPath(zoomUserId),
      {
        topic: ZoomService.FIXED_ROOM_TOPIC,
        type: 3,
        password,
        settings: this.fixedRoomSettings()
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data;
  }

  async ensureFixedMeetingRoom(zoomUserId) {
    const existing = await this.listFixedMeetingRooms(zoomUserId);
    const preferred =
      existing.find((m) => String(m.topic || '').startsWith('Sky States')) || existing[0];
    if (preferred?.id) {
      const token = await this.getAccessToken();
      const response = await axios.get(`${zoomConfig.apiBaseUrl}/meetings/${preferred.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    }
    return this.createFixedMeetingRoom(zoomUserId);
  }

  // Create a Zoom meeting for a specific licensed user in the account
  async createMeeting(meetingData) {
    try {
      const token = await this.getAccessToken();

      if (meetingData.usePMR) {
        try {
          return await this.getPMRLink(meetingData);
        } catch (pmrErr) {
          const msg = String(pmrErr.message || '');
          if (/pmi|personal meeting room/i.test(msg)) {
            console.warn(
              `[zoom] PMI not enabled for ${meetingData.zoomUserId} — using fixed recurring room`
            );
            const room = await this.ensureFixedMeetingRoom(meetingData.zoomUserId);
            return this.meetingLinkPayload(room, meetingData);
          }
          throw pmrErr;
        }
      }

      const instant = Boolean(meetingData.instant);
      const meetingConfig = {
        topic: meetingData.topic || 'Live Class',
        type: instant ? 1 : 2,
        duration: meetingData.duration || 60,
        timezone: meetingData.timezone || 'Asia/Kolkata',
        password: meetingData.password || this.generatePassword(),
        agenda: meetingData.agenda || '',
        settings: {
          host_video: true,
          participant_video: true,
          join_before_host: true,
          mute_upon_entry: true,
          waiting_room: false,
          audio: 'both',
          auto_recording: 'cloud',
          approval_type: 2,
          allow_multiple_devices: true,
          // Classroom defaults: host shares; students join muted
          who_can_share_screen: 'host',
          who_can_share_screen_when_someone_is_sharing: 'host',
          allow_participants_to_rename: false,
          private_meeting: false,
          allow_participants_chat_with: 4
        }
      };

      if (!instant && meetingData.startTime) {
        meetingConfig.start_time = new Date(meetingData.startTime).toISOString();
      }

      const response = await axios.post(this.userMeetingsPath(meetingData.zoomUserId), meetingConfig, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      return {
        success: true,
        meeting: {
          id: response.data.id,
          meetingId: response.data.id,
          topic: response.data.topic,
          startTime: response.data.start_time,
          duration: response.data.duration,
          joinUrl: response.data.join_url,
          startUrl: response.data.start_url,
          password: response.data.password,
          timezone: response.data.timezone
        }
      };
    } catch (error) {
      const detail = error.response?.data?.message || error.message;
      console.error('Error creating Zoom meeting:', error.response?.data || error.message);
      const err = new Error(detail || 'Failed to create Zoom meeting');
      err.code = error.code || 'ZOOM_CREATE_FAILED';
      throw err;
    }
  }

  async getPMRLink(meetingData) {
    try {
      const token = await this.getAccessToken();
      const zoomUserId = meetingData.zoomUserId;
      const userPath = zoomUserId
        ? `${zoomConfig.apiBaseUrl}/users/${encodeURIComponent(zoomUserId)}`
        : `${zoomConfig.apiBaseUrl}/users/me`;

      const response = await axios.get(userPath, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const pmrId = String(response.data.pmi || '').trim();
      if (!pmrId) {
        throw new Error('Trainer has no Personal Meeting Room (PMI) on Zoom');
      }

      const password = response.data.pmi_password || '';
      let joinUrl = String(response.data.personal_meeting_url || '').trim();
      if (!joinUrl) {
        joinUrl = `https://zoom.us/j/${pmrId}`;
      }
      if (password && !joinUrl.includes('pwd=')) {
        joinUrl += `${joinUrl.includes('?') ? '&' : '?'}pwd=${encodeURIComponent(password)}`;
      }

      let startUrl = `https://zoom.us/s/${pmrId}`;
      if (password) {
        startUrl += `?pwd=${encodeURIComponent(password)}`;
      }

      return this.meetingLinkPayload(
        {
          id: pmrId,
          password,
          join_url: joinUrl,
          start_url: startUrl,
          topic: meetingData.topic || 'Live Class',
          timezone: meetingData.timezone || 'Asia/Kolkata'
        },
        meetingData
      );
    } catch (error) {
      console.error('Error getting PMR link:', error.response?.data || error.message);
      throw new Error('Failed to get Personal Meeting Room link');
    }
  }

  /** Host start URL with ZAK so trainer always joins as host (PMI or scheduled). */
  async getHostStartUrl(zoomUserId, meetingId, { password = '' } = {}) {
    const id = String(meetingId || '').replace(/\s/g, '');
    if (!id) return '';
    let url = `https://zoom.us/s/${id}`;
    if (password) {
      url += `?pwd=${encodeURIComponent(password)}`;
    }
    try {
      const zak = await this.getZakToken(zoomUserId);
      if (zak) {
        url += `${url.includes('?') ? '&' : '?'}zak=${encodeURIComponent(zak)}`;
      }
    } catch (err) {
      console.warn('[zoomService] ZAK for host start URL failed:', err.message || err);
    }
    return url;
  }

  async getMeeting(meetingId) {
    try {
      const token = await this.getAccessToken();

      const response = await axios.get(`${zoomConfig.apiBaseUrl}/meetings/${meetingId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      return {
        success: true,
        meeting: {
          id: response.data.id,
          topic: response.data.topic,
          startTime: response.data.start_time,
          duration: response.data.duration,
          joinUrl: response.data.join_url,
          status: response.data.status
        }
      };
    } catch (error) {
      console.error('Error getting Zoom meeting:', error.response?.data || error.message);
      throw new Error('Failed to get Zoom meeting details');
    }
  }

  async updateMeeting(meetingId, updateData) {
    try {
      const token = await this.getAccessToken();

      await axios.patch(`${zoomConfig.apiBaseUrl}/meetings/${meetingId}`, updateData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      return { success: true, message: 'Meeting updated successfully' };
    } catch (error) {
      console.error('Error updating Zoom meeting:', error.response?.data || error.message);
      throw new Error('Failed to update Zoom meeting');
    }
  }

  async deleteMeeting(meetingId) {
    try {
      const token = await this.getAccessToken();

      await axios.delete(`${zoomConfig.apiBaseUrl}/meetings/${meetingId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      return { success: true, message: 'Meeting deleted successfully' };
    } catch (error) {
      if (error.response?.status === 404) {
        return { success: true, message: 'Meeting already deleted' };
      }
      console.error('Error deleting Zoom meeting:', error.response?.data || error.message);
      throw new Error('Failed to delete Zoom meeting');
    }
  }

  /**
   * End an in-progress Zoom meeting instance (host left / End class).
   * Does not delete the scheduled meeting object — safe for reconnect + unique rooms.
   * PMI: ends the current instance only.
   */
  async endMeeting(meetingId) {
    const id = String(meetingId || '').replace(/\s/g, '');
    if (!id) return { success: true, skipped: true };
    try {
      const token = await this.getAccessToken();
      await axios.put(
        `${zoomConfig.apiBaseUrl}/meetings/${encodeURIComponent(id)}/status`,
        { action: 'end' },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return { success: true };
    } catch (error) {
      const status = error.response?.status;
      const code = error.response?.data?.code;
      // Already ended / not started / missing
      if (status === 404 || status === 400 || code === 3001 || code === 3002) {
        return { success: true, alreadyEnded: true };
      }
      console.warn(
        '[zoomService] endMeeting failed:',
        error.response?.data || error.message
      );
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'end-failed'
      };
    }
  }

  /** Lightweight room state for join UX: waiting | started | ended | unknown */
  async getMeetingRoomStatus(meetingId) {
    const id = String(meetingId || '').replace(/\s/g, '');
    if (!id) return { status: 'unknown' };
    try {
      const token = await this.getAccessToken();
      const response = await axios.get(`${zoomConfig.apiBaseUrl}/meetings/${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const raw = String(response.data?.status || '').toLowerCase();
      if (raw === 'waiting' || raw === 'started') return { status: raw };
      return { status: raw || 'unknown' };
    } catch (error) {
      const status = error.response?.status;
      if (status === 404) return { status: 'ended' };
      return { status: 'unknown' };
    }
  }

  generatePassword() {
    return Math.random().toString(36).substring(2, 10);
  }

  async listMeetings(zoomUserId) {
    try {
      const token = await this.getAccessToken();
      const base = zoomUserId
        ? `${zoomConfig.apiBaseUrl}/users/${encodeURIComponent(zoomUserId)}/meetings`
        : `${zoomConfig.apiBaseUrl}/users/me/meetings`;

      const response = await axios.get(`${base}?type=upcoming`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      return {
        success: true,
        meetings: (response.data.meetings || []).map((m) => ({
          id: m.id,
          topic: m.topic,
          startTime: m.start_time,
          duration: m.duration,
          joinUrl: m.join_url
        }))
      };
    } catch (error) {
      console.error('Error listing Zoom meetings:', error.response?.data || error.message);
      throw new Error('Failed to list Zoom meetings');
    }
  }

  /** Meetings currently in progress for a Zoom user (includes active PMI sessions). */
  async listLiveMeetings(zoomUserId) {
    if (!zoomUserId) return { success: true, meetings: [] };
    try {
      const token = await this.getAccessToken();
      const base = `${zoomConfig.apiBaseUrl}/users/${encodeURIComponent(zoomUserId)}/meetings`;
      const response = await axios.get(`${base}?type=live`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return {
        success: true,
        meetings: (response.data.meetings || []).map((m) => ({
          id: String(m.id || ''),
          uuid: m.uuid || '',
          topic: m.topic || '',
          startTime: m.start_time || ''
        }))
      };
    } catch (error) {
      console.error('Error listing live Zoom meetings:', error.response?.data || error.message);
      return { success: false, meetings: [], error: error.message || 'zoom-live-list-failed' };
    }
  }

  async getRecordings(meetingId, { zoomUserId = '', from = '', to = '' } = {}) {
    if (zoomUserId && from && to) {
      return this.getRecordingsForMeeting(meetingId, { zoomUserId, from, to });
    }
    try {
      const token = await this.getAccessToken();

      const params = {};
      if (from) params.from = from;
      if (to) params.to = to;

      const response = await axios.get(`${zoomConfig.apiBaseUrl}/meetings/${meetingId}/recordings`, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });

      return {
        success: true,
        topic: response.data.topic || '',
        recordings:
          response.data.recording_files?.map((file) => ({
            id: file.id,
            meetingId: file.meeting_id,
            recordingStart: file.recording_start,
            recordingEnd: file.recording_end,
            fileType: file.file_type,
            fileSize: file.file_size,
            playUrl: file.play_url,
            downloadUrl: file.download_url,
            status: file.status,
            recordingType: file.recording_type
          })) || [],
        duration: response.data.duration,
        totalSize: response.data.total_size
      };
    } catch (error) {
      console.error('Error getting Zoom recordings:', error.response?.data || error.message);
      if (error.response?.status === 404) {
        return { success: true, recordings: [], message: 'No recordings found for this meeting' };
      }
      const err = new Error(
        error.response?.data?.message || error.message || 'Failed to get Zoom recordings'
      );
      err.code = error.response?.status === 401 ? 'ZOOM_RECORDING_AUTH' : 'ZOOM_RECORDING_FAILED';
      err.status = error.response?.status;
      throw err;
    }
  }

  /**
   * List all cloud recordings for a trainer in a date range (paginated).
   * Required for PMI rooms — /meetings/{id}/recordings only returns the latest instance.
   */
  async listUserRecordings(zoomUserId, from, to) {
    const userId = String(zoomUserId || '').trim();
    if (!userId || !from || !to) {
      return { success: true, meetings: [], recordings: [] };
    }

    const token = await this.getAccessToken();
    const meetings = [];
    let nextPageToken = '';

    do {
      const params = { from, to, page_size: 300, mc: 'false' };
      if (nextPageToken) params.next_page_token = nextPageToken;

      const response = await axios.get(
        `${zoomConfig.apiBaseUrl}/users/${encodeURIComponent(userId)}/recordings`,
        { headers: { Authorization: `Bearer ${token}` }, params }
      );

      meetings.push(...(response.data.meetings || []));
      nextPageToken = response.data.next_page_token || '';
    } while (nextPageToken);

    const recordings = [];
    for (const meeting of meetings) {
      const parentMeetingId = String(meeting.id || '');
      for (const file of meeting.recording_files || []) {
        recordings.push({
          id: file.id,
          meetingId: parentMeetingId,
          meetingUuid: file.meeting_id || meeting.uuid || '',
          recordingStart: file.recording_start,
          recordingEnd: file.recording_end,
          fileType: file.file_type,
          fileSize: file.file_size,
          playUrl: file.play_url,
          downloadUrl: file.download_url,
          status: file.status,
          recordingType: file.recording_type,
          topic: meeting.topic || ''
        });
      }
    }

    return { success: true, meetings, recordings };
  }

  async getRecordingsForMeeting(meetingId, { zoomUserId, from, to } = {}) {
    const pmi = String(meetingId || '').trim();
    if (!pmi) return { success: true, recordings: [] };

    if (zoomUserId && from && to) {
      const listed = await this.listUserRecordings(zoomUserId, from, to);
      const recordings = (listed.recordings || []).filter(
        (f) => String(f.meetingId || '') === pmi
      );
      return { success: true, recordings };
    }

    return this.getRecordings(pmi);
  }

  /** Account-wide recording list (used by legacy cron). */
  async listAllRecordings(from, to) {
    const defaultUser = zoomConfig.defaultUserId();
    const listed = await this.listUserRecordings(
      defaultUser,
      from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      to || new Date().toISOString().split('T')[0]
    );

    const meetings = (listed.meetings || []).map((meeting) => ({
      id: String(meeting.id || ''),
      uuid: meeting.uuid || '',
      topic: meeting.topic || '',
      startTime: meeting.start_time || '',
      duration: meeting.duration || 0,
      password: meeting.password || '',
      recordingFiles: (meeting.recording_files || []).map((file) => ({
        id: file.id,
        meetingId: file.meeting_id || meeting.id,
        recordingStart: file.recording_start,
        recordingEnd: file.recording_end,
        fileType: file.file_type,
        fileSize: file.file_size,
        playUrl: file.play_url,
        downloadUrl: file.download_url,
        status: file.status,
        recordingType: file.recording_type
      }))
    }));

    return { success: true, meetings };
  }

  /**
   * Download a Zoom cloud recording file to local disk (requires recording:read / cloud_recording scopes).
   */
  async downloadRecordingToFile(downloadUrl, destPath) {
    const fs = require('fs');
    const token = await this.getAccessToken();
    if (!downloadUrl) {
      throw new Error('Zoom recording download URL is missing');
    }

    const separator = String(downloadUrl).includes('?') ? '&' : '?';
    const url = `${downloadUrl}${separator}access_token=${encodeURIComponent(token)}`;

    const response = await axios.get(url, {
      responseType: 'stream',
      maxRedirects: 5,
      timeout: 30 * 60 * 1000,
      validateStatus: (s) => s >= 200 && s < 400
    });

    await new Promise((resolve, reject) => {
      const out = fs.createWriteStream(destPath);
      response.data.pipe(out);
      out.on('finish', resolve);
      out.on('error', reject);
      response.data.on('error', reject);
    });

    const stat = fs.statSync(destPath);
    if (!stat.size) {
      throw new Error('Downloaded Zoom recording is empty');
    }
    return { path: destPath, size: stat.size };
  }

  /**
   * Host ZAK token — required for Meeting SDK role=1 to start/host the meeting in-app.
   */
  async getZakToken(zoomUserId) {
    const token = await this.getAccessToken();
    // Never fall back to another account: a missing trainer id must not yield someone else's host token.
    const userId = String(zoomUserId || '').trim();
    if (!userId) {
      const err = new Error('Zoom user id required for host ZAK token');
      err.code = 'ZOOM_USER_REQUIRED';
      throw err;
    }
    try {
      const response = await axios.get(
        `${zoomConfig.apiBaseUrl}/users/${encodeURIComponent(userId)}/token`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: { type: 'zak' }
        }
      );
      const zak = response.data?.token || '';
      if (!zak) {
        throw new Error('Zoom did not return a ZAK token');
      }
      return zak;
    } catch (error) {
      console.error('Error getting Zoom ZAK:', error.response?.data || error.message);
      const err = new Error(
        error.response?.data?.message || error.message || 'Failed to get Zoom host token'
      );
      err.code = 'ZOOM_ZAK_FAILED';
      throw err;
    }
  }
}

module.exports = new ZoomService();
