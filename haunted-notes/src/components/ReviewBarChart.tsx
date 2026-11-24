import React, { useLayoutEffect, useRef, useState } from 'react';
import { barHeights } from '../lib/insights';
import type { DayBucket } from '../lib/insights';

/** Widest the chart is drawn (32rem). The viewBox width follows the container up to this, so 1 unit = 1px. */
const MAX_W = 512;
const MIN_W = 240;
const VIEW_H = 120;
const PLOT_TOP = 20; // room for count labels above the tallest bar
const PLOT_H = 76;
const BASE_Y = PLOT_TOP + PLOT_H; // 96
const BAR_MAX = 28;

interface Props {
  buckets: DayBucket[];
}

/**
 * Reviews per day for the last 7 days. Plain SVG (svg, rect, text only), no
 * animation. Counts are printed as text and repeated in a visually hidden
 * table, so no value relies on bar height or colour alone.
 */
const ReviewBarChart: React.FC<Props> = ({ buckets }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [viewW, setViewW] = useState(MAX_W);

  // Draw at the real pixel width so label text keeps its 12px size at every panel width.
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const w = Math.round(el.clientWidth);
      if (w > 0) setViewW(Math.min(MAX_W, Math.max(MIN_W, w)));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const colW = viewW / 7;
  const barW = Math.min(BAR_MAX, Math.round(colW * 0.5));
  const counts = buckets.map((b) => b.reviews);
  const total = counts.reduce((a, b) => a + b, 0);
  const heights = barHeights(counts, PLOT_H);

  return (
    <div className="insights-chart" ref={wrapRef} data-demo="insights-chart">
      <svg
        viewBox={`0 0 ${viewW} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`Reviews per day, last 7 days: ${total} in total`}
      >
        <rect
          className="chart-baseline"
          x={0}
          y={BASE_Y}
          width={viewW}
          height={2}
        />
        {buckets.map((b, i) => {
          const cx = i * colW + colW / 2;
          const h = heights[i] ?? 0;
          return (
            <React.Fragment key={b.dayKey}>
              <rect
                className="chart-bar"
                x={cx - barW / 2}
                y={BASE_Y - h}
                width={barW}
                height={h}
              />
              <text
                className="chart-label chart-count"
                x={cx}
                y={BASE_Y - h - 4}
                textAnchor="middle"
              >
                {b.reviews}
              </text>
              <text
                className="chart-label"
                x={cx}
                y={BASE_Y + 16}
                textAnchor="middle"
              >
                {b.label}
              </text>
            </React.Fragment>
          );
        })}
      </svg>
      <table className="sr-only">
        <caption>Reviews per day, last 7 days</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Reviews</th>
            <th scope="col">Correct</th>
          </tr>
        </thead>
        <tbody>
          {buckets.map((b) => (
            <tr key={b.dayKey}>
              <th scope="row">{b.label}</th>
              <td>{b.reviews}</td>
              <td>{b.correct}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {total === 0 && <p>No reviews in the last 7 days</p>}
    </div>
  );
};

export default ReviewBarChart;
