import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { GHOST_TYPES, LEVEL_NAMES, ghostTypeFor, hauntedLevel } from './haunt';
import { isBanished } from './srs';

const NOW = 1_700_000_000_000;
const DAY = 86_400_000;

// A card the app can really produce: new/haunting (reps 0) or scheduled (reps > 0).
const cardArb = fc
  .record({
    weaknessScore: fc.double({ min: 0, max: 1, noNaN: true }),
    reps: fc.integer({ min: 0, max: 6 }),
    dueOffsetDays: fc.integer({ min: -5, max: 30 }),
  })
  .map(({ weaknessScore, reps, dueOffsetDays }) => ({
    weaknessScore,
    reps,
    ease: 2.5,
    intervalDays: reps,
    dueAt: NOW + dueOffsetDays * DAY,
  }));

const cardsArb = fc.array(cardArb, { maxLength: 30 });

describe('ghostTypeFor', () => {
  it('maps every weakness (and out-of-range input) to one of the five types', () => {
    fc.assert(
      fc.property(fc.double({ noNaN: false }), (w) => {
        expect(GHOST_TYPES).toContain(ghostTypeFor(w));
      }),
    );
  });

  it('never goes to a weaker type as weakness grows', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (a, b) => {
          const [lo, hi] = a <= b ? [a, b] : [b, a];
          expect(GHOST_TYPES.indexOf(ghostTypeFor(lo))).toBeLessThanOrEqual(
            GHOST_TYPES.indexOf(ghostTypeFor(hi)),
          );
        },
      ),
    );
  });

  it('uses the documented band edges', () => {
    expect(ghostTypeFor(0)).toBe('wisp');
    expect(ghostTypeFor(0.19)).toBe('wisp');
    expect(ghostTypeFor(0.2)).toBe('ghoul');
    expect(ghostTypeFor(0.4)).toBe('banshee');
    expect(ghostTypeFor(0.6)).toBe('phantom');
    expect(ghostTypeFor(0.8)).toBe('poltergeist');
    expect(ghostTypeFor(1)).toBe('poltergeist');
  });

  it('reaches all five types', () => {
    const seen = new Set([0.05, 0.3, 0.5, 0.7, 0.95].map(ghostTypeFor));
    expect(seen.size).toBe(5);
  });
});

describe('hauntedLevel', () => {
  it('an empty room is calm', () => {
    const level = hauntedLevel([], NOW);
    expect(level.tier).toBe(0);
    expect(level.name).toBe(LEVEL_NAMES[0]);
    expect(level.weakCount).toBe(0);
  });

  it('the tier is always 0 to 4 and the name matches it', () => {
    fc.assert(
      fc.property(cardsArb, (cards) => {
        const level = hauntedLevel(cards, NOW);
        expect([0, 1, 2, 3, 4]).toContain(level.tier);
        expect(level.name).toBe(LEVEL_NAMES[level.tier]);
      }),
    );
  });

  it('banished ghosts never count', () => {
    fc.assert(
      fc.property(cardsArb, (cards) => {
        const onlyBanished = cards.filter((c) => isBanished(c, NOW));
        expect(hauntedLevel(onlyBanished, NOW).tier).toBe(0);
      }),
    );
  });

  it('adding a ghost never lowers the level', () => {
    fc.assert(
      fc.property(cardsArb, cardArb, (cards, extra) => {
        expect(hauntedLevel([...cards, extra], NOW).tier).toBeGreaterThanOrEqual(
          hauntedLevel(cards, NOW).tier,
        );
      }),
    );
  });

  it('banishing a ghost never raises the level', () => {
    fc.assert(
      fc.property(cardsArb, fc.nat(), (cards, pick) => {
        if (cards.length === 0) return;
        const i = pick % cards.length;
        const banished = cards.map((c, idx) =>
          idx === i ? { ...c, reps: 1, dueAt: NOW + 3 * DAY } : c,
        );
        expect(hauntedLevel(banished, NOW).tier).toBeLessThanOrEqual(
          hauntedLevel(cards, NOW).tier,
        );
      }),
    );
  });

  it('weakCount only counts unbanished ghosts with weakness of at least 0.5', () => {
    fc.assert(
      fc.property(cardsArb, (cards) => {
        const expected = cards.filter(
          (c) => !isBanished(c, NOW) && c.weaknessScore >= 0.5,
        ).length;
        expect(hauntedLevel(cards, NOW).weakCount).toBe(expected);
      }),
    );
  });
});
