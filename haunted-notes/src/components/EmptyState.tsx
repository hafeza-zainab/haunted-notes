import React from 'react';
import { useStore } from '../store/useStore';

const EmptyState: React.FC = () => {
  const setView      = useStore((s) => s.setView);
  const isDemoLoaded = useStore((s) => s.isDemoLoaded);
  const loadDemoData = useStore((s) => s.loadDemoData);

  const handleTryDemo = () => {
    loadDemoData();
    setView('dashboard');
  };

  return (
    <div className="empty-state" role="status" aria-label="No notes yet">
      {/* Sad little ghost */}
      <svg
        width="120"
        height="140"
        viewBox="0 0 100 120"
        aria-hidden="true"
        className="ghost-float"
        style={{ opacity: 0.5 }}
      >
        <path
          d="M50 10 C20 10 10 35 10 60 L10 110 L22 98 L34 110 L46 98 L58 110 L70 98 L82 110 L90 60 C90 35 80 10 50 10 Z"
          fill="var(--ghost-fill)"
          stroke="var(--ghost-stroke)"
          strokeWidth="2"
        />
        {/* Sad eyes (downward arcs) */}
        <path d="M30 55 Q37 50 44 55" fill="none" stroke="var(--ghost-eyes)" strokeWidth="3" strokeLinecap="round" />
        <path d="M56 55 Q63 50 70 55" fill="none" stroke="var(--ghost-eyes)" strokeWidth="3" strokeLinecap="round" />
      </svg>

      <h2>No ghosts yet…</h2>
      <p>Add your first note to summon some study ghosts.</p>

      <div className="empty-state-actions">
        <button
          className="btn-primary"
          onClick={() => setView('add')}
          autoFocus
        >
          ➕ Add Note
        </button>

        {!isDemoLoaded && (
          <button
            className="btn-ghost"
            onClick={handleTryDemo}
            aria-label="Load demo notes to see how Haunted Notes works"
          >
            👻 Try demo
          </button>
        )}
      </div>
    </div>
  );
};

export default EmptyState;
