# Design: captions that match the narration

- `public/demo-audio/manifest.json`: each clip has `cues: [{ startMs, text, estimated? }]`. Measured from the WAV (50 ms windows, rms below 350 is quiet); the two splits inside a phrase (quiz "and sends the ghost | back to the start...", data "import it back | with a safety check...") are estimated from word count.
- `src/lib/demoScript.ts`: the steps are built from tables of chapter-relative starts (`T`): each start is its cue plus 100 ms, one start is 150 ms. `lens` turns starts into lengths and `fit` pads a step's actions with a wait so that they last exactly that long (it throws if they are too long, so a mistake shows at load). `sample` on a step is a label for the bar.
- `src/lib/demoTypo.ts`: `typoOf(answer)` replaces the middle letter; unchanged under 6 letters.
- Quiz chapter: the Biology room (`quiz-room-demo-note-biology`, three cards). Card 1: Hint twice, Reveal, Next. Card 2: a wrong answer, Next. Card 3: right answer (typo if long). Results. Review missed and both missed cards answered.
- `src/demo/runner.ts`: `typeAnswerTypo`; publishes `sample`; `setDemoSound` follows the Sound button; the first clip is started in the click and the clock waits for its `playing` event (or an error, or 1.5 s).
- Store: `demoSound`, `setDemoSound`; `answerCard` plays the sounds when `soundEnabled` or (demo running and `demoSound`), at `DEMO_SOUND_SCALE` (0.4) during a run. `demoSound` is never saved.
- `DemoBar`: the sample label is its own line under the chapter, so the chapter line does not wrap (a first version put it in the chapter line and made the bar 285 px tall at 390px; now 225 px).
- `reveal()` scrolls click and type targets into view instantly, because the click follows at once.

## What the tests prove
1. Captions equal the narration, word for word, per chapter, against `NARRATION_SCRIPT.md`.
2. Cue texts equal the narration; caption i equals cue i.
3. Every caption starts 0 to 200 ms after its cue (600 for estimated).
4. Every measured cue is preceded by quiet and followed by speech in the audio file.
5. Every step that types sample text or jumps the clock carries a sample label.
6. A typo of any long word is exactly one edit and judged close; a short word is unchanged.
7. Answer sounds: silent unless the app sound or the demo Sound is on; 0.4 times the volume in a run; reset when the run ends.