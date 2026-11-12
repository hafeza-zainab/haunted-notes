import React from 'react';

/**
 * Fixed drift vectors (px) and delays (ms) for the particles a banished ghost
 * dissolves into. Fixed on purpose: no randomness during render.
 */
const PARTICLES = [
  { dx: -46, dy: -58, delay: 0,   size: 7 },
  { dx: 38,  dy: -70, delay: 60,  size: 5 },
  { dx: -18, dy: -90, delay: 120, size: 6 },
  { dx: 56,  dy: -36, delay: 40,  size: 4 },
  { dx: -62, dy: -26, delay: 100, size: 5 },
  { dx: 12,  dy: -104, delay: 160, size: 4 },
  { dx: 24,  dy: -50, delay: 20,  size: 6 },
] as const;

/**
 * A few specks that drift up and fade as a ghost dissolves. Decorative only
 * (aria-hidden); the "Banished!" message carries the meaning. Hidden under
 * prefers-reduced-motion.
 */
const BanishParticles: React.FC = () => (
  <span className="banish-particles" aria-hidden="true">
    {PARTICLES.map((p, i) => (
      <span
        key={i}
        className="banish-particle"
        style={
          {
            '--dx': `${p.dx}px`,
            '--dy': `${p.dy}px`,
            '--delay': `${p.delay}ms`,
            '--size': `${p.size}px`,
          } as React.CSSProperties
        }
      />
    ))}
  </span>
);

export default BanishParticles;
