import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import { getRunState, startDemo, stopDemo, subscribe, togglePause } from '../demo/runner';
import DemoBar from './DemoBar';
import DemoCard from './DemoCard';

/** Delay before `?demo=1` starts, so the first screen has painted. */
const AUTOSTART_DELAY_MS = 600;

/**
 * Mounted once in App. While a run is active it shows the shield (blocks the user's
 * pointer and keys on the app), an optional text card and the control bar. Escape
 * stops the run. `?demo=1` starts a run after load.
 */
const DemoPlayer: React.FC = () => {
  const run = useSyncExternalStore(subscribe, getRunState, getRunState);
  const active = run.status !== 'idle';
  const barRef = useRef<HTMLDivElement>(null);

  // ?demo=1 starts a run once after load (the timer is cleared if React remounts).
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('demo') !== '1') return;
    const id = window.setTimeout(() => void startDemo(), AUTOSTART_DELAY_MS);
    return () => window.clearTimeout(id);
  }, []);

  // Room under the bar, and Escape plus a key shield, only while a run is active.
  useEffect(() => {
    if (!active) return;
    document.body.classList.add('demo-running');
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (e.type === 'keydown') stopDemo();
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      if (e.key === 'Tab') return;
      if (barRef.current?.contains(e.target as Node)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    const types = ['keydown', 'keyup', 'keypress'] as const;
    types.forEach((t) => document.addEventListener(t, onKey, true));
    return () => {
      document.body.classList.remove('demo-running');
      types.forEach((t) => document.removeEventListener(t, onKey, true));
    };
  }, [active]);

  // Put keyboard focus on the controls when a run starts.
  const wasActive = useRef(false);
  useEffect(() => {
    if (active && !wasActive.current) {
      barRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    }
    wasActive.current = active;
  }, [active]);

  if (!active) return null;

  return (
    <>
      {run.card && <DemoCard card={run.card} />}
      <div className="demo-shield" aria-hidden="true" />
      <div ref={barRef}>
        <DemoBar
          paused={run.status === 'paused'}
          chapter={run.chapter}
          caption={run.caption}
          elapsedMs={run.elapsedMs}
          totalMs={run.totalMs}
          onTogglePause={togglePause}
          onStop={stopDemo}
        />
      </div>
    </>
  );
};

export default DemoPlayer;
