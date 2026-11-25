import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  demoUrlParams,
  getRunState,
  startDemo,
  stopDemo,
  subscribe,
  togglePause,
  toggleSound,
} from '../demo/runner';
import DemoBar from './DemoBar';
import DemoCard from './DemoCard';
import DemoStartPrompt from './DemoStartPrompt';

/** Delay before the silent `?demo=1&sound=0` start, so the first screen has painted. */
const AUTOSTART_DELAY_MS = 600;

/**
 * Mounted once in App. While a run is active it shows the shield (blocks the user's
 * pointer and keys on the app), an optional text card and the control bar. Escape
 * stops the run.
 *
 * `?demo=1` has no click, and browsers block sound that starts without one, so it
 * shows a "Start with sound" button. `?demo=1&sound=0` needs no sound and starts by
 * itself after load.
 */
const DemoPlayer: React.FC = () => {
  const run = useSyncExternalStore(subscribe, getRunState, getRunState);
  const active = run.status !== 'idle';
  const barRef = useRef<HTMLDivElement>(null);
  const [promptOpen, setPromptOpen] = useState(() => {
    const p = demoUrlParams();
    return p.demo && !p.silent;
  });

  // ?demo=1&sound=0 starts silently once after load (the timer is cleared if React remounts).
  useEffect(() => {
    const p = demoUrlParams();
    if (!p.demo || !p.silent) return;
    const id = window.setTimeout(() => void startDemo(), AUTOSTART_DELAY_MS);
    return () => window.clearTimeout(id);
  }, []);

  const startWithSound = useCallback(() => {
    setPromptOpen(false);
    // Runs inside the click, so the browser lets the first clip play.
    void startDemo({ sound: true });
  }, []);

  const cancelPrompt = useCallback(() => {
    setPromptOpen(false);
    requestAnimationFrame(() => document.getElementById('main-content')?.focus());
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

  if (!active) {
    return promptOpen ? <DemoStartPrompt onStart={startWithSound} onCancel={cancelPrompt} /> : null;
  }

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
          soundOn={run.sound}
          narrationUnavailable={run.narration === 'unavailable'}
          sampleNote={run.sample}
          onTogglePause={togglePause}
          onToggleSound={toggleSound}
          onStop={stopDemo}
        />
      </div>
    </>
  );
};

export default DemoPlayer;
