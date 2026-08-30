import { stashLiveJoinPayload } from './liveClassSessionCache';
import { openZoomWorkspace } from './openZoomWorkspace';

const WORKSPACE_TRY_MS = 1800;

/**
 * Open Zoom from LMS.
 * - Trainers (host): Zoom Workspace by default (ZAK start URL = always host).
 * - Students: try Workspace deep-link, then embedded classroom or web join in the same tab.
 */
export function openLiveClassSession({
  meetingId,
  joinUrl,
  embedded,
  conferenceProvider,
  host = false,
  joinPayload = null,
  preferWorkspace = undefined,
  userName = ''
}) {
  const isZoom = conferenceProvider === 'zoom';

  if (!isZoom) {
    if (joinUrl) window.open(joinUrl, '_blank', 'noopener,noreferrer');
    return { mode: 'external' };
  }

  const sdkMeetingNumber = joinPayload?.sdk?.meetingNumber || '';
  const sdkPassword = joinPayload?.sdk?.password || '';
  const workspaceOpts = {
    userName,
    meetingNumber: sdkMeetingNumber,
    password: sdkPassword,
    httpsFallback: joinUrl,
    openHttpsFallback: false
  };

  // Trainers: Zoom Workspace first (remote control, full host features).
  const wantWorkspace = preferWorkspace !== undefined ? preferWorkspace : host;

  if (wantWorkspace && joinUrl) {
    openZoomWorkspace(joinUrl, workspaceOpts);
    return { mode: 'workspace' };
  }

  // Students: Workspace if installed, otherwise same-tab embedded or web join.
  if (!host && joinUrl) {
    openZoomWorkspace(joinUrl, workspaceOpts);

    const openEmbeddedSameTab = () => {
      if (!embedded || !meetingId) return false;
      if (joinPayload) stashLiveJoinPayload(meetingId, joinPayload);
      window.location.assign(`/live/${encodeURIComponent(meetingId)}`);
      return true;
    };

    window.setTimeout(() => {
      if (document.visibilityState !== 'visible') return;
      if (openEmbeddedSameTab()) return;
      window.location.assign(joinUrl);
    }, WORKSPACE_TRY_MS);

    return { mode: embedded && meetingId ? 'workspace-or-embedded' : 'workspace-or-web' };
  }

  if (embedded && meetingId) {
    if (joinPayload) stashLiveJoinPayload(meetingId, joinPayload);
    const qs = host ? '?host=1' : '';
    window.location.assign(`/live/${encodeURIComponent(meetingId)}${qs}`);
    return { mode: 'embedded' };
  }

  if (joinUrl) {
    window.location.assign(joinUrl);
    return { mode: 'web-same-tab' };
  }

  return { mode: 'none' };
}

export default openLiveClassSession;
