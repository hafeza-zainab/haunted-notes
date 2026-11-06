import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import GhostSvg from './GhostSvg';
import EmptyState from './EmptyState';

const MASTERED_THRESHOLD = 0.05;
/** Number of ghosts shown before the "Show more" toggle appears. */
const GHOST_PAGE_SIZE = 20;

const DashboardView: React.FC = () => {
  const flashcards = useStore((s) => s.flashcards);
  const setView = useStore((s) => s.setView);

  const [showAll, setShowAll] = useState(false);

  const haunted = flashcards
    .filter((c) => c.weaknessScore > MASTERED_THRESHOLD)
    .slice()
    .sort((a, b) => b.weaknessScore - a.weaknessScore);

  const mastered = flashcards.filter((c) => c.weaknessScore <= MASTERED_THRESHOLD);

  if (flashcards.length === 0) {
    return <EmptyState />;
  }

  const hasMore = haunted.length > GHOST_PAGE_SIZE;
  const visible = showAll ? haunted : haunted.slice(0, GHOST_PAGE_SIZE);
  const hiddenCount = haunted.length - GHOST_PAGE_SIZE;

  return (
    <section className="dashboard-view" aria-label="Ghost dashboard">
      <header className="dashboard-header">
        <div className="dashboard-stats">
          <span className="stat">
            <strong>{haunted.length}</strong> haunting
          </span>
          <span className="stat stat--mastered">
            <strong>{mastered.length}</strong> banished
          </span>
        </div>
        {haunted.length > 0 && (
          <button
            className="btn-primary"
            onClick={() => setView('quiz')}
            aria-label="Start quiz to banish ghosts"
          >
            👻 Start Quiz
          </button>
        )}
      </header>

      {haunted.length === 0 ? (
        <div className="all-mastered" role="status">
          <p>🎉 All ghosts banished! Add more notes to summon new ones.</p>
          <button className="btn-primary" onClick={() => setView('add')}>
            ➕ Add Note
          </button>
        </div>
      ) : (
        <>
          <div
            className="ghost-grid"
            role="list"
            aria-label="Unmastered flashcards as ghosts"
          >
            {visible.map((card) => (
              <div
                key={card.id}
                className="ghost-card"
                role="listitem"
                title={card.sentence}
              >
                <GhostSvg
                  weakness={card.weaknessScore}
                  size={100}
                  label={`Ghost for: ${card.sentence}`}
                />
                <p className="ghost-prompt">{card.prompt}</p>
              </div>
            ))}
          </div>

          {hasMore && (
            <div className="show-more-row">
              <button
                className="btn-ghost show-more-btn"
                onClick={() => setShowAll((v) => !v)}
                aria-expanded={showAll}
                aria-controls="ghost-grid"
              >
                {showAll
                  ? '▲ Show fewer ghosts'
                  : `▼ Show ${hiddenCount} more ghost${hiddenCount !== 1 ? 's' : ''}`}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default DashboardView;
