/** Status lines for the backup panel. Pure; counts only, never note or card text. */
import { countLabel } from './plural';
import type { ImportSummary } from './backup';

export function exportStatus(notes: number, cards: number): string {
  return `Exported ${countLabel(notes, 'note')} and ${countLabel(cards, 'card')}.`;
}

export function importStatus(summary: Pick<ImportSummary, 'notes' | 'flashcards' | 'events'>): string {
  return `Imported ${countLabel(summary.notes.added, 'note')}, ${countLabel(summary.flashcards.added, 'card')} and ${countLabel(summary.events.added, 'review event')}.`;
}
