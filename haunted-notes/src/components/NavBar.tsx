import React from 'react';
import { useStore } from '../store/useStore';
import type { View } from '../types';
import { isBanished } from '../lib/srs';
import HauntMeter from './HauntMeter';

const NavBar: React.FC = () => {
  const currentView = useStore((s) => s.currentView);
  const setView = useStore((s) => s.setView);
  const soundEnabled = useStore((s) => s.soundEnabled);
  const toggleSound = useStore((s) => s.toggleSound);
  const flashcards = useStore((s) => s.flashcards);

  const hauntedCount = flashcards.filter((c) => !isBanished(c)).length;

  const navItems: { view: View; label: string; icon: string }[] = [
    { view: 'dashboard', label: 'Dashboard', icon: '🏚' },
    { view: 'add', label: 'Add Note', icon: '➕' },
    { view: 'quiz', label: 'Quiz', icon: '👻' },
  ];

  return (
    <nav className="navbar" aria-label="Main navigation">
      <a href="#main-content" className="skip-link">Skip to main content</a>

      <div className="navbar-brand" aria-label="Haunted Notes">
        <span aria-hidden="true">👻</span>
        <span className="brand-name">Haunted Notes</span>
        {hauntedCount > 0 && (
          <span className="ghost-badge">
            <span aria-hidden="true">{hauntedCount}</span>
            <span className="sr-only">{hauntedCount} ghosts haunting</span>
          </span>
        )}
      </div>

      <HauntMeter />

      <ul className="nav-links" role="list">
        {navItems.map(({ view, label, icon }) => (
          <li key={view}>
            <button
              className={`nav-btn ${currentView === view ? 'active' : ''}`}
              onClick={() => setView(view)}
              aria-current={currentView === view ? 'page' : undefined}
            >
              <span aria-hidden="true">{icon}</span>
              <span className="nav-label">{label}</span>
            </button>
          </li>
        ))}
      </ul>

      <button
        className="sound-toggle"
        onClick={toggleSound}
        aria-label={soundEnabled ? 'Disable sound' : 'Enable sound'}
        title={soundEnabled ? 'Disable sound' : 'Enable sound'}
      >
        {soundEnabled ? '🔊' : '🔇'}
      </button>
    </nav>
  );
};

export default NavBar;
