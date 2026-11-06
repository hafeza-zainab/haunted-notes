import React from 'react';
import { useStore } from './store/useStore';
import NavBar from './components/NavBar';
import AddNoteView from './components/AddNoteView';
import DashboardView from './components/DashboardView';
import QuizView from './components/QuizView';

const App: React.FC = () => {
  const currentView = useStore((s) => s.currentView);

  return (
    <div className="app-shell">
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
