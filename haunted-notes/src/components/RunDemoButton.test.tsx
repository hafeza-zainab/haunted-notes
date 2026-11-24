import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import RunDemoButton from './RunDemoButton';

describe('RunDemoButton', () => {
  it('renders non-empty HTML without throwing', () => {
    expect(renderToString(<RunDemoButton />).length).toBeGreaterThan(0);
  });

  it('reads "Run demo" with a hidden play icon and no aria-label', () => {
    const html = renderToString(<RunDemoButton />);
    expect(html).toContain('<span aria-hidden="true">▶ </span>Run demo</button>');
    expect(html).not.toContain('aria-label');
    expect(html).toContain('data-demo="run-demo"');
  });
});
