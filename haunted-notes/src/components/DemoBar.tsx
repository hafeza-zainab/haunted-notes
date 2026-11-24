import React from 'react';
import { CHAPTER_TITLES, formatClock } from '../lib/demoScript';

interface Props {
  paused: boolean;
  chapter: number;
  caption: string;
  elapsedMs: number;
  totalMs: number;
  onTogglePause: () => void;
  onStop: () => void;
}

/**
 * Bottom control bar for "Run demo". Shows the chapter, the caption, elapsed and
 * total time, a progress strip, the chapter dots and the Pause and Stop buttons.
 * Props only: it reads no store and starts nothing. The total comes from the
 * script, never from a typed-in number.
 */
const DemoBar: React.FC<Props> = ({
  paused,
  chapter,
  caption,
  elapsedMs,
  totalMs,
  onTogglePause,
  onStop,
}) => {
  const pct = totalMs > 0 ? Math.min(100, Math.round((elapsedMs / totalMs) * 100)) : 0;

  return (
    <section className="demo-bar" role="region" aria-label="Demo controls" data-demo="demo-bar">
      <div className="demo-bar-head">
        <p className="demo-chapter">
          Chapter {chapter + 1} of {CHAPTER_TITLES.length}: {CHAPTER_TITLES[chapter]}
        </p>
        <p className="demo-time">
          {formatClock(elapsedMs)} / {formatClock(totalMs)}
        </p>
      </div>

      <p className="demo-caption" role="status" aria-live="polite">
        {caption}
      </p>

      <div
        className="demo-progress"
        role="progressbar"
        aria-label="Demo progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <div className="demo-progress-fill" style={{ width: `${pct}%` }} />
      </div>

      <div className="demo-bar-foot">
        <ol className="demo-dots" aria-label="Chapters">
          {CHAPTER_TITLES.map((title, i) => (
            <li
              key={title}
              className={`demo-dot ${i < chapter ? 'done' : ''} ${i === chapter ? 'current' : ''}`}
              aria-current={i === chapter ? 'step' : undefined}
            >
              <span className="sr-only">{i < chapter ? `${title} (done)` : title}</span>
            </li>
          ))}
        </ol>
        <div className="demo-buttons">
          <button type="button" className="btn-secondary demo-btn" onClick={onTogglePause}>
            <span aria-hidden="true">{paused ? '▶ ' : '⏸ '}</span>
            {paused ? 'Resume' : 'Pause'}
          </button>
          <button type="button" className="btn-danger-outline demo-btn" onClick={onStop}>
            <span aria-hidden="true">⏹ </span>Stop
          </button>
        </div>
      </div>
    </section>
  );
};

export default DemoBar;
