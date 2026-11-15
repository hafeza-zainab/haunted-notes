import type { ReviewEvent, ReviewLog } from '../types';

export const REVIEW_LOG_VERSION = 1;
export const REVIEW_EVENT_CAP = 500;

export function emptyReviewLog(): ReviewLog {
  return { v: REVIEW_LOG_VERSION, events: [] };
}

/** Returns a new log with the event appended and the oldest events dropped over the cap. */
export function appendReview(log: ReviewLog, event: ReviewEvent): ReviewLog {
  const next: ReviewEvent = { t: event.t, r: event.r, c: event.c };
  const events = [...log.events, next];
  return {
    v: REVIEW_LOG_VERSION,
    events:
      events.length > REVIEW_EVENT_CAP
        ? events.slice(events.length - REVIEW_EVENT_CAP)
        : events,
  };
}

/** Migration steps keyed by the version they upgrade from. */
const MIGRATIONS: Record<number, (events: unknown[]) => unknown[]> = {
  // v0 was a pre-release log with the same event shape.
  0: (events) => events,
};

function migrateEvents(from: number, events: unknown[]): unknown[] {
  let current = events;
  for (let v = from; v < REVIEW_LOG_VERSION; v += 1) {
    const step = MIGRATIONS[v];
    if (step) current = step(current);
  }
  return current;
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function toEvent(item: unknown): ReviewEvent | null {
  if (!isRecord(item)) return null;
  const { t, r, c } = item;
  if (typeof t !== 'number' || !Number.isFinite(t) || t < 0) return null;
  if (typeof r !== 'string' || r.length === 0) return null;
  if (c !== 0 && c !== 1) return null;
  return { t, r, c };
}

/** Total function: any input becomes a valid, sorted, capped log of the current version. */
export function sanitizeReviewLog(raw: unknown): ReviewLog {
  try {
    if (!isRecord(raw)) return emptyReviewLog();
    const { v, events } = raw;
    if (typeof v !== 'number' || !Number.isInteger(v) || v > REVIEW_LOG_VERSION) {
      return emptyReviewLog();
    }
    if (!Array.isArray(events)) return emptyReviewLog();
    const migrated = v < REVIEW_LOG_VERSION ? migrateEvents(v, events) : events;
    const valid: ReviewEvent[] = [];
    for (const item of migrated) {
      const e = toEvent(item);
      if (e) valid.push(e);
    }
    // Array.prototype.sort is stable, so equal t keeps original order.
    valid.sort((a, b) => a.t - b.t);
    return {
      v: REVIEW_LOG_VERSION,
      events:
        valid.length > REVIEW_EVENT_CAP
          ? valid.slice(valid.length - REVIEW_EVENT_CAP)
          : valid,
    };
  } catch {
    return emptyReviewLog();
  }
}
