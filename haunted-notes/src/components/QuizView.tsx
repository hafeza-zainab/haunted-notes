import React, { useState, useEffect, useCallback } from 'react';
import { useStore } from '../store/useStore';
import GhostSvg from './GhostSvg';
import type { Flashcard } from '../types';

const MASTERED_THRESHOLD = 0.05;

type AnswerState = 'idle' | 'correct' | 'wrong';

/** Pick the next weakest unmastered card, excluding the current one */
function pickNext(cards: Flashcard[], excludeId?: string): Flashcard | null {
  const pool = cards.filter(
    (c) => c.weaknessScore > MASTERED_THRESHOLD && c.id !== excludeId,
  );
  if (pool.length === 0) {
    // Fallback: allow current card again
    const fallback = cards.filter((c) => c.weaknessScore > MASTERED_THRESHOLD);
    return fallback.length > 0
      ? fallback.reduce((a, b) => (b.weaknessScore > a.weaknessScore ? b : a))
      : null;
  }
  return pool.reduce((a, b) => (b.weaknessScore > a.weaknessScore ? b : a));
}

const QuizView: React.FC = () => {
  const flashcards = useStore((s) => s.flashcards);
  const answerCard = useStore((s) => s.answerCard);
  const setView = useStore((s) => s.setView);

  const [current, setCurrent] = useState<Flashcard | null>(() => pickNext(flashcards));
  const [input, setInput] = useState('');
  const [answerState, setAnswerState] = useState<AnswerState>('idle');
  const [feedback, setFeedback] = useState('');
  const [banishing, setBanishing] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [score, setScore] = useState({ correct: 0, wrong: 0 });

  // Sync current card if flashcards change externally
  useEffect(() => {
    if (!current) {
      setCurrent(pickNext(flashcards));
    }
  }, [flashcards, current]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!current || answerState !== 'idle') return;

      const correct =
        input.trim().toLowerCase() === current.clozeWord.toLowerCase();

      answerCard(current.id, correct);
      setScore((s) => ({
        correct: s.correct + (correct ? 1 : 0),
        wrong: s.wrong + (correct ? 0 : 1),
      }));

      if (correct) {
        setBanishing(true);
        setAnswerState('correct');
        setFeedback(`✓ Correct! The answer was "${current.clozeWord}".`);
        setTimeout(() => {
          setBanishing(false);
          setAnswerState('idle');
          setInput('');
          setFeedback('');
          setCurrent(pickNext(flashcards, current.id));
        }, 900);
      } else {
        setShaking(true);
        setAnswerState('wrong');
        setFeedback(`✗ Wrong. The answer was "${current.clozeWord}". Try again soon!`);
        setTimeout(() => {
          setShaking(false);
          setAnswerState('idle');
          setInput('');
          setFeedback('');
          setCurrent(pickNext(flashcards, current.id));
        }, 900);
      }
    },
    [current, answerState, input, answerCard, flashcards],
  );

  const handleSkip = () => {
    if (!current) return;
    setInput('');
    setFeedback('');
    setAnswerState('idle');
    setCurrent(pickNext(flashcards, current.id));
  };

  if (!current) {
    return (
      <section className="quiz-view quiz-complete" aria-label="Quiz complete">
        <h2>🎉 All Ghosts Banished!</h2>
        <p>
          Score: {score.correct} correct / {score.wrong} wrong
        </p>
        <button className="btn-primary" onClick={() => setView('dashboard')}>
          Back to Dashboard
        </button>
      </section>
    );
  }

  return (
    <section className="quiz-view" aria-label="Quiz mode">
      <header className="quiz-header">
        <h2>Quiz Mode</h2>
        <div className="quiz-score" aria-live="polite">
          <span className="score-correct">✓ {score.correct}</span>
          <span className="score-wrong">✗ {score.wrong}</span>
        </div>
      </header>

      <div className="quiz-ghost-area">
        <GhostSvg
          weakness={current.weaknessScore}
          banishing={banishing}
          shaking={shaking}
          size={120}
          label={`Ghost haunting: ${current.sentence}`}
        />
      </div>

      <div className="quiz-card">
        <p className="quiz-prompt" aria-label="Fill in the blank">
          {current.prompt}
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
          <label htmlFor="quiz-answer" className="sr-only">
            Your answer
          </label>
          <input
            id="quiz-answer"
            className="quiz-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Fill in the blank…"
            autoComplete="off"
            autoFocus
            disabled={answerState !== 'idle'}
            aria-describedby={feedback ? 'quiz-feedback' : undefined}
          />
          <div className="quiz-actions">
            <button
              type="submit"
              className="btn-primary"
              disabled={!input.trim() || answerState !== 'idle'}
            >
              Submit
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
              onClick={() => setView('dashboard')}
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
