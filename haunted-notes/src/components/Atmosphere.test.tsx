import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import Atmosphere from './Atmosphere';

describe('Atmosphere', () => {
  it('renders non-empty, decorative-only HTML without throwing', () => {
    const html = renderToString(<Atmosphere />);
    expect(html.length).toBeGreaterThan(0);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('fog--a');
  });
});
