/**
 * Build join URL for Google Meet or Zoom live classes.
 */
import { meetJoinUrl } from './meetJoinUrl';

export function liveJoinUrl(meetingOrLink, { host = false } = {}) {
  if (!meetingOrLink) return '';

  if (typeof meetingOrLink === 'object') {
    const m = meetingOrLink;
    const provider = m.conferenceProvider || (m.zoomMeetingId && !m.meetLink ? 'zoom' : 'meet');
    if (provider === 'zoom') {
      let url = host ? m.zoomStartUrl || m.zoomLink || m.joinLink || '' : m.zoomLink || m.joinLink || '';
      if (url && m.zoomPassword && !String(url).includes('pwd=')) {
        url += `${String(url).includes('?') ? '&' : '?'}pwd=${encodeURIComponent(m.zoomPassword)}`;
      }
      return url;
    }
    return meetJoinUrl(m.meetLink || m.joinLink || m.zoomLink, { host });
  }

  return meetJoinUrl(meetingOrLink, { host });
}

export function livePlatformLabel(meeting) {
  if (!meeting) return 'Live class';
  if (typeof meeting === 'string') {
    return meeting === 'zoom' ? 'Zoom' : 'Google Meet';
  }
  return meeting.conferenceProvider === 'zoom' ? 'Zoom' : 'Google Meet';
}

export function trainerLivePlatform(provider) {
  return provider === 'zoom' ? 'Zoom' : 'Google Meet';
}
