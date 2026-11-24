import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import DemoStartPrompt from './DemoStartPrompt';

describe('DemoStartPrompt', () => {
  it('renders non-empty HTML without throwing', () => {
    const html = renderToString(<DemoStartPrompt onStart={() => undefined} onCancel={() => undefined} />);
    expect(html.length).toBeGreaterThan(0);
    expect(html).toContain('role="dialog"');
    expect(html).toContain('Start with sound</button>');
  });
});
