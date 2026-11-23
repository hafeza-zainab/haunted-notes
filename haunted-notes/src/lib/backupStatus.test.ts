import { describe, it, expect } from 'vitest';
import { exportStatus, importStatus } from './backupStatus';

const summary = (notes: number, cards: number, events: number) => ({
  notes: { added: notes, skipped: 0 },
  flashcards: { added: cards, skipped: 0 },
  events: { added: events, skipped: 0 },
});

describe('backup status lines', () => {
  it('import uses singular for 1 and plural otherwise', () => {
    expect(importStatus(summary(1, 1, 1))).toBe('Imported 1 note, 1 card and 1 review event.');
    expect(importStatus(summary(2, 3, 0))).toBe('Imported 2 notes, 3 cards and 0 review events.');
  });

  it('export uses singular for 1 and plural otherwise', () => {
    expect(exportStatus(1, 1)).toBe('Exported 1 note and 1 card.');
    expect(exportStatus(3, 9)).toBe('Exported 3 notes and 9 cards.');
    expect(exportStatus(0, 0)).toBe('Exported 0 notes and 0 cards.');
  });
});
