import React from 'react';
import { useStore } from './store/useStore';
import NavBar from './components/NavBar';
import AddNoteView from './components/AddNoteView';
import DashboardView from './components/DashboardView';
import QuizView from './components/QuizView';
import Atmosphere from './components/Atmosphere';
import { hauntedLevel } from './lib/haunt';

const App: React.FC = () => {
  const currentView = useStore((s) => s.currentView);
  const flashcards = useStore((s) => s.flashcards);

  // 0 (calm) to 4 (overrun): CSS reads this for the vignette, fog and specks
  const { tier } = hauntedLevel(flashcards);

  return (
    <div className="app-shell" data-level={tier}>
      <Atmosphere />
      <NavBar />
      <main id="main-content" className="main-content" tabIndex={-1}>
        {currentView === 'dashboard' && <DashboardView />}
        {currentView === 'add' && <AddNoteView />}
        {currentView === 'quiz' && <QuizView />}
      </main>
    </div>
  );
};

export default App;
