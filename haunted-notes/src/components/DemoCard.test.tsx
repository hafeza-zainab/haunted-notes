import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import DemoCard from './DemoCard';

describe('DemoCard', () => {
  it('renders non-empty HTML without throwing', () => {
    const html = renderToString(<DemoCard card={{ title: 'Built with Kiro', lines: ['One.', 'Two.'] }} />);
    expect(html.length).toBeGreaterThan(0);
    expect(html).toContain('Built with Kiro');
    expect(html).toContain('One.');
    expect(html).toContain('Two.');
  });
});
