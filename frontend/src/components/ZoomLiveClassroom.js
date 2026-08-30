import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { getApiBaseUrl } from '../utils/apiBase';
import { consumeLiveJoinPayload } from '../utils/liveClassSessionCache';
import { openZoomWorkspace } from '../utils/openZoomWorkspace';
import '@zoom/meetingsdk/dist/css/bootstrap.css';
import '@zoom/meetingsdk/dist/css/react-select.css';
import './ZoomLiveClassroom.css';

function formatZoomError(err) {
  if (!err) return 'Failed to join classroom';
  if (typeof err === 'string') return err;
  if (err.reason) return String(err.reason);
  if (err.errorMessage) return String(err.errorMessage);
  if (err.message) return String(err.message);
  if (err.errorCode != null && err.errorMessage) {
    return `${err.errorMessage} (${err.errorCode})`;
  }
  try {
    return JSON.stringify(err);
  } catch (_) {
    return 'Failed to join classroom';
  }
}

function homePathForRole(role) {
  if (role === 'teacher') return '/teacher';
  if (role === 'admin') return '/admin';
  return '/dashboard';
}

function ensureZoomDomRoots() {
  if (!document.getElementById('zmmtg-root')) {
    const root = document.createElement('div');
    root.id = 'zmmtg-root';
    document.body.prepend(root);
  }
  if (!document.getElementById('aria-notify-area')) {
    const aria = document.createElement('div');
    aria.id = 'aria-notify-area';
    document.body.appendChild(aria);
  }
}

async function leaveEmbeddedZoom() {
  try {
    const { ZoomMtg } = await import('@zoom/meetingsdk');
    await new Promise((resolve) => {
      try {
        // leaveMeeting may navigate to leaveUrl — callers must open Zoom app BEFORE this.
        ZoomMtg.leaveMeeting({
          success: () => resolve(),
          error: () => resolve()
        });
      } catch (_) {
        resolve();
      }
      window.setTimeout(resolve, 800);
    });
  } catch (_) {
    /* ignore */
  }
  try {
    const root = document.getElementById('zmmtg-root');
    if (root) root.innerHTML = '';
  } catch (_) {
    /* ignore */
  }
}

/**
 * In-LMS Zoom classroom using Meeting SDK Client View.
 * Floating control lets trainers/students switch to Zoom Workspace (remote control, etc.).
 */
export default function ZoomLiveClassroom({ user }) {
  const { meetingId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const bootGenRef = useRef(0);
  const joinedRef = useRef(false);
  const sdkMetaRef = useRef({ meetingNumber: '', password: '' });
  const [phase, setPhase] = useState('loading');
  const [status, setStatus] = useState('Preparing classroom…');
  const [error, setError] = useState('');
  const [title, setTitle] = useState('Live class');
  const [trainerName, setTrainerName] = useState('');
  const [fallbackUrl, setFallbackUrl] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [markedPresent, setMarkedPresent] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [switchNote, setSwitchNote] = useState('');
  const asHost = searchParams.get('host') === '1';
  const isStudent = user?.role === 'student';

  const goBack = useCallback(() => {
    document.body.classList.remove('zoom-client-active');
    navigate(homePathForRole(user?.role));
  }, [navigate, user?.role]);

  const switchToZoomApp = useCallback(async () => {
    if (!fallbackUrl || switching) return;
    setSwitching(true);
    setSwitchNote('Opening Zoom Workspace…');
    try {
      // CRITICAL: open the desktop app BEFORE leaveMeeting — Zoom's leaveUrl
      // full-page redirect would otherwise cancel the protocol launch.
      const opened = openZoomWorkspace(fallbackUrl, {
        userName: user?.name || '',
        meetingNumber: sdkMetaRef.current.meetingNumber,
        password: sdkMetaRef.current.password,
        httpsFallback: fallbackUrl,
        // Host start URLs are already https (zak); don't open a second tab.
        openHttpsFallback: !/[?&]zak=/i.test(fallbackUrl) && !/\/s\//i.test(fallbackUrl)
      });
      if (!opened.opened) {
        throw new Error('No Zoom join link available for this class.');
      }
      setSwitchNote(
        isHost
          ? 'Zoom Workspace launch sent. Allow the browser prompt if shown, then use remote control from the desktop Share menu.'
          : 'Zoom Workspace launch sent. Allow the browser prompt if shown.'
      );

      // Give the OS a moment to hand off to Zoom.app before tearing down the web client.
      await new Promise((r) => window.setTimeout(r, 600));

      if (joinedRef.current) {
        await leaveEmbeddedZoom();
        joinedRef.current = false;
      }
      document.body.classList.remove('zoom-client-active');
      // leaveMeeting often already redirected via leaveUrl; navigate as backup.
      window.setTimeout(() => {
        try {
          navigate(homePathForRole(user?.role));
        } catch (_) {
          /* ignore */
        }
      }, 400);
    } catch (err) {
      console.error('[ZoomLiveClassroom] switch to workspace', err);
      setSwitchNote(err.message || 'Could not open Zoom Workspace. Install Zoom and try again.');
      setSwitching(false);
    }
  }, [fallbackUrl, switching, user?.name, user?.role, isHost, navigate]);

  useEffect(() => {
    const bootGen = ++bootGenRef.current;
    let cancelled = false;

    async function fetchJoinPayload() {
      const cached = consumeLiveJoinPayload(meetingId);
      if (cached?.sdk?.signature) return cached;

      const token = localStorage.getItem('token');
      const apiUrl = getApiBaseUrl();
      const res = await fetch(`${apiUrl}/api/meetings/${meetingId}/join`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ host: asHost })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to join class');
      return data;
    }

    async function boot() {
      setPhase('loading');
      setError('');
      setStatus('Preparing classroom…');
      joinedRef.current = false;
      document.body.classList.add('zoom-client-active');

      try {
        const data = await fetchJoinPayload();
        if (cancelled || bootGen !== bootGenRef.current) return;

        if (data.meeting?.title) setTitle(data.meeting.title);
        if (data.meeting?.teacherName) setTrainerName(data.meeting.teacherName);
        if (data.markedPresent) setMarkedPresent(true);
        const appUrl = data.joinUrl || data.meetLink || data.startUrl || '';
        setFallbackUrl(appUrl);
        sdkMetaRef.current = {
          meetingNumber: String(data.sdk?.meetingNumber || '').replace(/\s/g, ''),
          password: data.sdk?.password || ''
        };

        if (!data.embedded || !data.sdk?.signature) {
          setError(data.sdkError || 'Embedded Zoom is not available for this class yet.');
          setPhase('error');
          setStatus('');
          return;
        }

        const hostSession = Number(data.sdk.role) === 1 && Boolean(data.sdk.zak);
        setIsHost(hostSession);

        setStatus(
          data.markedPresent
            ? 'Attendance recorded. Connecting…'
            : hostSession
              ? 'Starting as host…'
              : 'Connecting to class…'
        );

        ensureZoomDomRoots();

        const { ZoomMtg } = await import('@zoom/meetingsdk');
        if (cancelled || bootGen !== bootGenRef.current) return;

        ZoomMtg.setZoomJSLib('https://source.zoom.us/3.13.2/lib', '/av');
        ZoomMtg.preLoadWasm();
        ZoomMtg.prepareWebSDK();

        const leaveUrl = `${window.location.origin}${homePathForRole(user?.role)}`;

        await new Promise((resolve, reject) => {
          ZoomMtg.init({
            leaveUrl,
            patchJsMedia: true,
            isSupportAV: true,
            isSupportChat: true,
            isLockBottom: true,
            showMeetingHeader: true,
            disableInvite: false,
            disableRecord: false,
            screenShare: true,
            success: () => resolve(),
            error: (err) => reject(err || new Error('Zoom init failed'))
          });
        });

        if (cancelled || bootGen !== bootGenRef.current) return;

        const joinPayload = {
          sdkKey: data.sdk.sdkKey,
          signature: data.sdk.signature,
          meetingNumber: String(data.sdk.meetingNumber || '').replace(/\s/g, ''),
          passWord: data.sdk.password || '',
          userName: data.sdk.userName || user?.name || 'Participant',
          userEmail: data.sdk.userEmail || user?.email || ''
        };
        if (data.sdk.zak) joinPayload.zak = data.sdk.zak;

        await new Promise((resolve, reject) => {
          ZoomMtg.join({
            ...joinPayload,
            success: () => resolve(),
            error: (err) => reject(err || new Error('Zoom join failed'))
          });
        });

        if (cancelled || bootGen !== bootGenRef.current) return;
        joinedRef.current = true;
        setPhase('joined');
        setStatus('');
      } catch (err) {
        console.error('[ZoomLiveClassroom]', err);
        if (!cancelled && bootGen === bootGenRef.current) {
          setError(formatZoomError(err));
          setPhase('error');
          setStatus('');
          document.body.classList.remove('zoom-client-active');
        }
      }
    }

    boot();

    return () => {
      cancelled = true;
      document.body.classList.remove('zoom-client-active');
      if (!joinedRef.current) {
        try {
          const root = document.getElementById('zmmtg-root');
          if (root) root.innerHTML = '';
        } catch (_) {
          /* ignore */
        }
      }
    };
  }, [meetingId, asHost, user?.name, user?.email, user?.role]);

  const roleLabel = isHost ? 'Host' : isStudent ? 'Student' : 'Participant';

  const workspaceSwitcher =
    fallbackUrl && typeof document !== 'undefined'
      ? createPortal(
          <div className="zoom-workspace-switch" role="region" aria-label="Zoom Workspace">
            <div className="zoom-workspace-switch__copy">
              <strong>Need remote control?</strong>
              <span>
                {isHost
                  ? 'Open Zoom Workspace for remote screen control. Recording Pause/Resume stays under More → Record in either view.'
                  : 'Switch to Zoom Workspace if your trainer needs remote screen control.'}
              </span>
            </div>
            <button
              type="button"
              className="zoom-workspace-switch__btn"
              disabled={switching || !fallbackUrl}
              onClick={switchToZoomApp}
            >
              {switching ? 'Opening…' : 'Open in Zoom app'}
            </button>
            {switchNote ? <p className="zoom-workspace-switch__note">{switchNote}</p> : null}
          </div>,
          document.body
        )
      : null;

  // Client View owns the page after join — keep only the workspace switcher overlay.
  if (phase === 'joined') {
    return workspaceSwitcher;
  }

  return (
    <>
      <div className={`zoom-live zoom-live--${phase}${isHost ? ' is-host' : ' is-participant'}`}>
        <header className="zoom-live__bar">
          <div className="zoom-live__brand">
            <div className="zoom-live__brand-text">
              <span className="zoom-live__logo">Sky States</span>
              <span className="zoom-live__product">Classroom</span>
            </div>
            <span className="zoom-live__sep" aria-hidden="true" />
            <div className="zoom-live__meta">
              <strong className="zoom-live__title">{title}</strong>
              {trainerName ? (
                <span className="zoom-live__trainer">Trainer · {trainerName}</span>
              ) : null}
              <div className="zoom-live__chips">
                <span className={`zoom-live__chip zoom-live__chip--role${isHost ? ' is-host' : ''}`}>
                  {roleLabel}
                </span>
                <span className="zoom-live__chip zoom-live__chip--zoom">Zoom</span>
                {markedPresent && isStudent ? (
                  <span className="zoom-live__chip zoom-live__chip--present">Present</span>
                ) : null}
              </div>
            </div>
          </div>
          <div className="zoom-live__bar-actions">
            {fallbackUrl ? (
              <button
                type="button"
                className="zoom-live__workspace"
                disabled={switching}
                onClick={switchToZoomApp}
              >
                {switching ? 'Opening…' : 'Open in Zoom app'}
              </button>
            ) : null}
            <button type="button" className="zoom-live__leave" onClick={goBack}>
              Cancel
            </button>
          </div>
        </header>

        {phase === 'loading' && status ? (
          <div className="zoom-live__banner" role="status">
            <span className="zoom-live__spinner" aria-hidden="true" />
            <p>{status}</p>
          </div>
        ) : null}

        {phase === 'error' && error ? (
          <div className="zoom-live__error" role="alert">
            <h2>Couldn’t open classroom</h2>
            <p>{error}</p>
            <div className="zoom-live__error-actions">
              <button type="button" className="zoom-live__leave" onClick={goBack}>
                Back to LMS
              </button>
              {fallbackUrl ? (
                <button
                  type="button"
                  className="zoom-live__fallback"
                  disabled={switching}
                  onClick={switchToZoomApp}
                >
                  Open in Zoom app
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {phase === 'loading' ? (
          <div className="zoom-live__stage">
            <div className="zoom-live__placeholder">
              <p className="zoom-live__loading-brand">Sky States Classroom</p>
              <h1>{title}</h1>
            <p className="zoom-live__loading-sub">
              Loading full Zoom classroom — mic, camera, share, chat, and cloud recording. As host,
              use <strong>More → Record</strong> for Pause / Resume / Stop.
            </p>
              <div className="zoom-live__loading-bar" />
            </div>
          </div>
        ) : null}
      </div>
      {phase === 'loading' || phase === 'error' ? workspaceSwitcher : null}
    </>
  );
}
