import { describe, it, expect, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import TourCoach from './TourCoach';
import { useStore } from '../store/useStore';
import { TOUR_STEPS } from '../lib/tour';
import { buildDemoData } from '../lib/demoData';

function render(step: number | null) {
  // renderToStaticMarkup reads the store's initial state
  Object.assign(useStore.getInitialState(), { tourStep: step });
  return renderToStaticMarkup(<TourCoach />);
}

afterEach(() => {
  Object.assign(useStore.getInitialState(), { tourStep: null });
});

describe('TourCoach', () => {
  it('renders nothing when the tour is closed', () => {
    expect(render(null)).toBe('');
  });

  it('is a dialog named by its step title, with Next and Skip tour', () => {
    const html = render(0);
    expect(html).toContain('role="dialog"');
    const id = html.match(/aria-labelledby="([^"]+)"/)?.[1];
    expect(id).toBeTruthy();
    expect(html).toContain(`id="${id}" class="tour-title">${TOUR_STEPS[0].title}</h2>`);
    expect(html).toContain('>Next</button>');
    expect(html).toContain('>Skip tour</button>');
    expect(html).toContain('>Step 1 of 5</p>');
  });

  it('the last step says Finish', () => {
    const html = render(TOUR_STEPS.length - 1);
    expect(html).toContain('>Finish</button>');
    expect(html).not.toContain('>Next</button>');
  });

  it('no step shows a demo answer', () => {
    const answers = buildDemoData().flashcards.map((c) => c.clozeWord.toLowerCase());
    for (let i = 0; i < TOUR_STEPS.length; i++) {
      const text = render(i).replace(/<[^>]+>/g, ' ').toLowerCase();
      for (const a of answers) expect(new RegExp(`\\b${a}\\b`).test(text)).toBe(false);
    }
  });
});
