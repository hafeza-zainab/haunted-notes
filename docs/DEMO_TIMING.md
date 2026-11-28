# Demo timing: subtitles and narration clips
Branch `demo-pitch`. Numbers come from the script data (`src/lib/demoScript.ts`), the manifest (`public/demo-audio/manifest.json`: all nine clips re-measured with `audio.duration` in Chromium, cue times placed from quiet gaps in the WAV files), and full runs in Chromium through the Playwright MCP (dev server). **Nothing here was heard**: headless Chromium has no speaker. Times are in seconds at normal speed.

## What changed in this round
Chapter 1 is now "the problem": it plays over the real dashboard loaded with demo data from second 0, with no title card. Chapters 5 and 9 follow the new narration. The sample texts are filled in at once instead of typed, and no step waits with nothing on screen: the last highlight, click or fill of a step is extended to the step's end. The other six clips are unchanged.

## Chapters and clips
| Ch | Chapter | Start | Chapter length | Clip | Headroom | Subtitles |
|---|---|---|---|---|---|---|
| 1 | The problem | 0.00 s | 15.30 s | 13.84 s | 1.46 s | 6 |
| 2 | Four inputs | 15.30 s | 21.70 s | 20.24 s | 1.46 s | 7 |
| 3 | Ghost rooms | 37.00 s | 12.50 s | 11.04 s | 1.46 s | 4 |
| 4 | The quiz | 49.50 s | 25.40 s | 21.68 s | 3.72 s | 7 |
| 5 | Spaced repetition | 74.90 s | 17.60 s | 14.40 s | 3.20 s | 5 |
| 6 | Study insights | 92.50 s | 8.20 s | 6.80 s | 1.40 s | 3 |
| 7 | Your data stays yours | 100.70 s | 8.60 s | 7.12 s | 1.48 s | 3 |
| 8 | Built with Kiro | 109.30 s | 12.60 s | 11.12 s | 1.48 s | 3 |
| 9 | Try it yourself | 121.90 s | 8.36 s | 6.96 s | 1.40 s | 4 |

Script total: **130.26 s (2:10)**, 42 steps. Measured: 132.0 to 132.1 s from the click to the bar closing (the extra 0.7 to 0.8 s is the wait for the first sound). The clips total 113.20 s. A test requires the run to be at most 170 s and at least as long as all clips together, and every chapter to be at least its clip plus 0.4 s margin plus 1 s start-up allowance.

The prompt asked for 140 to 170 s. The run is 130.3 s. Reaching 140 s would need about 10 s of silent padding, which the same prompt forbids, so the floor in the test stays at 115 s.

## Every subtitle, with its start
`Cue` is where the phrase starts inside the clip. `Shown` is when the caption appears, counted from the chapter start. Chapter 1 captions appear exactly at the cue (the clock starts when the audio clock moves); other chapters add 0.1 s. Cues marked (est.) are splits inside one phrase with no quiet gap, placed by word count. The captions are the narration words, not the shorter captions in the prompt (for example, chapter 1 has 6 captions, not 4), because the user had reported captions that did not match the audio.
| Ch | Cue | Shown | Subtitle (exactly the narration) |
|---|---|---|---|
| 1 | 0.00 | 0.00 | Taking notes is easy. |
| 1 | 1.85 | 1.85 | Knowing what to revise, |
| 1 | 3.45 | 3.45 | and when, across many subjects, is the hard part. |
| 1 | 7.25 | 7.25 | Haunted Notes turns your notes into ghosts |
| 1 | 9.50 | 9.50 | and remembers the revision schedule for you. |
| 1 | 12.15 | 12.15 | You only have to remember the answers. |
| 2 | 0.00 | 0.00 | Add notes four ways. |
| 2 | 1.85 | 2.00 | Type them, speak with your microphone, |
| 2 | 4.20 | 4.30 | snap a photo of printed text, or upload an audio recording. |
| 2 | 8.10 | 8.20 | Audio files and photos are processed on your own device, |
| 2 | 11.25 | 11.35 | and the live microphone uses your browser's speech service. |
| 2 | 14.50 | 14.60 | Each note is split into fill-in-the-blank flashcards, |
| 2 | 17.40 | 17.50 | so even a long lecture becomes a short set of questions. |
| 3 | 0.00 | 0.00 | Every note becomes a haunted room. |
| 3 | 2.30 | 2.40 | Each flashcard you have not mastered is a ghost, |
| 3 | 5.25 | 5.35 | and the weaker your memory of it, the more menacing it looks. |
| 3 | 8.45 | 8.55 | The meter at the top shows how crowded your haunting is. |
| 4 | 0.00 | 0.00 | Start a quiz and fill in each blank. |
| 4 | 2.75 | 2.85 | Stuck? Ask for a hint, or reveal the answer. |
| 4 | 6.10 | 6.20 | A wrong answer breaks your quiz streak and sends the ghost |
| 4 | 8.70 (est.) | 8.80 | back to the start of its review ladder. |
| 4 | 11.20 | 11.30 | A right answer banishes it. Small typos on long words are forgiven, |
| 4 | 15.60 | 15.70 | and the answer is never hidden in the page before you respond. |
| 4 | 18.80 | 18.90 | When the round ends, review only the cards you missed. |
| 5 | 0.00 | 0.00 | Banished ghosts do not stay gone. |
| 5 | 2.40 | 2.50 | A fixed ladder brings each one back after |
| 5 | 4.90 | 5.00 | two, three, five, then seven days, |
| 5 | 8.65 | 8.75 | so you never track dates yourself. |
| 5 | 10.70 | 10.80 | Skip ahead, and the ghosts that are due return, glowing orange. |
| 6 | 0.00 | 0.00 | Your study insights show your day streak, |
| 6 | 2.50 | 2.60 | what you reviewed today, your accuracy this week, |
| 6 | 5.65 | 5.75 | and your weakest rooms. |
| 7 | 0.00 | 0.00 | Your notes live in your browser. |
| 7 | 2.05 | 2.15 | Export a backup any time, and import it back |
| 7 | 4.40 (est.) | 4.50 | with a safety check before anything is merged. |
| 8 | 0.00 | 0.00 | Haunted Notes was built with Kiro, using specs, steering files, hooks, |
| 8 | 4.85 | 4.95 | a custom UI reviewer agent, a Playwright MCP server, |
| 8 | 8.65 | 8.75 | and property-based tests that caught real bugs. |
| 9 | 0.00 | 0.00 | You remember the answers. |
| 9 | 1.64 | 1.74 | Haunted Notes remembers when. |
| 9 | 3.32 | 3.42 | The link and source code are below. |
| 9 | 5.04 | 5.14 | Built for Kiroween 2026. |

## Chapter 1 cues: how they were found
Quiet gaps in the WAV placed the phrase starts. For each stretch the offline Windows recogniser (System.Speech, en-US) was run only to confirm the order of stretches; its text was often wrong and was not used.

## Chapter 5: the silent jump
The new narration no longer says "Ignore them longer, and they look stronger." The script still shows the five-day "ignore" jump at the end of the "Skip ahead" step, in silence, with the label "sample: simulated time jump", because every existing step was to be kept. Decision for the owner: keep it or drop it.

## Measured at 1280 px (before the chapter 1 lead fix)
- Dashboard with 3 rooms and 9 ghosts at 161 ms after the click, no card.
- 42 of 42 caption texts equal their cue texts.
- Caption offset against the audible speech start (measured from audio clocks, not heard): worst 230 ms early, mean 78 ms; chapter 1 captions were about 170 to 200 ms late. The lead was then removed from chapter 1 (commit after `a7539d1`). **UNVERIFIED**: the offset after that fix was not re-measured in a browser.
- Audible start minus scheduled start per clip: about 111 to 250 ms for chapters 2 to 9.
- Chapter 1 sound starts about 0.7 s after the click. This is the first-sound latency (browser audio start) and is a known exception to the 300 ms rule.

## Chapter 9 clip replaced (category name removed)
`chapter-9.wav` was replaced by a new recording: 6.96 s (was 8.00 s), re-measured in Chromium with `audio.duration` (the other eight clips were measured again and are unchanged). The last phrase is now "Built for Kiroween 2026." Cues from the quiet gaps in the WAV (end of each gap): 0, 1.64, 3.32 and 5.04 s. Chapter 9 was cut from 9.40 s to 8.36 s (clip + 0.4 s margin + 1 s start-up allowance), because the no-idle test would fail with 1.04 s of silent tail. The fit report passes for all nine chapters (the `every clip fits its chapter` tests). The 1280 and 390 px runs in the sections above were made with the old chapter 9 clip and were **not repeated**: UNVERIFIED for the new clip. Nothing was heard.
