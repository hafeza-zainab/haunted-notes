import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import BanishParticles from './BanishParticles';

describe('BanishParticles', () => {
  it('renders non-empty, decorative-only HTML without throwing', () => {
    const html = renderToString(<BanishParticles />);
    expect(html.length).toBeGreaterThan(0);
    expect(html).toContain('aria-hidden="true"');
    expect(html.match(/banish-particle"/g)?.length).toBe(7);
  });
});
