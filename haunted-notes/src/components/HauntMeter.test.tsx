import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import HauntMeter from './HauntMeter';

describe('HauntMeter', () => {
  it('renders non-empty HTML without throwing', () => {
    const html = renderToString(<HauntMeter />);
    expect(html.length).toBeGreaterThan(0);
    expect(html).toContain('role="meter"');
    expect(html).toContain('Haunted:');
  });
});
