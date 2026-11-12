import React from 'react';
import { ghostTypeFor } from '../lib/haunt';
import { GHOST_SHAPES } from './ghostShapes';

interface GhostSvgProps {
  /** 0 = mastered (fully transparent/small), 1 = totally unknown (full size) */
  weakness: number;
  /** Whether this ghost is being banished right now */
  banishing?: boolean;
  /** Whether this ghost is shaking (wrong answer) */
  shaking?: boolean;
  size?: number;
  label: string;
  /** Extra CSS class(es) appended to the SVG element (e.g. "ghost--returned") */
  className?: string;
}

/**
 * Inline SVG ghost. The weakness score picks the ghost type (wisp, ghoul,
 * banshee, phantom, poltergeist) and still encodes size and opacity.
 * All animations respect prefers-reduced-motion.
 */
const GhostSvg: React.FC<GhostSvgProps> = ({
  weakness,
  banishing = false,
  shaking = false,
  size = 80,
  label,
  className,
}) => {
  const opacity = 0.2 + weakness * 0.8;           // 0.2 → 1.0
  const scale = 0.4 + weakness * 0.6;              // 0.4 → 1.0
  const displaySize = size * scale;

  const type = ghostTypeFor(weakness);
  const Shape = GHOST_SHAPES[type];

  let animClass = 'ghost-float';
  if (banishing) animClass = 'ghost-banish';
  if (shaking) animClass = 'ghost-shake';
  animClass = `${animClass} ghost-type--${type}`;
  if (className) animClass = `${animClass} ${className}`;

  return (
    <svg
      width={displaySize}
      height={displaySize}
      viewBox="0 0 100 120"
      aria-label={label}
      role="img"
      className={animClass}
      style={{ opacity, transition: 'opacity 0.4s, transform 0.4s' }}
    >
      <Shape />
      {/* Glow ring */}
      <ellipse
        cx="50"
        cy="60"
        rx="38"
        ry="42"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1.5"
        opacity={weakness * 0.4}
      />
    </svg>
  );
};

export default GhostSvg;
