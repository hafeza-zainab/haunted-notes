import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ReviewBarChart from './ReviewBarChart';
import type { DayBucket } from '../lib/insights';

const LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function makeBuckets(counts: number[]): DayBucket[] {
  return counts.map((reviews, i) => ({
    dayKey: 20000 + i,
    label: LABELS[i] ?? 'Mon',
    reviews,
    correct: Math.floor(reviews / 2),
  }));
}

const render = (counts: number[]): string =>
  renderToStaticMarkup(<ReviewBarChart buckets={makeBuckets(counts)} />);

const svgOf = (html: string): string => /<svg[\s\S]*<\/svg>/.exec(html)?.[0] ?? '';

describe('ReviewBarChart render', () => {
  it('uses only svg, rect and text elements inside the SVG', () => {
    const svg = svgOf(render([1, 2, 3, 4, 5, 6, 7]));
    expect(svg).not.toBe('');
    const inner = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
    const tags = new Set([...inner.matchAll(/<\/?([a-zA-Z][\w-]*)/g)].map((m) => m[1]));
    expect([...tags].sort()).toEqual(['rect', 'text']);
    expect(svg.match(/<svg/g)).toHaveLength(1);
  });

  it('exposes the SVG as an image with an aria-label stating the total', () => {
    const svg = svgOf(render([1, 2, 3, 4, 5, 6, 7]));
    expect(svg).toContain('role="img"');
    expect(svg).toMatch(/aria-label="[^"]*28 in total[^"]*"/);
  });

  it('renders a sr-only table with a caption, header and 7 body rows', () => {
    const html = render([1, 0, 3, 0, 5, 0, 7]);
    const table = /<table class="sr-only">[\s\S]*<\/table>/.exec(html)?.[0] ?? '';
    expect(table).not.toBe('');
    expect(table).toContain('<caption>');
    for (const h of ['Day', 'Reviews', 'Correct']) expect(table).toContain(`>${h}</th>`);
    const body = /<tbody>([\s\S]*)<\/tbody>/.exec(table)?.[1] ?? '';
    expect(body.match(/<tr>/g)).toHaveLength(7);
  });

  it('shows the empty message only when every count is 0', () => {
    const msg = 'No reviews in the last 7 days';
    expect(render([0, 0, 0, 0, 0, 0, 0])).toContain(msg);
    expect(render([0, 0, 0, 0, 0, 0, 1])).not.toContain(msg);
  });

  it('renders a zero count as a zero-height bar and the max as a taller one', () => {
    const html = render([0, 4, 0, 0, 0, 0, 2]);
    const heights = [...html.matchAll(/<rect class="chart-bar"[^>]*?height="([\d.]+)"/g)].map(
      (m) => Number(m[1]),
    );
    expect(heights).toHaveLength(7);
    expect(heights[0]).toBe(0);
    expect(heights[2]).toBe(0);
    expect(heights[1]).toBeGreaterThan(heights[6]);
    expect(heights[6]).toBeGreaterThan(0);
  });

  it('renders all-zero counts as seven zero-height bars', () => {
    const html = render([0, 0, 0, 0, 0, 0, 0]);
    const heights = [...html.matchAll(/<rect class="chart-bar"[^>]*?height="([\d.]+)"/g)].map(
      (m) => Number(m[1]),
    );
    expect(heights).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });
});
