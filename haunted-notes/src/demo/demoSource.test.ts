import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/** Files that make up the script and its runner. */
const FILES = [
  '../lib/demoScript.ts',
  '../lib/demoSnapshot.ts',
  '../lib/demoNarration.ts',
  '../lib/demoNarrator.ts',
  './domActions.ts',
  './runner.ts',
  '../components/DemoStartPrompt.tsx',
];

const read = (f: string) => readFileSync(new URL(f, import.meta.url), 'utf8');

/** Strip comments so the rules below judge code, not prose. */
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const FORBIDDEN: [string, RegExp][] = [
  ['fetch', /\bfetch\s*\(/],
  ['window.open', /window\.open\b/],
  ['URL.createObjectURL', /createObjectURL/],
  ['XMLHttpRequest', /XMLHttpRequest/],
  ['sendBeacon', /sendBeacon/],
  ['WebSocket', /WebSocket/],
  ['dynamic import()', /\bimport\s*\(/],
  ['Whisper module', /useWhisper|whisper\.worker|@huggingface|from\s+['"][^'"]*whisper/i],
  ['Tesseract module', /tesseract|loadOcrEngine|extractTextFromImage|from\s+['"][^'"]*\/ocr['"]/i],
  ['speech module', /from\s+['"][^'"]*\/speech['"]|startSpeechRecognition/],
  ['file chooser', /showOpenFilePicker|showSaveFilePicker|type\s*=\s*['"]file['"]/],
  ['dialogs', /\b(alert|confirm|prompt)\s*\(/],
];

describe('the demo script and runner never touch the network, files or the heavy engines', () => {
  for (const file of FILES) {
    it(`${file} has no forbidden reference`, () => {
      const src = code(read(file));
      for (const [name, re] of FORBIDDEN) {
        expect(re.test(src), `${file} references ${name}`).toBe(false);
      }
    });
  }

  it('the runner reaches elements only through data-demo, never by position', () => {
    const src = code(read('./domActions.ts')) + code(read('./runner.ts'));
    expect(src).not.toMatch(/nth-child|nth-of-type|:first-child|:last-child|getElementsByTagName/);
    expect(src).not.toMatch(/querySelector(All)?\(\s*['"`](?!\[data-demo|\.\$\{HIGHLIGHT_CLASS)/);
  });

  it('the Photo tab skips the OCR load while a run is active', () => {
    const src = read('../components/AddNoteView.tsx');
    expect(src).toMatch(/demoRunning\)\s*\{[\s\S]{0,200}setOcrReady\(true\)[\s\S]{0,40}\}\s*else if \(m === 'photo'/);
  });
});

describe('narration plays only same-origin /demo-audio/ clips', () => {
  const read2 = (f: string) => code(read(f));
  const narrator = read2('../lib/demoNarrator.ts');
  const narration = read2('../lib/demoNarration.ts');
  const runner = read2('./runner.ts');

  it('an Audio element is created only in the runner, with no source argument', () => {
    for (const file of FILES) {
      const src = read2(file);
      const uses = src.match(/new\s+Audio\s*\(([^)]*)\)/g) ?? [];
      if (file === './runner.ts') {
        expect(uses).toEqual(['new Audio()']);
      } else {
        expect(uses, file).toEqual([]);
      }
    }
  });

  it('the only place a source is assigned is the narrator, and only from srcFor', () => {
    expect(narrator).toMatch(/audio\.src\s*=\s*srcFor\(chapter\)/);
    for (const file of FILES) {
      const src = read2(file);
      const assigns = src.match(/\.src\s*=[^=]/g) ?? [];
      expect(assigns.length, file).toBe(file === '../lib/demoNarrator.ts' ? 1 : 0);
    }
  });

  it('the runner hands the narrator narrationSrc, which is always a /demo-audio/ path', () => {
    expect(runner).toMatch(/srcFor:\s*narrationSrc/);
    expect(narration).toMatch(/return\s+`\/demo-audio\/\$\{narrationFile\(chapter\)\}`/);
  });

  it('no script, runner or narration file contains an absolute or protocol-relative URL', () => {
    for (const file of FILES) {
      const src = read2(file);
      expect(src, file).not.toMatch(/['"`]\s*(https?:)?\/\/[a-z0-9]/i);
      expect(src, file).not.toMatch(/https?:\/\//i);
    }
  });

  it('there is no <audio> tag, Web Audio graph or media-source path that could load something else', () => {
    for (const file of FILES) {
      const src = read2(file);
      expect(src, file).not.toMatch(/<audio\b|AudioContext|createMediaElementSource|MediaSource|srcObject|SpeechSynthesis/);
    }
  });

  it('the audio files are never read through the browser APIs the scan bans', () => {
    // fetch, XMLHttpRequest, createObjectURL and window.open stay forbidden in every file above.
    for (const file of FILES) {
      const src = read2(file);
      expect(src, file).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|createObjectURL|window\.open/);
    }
  });
});

describe('the first clip starts inside the click and the run waits for its sound', () => {
  const runner = code(read('./runner.ts'));

  it('starts chapter 1 before any await, then waits a bounded time for the sound', () => {
    const start = runner.indexOf('narrator.chapterStarted(0, 0, 0)');
    const wait = runner.indexOf('await waitForFirstSound(FIRST_SOUND_WAIT_MS)');
    expect(start).toBeGreaterThan(-1);
    expect(wait).toBeGreaterThan(start);
    // Nothing is awaited between the start of startDemo and the first play(): it stays inside the click.
    const head = runner.slice(runner.indexOf('export async function startDemo'), start);
    expect(head).not.toMatch(/\bawait\b/);
    const limit = Number(runner.match(/FIRST_SOUND_WAIT_MS\s*=\s*(\d+)/)?.[1]);
    expect(limit).toBeGreaterThan(0);
    expect(limit).toBeLessThanOrEqual(2000);
  });

  it('waits for the audio clock to move, and stops at once on an error or after a limit, so a missing clip never holds the run', () => {
    // The playing event comes 0.2 to 0.3 s before sound; the clock (currentTime) is what moves with it.
    expect(runner).toMatch(/audio\.currentTime\s*>\s*FIRST_SOUND_CLOCK_S/);
    expect(runner).toMatch(/performance\.now\(\)\s*-\s*started\s*>=\s*ms/);
    expect(runner).toMatch(/addEventListener\('error', done\)/);
    const clock = Number(runner.match(/FIRST_SOUND_CLOCK_S\s*=\s*([0-9.]+)/)?.[1]);
    expect(clock).toBeGreaterThan(0);
    expect(clock).toBeLessThan(0.2);
  });
});