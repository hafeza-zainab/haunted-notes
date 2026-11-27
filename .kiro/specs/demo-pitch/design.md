# Design: the problem pitch in Run demo

## Cues from the new clips
Measured as before (quiet gaps in the WAV, 50 ms windows, rms below 350), and the words of every stretch of speech were then recognised per stretch with the offline Windows recogniser (System.Speech, en-US) on each stretch cut out alone. That settled the splits that gap length and syllable counts could not (for example "Knowing what to revise," | "and when, across many subjects," | "is the hard part.", and "two," | "three," | "five," | "then seven days," in chapter 5). The recogniser misheard some words, so only the order of the stretches was used, never its text.

| Chapter | Clip | Captions (start in the clip) |
|---|---|---|
| 1 | 13.84 s | 0.00 Taking notes is easy. / 1.85 Knowing what to revise, / 3.45 and when, across many subjects, is the hard part. / 7.25 Haunted Notes turns your notes into ghosts / 9.50 and remembers the revision schedule for you. / 12.15 You only have to remember the answers. |
| 5 | 14.40 s | 0.00 Banished ghosts do not stay gone. / 2.40 A fixed ladder brings each one back after / 4.90 two, three, five, then seven days, / 8.65 so you never track dates yourself. / 10.70 Skip ahead, and the ghosts that are due return, glowing orange. |
| 9 | 8.00 s | 0.00 You remember the answers. / 1.60 Haunted Notes remembers when. / 3.35 The link and source code are below. / 5.40 Kiroween 2026, Frankenstein. |

Why not the prompt's captions ("Knowing when to revise is hard.", "No dates to track: the ladder returns each ghost."): they are not what the voice says, and the previous round was fixing exactly that complaint. The prompt's meaning is kept: the ladder line is its own caption, and the closing line is the first two captions of chapter 9.

## Script
- `demoScript.ts`: chapter 1 has six steps and no `card`; `INTRO_HOLD_MS` and `END_HOLD_MS` are removed (the chapter length is now the clip plus 1.4 s). `fit()` no longer pads a step with a silent wait: it extends the last highlight or click, and only a card-only step keeps a wait. New action `fill` (instant paste: set the field, then hold).
- Chapter ends (s): 15.3, 21.7, 12.5, 25.4, 17.6, 8.2, 8.6, 12.6, 9.4. Total 131.3 s.
- New `data-demo="quiz-feedback"` on the quiz feedback line, so the wrong-answer message can be outlined instead of waiting.
- `runner.ts`: the run starts by loading the demo data (`loadDemoOnly`) before the first-sound wait, so the dashboard with ghosts is on screen at once. The first-sound wait now ends when the audio clock really moves (`currentTime` above 0.03 s) instead of at the `playing` event, which came 0.2 to 0.3 s before sound.

## Tests
Chapter 1 has no title card and the run starts with the demo data loaded; no step only waits unless it shows a card; chapters other than the quiz and spaced repetition are within 150 ms of the minimum length; the total is 115 to 170 s and at least the sum of the clips; captions equal the narration (new text); cues agree with the audio; sample texts are filled at once, not typed.