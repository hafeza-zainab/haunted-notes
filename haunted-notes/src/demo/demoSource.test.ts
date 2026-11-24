import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/** Files that make up the script and its runner. */
const FILES = ['../lib/demoScript.ts', '../lib/demoSnapshot.ts', './domActions.ts', './runner.ts'];

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
