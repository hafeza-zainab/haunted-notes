import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import DemoBar from './DemoBar';
import { CHAPTER_TITLES, formatClock, scriptTotalMs } from '../lib/demoScript';

const noop = () => undefined;

function render(over: Partial<React.ComponentProps<typeof DemoBar>> = {}) {
  return renderToString(
    <DemoBar
      paused={false}
      chapter={3}
      caption="Hint shows the first letter, then the length."
      elapsedMs={75_000}
      totalMs={scriptTotalMs()}
      onTogglePause={noop}
      onStop={noop}
      {...over}
    />,
  );
}

describe('DemoBar', () => {
  it('renders non-empty HTML without throwing', () => {
    expect(render().length).toBeGreaterThan(0);
  });

  it('is a labelled region with the chapter title and the caption', () => {
    const html = render();
    expect(html).toContain('role="region"');
    expect(html).toContain('aria-label="Demo controls"');
    expect(html).toContain(`Chapter <!-- -->4<!-- --> of <!-- -->9<!-- -->: <!-- -->${CHAPTER_TITLES[3]}`);
    expect(html).toContain('Hint shows the first letter, then the length.');
  });

  it('announces the caption politely and nothing else live', () => {
    const html = render();
    expect(html).toMatch(/<p class="demo-caption" role="status" aria-live="polite">/);
    expect(html.match(/aria-live=/g)).toHaveLength(1);
  });

  it('shows elapsed and the true total from the script', () => {
    const html = render({ elapsedMs: 75_000 });
    expect(html).toContain(`${formatClock(75_000)}`);
    expect(html).toContain(formatClock(scriptTotalMs()));
  });

  it('has a progress strip with a value', () => {
    const html = render({ elapsedMs: 50_000, totalMs: 100_000 });
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="50"');
    expect(html).toContain('width:50%');
  });

  it('caps progress at 100 and survives a zero total', () => {
    expect(render({ elapsedMs: 9e9, totalMs: 100 })).toContain('aria-valuenow="100"');
    expect(render({ elapsedMs: 5, totalMs: 0 })).toContain('aria-valuenow="0"');
  });

  it('has one dot per chapter and marks only the current one', () => {
    const html = render({ chapter: 2 });
    expect(html.match(/class="demo-dot /g)).toHaveLength(CHAPTER_TITLES.length);
    expect(html.match(/aria-current="step"/g)).toHaveLength(1);
    expect(html).toContain('aria-label="Chapters"');
  });

  it('names finished chapters "(done)" for screen readers, not by colour alone', () => {
    const html = render({ chapter: 2 });
    expect(html).toContain(`${CHAPTER_TITLES[0]} (done)`);
    expect(html).toContain(`${CHAPTER_TITLES[1]} (done)`);
    expect(html).not.toContain(`${CHAPTER_TITLES[2]} (done)`);
    expect(html).not.toContain(`${CHAPTER_TITLES[5]} (done)`);
  });

  it('has Pause and Stop buttons whose names equal their visible text', () => {
    const html = render();
    const buttons = [...html.matchAll(/<button[^>]*>(.*?)<\/button>/g)];
    expect(buttons).toHaveLength(2);
    for (const [tag] of buttons) {
      expect(tag).not.toContain('aria-label'); // name comes from the visible text
      expect(tag).toContain('type="button"');
      expect(tag).toContain('<span aria-hidden="true">'); // icon hidden from the name
    }
    expect(html).toContain('Pause</button>');
    expect(html).toContain('Stop</button>');
  });

  it('the button shows Resume while paused', () => {
    const html = render({ paused: true });
    expect(html).toContain('Resume</button>');
    expect(html).not.toContain('Pause</button>');
  });
});
