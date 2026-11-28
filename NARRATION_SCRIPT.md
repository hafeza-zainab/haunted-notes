# Narration script for the Haunted Notes demo (text-to-speech, no human voice)

Use this with the self-playing "Run demo" recording (video cut, about 2:12).
Narration speaks about 70 percent of each chapter, so there is room for the on-screen actions. Keep the on-screen captions too: they help judges who watch with sound off.

## How to turn it into audio (free)
1. Generate one audio clip per chapter (not one long file). Clipchamp (free, built into Windows) has a built-in text-to-speech tool. Pick a calm, neutral voice at normal speed. Check the tool's terms say the audio can be used in a public video.
2. Record the demo at 1x speed with OBS or Game Bar. No music. No microphone.
3. In the editor, put each clip at the start time of its chapter. Exact start times will be in `docs/DEMO_TIMING.md` once Kiro measures them. Until then use the planned times below.
4. Trim the end of each clip so it finishes before the next chapter starts. If a clip is too long, shorten the text instead of speeding the voice up.
5. Export as 1080p MP4, upload public to YouTube, confirm it is under 3:00.

## Script (read exactly as written)

| # | Planned start | Words | Narration |
|---|---|---|---|
| 1 The problem | 0:00 | 38 | Taking notes is easy. Knowing what to revise, and when, across many subjects, is the hard part. Haunted Notes turns your notes into ghosts and remembers the revision schedule for you. You only have to remember the answers. |
| 2 Four inputs | 0:06 | 65 | Add notes four ways. Type them, speak with your microphone, snap a photo of printed text, or upload an audio recording. Audio files and photos are processed on your own device, and the live microphone uses your browser's speech service. Each note is split into fill-in-the-blank flashcards, so even a long lecture becomes a short set of questions. |
| 3 Ghost rooms | 0:36 | 38 | Every note becomes a haunted room. Each flashcard you have not mastered is a ghost, and the weaker your memory of it, the more menacing it looks. The meter at the top shows how crowded your haunting is. |
| 4 The quiz | 0:51 | 80 | Start a quiz and fill in each blank. Stuck? Ask for a hint, or reveal the answer. A wrong answer breaks your quiz streak and sends the ghost back to the start of its review ladder. A right answer banishes it. Small typos on long words are forgiven, and the answer is never hidden in the page before you respond. When the round ends, review only the cards you missed. |
| 5 Spaced repetition | 1:36 | 37 | Banished ghosts do not stay gone. A fixed ladder brings each one back after two, three, five, then seven days, so you never track dates yourself. Skip ahead, and the ghosts that are due return, glowing orange. |
| 6 Insights | 1:51 | 21 | Your study insights show your day streak, what you reviewed today, your accuracy this week, and your weakest rooms. |
| 7 Your data | 2:01 | 24 | Your notes live in your browser. Export a backup any time, and import it back with a safety check before anything is merged. |
| 8 Built with Kiro | 2:11 | 28 | Haunted Notes was built with Kiro, using specs, steering files, hooks, a custom UI reviewer agent, a Playwright MCP server, and property-based tests that caught real bugs. |
| 9 End | 2:23 | 17 | You remember the answers. Haunted Notes remembers when. The link and source code are below. Kiroween 2026, Frankenstein. |

Total about 340 words, roughly 2 minutes 15 seconds of speech at a normal pace. The demo now runs about 2:12 (131.3 s of script, measured 132 s in `docs/DEMO_TIMING.md`). The start times in the table above are old; `docs/DEMO_TIMING.md` is the source for the real start of every chapter.
Note: "quiz streak" (chapter 4) is the counter in the quiz header. "Day streak" (chapter 6) counts days with at least one review. They are different, so keep both words as written.

## Pitch update (Nov 27): what changed and what to regenerate
- Only chapters **1, 5 and 9** changed. Generate new clips for those three, export WAV, and overwrite `chapter-1.wav`, `chapter-5.wav` and `chapter-9.wav` in `haunted-notes/public/demo-audio/`. Leave the other six clips alone.
- Chapter 1 is now the problem and the promise, spoken over the real dashboard (see KIRO_DEMO_PITCH_PROMPT.md), so the project is working from second 0.
- The review method is the **2-3-5-7 day ladder** (reviews on days 2, 5, 10 and 17). Never say "1-3-7" in the video, the README or the Devpost page.
- Do not claim other apps lack scheduling (some flashcard apps do schedule reviews). The pitch is that the hard part is tracking what to revise, and when, across many subjects, and that Haunted Notes does it for you.
- Chapter 8 (Built with Kiro): record a 12 to 15 second clip of the real Kiro IDE (the `.kiro` folder with steering, a spec, the Agent Hooks panel, the custom agent, a passing test run) and splice it over that chapter in the video. Keep the narration as written.

## Accuracy rules
- Say only what is on screen at that moment. If a chapter in the final demo changes, change its narration to match.
- Do not say "works offline" unless the demo shows it. Do not say "no data leaves your device": the live microphone uses the browser's speech service, and the first photo scan downloads its engine files.
- The Kiro line must match docs/KIRO_EVIDENCE.md. Remove anything not in that file.

## Optional follow-up prompt for Kiro (paste after the main demo prompt is finished and merged or verified)
```
RULES: current branch only, never push, run lint, tests and build before each commit,
never weaken tests, mark anything not run as UNVERIFIED, log it in KIRO_LOG.md.

1. Write docs/DEMO_TIMING.md: the measured start and end second of every demo chapter
   at 1x speed (from a real Playwright run), the total length, and every caption with
   its start second.
2. Add a second mode: "Full walkthrough" (about 4 to 5 minutes) next to "Run demo"
   (the video cut). Full adds: each Add Note tab explained with its privacy note;
   the import dialog's summary text shown with a sample (no real file, no download);
   a caption card about the installed offline build; mobile and accessibility cards;
   and one caption card per Kiro feature used (taken only from docs/KIRO_EVIDENCE.md).
   URL ?demo=1 plays the video cut, ?demo=full plays the full walkthrough.
3. Same data-safety, no-network and no-download rules. Update the tests, verify both
   modes with the Playwright MCP, and measure both totals.
```
