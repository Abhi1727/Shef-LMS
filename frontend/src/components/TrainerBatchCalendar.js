import React, { useMemo, useState } from 'react';

const IST = 'Asia/Kolkata';

function monthLabel(d) {
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: IST });
}

function ymd(d) {
  return d.toLocaleDateString('en-CA', { timeZone: IST });
}

/** Compact month calendar for trainer batch — schedule chip + live sessions. */
export default function TrainerBatchCalendar({ meetings = [], schedule = null, batchName = '' }) {
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return new Date(Date.UTC(n.getFullYear(), n.getMonth(), 1));
  });

  const { weeks, monthTitle } = useMemo(() => {
    const y = cursor.getUTCFullYear();
    const m = cursor.getUTCMonth();
    const first = new Date(Date.UTC(y, m, 1));
    const last = new Date(Date.UTC(y, m + 1, 0));
    const startPad = first.getUTCDay();
    const daysInMonth = last.getUTCDate();
    const cells = [];
    for (let i = 0; i < startPad; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(new Date(Date.UTC(y, m, d)));
    }
    while (cells.length % 7 !== 0) cells.push(null);
    const weeks = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return { weeks, monthTitle: monthLabel(first) };
  }, [cursor]);

  const eventsByDay = useMemo(() => {
    const map = new Map();
    (meetings || []).forEach((mt) => {
      const key = mt.scheduledDate || (mt.scheduledStart ? ymd(new Date(mt.scheduledStart)) : '');
      if (!key) return;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(mt);
    });
    return map;
  }, [meetings]);

  const todayKey = ymd(new Date());
  const scheduleLabel =
    schedule?.days && schedule?.time
      ? `${schedule.days} · ${schedule.time} IST`
      : schedule?.time || schedule?.days || '';

  const shiftMonth = (delta) => {
    setCursor((c) => new Date(Date.UTC(c.getUTCFullYear(), c.getUTCMonth() + delta, 1)));
  };

  return (
    <section className="trainer-batch-cal">
      <div className="trainer-batch-cal__head">
        <div>
          <p className="live-studio-section-num">6. Calendar</p>
          <h3>{monthTitle}</h3>
          {batchName ? <p className="trainer-batch-cal__sub">{batchName}</p> : null}
        </div>
        <div className="trainer-batch-cal__nav">
          <button type="button" className="trainer-batch-cal__nav-btn" onClick={() => shiftMonth(-1)}>
            Prev
          </button>
          <button
            type="button"
            className="trainer-batch-cal__nav-btn"
            onClick={() => setCursor(new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), 1)))}
          >
            Today
          </button>
          <button type="button" className="trainer-batch-cal__nav-btn" onClick={() => shiftMonth(1)}>
            Next
          </button>
        </div>
      </div>
      {scheduleLabel ? (
        <p className="trainer-batch-cal__schedule">
          Regular schedule: <strong>{scheduleLabel}</strong>
        </p>
      ) : null}
      <div className="trainer-batch-cal__grid" role="grid" aria-label="Month calendar">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="trainer-batch-cal__dow">
            {d}
          </div>
        ))}
        {weeks.flat().map((day, idx) => {
          if (!day) {
            return <div key={`e-${idx}`} className="trainer-batch-cal__cell trainer-batch-cal__cell--empty" />;
          }
          const key = ymd(day);
          const events = eventsByDay.get(key) || [];
          const isToday = key === todayKey;
          return (
            <div
              key={key}
              className={`trainer-batch-cal__cell${isToday ? ' is-today' : ''}${
                events.length ? ' has-events' : ''
              }`}
            >
              <span className="trainer-batch-cal__date">{day.getUTCDate()}</span>
              {events.slice(0, 2).map((ev) => (
                <span
                  key={ev.id}
                  className={`trainer-batch-cal__pill${
                    ev.status === 'live' ? ' is-live' : ev.status === 'completed' ? ' is-done' : ''
                  }`}
                  title={ev.title}
                >
                  {ev.scheduledTime || 'Class'}
                </span>
              ))}
              {scheduleLabel && events.length === 0 && day.getUTCDay() !== 0 && day.getUTCDay() !== 6 ? (
                <span className="trainer-batch-cal__pill is-routine">{schedule.time || 'Class'}</span>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
