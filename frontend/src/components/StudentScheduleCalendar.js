import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getApiBaseUrl } from '../utils/apiBase';
import './MeetLiveClasses.css';

function startOfWeek(d) {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() + diff);
  return x;
}

function startOfMonth(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), 1);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatDayLabel(d) {
  return d.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  });
}

function formatTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata'
  });
}

function toGCalStamp(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

/** Google Calendar “create event” template URL for a live class */
export function googleCalendarUrl(ev) {
  if (!ev?.start) return '';
  const start = toGCalStamp(ev.start);
  const end = toGCalStamp(
    ev.end || new Date(new Date(ev.start).getTime() + 60 * 60 * 1000).toISOString()
  );
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: ev.title || 'Live class',
    dates: `${start}/${end}`,
    details: [
      ev.description || '',
      ev.batchName ? `Batch: ${ev.batchName}` : '',
      ev.teacherName ? `Trainer: ${ev.teacherName}` : '',
      'Join from Sky States LMS so attendance is recorded.'
    ]
      .filter(Boolean)
      .join('\n'),
    location: 'Google Meet (via Sky States LMS)',
    ctz: 'Asia/Kolkata'
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function parseCohortDays(schedule) {
  if (!schedule) return [];
  const raw = schedule.days || schedule.day || '';
  if (Array.isArray(raw)) return raw.map(String);
  return String(raw)
    .split(/[,/|&]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function dayMatchesCohort(date, cohortDays) {
  if (!cohortDays.length) return false;
  const names = [
    'sun',
    'sunday',
    'mon',
    'monday',
    'tue',
    'tues',
    'tuesday',
    'wed',
    'wednesday',
    'thu',
    'thur',
    'thurs',
    'thursday',
    'fri',
    'friday',
    'sat',
    'saturday'
  ];
  const weekday = date
    .toLocaleDateString('en-US', { weekday: 'short', timeZone: 'Asia/Kolkata' })
    .toLowerCase()
    .slice(0, 3);
  return cohortDays.some((d) => {
    const x = String(d).toLowerCase().replace(/\./g, '');
    if (x.startsWith(weekday)) return true;
    return names.some((n) => n.startsWith(x) && n.startsWith(weekday));
  });
}

export default function StudentScheduleCalendar({
  compact = false,
  onPlayRecording,
  classroomVideos = [],
  hideHero = false
}) {
  const [events, setEvents] = useState([]);
  const [cohort, setCohort] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [joinNote, setJoinNote] = useState('');
  const [joiningId, setJoiningId] = useState('');
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()));
  const [view, setView] = useState('week'); // week | month

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const apiUrl = getApiBaseUrl();
      const res = await fetch(`${apiUrl}/api/student/schedule`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to load schedule');
      setEvents(Array.isArray(data.events) ? data.events : []);
      setCohort(Array.isArray(data.cohort) ? data.cohort : []);
    } catch (err) {
      setError(err.message || 'Failed to load schedule');
      setEvents([]);
      setCohort([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const cohortDays = useMemo(() => {
    const days = [];
    cohort.forEach((c) => days.push(...parseCohortDays(c.schedule)));
    return [...new Set(days)];
  }, [cohort]);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const monthCells = useMemo(() => {
    const first = startOfMonth(monthCursor);
    const gridStart = startOfWeek(first);
    return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  }, [monthCursor]);

  const eventsByDay = useMemo(() => {
    const map = {};
    events.forEach((ev) => {
      if (!ev.start) return;
      const d = new Date(ev.start);
      const key = d.toDateString();
      if (!map[key]) map[key] = [];
      map[key].push(ev);
    });
    Object.values(map).forEach((list) =>
      list.sort((a, b) => new Date(a.start) - new Date(b.start))
    );
    return map;
  }, [events]);

  const handleJoin = async (meetingId) => {
    setJoiningId(meetingId);
    setJoinNote('');
    setError('');
    try {
      const token = localStorage.getItem('token');
      const apiUrl = getApiBaseUrl();
      const res = await fetch(`${apiUrl}/api/meetings/${meetingId}/join`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to join');
      const link = data.meetLink || data.joinUrl;
      if (!link) throw new Error('Meet link unavailable');
      setJoinNote(
        data.markedPresent
          ? 'You’re marked present. Opening Google Meet…'
          : 'Opening Google Meet…'
      );
      window.open(link, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(err.message || 'Join failed');
    } finally {
      setJoiningId('');
    }
  };

  const playRecording = (ev) => {
    if (typeof onPlayRecording === 'function') {
      const fromClassroom = classroomVideos.find((v) => String(v.id) === String(ev.lectureId));
      onPlayRecording(
        fromClassroom || {
          id: ev.lectureId,
          title: ev.title,
          videoSource: ev.videoSource,
          driveId: ev.driveId,
          youtubeVideoUrl: ev.youtubeVideoUrl,
          youtubeVideoId: ev.youtubeVideoId,
          youtubeEmbedUrl: ev.youtubeEmbedUrl,
          duration: ev.duration,
          instructor: ev.instructor
        }
      );
      return;
    }
    if (ev.driveId) {
      window.open(`https://drive.google.com/file/d/${ev.driveId}/view`, '_blank', 'noopener,noreferrer');
    } else if (ev.youtubeVideoUrl) {
      window.open(ev.youtubeVideoUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const upcoming = events
    .filter((e) => e.type === 'live' && e.start && new Date(e.start).getTime() >= Date.now() - 2 * 3600e3)
    .slice(0, 6);

  const renderEventActions = (ev) => (
    <div className="live-session__cta">
      {ev.type === 'live' && ev.meetingId && (
        <button
          type="button"
          className="live-lobby__btn live-lobby__btn--primary live-lobby__btn--sm"
          disabled={joiningId === ev.meetingId}
          onClick={() => handleJoin(ev.meetingId)}
        >
          {joiningId === ev.meetingId ? 'Joining…' : 'Join'}
        </button>
      )}
      {ev.type === 'live' && ev.start && (
        <a
          className="live-lobby__btn live-lobby__btn--ghost live-lobby__btn--sm"
          href={googleCalendarUrl(ev)}
          target="_blank"
          rel="noopener noreferrer"
        >
          Google Calendar
        </a>
      )}
      {(ev.type === 'recording' || (ev.type === 'live_past' && ev.classroomLectureId)) &&
        (ev.lectureId || ev.classroomLectureId) && (
          <button
            type="button"
            className="live-lobby__btn live-lobby__btn--ghost live-lobby__btn--sm"
            onClick={() =>
              playRecording({
                ...ev,
                lectureId: ev.lectureId || ev.classroomLectureId
              })
            }
          >
            Watch
          </button>
        )}
    </div>
  );

  return (
    <div
      className={`live-lobby live-lobby--student live-cal ${compact ? 'live-lobby--compact' : ''}`}
    >
      {!hideHero && !compact && (
        <div className="live-lobby__hero">
          <p className="live-lobby__eyebrow">Sky States · Cohort calendar</p>
          <h2>Class schedule</h2>
          <p>
            Track live cohort sessions by day. Add them to Google Calendar, and join from LMS so
            attendance is recorded.
          </p>
        </div>
      )}

      {cohort.length > 0 && (
        <div className="live-cal-cohort">
          {cohort.map((c) => (
            <div key={c.batchId} className="live-cal-cohort__chip">
              <strong>{c.batchName || 'Batch'}</strong>
              <span>
                {(c.schedule?.days || 'Schedule TBA') +
                  (c.schedule?.time ? ` · ${c.schedule.time}` : '')}
              </span>
            </div>
          ))}
        </div>
      )}

      <section className="live-lobby__card">
        <div className="live-lobby__card-head">
          <h3>{view === 'week' ? 'This week' : 'Month'}</h3>
          <div className="live-session__cta">
            <div className="live-lobby__chip-row">
              <button
                type="button"
                className={`live-lobby__chip${view === 'week' ? ' is-active' : ''}`}
                onClick={() => setView('week')}
              >
                Week
              </button>
              <button
                type="button"
                className={`live-lobby__chip${view === 'month' ? ' is-active' : ''}`}
                onClick={() => setView('month')}
              >
                Month
              </button>
            </div>
            {view === 'week' ? (
              <>
                <button
                  type="button"
                  className="live-lobby__btn live-lobby__btn--ghost live-lobby__btn--sm"
                  onClick={() => setWeekStart((w) => addDays(w, -7))}
                >
                  Prev
                </button>
                <button
                  type="button"
                  className="live-lobby__btn live-lobby__btn--ghost live-lobby__btn--sm"
                  onClick={() => setWeekStart(startOfWeek(new Date()))}
                >
                  Today
                </button>
                <button
                  type="button"
                  className="live-lobby__btn live-lobby__btn--ghost live-lobby__btn--sm"
                  onClick={() => setWeekStart((w) => addDays(w, 7))}
                >
                  Next
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="live-lobby__btn live-lobby__btn--ghost live-lobby__btn--sm"
                  onClick={() =>
                    setMonthCursor((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))
                  }
                >
                  Prev
                </button>
                <button
                  type="button"
                  className="live-lobby__btn live-lobby__btn--ghost live-lobby__btn--sm"
                  onClick={() => setMonthCursor(startOfMonth(new Date()))}
                >
                  Today
                </button>
                <button
                  type="button"
                  className="live-lobby__btn live-lobby__btn--ghost live-lobby__btn--sm"
                  onClick={() =>
                    setMonthCursor((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))
                  }
                >
                  Next
                </button>
              </>
            )}
            <button
              type="button"
              className="live-lobby__btn live-lobby__btn--ghost live-lobby__btn--sm"
              onClick={load}
            >
              Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <p className="live-lobby--empty">Loading schedule…</p>
        ) : error ? (
          <p className="live-lobby__alert live-lobby__alert--err">{error}</p>
        ) : view === 'week' ? (
          <div className="live-cal-week">
            {weekDays.map((day) => {
              const list = eventsByDay[day.toDateString()] || [];
              const isToday = sameDay(day, new Date());
              const isCohortDay = dayMatchesCohort(day, cohortDays);
              return (
                <div
                  key={day.toISOString()}
                  className={`live-cal-day ${isToday ? 'live-cal-day--today' : ''} ${
                    isCohortDay ? 'live-cal-day--cohort' : ''
                  }`}
                >
                  <div className="live-cal-day__label">
                    {formatDayLabel(day)}
                    {isCohortDay ? <span className="live-cal-day__cohort-tag">Cohort</span> : null}
                  </div>
                  {list.length === 0 ? (
                    <p className="live-lobby__muted live-cal-day__empty">
                      {isCohortDay ? 'Usual class day' : 'No sessions'}
                    </p>
                  ) : (
                    <ul className="live-cal-day__list">
                      {list.map((ev) => (
                        <li key={ev.id} className={`live-cal-item live-cal-item--${ev.type}`}>
                          <div className="live-cal-item__time">{formatTime(ev.start)}</div>
                          <div className="live-cal-item__title">{ev.title}</div>
                          <div className="live-cal-item__meta">
                            {ev.type === 'live' || ev.type === 'live_past'
                              ? 'Live class'
                              : ev.videoSource === 'drive'
                                ? 'Drive recording'
                                : 'Recording'}
                            {ev.batchName ? ` · ${ev.batchName}` : ''}
                          </div>
                          {renderEventActions(ev)}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="live-cal-month">
            <p className="live-cal-month__title">
              {monthCursor.toLocaleDateString('en-IN', {
                month: 'long',
                year: 'numeric',
                timeZone: 'Asia/Kolkata'
              })}
            </p>
            <div className="live-cal-month__dow">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div className="live-cal-month__grid">
              {monthCells.map((day) => {
                const list = eventsByDay[day.toDateString()] || [];
                const inMonth = day.getMonth() === monthCursor.getMonth();
                const isToday = sameDay(day, new Date());
                const isCohortDay = dayMatchesCohort(day, cohortDays);
                return (
                  <div
                    key={day.toISOString()}
                    className={`live-cal-month__cell ${inMonth ? '' : 'is-muted'} ${
                      isToday ? 'is-today' : ''
                    } ${isCohortDay ? 'is-cohort' : ''}`}
                  >
                    <span className="live-cal-month__date">{day.getDate()}</span>
                    {list.slice(0, 2).map((ev) => (
                      <button
                        key={ev.id}
                        type="button"
                        className={`live-cal-month__dot live-cal-month__dot--${ev.type}`}
                        title={ev.title}
                        onClick={() => {
                          if (ev.type === 'live' && ev.meetingId) handleJoin(ev.meetingId);
                          else if (ev.lectureId || ev.classroomLectureId) {
                            playRecording({
                              ...ev,
                              lectureId: ev.lectureId || ev.classroomLectureId
                            });
                          }
                        }}
                      >
                        {formatTime(ev.start) || '•'} {ev.title}
                      </button>
                    ))}
                    {list.length > 2 && (
                      <span className="live-lobby__muted">+{list.length - 2} more</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {joinNote && <p className="live-lobby__alert live-lobby__alert--ok">{joinNote}</p>}
      </section>

      {upcoming.length > 0 && (
        <section className="live-lobby__card" style={{ marginTop: '1rem' }}>
          <h3>Coming up</h3>
          <ul className="live-lobby__list">
            {upcoming.map((ev) => (
              <li key={`up-${ev.id}`} className="live-session">
                <div className="live-session__top">
                  <div>
                    <h4 className="live-session__title">{ev.title}</h4>
                    <p className="live-session__meta">
                      {ev.start
                        ? new Date(ev.start).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
                        : ''}
                      {ev.teacherName ? ` · ${ev.teacherName}` : ''}
                      {ev.batchName ? ` · ${ev.batchName}` : ''}
                    </p>
                  </div>
                  <span className="live-session__badge live-session__badge--soon">Live</span>
                </div>
                {renderEventActions(ev)}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
