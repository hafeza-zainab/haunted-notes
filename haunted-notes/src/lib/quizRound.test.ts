import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { nextStreak, addMissed } from './quizRound';

describe('nextStreak', () => {
  it('a correct answer adds one, a wrong one resets to zero', () => {
    fc.assert(
      fc.property(fc.nat(1000), (s) => {
        expect(nextStreak(s, true)).toBe(s + 1);
        expect(nextStreak(s, false)).toBe(0);
      }),
    );
  });

  it('after any run of answers the streak equals the trailing run of corrects', () => {
    fc.assert(
      fc.property(fc.array(fc.boolean(), { maxLength: 40 }), (answers) => {
        const streak = answers.reduce(nextStreak, 0);
        let trailing = 0;
        for (let i = answers.length - 1; i >= 0 && answers[i]; i--) trailing++;
        expect(streak).toBe(trailing);
      }),
    );
  });
});

describe('addMissed', () => {
  it('keeps each id once, in order of first miss', () => {
    fc.assert(
      fc.property(fc.array(fc.constantFrom('a', 'b', 'c', 'd'), { maxLength: 30 }), (ids) => {
        const missed = ids.reduce<string[]>((acc, id) => addMissed(acc, id), []);
        expect(missed).toEqual([...new Set(ids)]);
      }),
    );
  });

  it('does not mutate its input', () => {
    const before = ['a'];
    addMissed(before, 'b');
    expect(before).toEqual(['a']);
  });
});
