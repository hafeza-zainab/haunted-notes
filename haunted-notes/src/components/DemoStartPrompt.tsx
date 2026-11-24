import React, { useEffect, useId, useRef } from 'react';
import { formatClock, scriptTotalMs } from '../lib/demoScript';

interface Props {
  onStart: () => void;
  onCancel: () => void;
}

/**
 * Shown for `?demo=1`. Browsers block sound that starts without a click, so a click
 * on this one button starts the narrated run. Escape cancels. The length shown
 * comes from the script.
 */
const DemoStartPrompt: React.FC<Props> = ({ onStart, onCancel }) => {
  const titleId = useId();
  const textId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    buttonRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      } else if (e.key === 'Tab') {
        // A modal dialog: its one button is the only place focus can go.
        e.preventDefault();
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div
      className="demo-prompt"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={textId}
    >
      <div className="demo-prompt-box">
        <h2 id={titleId} className="demo-prompt-title">Haunted Notes demo</h2>
        <p id={textId} className="demo-prompt-text">
          A narrated walkthrough of {formatClock(scriptTotalMs())}. Your browser needs one click
          before it can play sound.
        </p>
        <button ref={buttonRef} type="button" className="btn-primary demo-btn" onClick={onStart}>
          Start with sound
        </button>
        <p className="demo-prompt-hint">Press Escape to cancel.</p>
      </div>
    </div>
  );
};

export default DemoStartPrompt;
