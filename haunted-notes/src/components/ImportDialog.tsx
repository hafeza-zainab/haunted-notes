import React, { useEffect, useId, useRef } from 'react';
import type { ImportSummary, ImportWarning } from '../lib/backup';

const WARNING_TEXT: Record<ImportWarning, string> = {
  'review-log-ignored':
    'The review history in this file was ignored because this app cannot read its version.',
};

interface ImportDialogProps {
  summary: ImportSummary;
  onConfirm: () => void;
  onCancel: () => void;
}

function hasNewItems(s: ImportSummary): boolean {
  return s.notes.added + s.flashcards.added + s.events.added > 0;
}

/** Confirm dialog for an import. Shows counts and fixed warning texts only. */
const ImportDialog: React.FC<ImportDialogProps> = ({ summary, onConfirm, onCancel }) => {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (!dlg.open && typeof dlg.showModal === 'function') dlg.showModal();
    return () => {
      if (dlg.open && typeof dlg.close === 'function') dlg.close();
    };
  }, []);

  const rows: { label: string; added: number; skipped: number; dropped: number }[] = [
    { label: 'Notes', added: summary.notes.added, skipped: summary.notes.skipped, dropped: summary.dropped.notes },
    { label: 'Cards', added: summary.flashcards.added, skipped: summary.flashcards.skipped, dropped: summary.dropped.flashcards },
    { label: 'Review events', added: summary.events.added, skipped: summary.events.skipped, dropped: summary.dropped.events },
  ];
  const canConfirm = hasNewItems(summary);

  return (
    <dialog
      ref={ref}
      className="backup-dialog"
      aria-labelledby={titleId}
      aria-modal="true"
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
    >
      <h2 id={titleId} className="backup-dialog-title">Import backup</h2>
      <ul className="backup-counts">
        {rows.map((r) => (
          <li key={r.label}>
            {`${r.label}: ${r.added} new, ${r.skipped} already here, ${r.dropped} invalid`}
          </li>
        ))}
      </ul>
      {!canConfirm && <p>Nothing new will be added.</p>}
      {summary.warnings.length > 0 && (
        <ul className="backup-warnings">
          {summary.warnings.map((w) => (
            <li key={w}>Warning: {WARNING_TEXT[w]}</li>
          ))}
        </ul>
      )}
      <div className="backup-dialog-actions">
        <button type="button" className="btn-ghost" onClick={onCancel} autoFocus>
          Cancel
        </button>
        {canConfirm && (
          <button type="button" className="btn-primary" onClick={onConfirm}>
            Merge into my notes
          </button>
        )}
      </div>
    </dialog>
  );
};

export default ImportDialog;
