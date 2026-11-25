# Narration script for the Haunted Notes demo (text-to-speech, no human voice)

Use this with the self-playing "Run demo" recording (video cut, about 2:40).
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
| 1 Intro | 0:00 | 15 | Haunted Notes turns your unfinished notes into ghosts that haunt you until you master them. |
| 2 Four inputs | 0:06 | 65 | Add notes four ways. Type them, speak with your microphone, snap a photo of printed text, or upload an audio recording. Audio files and photos are processed on your own device, and the live microphone uses your browser's speech service. Each note is split into fill-in-the-blank flashcards, so even a long lecture becomes a short set of questions. |
| 3 Ghost rooms | 0:36 | 38 | Every note becomes a haunted room. Each flashcard you have not mastered is a ghost, and the weaker your memory of it, the more menacing it looks. The meter at the top shows how crowded your haunting is. |
| 4 The quiz | 0:51 | 80 | Start a quiz and fill in each blank. Stuck? Ask for a hint, or reveal the answer. A wrong answer breaks your quiz streak and sends the ghost back to the start of its review ladder. A right answer banishes it. Small typos on long words are forgiven, and the answer is never hidden in the page before you respond. When the round ends, review only the cards you missed. |
| 5 Spaced repetition | 1:36 | 40 | Banished ghosts do not stay gone. A review ladder brings each one back after two days, then three, five, and seven. Jump ahead, and the ghosts that are due return, glowing orange. Ignore them longer, and they look stronger. |
| 6 Insights | 1:51 | 21 | Your study insights show your day streak, what you reviewed today, your accuracy this week, and your weakest rooms. |
| 7 Your data | 2:01 | 24 | Your notes live in your browser. Export a backup any time, and import it back with a safety check before anything is merged. |
| 8 Built with Kiro | 2:11 | 28 | Haunted Notes was built with Kiro, using specs, steering files, hooks, a custom UI reviewer agent, a Playwright MCP server, and property-based tests that caught real bugs. |
| 9 End | 2:23 | 20 | Try it yourself. The live link and the source code are below. Built for Kiroween 2026, in the Frankenstein category. |

Total about 340 words, roughly 2 minutes 15 seconds of speech at a normal pace. The demo now runs about 2:42 (162.6 s), so the planned start times above are approximate until `docs/DEMO_TIMING.md` exists.
Note: "quiz streak" (chapter 4) is the counter in the quiz header. "Day streak" (chapter 6) counts days with at least one review. They are different, so keep both words as written.

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
   (the 2:40 video cut). Full adds: each Add Note tab explained with its privacy note;
   the import dialog's summary text shown with a sample (no real file, no download);
   a caption card about the installed offline build; mobile and accessibility cards;
   and one caption card per Kiro feature used (taken only from docs/KIRO_EVIDENCE.md).
   URL ?demo=1 plays the video cut, ?demo=full plays the full walkthrough.
3. Same data-safety, no-network and no-download rules. Update the tests, verify both
   modes with the Playwright MCP, and measure both totals.
```
