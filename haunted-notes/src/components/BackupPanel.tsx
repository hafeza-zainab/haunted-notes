import React, { useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import {
  BACKUP_LIMITS,
  backupFileName,
  buildExport,
  isFileSizeAllowed,
  mergeBackup,
  parseBackupText,
  serializeExport,
} from '../lib/backup';
import type { BackupData, ImportSummary, RejectReason } from '../lib/backup';
import ImportDialog from './ImportDialog';
import { exportStatus, importStatus } from '../lib/backupStatus';

const REJECT_MESSAGE: Record<RejectReason, string> = {
  'not-json': 'Import failed: that file is not valid JSON.',
  'not-an-object': 'Import failed: that file is not a Haunted Notes backup.',
  'wrong-app': 'Import failed: that file was not made by Haunted Notes.',
  'bad-version': 'Import failed: the backup version is not valid.',
  'unknown-version': 'Import failed: this backup version is not supported.',
  'bad-shape': 'Import failed: the backup file is damaged.',
  'too-many': 'Import failed: the backup holds more items than this app accepts.',
};

const TOO_BIG = `Import failed: the file is larger than ${BACKUP_LIMITS.fileBytes / (1024 * 1024)} MiB.`;
const UNREADABLE = 'Import failed: that file could not be read.';

interface Pending {
  data: BackupData;
  summary: ImportSummary;
}

const BackupPanel: React.FC = () => {
  const notes = useStore((s) => s.notes);
  const flashcards = useStore((s) => s.flashcards);
  const reviewLog = useStore((s) => s.reviewLog);
  const importBackup = useStore((s) => s.importBackup);

  const inputRef = useRef<HTMLInputElement>(null);
  const importBtnRef = useRef<HTMLButtonElement>(null);
  const [status, setStatus] = useState('');
  const [pending, setPending] = useState<Pending | null>(null);

  const handleExport = () => {
    const file = buildExport({ notes, flashcards, reviewLog }, Date.now());
    const blob = new Blob([serializeExport(file)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = backupFileName(Date.now(), new Date().getTimezoneOffset());
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setStatus(exportStatus(notes.length, flashcards.length));
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    if (!isFileSizeAllowed(file.size)) {
      setStatus(TOO_BIG);
      input.value = '';
      return;
    }
    let text: string;
    try {
      text = await file.text();
    } catch {
      setStatus(UNREADABLE);
      input.value = '';
      return;
    }
    input.value = '';
    const { notes: curNotes, flashcards: curCards, reviewLog: curLog } = useStore.getState();
    const result = parseBackupText(text, {
      existingNoteIds: new Set(curNotes.map((n) => n.id)),
      now: Date.now(),
    });
    if (!result.ok) {
      setStatus(REJECT_MESSAGE[result.reason]);
      return;
    }
    const { summary } = mergeBackup(
      { notes: curNotes, flashcards: curCards, reviewLog: curLog },
      result.data,
      result.dropped,
      result.warnings,
    );
    setStatus('');
    setPending({ data: result.data, summary });
  };

  const closeDialog = () => {
    setPending(null);
    // Wait until the modal dialog is gone: while it is open the page behind it is
    // inert and focus() does nothing. If this panel was replaced (the empty state
    // swaps to the dashboard after an import), fall back to the main region.
    requestAnimationFrame(() => {
      (importBtnRef.current ?? document.getElementById('main-content'))?.focus();
    });
  };

  const handleConfirm = () => {
    if (!pending) return;
    const s = importBackup(pending.data);
    setStatus(importStatus(s));
    closeDialog();
  };

  return (
    <section className="backup-panel" aria-labelledby="backup-heading">
      <h2 id="backup-heading">Backup and restore</h2>
      <div className="backup-actions">
        <button type="button" className="btn-secondary" onClick={handleExport} data-demo="backup-export">
          Export backup
        </button>
        <button
          type="button"
          className="btn-secondary"
          data-demo="backup-import"
          ref={importBtnRef}
          onClick={() => inputRef.current?.click()}
        >
          Import backup
        </button>
        <input
          ref={inputRef}
          className="sr-only"
          type="file"
          accept=".json,application/json"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => void handleFile(e)}
        />
      </div>
      <p className="input-hint" data-demo="privacy-line">
        Your notes stay in this browser. A backup is a file you save yourself.
      </p>
      <p className="backup-status" role="status" aria-live="polite">
        {status}
      </p>
      {pending && (
        <ImportDialog summary={pending.summary} onConfirm={handleConfirm} onCancel={closeDialog} />
      )}
    </section>
  );
};

export default BackupPanel;
