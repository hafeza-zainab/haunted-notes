import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import DemoPlayer from './DemoPlayer';

describe('DemoPlayer', () => {
  it('renders without throwing, and renders nothing while no run is active', () => {
    // Not the usual "non-empty" check: the player is invisible until a run starts.
    expect(renderToString(<DemoPlayer />)).toBe('');
  });
});
