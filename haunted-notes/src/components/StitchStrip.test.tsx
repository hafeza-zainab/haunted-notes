import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import StitchStrip from './StitchStrip';

describe('StitchStrip', () => {
  const html = renderToStaticMarkup(<StitchStrip />);

  it('is a labelled figure with the neutral caption', () => {
    expect(html).toMatch(/<figure[^>]*aria-labelledby="[^"]+"/);
    expect(html).toContain('Four inputs, one ghost pipeline</figcaption>');
  });

  it('lists the four inputs and the three pipeline stages in order', () => {
    for (const name of ['Type', 'Speak', 'Photo', 'Audio file']) expect(html).toContain(`>${name}</li>`);
    const stages = ['Flashcards', 'Ghosts', 'Spaced review'].map((s) => html.indexOf(`>${s}</span>`));
    expect(stages.every((i) => i > 0)).toBe(true);
    expect([...stages].sort((a, b) => a - b)).toEqual(stages);
  });

  it('has no interactive elements and hides every arrow from screen readers', () => {
    expect(html).not.toMatch(/<(button|a|input)\b/);
    const arrows = html.match(/<span[^>]*>→<\/span>/g) ?? [];
    expect(arrows.length).toBe(3);
    for (const a of arrows) expect(a).toContain('aria-hidden="true"');
  });
});
