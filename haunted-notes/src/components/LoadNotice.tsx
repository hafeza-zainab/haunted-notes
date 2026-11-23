import React from 'react';
import { useStore } from '../store/useStore';
import { noticeText } from '../lib/loadReport';

/**
 * One-line notice shown when saved notes or cards could not be loaded. Shows
 * counts only, never note or card text.
 */
const LoadNotice: React.FC = () => {
  const loadNotice = useStore((s) => s.loadNotice);
  const dismiss = useStore((s) => s.dismissLoadNotice);
  // The button disappears on dismiss: move focus to the main region so it is not lost.
  const handleDismiss = () => {
    dismiss();
    document.getElementById('main-content')?.focus();
  };

  if (!loadNotice) return null;
  return (
    <div className="load-notice" role="status">
      <p>{noticeText(loadNotice)}</p>
      <button type="button" className="btn-secondary" onClick={handleDismiss}>
        Dismiss
      </button>
    </div>
  );
};

export default LoadNotice;
