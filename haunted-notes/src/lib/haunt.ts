/**
 * src/lib/haunt.ts
 *
 * Pure helpers for the haunting atmosphere: which ghost type a card gets and how
 * "haunted" the whole room is. No React, no Zustand, no DOM.
 */

import type { SrsFields } from '../types';
import { isBanished } from './srs';

// ── Ghost types ──────────────────────────────────────────────────────────────

export const GHOST_TYPES = ['wisp', 'ghoul', 'banshee', 'phantom', 'poltergeist'] as const;
export type GhostType = (typeof GHOST_TYPES)[number];

/**
 * Pick a ghost type from a weakness score. Five equal bands:
 * wisp [0, 0.2), ghoul [0.2, 0.4), banshee [0.4, 0.6), phantom [0.6, 0.8),
 * poltergeist [0.8, 1]. Out-of-range or NaN input is clamped (NaN counts as 0).
 */
export function ghostTypeFor(weakness: number): GhostType {
  const w = Number.isNaN(weakness) ? 0 : Math.min(1, Math.max(0, weakness));
  const index = Math.min(GHOST_TYPES.length - 1, Math.floor(w * GHOST_TYPES.length));
  return GHOST_TYPES[index];
}

// ── Haunted level ────────────────────────────────────────────────────────────

export const LEVEL_NAMES = ['Calm', 'Uneasy', 'Restless', 'Crowded', 'Overrun'] as const;
export type HauntedTier = 0 | 1 | 2 | 3 | 4;

/** A ghost counts as "weak" from this weakness upward. */
const WEAK_FROM = 0.5;

/** Total weakness load at which each tier starts (tier 1 starts at any load > 0). */
const TIER_FROM_LOAD = [0, 3, 6, 10] as const;

export interface HauntedLevel {
  tier: HauntedTier;
  name: (typeof LEVEL_NAMES)[number];
  /** Unbanished ghosts with weakness of at least 0.5. */
  weakCount: number;
  /** Sum of weakness over all unbanished ghosts. */
  load: number;
}

/**
 * How haunted the room is. Only unbanished ghosts count: banishing a ghost can
 * never raise the level, and a new weak ghost can never lower it.
 */
export function hauntedLevel(
  cards: (SrsFields & { weaknessScore: number })[],
  now = Date.now(),
): HauntedLevel {
  let load = 0;
  let weakCount = 0;
  for (const c of cards) {
    if (isBanished(c, now)) continue;
    load += c.weaknessScore;
    if (c.weaknessScore >= WEAK_FROM) weakCount += 1;
  }

  let tier: HauntedTier = 0;
  if (load > 0) tier = 1;
  if (load >= TIER_FROM_LOAD[1]) tier = 2;
  if (load >= TIER_FROM_LOAD[2]) tier = 3;
  if (load >= TIER_FROM_LOAD[3]) tier = 4;

  return { tier, name: LEVEL_NAMES[tier], weakCount, load };
}
