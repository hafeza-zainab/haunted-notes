import React from 'react';
import { barHeights } from '../lib/insights';
import type { DayBucket } from '../lib/insights';

const VIEW_W = 280;
const VIEW_H = 120;
const PLOT_TOP = 20; // room for count labels above the tallest bar
const PLOT_H = 76;
const BASE_Y = PLOT_TOP + PLOT_H; // 96
const COL_W = VIEW_W / 7;
const BAR_W = 24;

interface Props {
  buckets: DayBucket[];
}

/**
 * Reviews per day for the last 7 days. Plain SVG (svg, rect, text only), no
 * animation. Counts are printed as text and repeated in a visually hidden
 * table, so no value relies on bar height or colour alone.
 */
const ReviewBarChart: React.FC<Props> = ({ buckets }) => {
  const counts = buckets.map((b) => b.reviews);
  const total = counts.reduce((a, b) => a + b, 0);
  const heights = barHeights(counts, PLOT_H);

  return (
    <div className="insights-chart">
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        role="img"
        aria-label={`Reviews per day, last 7 days: ${total} in total`}
      >
        <rect
          className="chart-baseline"
          x={0}
          y={BASE_Y}
          width={VIEW_W}
          height={2}
        />
        {buckets.map((b, i) => {
          const cx = i * COL_W + COL_W / 2;
          const h = heights[i] ?? 0;
          return (
            <React.Fragment key={b.dayKey}>
              <rect
                className="chart-bar"
                x={cx - BAR_W / 2}
                y={BASE_Y - h}
                width={BAR_W}
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
