import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useStore } from '../store/useStore';
import GhostSvg from './GhostSvg';
import type { Flashcard } from '../types';
import { isDue, isReturned } from '../lib/srs';

// ── Answer normalisation ──────────────────────────────────────────────────────

/**
 * Strip leading/trailing whitespace and punctuation, then lowercase.
 * Allows "JVM." or " photosynthesis! " to match the stored cloze word.
 */
function normalise(s: string): string {
  return s.trim().replace(/^[^\w]+|[^\w]+$/g, '').toLowerCase();
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

  // ── Build the queue once at mount ─────────────────────────────────────────
  //
  // We snapshot the eligible card IDs into a ref so that store updates
  // (weaknessScore, SRS fields) never mutate the round's ordering or length.
  // The queue is a simple ordered list; we walk it front-to-back.

  const queueRef = useRef<string[]>([]);
  const indexRef = useRef<number>(0);

  // Initialise the queue exactly once.  We use a ref+flag instead of useMemo
  // so that the queue is truly frozen even if the parent re-renders.
  const initialised = useRef(false);
  if (!initialised.current) {
    initialised.current = true;

    let eligible = quizNoteId
      ? allFlashcards.filter((c) => c.noteId === quizNoteId)
      : allFlashcards;

    if (quizDueOnly) {
      eligible = eligible.filter((c) => isDue(c));
    }

    // Shuffle for variety within the round
    const shuffled = eligible.slice().sort(() => Math.random() - 0.5);
    queueRef.current = shuffled.map((c) => c.id);
    indexRef.current = 0;
  }

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
  // Incremented by advance() to guarantee a re-render even when all other
  // state values are already at their reset values (e.g. Skip on the last card).
  const [tick, setTick]                   = useState(0);

  // Resolve the current card from the queue.
  // Reading `tick` here means every setTick() call in advance() causes this
  // line to re-evaluate, picking up the updated indexRef.current — even when
  // all the other state resets in advance() are already at their default values
  // (the case that caused Skip to do nothing on the last card).
  const currentId   = tick >= 0 ? (queueRef.current[indexRef.current] ?? null) : null;
  const currentCard = currentId ? (cardById.get(currentId) ?? null) : null;

  // Re-focus the input whenever we advance to a new card
  const inputRef = useRef<HTMLInputElement>(null);

  const quizNote  = quizNoteId ? notes.find((n) => n.id === quizNoteId) : null;
  const quizTitle = quizNote
    ? (quizNote.title ?? quizNote.rawText.slice(0, 40))
    : null;

  // ── Navigation ────────────────────────────────────────────────────────────

  const advance = useCallback(() => {
    indexRef.current += 1;
    setInput('');
    setFeedback('');
    setAnswerState('idle');
    setBanishing(false);
    setShaking(false);
    setTick((t) => t + 1); // always triggers a re-render to pick up the new index
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
        setFeedback(`✓ Correct! The answer was "${currentCard.clozeWord}".`);
        // Auto-advance after the banish animation
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

  if (!currentCard) {
    const total = queueRef.current.length;
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
  const queueTotal    = queueRef.current.length;
  const queuePos      = indexRef.current + 1; // 1-based for display

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
            <p className="quiz-mode-label" aria-label="Reviewing due cards only">
              🔔 Due cards only
            </p>
          )}
          {quizTitle && (
            <p className="quiz-note-label" aria-label={`Quizzing note: ${quizTitle}`}>
              📜 {quizTitle}
            </p>
          )}
        </div>
        <div className="quiz-score" aria-live="polite">
          <span className="quiz-progress" aria-label={`Card ${queuePos} of ${queueTotal}`}>
            {queuePos} / {queueTotal}
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
        <GhostSvg
          weakness={currentCard.weaknessScore}
          banishing={banishing}
          shaking={shaking}
          size={120}
          label={`Ghost haunting: ${currentCard.sentence}`}
          className={ghostReturned ? 'ghost--returned' : undefined}
        />
      </div>

      <div className="quiz-card">
        <p className="quiz-prompt" aria-label="Fill in the blank">
          {currentCard.prompt}
        </p>

        {feedback && (
          <p
            className={`quiz-feedback ${answerState}`}
            role="alert"
            aria-live="assertive"
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
            // Keep editable while showing wrong feedback so user can read; disable only on correct
            disabled={answerState === 'correct'}
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
