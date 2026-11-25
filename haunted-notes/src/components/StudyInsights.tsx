import React, { useId, useMemo, useState } from 'react';
import { useStore } from '../store/useStore';
import { computeInsights } from '../lib/insights';
import { noteTitle } from '../lib/noteTitle';
import ReviewBarChart from './ReviewBarChart';

function streakLabel(n: number): string {
  return n === 1 ? 'day streak' : 'day streaks';
}

/** Dashboard progress panel. Reads the store, renders computeInsights output. */
const StudyInsights: React.FC = () => {
  const headingId = useId();
  const reviewLog = useStore((s) => s.reviewLog);
  const notes = useStore((s) => s.notes);
  const flashcards = useStore((s) => s.flashcards);

  // Clock is read once per mount (lazy initializer), not during each render.
  const [clock] = useState(() => ({
    now: Date.now(),
    tzOffsetMinutes: new Date().getTimezoneOffset(),
  }));

  const insights = useMemo(
    () =>
      computeInsights({
        events: reviewLog.events,
        notes,
        cards: flashcards,
        now: clock.now,
        tzOffsetMinutes: clock.tzOffsetMinutes,
      }),
    [reviewLog, notes, flashcards, clock],
  );

  const titleById = new Map(notes.map((n) => [n.id, noteTitle(n)]));

  return (
    <section className="insights" aria-labelledby={headingId} data-demo="insights">
      <h2 id={headingId}>Study insights</h2>
      <dl className="insights-stats" data-demo="insights-stats">
        <div className="insights-stat">
          <dt>{streakLabel(insights.streak)}</dt>
          <dd>{insights.streak}</dd>
        </div>
        <div className="insights-stat">
          <dt>reviewed today</dt>
          <dd>{insights.today}</dd>
        </div>
        <div className="insights-stat">
          <dt>accuracy, 7 days</dt>
          <dd className={insights.accuracy === null ? 'insights-stat-empty' : undefined}>
            {insights.accuracy === null
              ? 'No reviews yet'
              : `${Math.round(insights.accuracy * 100)}%`}
          </dd>
        </div>
      </dl>
      <h3>Weakest rooms</h3>
      {insights.weakest.length === 0 ? (
        <p data-demo="insights-weak">No weak rooms. All ghosts are banished or none exist yet.</p>
      ) : (
        <ol className="insights-weak" data-demo="insights-weak">
          {insights.weakest.map((r) => (
            <li key={r.noteId}>
              <span>{titleById.get(r.noteId) ?? ''}</span>{' '}
              <span>weakness {Math.round(r.weakness * 100)}%</span>
            </li>
          ))}
        </ol>
      )}
      <ReviewBarChart buckets={insights.buckets} />
    </section>
  );
};

export default StudyInsights;
