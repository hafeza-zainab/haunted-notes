import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useStore } from '../store/useStore';
import GhostSvg from './GhostSvg';
import BanishParticles from './BanishParticles';
import type { Flashcard } from '../types';
import { isDue, isReturned, isBanished } from '../lib/srs';
import { normalizeBlanks } from '../lib/blank';

// ── Answer normalisation ──────────────────────────────────────────────────────

/**
 * Strip leading/trailing whitespace and punctuation, then lowercase.
 * Allows "JVM." or " photosynthesis! " to match the stored cloze word.
 */
function normalise(s: string): string {
  return s.trim().replace(/^[^\w]+|[^\w]+$/g, '').toLowerCase();
}

// ── Queue building ────────────────────────────────────────────────────────────

/**
 * Snapshot of card ids for one round, shuffled.
 * Banished cards (reps > 0 and dueAt in the future) are never included.
 * Optional filters: a single note, and due (returned) cards only.
 */
function buildQueue(
  cards: Flashcard[],
  noteId: string | null,
  dueOnly: boolean,
): string[] {
  let eligible = cards.filter((c) => !isBanished(c));
  if (noteId) eligible = eligible.filter((c) => c.noteId === noteId);
  if (dueOnly) eligible = eligible.filter((c) => isDue(c));
  return eligible
    .slice()
    .sort(() => Math.random() - 0.5)
    .map((c) => c.id);
}

// ── QuizView ──────────────────────────────────────────────────────────────────

type AnswerState = 'idle' | 'correct' | 'wrong';

const QuizView: React.FC = () => {
  const allFlashcards  = useStore((s) => s.flashcards);
  const quizNoteId     = useStore((s) => s.quizNoteId);
  const quizDueOnly    = useStore((s) => s.quizDueOnly);
  const notes          = useStore((s) => s.notes);
  const answerCard     = useStore((s) => s.answerCard);
  const setView        = useStore((s) => s.setView);
  const setQuizNoteId  = useStore((s) => s.setQuizNoteId);
  const setQuizDueOnly = useStore((s) => s.setQuizDueOnly);

  // ── Queue: snapshot of card ids, built once by the lazy initialiser ───────
  // Store updates (weakness, SRS fields) never change this round's order or length.
  const [queue] = useState<string[]>(() =>
    buildQueue(allFlashcards, quizNoteId, quizDueOnly),
  );
  const [index, setIndex] = useState(0);

  // Build a lookup map from the live store so we always display up-to-date
  // card data (weakness, etc.) but never change the queue.
  const cardById = new Map<string, Flashcard>(
    allFlashcards.map((c) => [c.id, c]),
  );

  // ── Local UI state ────────────────────────────────────────────────────────

  const [input, setInput]                 = useState('');
  const [answerState, setAnswerState]     = useState<AnswerState>('idle');
  const [feedback, setFeedback]           = useState('');
  const [banishing, setBanishing]         = useState(false);
  const [shaking, setShaking]             = useState(false);
  const [score, setScore]                 = useState({ correct: 0, asked: 0 });

  // Resolve the current card from the queue (null once the end is reached).
  const currentId   = queue[index] ?? null;
  const currentCard = currentId ? (cardById.get(currentId) ?? null) : null;

  // Re-focus the input whenever we advance to a new card
  const inputRef = useRef<HTMLInputElement>(null);

  const quizNote  = quizNoteId ? notes.find((n) => n.id === quizNoteId) : null;
  const quizTitle = quizNote
    ? (quizNote.title ?? quizNote.rawText.slice(0, 40))
    : null;

  // ── Navigation ────────────────────────────────────────────────────────────

  const advance = useCallback(() => {
    setIndex((i) => i + 1);
    setInput('');
    setFeedback('');
    setAnswerState('idle');
    setBanishing(false);
    setShaking(false);
  }, []);

  const exitQuiz = useCallback(() => {
    setQuizNoteId(null);
    setQuizDueOnly(false);
    setView('dashboard');
  }, [setQuizNoteId, setQuizDueOnly, setView]);

  // ── Answer submission ─────────────────────────────────────────────────────

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!currentCard) return;

      // While showing feedback after wrong, the "Submit" button becomes "Next"
      if (answerState === 'wrong') {
        advance();
        return;
      }

      if (answerState !== 'idle') return;

      const correct = normalise(input) === normalise(currentCard.clozeWord);

      answerCard(currentCard.id, correct);
      setScore((s) => ({
        correct: s.correct + (correct ? 1 : 0),
        asked: s.asked + 1,
      }));

      if (correct) {
        setBanishing(true);
        setAnswerState('correct');
        setFeedback(`👻 Banished! The answer was "${currentCard.clozeWord}".`);
        // Keep the message visible ~900 ms (also under reduced motion), then advance
        setTimeout(advance, 900);
      } else {
        setShaking(true);
        setAnswerState('wrong');
        setFeedback(`✗ The answer was "${currentCard.clozeWord}".`);
        // Do NOT auto-advance — user must press Next to acknowledge
        setTimeout(() => setShaking(false), 400);
      }
    },
    [currentCard, answerState, input, answerCard, advance],
  );

  // ── Skip ──────────────────────────────────────────────────────────────────

  const handleSkip = useCallback(() => {
    if (answerState !== 'idle') return;
    advance();
  }, [answerState, advance]);

  // Focus the input after advancing
  useEffect(() => {
    if (answerState === 'idle') {
      inputRef.current?.focus();
    }
  }, [answerState, currentId]);

  // ── Completion screen ─────────────────────────────────────────────────────

  if (queue.length === 0) {
    return (
      <section className="quiz-view quiz-complete" aria-label="Nothing to review">
        <h2>No ghosts to review right now</h2>
        <button className="btn-primary" onClick={exitQuiz}>
          Back to Dashboard
        </button>
      </section>
    );
  }

  if (!currentCard) {
    const total = queue.length;
    const completionMsg = quizDueOnly
      ? '👻 All returned ghosts reviewed!'
      : '🎉 Round complete!';

    return (
      <section className="quiz-view quiz-complete" aria-label="Quiz complete">
        <h2>{completionMsg}</h2>
        {quizTitle && <p className="quiz-note-label">Room: {quizTitle}</p>}
        <p className="quiz-final-score">
          <strong>{score.correct}</strong> correct out of{' '}
          <strong>{score.asked}</strong> asked
          {score.asked < total && (
            <span className="quiz-skipped"> ({total - score.asked} skipped)</span>
          )}
        </p>
        <button className="btn-primary" onClick={exitQuiz}>
          Back to Dashboard
        </button>
      </section>
    );
  }

  // ── Active card ───────────────────────────────────────────────────────────

  const ghostReturned = isReturned(currentCard);
  const queueTotal    = queue.length;
  const queuePos      = index + 1; // 1-based for display

  // Button label switches after a wrong answer
  const submitLabel = answerState === 'wrong' ? 'Next →' : 'Submit';
  const submitDisabled = answerState === 'correct' ||
    (answerState === 'idle' && !input.trim());

  return (
    <section className="quiz-view" aria-label="Quiz mode">
      <header className="quiz-header">
        <div>
          <h2>Quiz Mode</h2>
          {quizDueOnly && (
            <p className="quiz-mode-label">
              🔔 Due cards only
            </p>
          )}
          {quizTitle && (
            <p className="quiz-note-label">
              📜 {quizTitle}
            </p>
          )}
        </div>
        <div className="quiz-score" aria-live="polite">
          <span className="quiz-progress">
            <span aria-hidden="true">{queuePos} / {queueTotal}</span>
            <span className="sr-only">Card {queuePos} of {queueTotal}</span>
          </span>
          <span className="score-correct">✓ {score.correct}</span>
          <span className="score-wrong">✗ {score.asked - score.correct}</span>
        </div>
      </header>

      {ghostReturned && (
        <p className="ghost-returned-banner" role="status" aria-live="polite">
          👻 This ghost has returned!
        </p>
      )}

      <div className="quiz-ghost-area">
        {banishing && <BanishParticles />}
        <GhostSvg
          weakness={currentCard.weaknessScore}
          banishing={banishing}
          shaking={shaking}
          size={120}
          label={`Ghost haunting: ${normalizeBlanks(currentCard.prompt)}`}
          className={ghostReturned ? 'ghost--returned' : undefined}
        />
      </div>

      <div className="quiz-card">
        <p className="quiz-prompt">
          <span className="sr-only">Fill in the blank: </span>
          {normalizeBlanks(currentCard.prompt)}
        </p>

        {feedback && (
          <p
            className={`quiz-feedback ${answerState}`}
            role={answerState === 'wrong' ? 'alert' : 'status'}
            aria-live={answerState === 'wrong' ? 'assertive' : 'polite'}
          >
            {feedback}
          </p>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <label htmlFor="quiz-answer" className="sr-only">Your answer</label>
          <input
            ref={inputRef}
            id="quiz-answer"
            className="quiz-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Fill in the blank…"
            autoComplete="off"
            autoFocus
            // Keep editable while showing wrong feedback so user can read.
            // readOnly (not disabled) after a correct answer so focus is not lost.
            readOnly={answerState === 'correct'}
          />
          <div className="quiz-actions">
            <button
              type="submit"
              className="btn-primary"
              disabled={submitDisabled}
            >
              {submitLabel}
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={handleSkip}
              disabled={answerState !== 'idle'}
            >
              Skip
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={exitQuiz}
            >
              Dashboard
            </button>
          </div>
        </form>
      </div>
    </section>
  );
};

export default QuizView;
