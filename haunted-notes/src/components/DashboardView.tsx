import React, { useState, useId } from 'react';
import { useStore } from '../store/useStore';
import GhostSvg from './GhostSvg';
import EmptyState from './EmptyState';
import type { Note, Flashcard } from '../types';
import { isDue, isBanished } from '../lib/srs';

// ── Constants ────────────────────────────────────────────────────────────────

const PREVIEW_GHOST_COUNT = 3;
const TITLE_MAX_LEN       = 40;

type SortMode = 'weakest' | 'newest';

// ── Helpers ──────────────────────────────────────────────────────────────────

function noteTitle(note: Note): string {
  if (note.title) return note.title;
  const t = note.rawText.trim().replace(/\s+/g, ' ');
  return t.length > TITLE_MAX_LEN ? t.slice(0, TITLE_MAX_LEN - 1) + '…' : t;
}

function roomSortWeight(cards: Flashcard[]): number {
  const haunted = cards.filter((c) => !isBanished(c));
  if (haunted.length === 0) return 0;
  return haunted.reduce((s, c) => s + c.weaknessScore, 0) / haunted.length;
}

// ── ConfirmDialog ─────────────────────────────────────────────────────────────

interface ConfirmDialogProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ message, onConfirm, onCancel }) => (
  <div className="confirm-overlay" role="dialog" aria-modal="true" aria-label="Confirm action">
    <div className="confirm-box">
      <p className="confirm-message">{message}</p>
      <div className="confirm-actions">
        <button className="btn-danger-outline" onClick={onConfirm} autoFocus>
          Yes, delete
        </button>
        <button className="btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  </div>
);

// ── HauntedRoom ───────────────────────────────────────────────────────────────

interface HauntedRoomProps {
  note: Note;
  cards: Flashcard[];
  onQuiz: () => void;
  onDelete: () => void;
}

const HauntedRoom: React.FC<HauntedRoomProps> = ({ note, cards, onQuiz, onDelete }) => {
  const renameNote = useStore((s) => s.renameNote);
  const titleId    = useId();

  const [expanded, setExpanded]     = useState(false);
  const [editing, setEditing]       = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);

  const haunted  = cards.filter((c) => !isBanished(c))
                        .sort((a, b) => b.weaknessScore - a.weaknessScore);
  const mastered = cards.filter((c) => isBanished(c));
  const total    = cards.length;
  const pct      = total > 0 ? Math.round((mastered.length / total) * 100) : 0;
  const dueCount = cards.filter((c) => isDue(c)).length;

  const visibleGhosts = expanded ? haunted : haunted.slice(0, PREVIEW_GHOST_COUNT);
  const hiddenCount   = haunted.length - PREVIEW_GHOST_COUNT;

  const startEdit = () => {
    setTitleDraft(note.title ?? '');
    setEditing(true);
  };

  const commitEdit = () => {
    renameNote(note.id, titleDraft);
    setEditing(false);
  };

  const handleTitleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
    if (e.key === 'Escape') { setEditing(false); }
  };

  return (
    <article
      className={`room-card ${haunted.length === 0 ? 'room-card--cleared' : ''}`}
      aria-label={`Haunted room: ${noteTitle(note)}`}
    >
      {/* ── Room header ── */}
      <div className="room-header">
        <div className="room-title-row">
          {editing ? (
            <input
              id={titleId}
              className="room-title-input"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={handleTitleKey}
              maxLength={80}
              autoFocus
              aria-label="Edit room title"
            />
          ) : (
            <button
              className="room-title-btn"
              onClick={startEdit}
              aria-label={`Rename room: ${noteTitle(note)}`}
              title="Click to rename"
            >
              <span className="room-title-text">{noteTitle(note)}</span>
              <span className="room-title-edit-icon" aria-hidden="true">✎</span>
            </button>
          )}

          <div className="room-badges">
            {haunted.length > 0 && (
              <span className="badge badge--haunting" aria-label={`${haunted.length} haunting`}>
                👻 {haunted.length}
              </span>
            )}
            {mastered.length > 0 && (
              <span className="badge badge--mastered" aria-label={`${mastered.length} banished`}>
                ✓ {mastered.length}
              </span>
            )}
            {dueCount > 0 && (
              <span className="badge badge--due" aria-label={`${dueCount} due`}>
                🔔 {dueCount} due
              </span>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="room-progress" aria-label={`${pct}% banished`}>
          <div
            className="room-progress-fill"
            style={{ width: `${pct}%` }}
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      </div>

      {/* ── Ghost preview grid ── */}
      {haunted.length > 0 ? (
        <>
          <div
            className="room-ghost-grid"
            role="list"
            aria-label="Ghosts in this room"
          >
            {visibleGhosts.map((card) => (
              <div
                key={card.id}
                className="ghost-card"
                role="listitem"
                title={card.sentence}
              >
                <GhostSvg
                  weakness={card.weaknessScore}
                  size={80}
                  label={`Ghost: ${card.prompt}`}
                  className={isDue(card) && card.reps > 0 ? 'ghost--returned' : undefined}
                />
                <p className="ghost-prompt">{card.prompt}</p>
              </div>
            ))}
          </div>

          {haunted.length > PREVIEW_GHOST_COUNT && (
            <button
              className="room-expand-btn"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
            >
              {expanded
                ? '▲ Show fewer'
                : `▼ Show ${hiddenCount} more ghost${hiddenCount !== 1 ? 's' : ''}`}
            </button>
          )}
        </>
      ) : (
        <p className="room-cleared-msg">
          {total === 0
            ? <span className="room-no-cards">No ghosts yet — text may need more detail.</span>
            : '🎉 All ghosts banished!'}
        </p>
      )}

      {/* ── Room actions ── */}
      <div className="room-actions">
        {haunted.length > 0 && (
          <button className="btn-primary btn-sm" onClick={onQuiz}>
            👻 Quiz this room
          </button>
        )}
        <button
          className="btn-danger-outline btn-sm"
          onClick={() => setConfirmDel(true)}
          aria-label={`Delete note: ${noteTitle(note)}`}
        >
          🗑 Delete
        </button>
      </div>

      {confirmDel && (
        <ConfirmDialog
          message={`Delete "${noteTitle(note)}" and its ${total} card${total !== 1 ? 's' : ''}?`}
          onConfirm={() => { setConfirmDel(false); onDelete(); }}
          onCancel={() => setConfirmDel(false)}
        />
      )}
    </article>
  );
};

// ── DashboardView ─────────────────────────────────────────────────────────────

const DashboardView: React.FC = () => {
  const notes          = useStore((s) => s.notes);
  const flashcards     = useStore((s) => s.flashcards);
  const isDemoLoaded   = useStore((s) => s.isDemoLoaded);
  const deleteNote     = useStore((s) => s.deleteNote);
  const setView        = useStore((s) => s.setView);
  const setQuizNoteId  = useStore((s) => s.setQuizNoteId);
  const setQuizDueOnly = useStore((s) => s.setQuizDueOnly);
  const clearDemoData  = useStore((s) => s.clearDemoData);
  const timeTravelDay  = useStore((s) => s.timeTravelDay);
  const resetAll       = useStore((s) => s.resetAll);

  const [sortMode, setSortMode]         = useState<SortMode>('weakest');
  const [confirmReset, setConfirmReset] = useState(false);

  // Show dev tools only when ?dev=1 is present in the URL
  const isDevMode = new URLSearchParams(window.location.search).get('dev') === '1';

  if (notes.length === 0) return <EmptyState />;

  // Build per-note card collections
  const noteRooms = notes.map((note) => ({
    note,
    cards: flashcards.filter((c) => c.noteId === note.id),
  }));

  // Summary counts (across all notes)
  const totalHaunting = flashcards.filter((c) => !isBanished(c)).length;
  const totalBanished = flashcards.filter((c) => isBanished(c)).length;
  const dueCount      = flashcards.filter((c) => isDue(c)).length;

  // Sort rooms
  const sorted = noteRooms.slice().sort((a, b) => {
    if (sortMode === 'newest') return b.note.createdAt - a.note.createdAt;
    // weakest: sort by average weakness of haunted cards, descending
    return roomSortWeight(b.cards) - roomSortWeight(a.cards);
  });

  const startQuizAll = () => {
    setQuizNoteId(null);
    setQuizDueOnly(false);
    setView('quiz');
  };

  const startQuizNote = (noteId: string) => {
    setQuizNoteId(noteId);
    setQuizDueOnly(false);
    setView('quiz');
  };

  const startQuizDue = () => {
    setQuizNoteId(null);
    setQuizDueOnly(true);
    setView('quiz');
  };

  return (
    <section className="dashboard-view" aria-label="Ghost dashboard">

      {/* ── Summary bar ── */}
      <div className="summary-bar">
        <div className="summary-stats">
          <span className="stat">
            <strong>{totalHaunting}</strong> haunting
          </span>
          <span className="stat stat--mastered">
            <strong>{totalBanished}</strong> banished
          </span>
          <span className="stat">
            <strong>{notes.length}</strong> room{notes.length !== 1 ? 's' : ''}
          </span>
          <span className={`stat ${dueCount > 0 ? 'stat--due' : 'stat--no-due'}`} aria-live="polite">
            {dueCount > 0 ? (
              <><strong>{dueCount}</strong> ghost{dueCount !== 1 ? 's' : ''} returned</>
            ) : (
              'No ghosts due'
            )}
          </span>
        </div>

        <div className="summary-actions">
          {dueCount > 0 && (
            <button
              className="btn-due"
              onClick={startQuizDue}
              aria-label={`Review ${dueCount} due ghost${dueCount !== 1 ? 's' : ''}`}
            >
              🔔 Review due ghosts
            </button>
          )}
          {totalHaunting > 0 && (
            <button className="btn-primary" onClick={startQuizAll}>
              👻 Start Quiz
            </button>
          )}
          {isDemoLoaded && (
            <button
              className="btn-ghost btn-sm"
              onClick={clearDemoData}
              aria-label="Remove demo notes and cards"
            >
              ✕ Clear demo
            </button>
          )}
          {isDevMode && (
            <button
              className="btn-dev"
              onClick={timeTravelDay}
              title="Dev tool: shift all dueAt back by 24 h"
              aria-label="Time travel +1 day: make all scheduled ghosts due now"
            >
              ⏩ +1 day
            </button>
          )}
          <button
            className="btn-danger-outline"
            onClick={() => setConfirmReset(true)}
            aria-label="Reset all data"
          >
            🗑 Reset all
          </button>
        </div>
      </div>

      {/* ── Sort controls ── */}
      <div className="sort-bar" role="group" aria-label="Sort rooms by">
        <span className="sort-label">Sort:</span>
        {(['weakest', 'newest'] as SortMode[]).map((mode) => (
          <button
            key={mode}
            className={`sort-btn ${sortMode === mode ? 'active' : ''}`}
            onClick={() => setSortMode(mode)}
            aria-pressed={sortMode === mode}
          >
            {mode === 'weakest' ? '⚡ Weakest first' : '🕐 Newest first'}
          </button>
        ))}
      </div>

      {/* ── Room grid ── */}
      <div className="rooms-grid" role="list">
        {sorted.map(({ note, cards }) => (
          <div key={note.id} role="listitem">
            <HauntedRoom
              note={note}
              cards={cards}
              onQuiz={() => startQuizNote(note.id)}
              onDelete={() => deleteNote(note.id)}
            />
          </div>
        ))}
      </div>

      {/* ── Reset all confirm ── */}
      {confirmReset && (
        <ConfirmDialog
          message="Delete ALL notes, flashcards and progress? This cannot be undone."
          onConfirm={() => { setConfirmReset(false); resetAll(); }}
          onCancel={() => setConfirmReset(false)}
        />
      )}
    </section>
  );
};

export default DashboardView;
