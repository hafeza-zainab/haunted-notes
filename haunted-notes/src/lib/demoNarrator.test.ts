import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { SEEK_THRESHOLD_MS, createNarrator, type AudioLike } from './demoNarrator';
import { narrationSrc } from './demoNarration';

/** A fake audio element that records overlap: a source swapped while still playing. */
class FakeAudio implements AudioLike {
  private source = '';
  currentTime = 0;
  paused = true;
  ended = false;
  playCalls: string[] = [];
  violations = 0;
  loads = 0;
  /** Decides what play() does for a source: resolve (null) or reject with this error. */
  failWith: (src: string) => { name: string } | null = () => null;
  /** When set, play() waits for this promise before settling (to test late results). */
  gate: Promise<void> | null = null;

  get src(): string {
    return this.source;
  }
  set src(v: string) {
    if (!this.paused && this.source !== '') this.violations++;
    this.source = v;
    this.currentTime = 0;
    this.ended = false;
  }
  play(): Promise<void> {
    const err = this.failWith(this.source);
    const src = this.source;
    this.playCalls.push(src);
    this.paused = false;
    const gate = this.gate;
    return (gate ?? Promise.resolve()).then(() => {
      if (err) {
        this.paused = true;
        return Promise.reject(Object.assign(new Error(err.name), { name: err.name }));
      }
    });
  }
  pause(): void {
    this.paused = true;
  }
  removeAttribute(): void {
    this.source = '';
  }
  load(): void {
    this.loads++;
    this.paused = true;
  }
  /** The clip played to its end: paused and ended become true. */
  finish(): void {
    this.paused = true;
    this.ended = true;
  }
}

function setup(sound = true) {
  const audio = new FakeAudio();
  let unavailable = 0;
  const n = createNarrator({
    audio,
    srcFor: narrationSrc,
    sound,
    onUnavailable: () => void unavailable++,
  });
  return { audio, n, count: () => unavailable };
}

const flush = () => new Promise<void>((r) => setTimeout(r, 0));

describe('start offsets', () => {
  it('starts the clip of a chapter from 0 at its scheduled start', () => {
    const { audio, n } = setup();
    n.chapterStarted(2, 36_900, 36_920);
    expect(audio.src).toBe('/demo-audio/chapter-3.wav');
    expect(audio.currentTime).toBe(0);
    expect(audio.paused).toBe(false);
  });

  it('turning sound on later starts at the exact offset into the chapter', () => {
    const { audio, n } = setup(false);
    n.chapterStarted(2, 36_900, 36_900);
    expect(audio.playCalls).toHaveLength(0);
    n.setSound(true, 40_900);
    expect(audio.src).toBe('/demo-audio/chapter-3.wav');
    expect(audio.currentTime).toBeCloseTo(4, 10);
    expect(audio.paused).toBe(false);
  });

  it(`an offset under ${SEEK_THRESHOLD_MS} ms starts from the very beginning`, () => {
    const { audio, n } = setup(false);
    n.chapterStarted(0, 0, 0);
    n.setSound(true, SEEK_THRESHOLD_MS - 1);
    expect(audio.currentTime).toBe(0);
  });
});

describe('pause and resume', () => {
  it('Pause pauses the audio and Resume plays the same clip without restarting it', () => {
    const { audio, n } = setup();
    n.chapterStarted(0, 0, 0);
    audio.currentTime = 2.5; // the clip has played for 2.5 s
    n.pause(2500);
    expect(audio.paused).toBe(true);
    n.resume(2500);
    expect(audio.paused).toBe(false);
    expect(audio.currentTime).toBe(2.5);
    expect(audio.playCalls).toEqual(['/demo-audio/chapter-1.wav', '/demo-audio/chapter-1.wav']);
  });

  it('a clip that already finished is not restarted by Pause then Resume', () => {
    const { audio, n } = setup();
    n.chapterStarted(0, 0, 0);
    audio.finish();
    n.pause(9000);
    n.resume(9000);
    expect(audio.playCalls).toHaveLength(1);
    expect(audio.paused).toBe(true);
  });

  it('sound turned on while paused waits for Resume, then starts at the right offset', () => {
    const { audio, n } = setup(false);
    n.chapterStarted(1, 6000, 6000);
    n.pause(10_000);
    n.setSound(true, 10_000);
    expect(audio.playCalls).toHaveLength(0);
    n.resume(10_000);
    expect(audio.src).toBe('/demo-audio/chapter-2.wav');
    expect(audio.currentTime).toBeCloseTo(4, 10);
    expect(audio.paused).toBe(false);
  });
});

describe('no overlap', () => {
  it('the next chapter replaces the clip; the old one is paused first', () => {
    const { audio, n } = setup();
    n.chapterStarted(0, 0, 0);
    n.chapterStarted(1, 6000, 6000);
    n.chapterStarted(2, 36_900, 36_900);
    expect(audio.violations).toBe(0);
    expect(audio.src).toBe('/demo-audio/chapter-3.wav');
    expect(audio.playCalls).toHaveLength(3);
  });
});

describe('sound off', () => {
  it('plays nothing and holds nothing while sound is off', () => {
    const { audio, n } = setup(false);
    n.chapterStarted(0, 0, 0);
    n.chapterStarted(1, 6000, 6000);
    expect(audio.playCalls).toHaveLength(0);
    expect(audio.src).toBe('');
  });

  it('turning sound off mid-clip pauses and releases it', () => {
    const { audio, n } = setup();
    n.chapterStarted(3, 52_400, 52_400);
    n.setSound(false, 60_000);
    expect(audio.paused).toBe(true);
    expect(audio.src).toBe('');
    n.chapterStarted(4, 101_800, 101_800);
    expect(audio.playCalls).toHaveLength(1);
  });
});

describe('stop', () => {
  it('stops, resets and releases the audio, and later events do nothing', () => {
    const { audio, n } = setup();
    n.chapterStarted(3, 52_400, 52_400);
    audio.currentTime = 7;
    n.stop();
    expect(audio.paused).toBe(true);
    expect(audio.currentTime).toBe(0);
    expect(audio.src).toBe('');
    const calls = audio.playCalls.length;
    n.chapterStarted(4, 101_800, 101_800);
    n.resume(1);
    n.setSound(true, 2);
    expect(audio.playCalls).toHaveLength(calls);
    n.stop(); // a second stop is harmless
  });
});

describe('failure is not fatal', () => {
  it('a clip that cannot play reports unavailable once and the next chapter still starts', async () => {
    const { audio, n, count } = setup();
    audio.failWith = (src) => (src.endsWith('chapter-2.wav') ? { name: 'NotSupportedError' } : null);
    n.chapterStarted(0, 0, 0);
    n.chapterStarted(1, 6000, 6000);
    await flush();
    expect(count()).toBe(1);
    n.chapterStarted(2, 36_900, 36_900);
    await flush();
    expect(count()).toBe(1);
    expect(audio.src).toBe('/demo-audio/chapter-3.wav');
    expect(audio.paused).toBe(false);
  });

  it('reports only once even if several clips fail', async () => {
    const { audio, n, count } = setup();
    audio.failWith = () => ({ name: 'NotAllowedError' });
    n.chapterStarted(0, 0, 0);
    n.chapterStarted(1, 6000, 6000);
    n.chapterStarted(2, 36_900, 36_900);
    await flush();
    expect(count()).toBe(1);
  });

  it('an AbortError (interrupted play) is not a failure', async () => {
    const { audio, n, count } = setup();
    audio.failWith = () => ({ name: 'AbortError' });
    n.chapterStarted(0, 0, 0);
    await flush();
    expect(count()).toBe(0);
  });

  it('a late rejection from a replaced clip is ignored', async () => {
    const { audio, n, count } = setup();
    let release!: () => void;
    audio.gate = new Promise<void>((r) => (release = r));
    audio.failWith = (src) => (src.endsWith('chapter-1.wav') ? { name: 'NotSupportedError' } : null);
    n.chapterStarted(0, 0, 0);
    audio.gate = null;
    n.chapterStarted(1, 6000, 6000); // replaces chapter 1 before its failure arrives
    release();
    await flush();
    expect(count()).toBe(0);
  });

  it('never throws when the audio object throws', () => {
    const throwing: AudioLike = {
      get src() {
        return '';
      },
      set src(_v: string) {
        throw new Error('boom');
      },
      currentTime: 0,
      paused: true,
      ended: false,
      play: () => {
        throw new Error('boom');
      },
      pause: () => {
        throw new Error('boom');
      },
      removeAttribute: () => {
        throw new Error('boom');
      },
      load: () => {
        throw new Error('boom');
      },
    };
    let n = 0;
    const nar = createNarrator({ audio: throwing, srcFor: narrationSrc, sound: true, onUnavailable: () => void n++ });
    expect(() => {
      nar.chapterStarted(0, 0, 0);
      nar.pause(1);
      nar.resume(2);
      nar.setSound(false, 3);
      nar.stop();
    }).not.toThrow();
    expect(n).toBe(1);
  });

  it('a throwing onUnavailable callback does not break the narrator', async () => {
    const audio = new FakeAudio();
    audio.failWith = () => ({ name: 'NotSupportedError' });
    const n = createNarrator({
      audio,
      srcFor: narrationSrc,
      sound: true,
      onUnavailable: () => {
        throw new Error('ui bug');
      },
    });
    n.chapterStarted(0, 0, 0);
    await flush();
    expect(() => n.stop()).not.toThrow();
  });
});

describe('properties over any sequence of events', () => {
  type Ev =
    | { k: 'start'; chapter: number }
    | { k: 'pause' }
    | { k: 'resume' }
    | { k: 'sound'; on: boolean }
    | { k: 'finish' }
    | { k: 'stop' };

  const evArb: fc.Arbitrary<Ev> = fc.oneof(
    fc.record({ k: fc.constant('start' as const), chapter: fc.integer({ min: 0, max: 8 }) }),
    fc.constant({ k: 'pause' as const }),
    fc.constant({ k: 'resume' as const }),
    fc.record({ k: fc.constant('sound' as const), on: fc.boolean() }),
    fc.constant({ k: 'finish' as const }),
    fc.constant({ k: 'stop' as const }),
  );

  it('at most one clip plays, and only when sound is on, the run is not paused and it is the current chapter', () => {
    fc.assert(
      fc.property(fc.array(evArb, { maxLength: 40 }), fc.boolean(), (events, startSound) => {
        const { audio, n } = setup(startSound);
        let sound = startSound;
        let paused = false;
        let chapter: number | null = null;
        let stopped = false;
        let now = 0;
        for (const e of events) {
          now += 1000;
          if (e.k === 'start' && !stopped) {
            chapter = e.chapter;
            n.chapterStarted(e.chapter, now, now);
          } else if (e.k === 'pause') {
            paused = !stopped || paused;
            n.pause(now);
          } else if (e.k === 'resume') {
            paused = false;
            n.resume(now);
          } else if (e.k === 'sound') {
            sound = e.on;
            n.setSound(e.on, now);
          } else if (e.k === 'finish') {
            audio.finish();
          } else if (e.k === 'stop') {
            stopped = true;
            n.stop();
          }
          expect(audio.violations).toBe(0);
          expect(audio.currentTime).toBeGreaterThanOrEqual(0);
          if (!audio.paused) {
            expect(stopped).toBe(false);
            expect(sound).toBe(true);
            expect(paused).toBe(false);
            expect(chapter).not.toBeNull();
            expect(audio.src).toBe(narrationSrc(chapter as number));
          }
          if (stopped) {
            expect(audio.paused).toBe(true);
            expect(audio.src).toBe('');
          }
        }
      }),
      { numRuns: 200 },
    );
  });

  it('the source is always one of the nine /demo-audio/ clips or empty', () => {
    fc.assert(
      fc.property(fc.array(evArb, { maxLength: 40 }), (events) => {
        const { audio, n } = setup();
        let now = 0;
        for (const e of events) {
          now += 700;
          if (e.k === 'start') n.chapterStarted(e.chapter, now, now);
          else if (e.k === 'pause') n.pause(now);
          else if (e.k === 'resume') n.resume(now);
          else if (e.k === 'sound') n.setSound(e.on, now);
          else if (e.k === 'finish') audio.finish();
          else n.stop();
          expect(audio.src === '' || /^\/demo-audio\/chapter-[1-9]\.wav$/.test(audio.src)).toBe(true);
        }
      }),
    );
  });
});
