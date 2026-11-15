import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import ImportDialog from './ImportDialog';
import type { ImportSummary } from '../lib/backup';

const summary: ImportSummary = {
  notes: { added: 1, skipped: 0 },
  flashcards: { added: 2, skipped: 1 },
  events: { added: 0, skipped: 0 },
  dropped: { notes: 0, flashcards: 3, events: 0 },
  warnings: [],
};

const render = (s: ImportSummary) =>
  renderToString(<ImportDialog summary={s} onConfirm={() => {}} onCancel={() => {}} />);

describe('ImportDialog', () => {
  it('renders non-empty HTML without throwing', () => {
    expect(render(summary).length).toBeGreaterThan(0);
  });

  it('shows counts, a name, Cancel and Merge', () => {
    const html = render(summary);
    expect(html).toContain('aria-labelledby');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('Cards: 2 new, 1 already here, 3 invalid');
    expect(html).toContain('Cancel');
    expect(html).toContain('Merge into my notes');
  });

  it('shows warnings as text', () => {
    const html = render({ ...summary, warnings: ['review-log-ignored'] });
    expect(html).toContain('review history in this file was ignored');
  });

  it('offers only Cancel when nothing is new', () => {
    const html = render({
      ...summary,
      notes: { added: 0, skipped: 1 },
      flashcards: { added: 0, skipped: 1 },
    });
    expect(html).toContain('Nothing new will be added.');
    expect(html).toContain('Cancel');
    expect(html).not.toContain('Merge into my notes');
  });

  it('contains no seeded answer text', () => {
    const marker = 'ZZ_ANSWER_MARKER_ZZ';
    expect(render(summary)).not.toContain(marker);
  });
});
