import React from 'react';
import { trainerLivePlatform } from '../utils/liveJoinUrl';
import './LiveClassStudio.css';

const PLATFORM_CARDS = [
  {
    id: 'meet',
    label: 'Google Meet',
    tag: 'Contact admin',
    tagClass: 'is-muted',
    disabled: true,
    icon: (
      <svg viewBox="0 0 24 24" width="48" height="48" aria-hidden="true">
        <path fill="#00832d" d="M4 7h7v10H4z" />
        <path fill="#0066da" d="M11 9l5-1.5v9L11 15V9z" />
        <path fill="#e94235" d="M16 8.5l5-1.5v9l-5-1.5z" />
        <path fill="#fbbc04" d="M4 4h7v3H4z" />
      </svg>
    )
  },
  {
    id: 'zoom',
    label: 'Zoom',
    tag: 'Integrated',
    tagClass: 'is-ok',
    icon: (
      <svg viewBox="0 0 24 24" width="48" height="48" aria-hidden="true">
        <rect fill="#2D8CFF" rx="5" width="24" height="24" />
        <path
          fill="#fff"
          d="M7 9.5c0-.8.7-1.5 1.5-1.5h7c.8 0 1.5.7 1.5 1.5v5c0 .8-.7 1.5-1.5 1.5h-7c-.8 0-1.5-.7-1.5-1.5v-5zm9 1.2 3.8-2.3v6.8L16 13.2v-2.5z"
        />
      </svg>
    )
  }
];

/**
 * Trainer live-class launcher — Start now and schedule side by side.
 */
export default function LiveClassPlatformPicker({
  selectedPlatform = 'zoom',
  trainerPlatform = 'zoom',
  meetEnabled = true,
  onSelect,
  batchLabel = '',
  classTitle = '',
  onClassTitleChange,
  scheduledDate = '',
  scheduledTime = '',
  description = '',
  onFieldChange,
  onStartNow,
  onSchedule,
  saving = false,
  showBatchSelect = false,
  batches = [],
  batchId = '',
  onBatchChange,
  simplified = false
}) {
  const assigned = trainerPlatform === 'zoom' ? 'zoom' : meetEnabled ? 'meet' : 'zoom';
  const zoomOnly = assigned === 'zoom';
  const activePlatform = zoomOnly ? 'zoom' : selectedPlatform;
  const platformLabel = trainerLivePlatform(activePlatform);
  const isZoom = activePlatform === 'zoom';

  const defaultTitle = batchLabel ? `${batchLabel} — Live class` : 'Live class';

  const batchField = showBatchSelect ? (
    <label className="live-studio-field live-studio-field--full">
      Batch
      <select
        value={batchId}
        onChange={(e) => onBatchChange?.(e.target.value)}
        required
      >
        <option value="">Select batch</option>
        {batches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name || b.id}
          </option>
        ))}
      </select>
    </label>
  ) : null;

  const handleStartSubmit = (e) => {
    e.preventDefault();
    onStartNow?.();
  };

  const handleScheduleSubmit = (e) => {
    e.preventDefault();
    onSchedule?.(e);
  };

  return (
    <section className="live-studio-panel live-studio-panel--compact">
      <div className="live-studio-panel__top">
        <div className="live-studio-panel__intro">
          <h2>{simplified ? 'Live class' : 'Live session'}</h2>
          <p>
            {simplified
              ? 'Same Zoom room · students join from their dashboard'
              : isZoom
                ? 'Personal Zoom room · start or schedule below'
                : 'Google Meet or Zoom for this batch'}
          </p>
        </div>
        <div
          className="live-studio-platforms live-studio-platforms--duo"
          role="list"
          aria-label="Video platforms"
        >
          {PLATFORM_CARDS.map((p) => {
            const isActive = p.id === activePlatform;
            const isDisabled =
              p.disabled || (p.id === 'meet' && !meetEnabled) || (zoomOnly && p.id !== 'zoom');
            const tag = p.id === 'meet' && !meetEnabled ? 'Contact admin' : p.tag;
            return (
              <button
                key={p.id}
                type="button"
                role="listitem"
                className={`live-studio-platform live-studio-platform--compact${
                  isActive ? ' is-selected' : ''
                }${p.id === 'zoom' ? ' is-zoom' : ''}${isDisabled ? ' is-disabled' : ''}`}
                disabled={isDisabled}
                onClick={() => !isDisabled && onSelect?.(p.id)}
                aria-pressed={isActive}
              >
                {isActive ? (
                  <span className="live-studio-platform__check" aria-hidden="true">
                    ✓
                  </span>
                ) : null}
                <span className="live-studio-platform__icon">{p.icon}</span>
                <span className="live-studio-platform__text">
                  <span className="live-studio-platform__label">{p.label}</span>
                  <span className={`live-studio-platform__tag ${p.tagClass}`}>{tag}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="live-studio-panel__body live-studio-panel__body--compact">
        {batchField}

        <div className="live-studio-dual">
          <form
            className="live-studio-dual__col live-studio-dual__col--start"
            onSubmit={handleStartSubmit}
          >
            <h3 className="live-studio-dual__title">Start now</h3>
            <p className="live-studio-hint">
              {batchLabel
                ? `Open ${isZoom ? 'Zoom' : platformLabel} for ${batchLabel} right away.`
                : `Open your ${isZoom ? 'Zoom' : platformLabel} room for this batch.`}
            </p>
            <button
              type="submit"
              className={`live-studio-cta live-studio-cta--compact${isZoom ? ' is-zoom' : ' is-meet'}`}
              disabled={saving}
            >
              {saving ? 'Please wait…' : 'Start class now'}
            </button>
          </form>

          <form
            className="live-studio-dual__col live-studio-dual__col--schedule"
            onSubmit={handleScheduleSubmit}
          >
            <h3 className="live-studio-dual__title">Schedule class</h3>
            <label className="live-studio-field live-studio-field--full">
              Title
              <input
                type="text"
                value={classTitle}
                onChange={(e) => onClassTitleChange?.(e.target.value)}
                placeholder={defaultTitle}
              />
            </label>
            <div className="live-studio-schedule-row live-studio-schedule-row--datetime">
              <label className="live-studio-field">
                Date
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => onFieldChange?.('scheduledDate', e.target.value)}
                  required
                />
              </label>
              <label className="live-studio-field">
                Time (IST)
                <input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => onFieldChange?.('scheduledTime', e.target.value)}
                  required
                />
              </label>
            </div>
            {!simplified && (
              <label className="live-studio-field live-studio-field--full">
                Agenda <span className="live-studio-optional">(optional)</span>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => onFieldChange?.('description', e.target.value)}
                  placeholder="What will you cover?"
                />
              </label>
            )}
            <button
              type="submit"
              className={`live-studio-cta live-studio-cta--compact live-studio-cta--schedule${
                isZoom ? ' is-zoom' : ' is-meet'
              }`}
              disabled={saving}
            >
              {saving ? 'Please wait…' : 'Schedule class'}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
