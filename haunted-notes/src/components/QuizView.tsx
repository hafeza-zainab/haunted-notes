import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store/useStore';
import GhostSvg from './GhostSvg';
import BanishParticles from './BanishParticles';
import type { Flashcard } from '../types';
import { isDue, isReturned, isBanished } from '../lib/srs';
import { normalizeBlanks } from '../lib/blank';
import { judgeAnswer, hintFor, type HintLevel } from '../lib/answer';
import { nextStreak, addMissed } from '../lib/quizRound';

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

/** Callback ref (stable identity): move focus to the results heading when it appears. */
function focusOnMount(el: HTMLElement | null) {
  el?.focus();
}

// ── QuizView ──────────────────────────────────────────────────────────────────

type AnswerState = 'idle' | 'correct' | 'wrong';

const MAX_HINT_LEVEL = 2;

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
  // "Review missed" replaces it with another frozen snapshot (the missed ids).
  const [queue, setQueue] = useState<string[]>(() =>
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
  const [hintLevel, setHintLevel]         = useState<HintLevel>(0);
  const [streak, setStreak]               = useState(0);
  const [bestStreak, setBestStreak]       = useState(0);
  const [missed, setMissed]               = useState<string[]>([]);
  const [reviewing, setReviewing]         = useState(false);

  // Resolve the current card from the queue (null once the end is reached).
  const currentId   = queue[index] ?? null;
  const currentCard = currentId ? (cardById.get(currentId) ?? null) : null;

  // Re-focus the input whenever we advance to a new card
  const inputRef = useRef<HTMLInputElement>(null);
  // The Submit / Next button: Reveal moves focus here so focus is never lost
  const nextRef  = useRef<HTMLButtonElement>(null);

  const quizNote  = quizNoteId ? notes.find((n) => n.id === quizNoteId) : null;
  const quizTitle = quizNote
    ? (quizNote.title ?? quizNote.rawText.slice(0, 40))
    : null;

  // ── Navigation ────────────────────────────────────────────────────────────

  // (Plain functions: the React Compiler memoizes these itself.)

  const resetCard = () => {
    setInput('');
    setFeedback('');
    setAnswerState('idle');
    setBanishing(false);
    setShaking(false);
    setHintLevel(0);
  };

  const advance = () => {
    setIndex((i) => i + 1);
    resetCard();
  };

  const exitQuiz = () => {
    setQuizNoteId(null);
    setQuizDueOnly(false);
    setView('dashboard');
  };

  /** Start a new round with only the cards missed in this one. */
  const reviewMissed = () => {
    setQueue(missed);
    setIndex(0);
    resetCard();
    setScore({ correct: 0, asked: 0 });
    setStreak(0);
    setBestStreak(0);
    setMissed([]);
    setReviewing(true);
  };

  // ── Answer submission ─────────────────────────────────────────────────────

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCard) return;

    // While showing feedback after wrong, the "Submit" button becomes "Next"
    if (answerState === 'wrong') {
      advance();
      return;
    }

    if (answerState !== 'idle') return;

    // Typos of one letter are accepted for answers of 6+ letters
    const verdict = judgeAnswer(input, currentCard.clozeWord);
    const correct = verdict !== 'wrong';
    const hinted  = correct && hintLevel > 0;

    answerCard(currentCard.id, correct, hinted);
    setScore((s) => ({
      correct: s.correct + (correct ? 1 : 0),
      asked: s.asked + 1,
    }));
    const newStreak = nextStreak(streak, correct);
    setStreak(newStreak);
    setBestStreak((b) => Math.max(b, newStreak));

    if (correct) {
      const lead = verdict === 'close' ? 'Close enough! ' : '';
      const tail = hinted ? ' A hint was used, so it returns sooner.' : '';
      setBanishing(true);
      setAnswerState('correct');
      setFeedback(`${lead}👻 Banished! The answer was "${currentCard.clozeWord}".${tail}`);
      // Keep the message visible ~900 ms (also under reduced motion), then advance
      setTimeout(advance, 900);
    } else {
      setMissed((m) => addMissed(m, currentCard.id));
      setShaking(true);
      setAnswerState('wrong');
      setFeedback(`✗ The answer was "${currentCard.clozeWord}".`);
      // Do NOT auto-advance — user must press Next to acknowledge
      setTimeout(() => setShaking(false), 400);
    }
  };

  // ── Skip ──────────────────────────────────────────────────────────────────

  const handleSkip = () => {
    if (answerState !== 'idle') return;
    advance();
  };

  // ── Hint: first letter, then the length ───────────────────────────────────

  const handleHint = () => {
    if (answerState !== 'idle' || hintLevel >= MAX_HINT_LEVEL) return;
    setHintLevel((l) => (l + 1) as HintLevel);
  };

  // ── Reveal: show the answer, counts as wrong ──────────────────────────────

  const handleReveal = () => {
    if (!currentCard || answerState !== 'idle') return;
    answerCard(currentCard.id, false);
    setScore((s) => ({ ...s, asked: s.asked + 1 }));
    setStreak(nextStreak(streak, false));
    setMissed((m) => addMissed(m, currentCard.id));
    setAnswerState('wrong');
    setFeedback(`👁 Revealed: the answer was "${currentCard.clozeWord}".`);
    // The Reveal button is about to be disabled: move focus to Next
    requestAnimationFrame(() => nextRef.current?.focus());
  };

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
    const completionMsg = reviewing
      ? '🔁 Review complete!'
      : quizDueOnly
        ? '👻 All returned ghosts reviewed!'
        : '🎉 Round complete!';
    const missedCards = missed
      .map((id) => cardById.get(id))
      .filter((c): c is Flashcard => c !== undefined);

    return (
      <section className="quiz-view quiz-complete" aria-label="Quiz complete">
        {/* Focus lands here so keyboard and screen-reader users are not left on <body> */}
        <h2 ref={focusOnMount} tabIndex={-1}>{completionMsg}</h2>
        {quizTitle && <p className="quiz-note-label">Room: {quizTitle}</p>}
        <p className="quiz-final-score">
          <strong>{score.correct}</strong> correct out of{' '}
          <strong>{score.asked}</strong> asked
          {score.asked < total && (
            <span className="quiz-skipped"> ({total - score.asked} skipped)</span>
          )}
        </p>
        <p className="quiz-best-streak">
          Best streak: <strong>{bestStreak}</strong>
        </p>

        {missedCards.length > 0 && (
          <div className="quiz-missed">
            <h3>Missed ({missedCards.length})</h3>
            <ul aria-label="Missed cards">
              {missedCards.map((c) => (
                <li key={c.id}>
                  <span className="missed-prompt">{normalizeBlanks(c.prompt)}</span>
                  <span className="missed-answer">
                    Answer: <strong>{c.clozeWord}</strong>
                  </span>
                </li>
              ))}
            </ul>
            <button className="btn-primary" onClick={reviewMissed}>
              Review missed
            </button>
          </div>
        )}

        <button
          className={missedCards.length > 0 ? 'btn-ghost' : 'btn-primary'}
          onClick={exitQuiz}
        >
          Back to Dashboard
        </button>
      </section>
    );
  }

  // ── Active card ───────────────────────────────────────────────────────────

  const ghostReturned = isReturned(currentCard);
  const queueTotal    = queue.length;
  const queuePos      = index + 1; // 1-based for display

  // Only the first letter / the length is ever put in the DOM, never the answer
  const hintText = hintFor(currentCard.clozeWord, hintLevel);
  const hintMaxed = hintLevel >= MAX_HINT_LEVEL;

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
          {reviewing && (
            <p className="quiz-mode-label">
              🔁 Reviewing missed cards
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
          <span className="score-streak">Streak <strong>{streak}</strong></span>
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

        {/* Hint: always rendered so screen readers announce changes */}
        <p
          className={`quiz-hint ${hintText ? 'on' : ''}`}
          role="status"
          aria-live="polite"
        >
          {hintText && (
            <>
              <span aria-hidden="true">💡 </span>
              {hintText}
            </>
          )}
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
              ref={nextRef}
              type="submit"
              className="btn-primary"
              disabled={submitDisabled}
            >
              {submitLabel}
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={handleHint}
              disabled={answerState !== 'idle'}
              // aria-disabled (not disabled) at the maximum, so focus stays on the button
              aria-disabled={hintMaxed ? true : undefined}
            >
              Hint
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
              onClick={handleReveal}
              disabled={answerState !== 'idle'}
            >
              Reveal
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
