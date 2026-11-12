import React from 'react';
import type { GhostType } from '../lib/haunt';

/**
 * The five ghost bodies, inner SVG only (viewBox 0 0 100 120).
 * Each renders well under 2 KB. Colours come from CSS variables so the
 * "returned" orange tint and the palette tokens still apply.
 */

const BODY = {
  fill: 'var(--ghost-fill)',
  stroke: 'var(--ghost-stroke)',
  strokeWidth: 2,
  strokeLinejoin: 'round',
} as const;
const EYES = { fill: 'var(--ghost-eyes)' } as const;
const VOID = { fill: 'var(--bg)', opacity: 0.85 } as const;

/** Wisp: a small teardrop flame with a curling tail and tiny eyes. */
const Wisp: React.FC = () => (
  <>
    <path
      d="M50 12 C62 32 72 48 70 72 C68 92 60 102 50 110 C40 102 32 92 30 72 C28 48 38 32 50 12 Z"
      {...BODY}
    />
    <path d="M50 110 C44 114 54 116 48 120" fill="none" stroke="var(--ghost-stroke)" strokeWidth={2} strokeLinecap="round" />
    <circle cx="43" cy="64" r="3.5" {...EYES} />
    <circle cx="57" cy="64" r="3.5" {...EYES} />
  </>
);

/** Ghoul: hunched body, jagged hem, hollow tall eyes and a gaping mouth. */
const Ghoul: React.FC = () => (
  <>
    <path
      d="M50 10 C26 10 12 32 12 58 L12 104 L24 94 L36 108 L48 94 L60 108 L72 94 L88 104 L88 58 C88 32 74 10 50 10 Z"
      {...BODY}
    />
    <ellipse cx="36" cy="52" rx="7" ry="11" {...EYES} />
    <ellipse cx="64" cy="52" rx="7" ry="11" {...EYES} />
    <ellipse cx="36" cy="55" rx="3" ry="6" {...VOID} />
    <ellipse cx="64" cy="55" rx="3" ry="6" {...VOID} />
    <ellipse cx="50" cy="80" rx="9" ry="12" {...VOID} />
  </>
);

/** Banshee: long streaming hair, slanted eyes and a wailing mouth. */
const Banshee: React.FC = () => (
  <>
    <path
      d="M50 8 C30 8 20 26 22 46 C14 60 14 84 8 114 C20 104 26 108 32 118 C38 100 44 104 50 118 C56 104 62 100 68 118 C74 108 80 104 92 114 C86 84 86 60 78 46 C80 26 70 8 50 8 Z"
      {...BODY}
    />
    <ellipse cx="37" cy="54" rx="8" ry="4" transform="rotate(18 37 54)" {...EYES} />
    <ellipse cx="63" cy="54" rx="8" ry="4" transform="rotate(-18 63 54)" {...EYES} />
    <ellipse cx="50" cy="78" rx="8" ry="14" {...VOID} />
  </>
);

/** Phantom: a hooded cloak with an empty face and two small bright eyes. */
const Phantom: React.FC = () => (
  <>
    <path
      d="M50 6 C34 6 26 20 26 34 C14 46 10 70 10 112 L24 100 L36 114 L50 100 L64 114 L76 100 L90 112 C90 70 86 46 74 34 C74 20 66 6 50 6 Z"
      {...BODY}
    />
    <ellipse cx="50" cy="48" rx="19" ry="22" {...VOID} />
    <circle cx="42" cy="46" r="4" {...EYES} />
    <circle cx="58" cy="46" r="4" {...EYES} />
  </>
);

/** Poltergeist: a spiky, chaotic star with angry eyes, a zigzag mouth and debris. */
const Poltergeist: React.FC = () => (
  <>
    <path
      d="M50 6 L58 22 L76 14 L72 34 L92 40 L78 54 L90 74 L72 74 L76 98 L58 88 L50 112 L42 88 L24 98 L28 74 L10 74 L22 54 L8 40 L28 34 L24 14 L42 22 Z"
      {...BODY}
    />
    <path d="M28 46 L46 54 M72 46 L54 54" fill="none" stroke="var(--ghost-eyes)" strokeWidth={3.5} strokeLinecap="round" />
    <circle cx="38" cy="60" r="4.5" {...EYES} />
    <circle cx="62" cy="60" r="4.5" {...EYES} />
    <path d="M34 80 L42 74 L50 80 L58 74 L66 80" fill="none" stroke="var(--ghost-eyes)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="14" cy="18" r="2.5" {...EYES} />
    <circle cx="88" cy="102" r="2.5" {...EYES} />
  </>
);

export const GHOST_SHAPES: Record<GhostType, React.FC> = {
  wisp: Wisp,
  ghoul: Ghoul,
  banshee: Banshee,
  phantom: Phantom,
  poltergeist: Poltergeist,
};
