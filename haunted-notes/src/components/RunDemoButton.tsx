import React from 'react';
import { startDemo } from '../demo/runner';

/** The one "Run demo" button used on the home screen, Add Note and the dashboard. */
const RunDemoButton: React.FC<{ className?: string }> = ({ className = 'btn-ghost' }) => (
  <button
    type="button"
    className={`${className} btn-run-demo`}
    data-demo="run-demo"
    onClick={() => void startDemo()}
  >
    <span aria-hidden="true">▶ </span>Run demo
  </button>
);

export default RunDemoButton;
