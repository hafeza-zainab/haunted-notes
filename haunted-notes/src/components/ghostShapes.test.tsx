import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup, renderToString } from 'react-dom/server';
import { GHOST_TYPES } from '../lib/haunt';
import { GHOST_SHAPES } from './ghostShapes';
import GhostSvg from './GhostSvg';

const MAX_BYTES = 2048;

describe('ghost shapes', () => {
  it('has a shape for every ghost type', () => {
    for (const type of GHOST_TYPES) expect(GHOST_SHAPES[type]).toBeTypeOf('function');
  });

  it('each type renders non-empty SVG under 2 KB', () => {
    for (const type of GHOST_TYPES) {
      const Shape = GHOST_SHAPES[type];
      const html = renderToStaticMarkup(<svg><Shape /></svg>);
      expect(html.length).toBeGreaterThan(0);
      expect(new TextEncoder().encode(html).length).toBeLessThan(MAX_BYTES);
    }
  });

  it('the five shapes are visually distinct (different markup)', () => {
    const markup = GHOST_TYPES.map((type) => {
      const Shape = GHOST_SHAPES[type];
      return renderToStaticMarkup(<svg><Shape /></svg>);
    });
    expect(new Set(markup).size).toBe(GHOST_TYPES.length);
  });
});

describe('GhostSvg', () => {
  it('renders non-empty HTML with its label and a type class', () => {
    const html = renderToString(<GhostSvg weakness={0.9} label="Ghost: _____ test" />);
    expect(html.length).toBeGreaterThan(0);
    expect(html).toContain('aria-label="Ghost: _____ test"');
    expect(html).toContain('ghost-type--poltergeist');
  });

  it('the whole ghost SVG (shape plus glow ring) stays under 2 KB for every type', () => {
    for (const weakness of [0.05, 0.3, 0.5, 0.7, 0.95]) {
      const html = renderToStaticMarkup(<GhostSvg weakness={weakness} label="Ghost" />);
      expect(new TextEncoder().encode(html).length).toBeLessThan(MAX_BYTES);
    }
  });
});
