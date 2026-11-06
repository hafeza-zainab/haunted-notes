import React from 'react';

interface GhostSvgProps {
  /** 0 = mastered (fully transparent/small), 1 = totally unknown (full size) */
  weakness: number;
  /** Whether this ghost is being banished right now */
  banishing?: boolean;
  /** Whether this ghost is shaking (wrong answer) */
  shaking?: boolean;
  size?: number;
  label: string;
}

/**
 * Inline SVG ghost whose size and opacity encode weakness score.
 * All animations respect prefers-reduced-motion.
 */
const GhostSvg: React.FC<GhostSvgProps> = ({
  weakness,
  banishing = false,
  shaking = false,
  size = 80,
  label,
}) => {
  const opacity = 0.2 + weakness * 0.8;           // 0.2 → 1.0
  const scale = 0.4 + weakness * 0.6;              // 0.4 → 1.0
  const displaySize = size * scale;

  let animClass = 'ghost-float';
  if (banishing) animClass = 'ghost-banish';
  if (shaking) animClass = 'ghost-shake';

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
      {/* Body */}
      <path
        d="M50 10 C20 10 10 35 10 60 L10 110 L22 98 L34 110 L46 98 L58 110 L70 98 L82 110 L90 60 C90 35 80 10 50 10 Z"
        fill="var(--ghost-fill)"
        stroke="var(--ghost-stroke)"
        strokeWidth="2"
      />
      {/* Left eye */}
      <ellipse cx="37" cy="55" rx="8" ry="9" fill="var(--ghost-eyes)" />
      {/* Right eye */}
      <ellipse cx="63" cy="55" rx="8" ry="9" fill="var(--ghost-eyes)" />
      {/* Glow */}
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
