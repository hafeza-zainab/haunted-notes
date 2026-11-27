# Requirements: the problem pitch in Run demo

## Introduction
Run demo should say the problem in its first seconds and show the project working from second 0: taking notes is easy; knowing what to revise, and when, across many subjects, is the hard part; Haunted Notes remembers the schedule so the student only remembers the answers. The review method is the fixed 2-3-5-7 day ladder. Never write "1-3-7". Never claim other apps lack scheduling.

Three narration clips were replaced by the author: chapter 1 (the problem), chapter 5 (the ladder) and chapter 9 (the close). The other six are unchanged. `NARRATION_SCRIPT.md` holds the new words.

## Requirements
1. **Working from second 0.** Chapter 1 has no title card. The run starts on the real dashboard, already loaded with the built-in demo data, with the caption bar over it. The ghosts are on screen within the first second.
2. **Captions are the narration.** The rule from `demo-sync` stays: the captions of a chapter, joined, equal its text in `NARRATION_SCRIPT.md`, and each starts when its words are spoken (cues in the manifest, measured from the audio). This replaces the freehand captions suggested in the prompt, which would not match the voice. Each caption is 12 words or fewer.
3. **Chapter 5.** The ladder sentence "so you never track dates yourself" is its own caption. Every existing step is kept, including the five-day "ignore" jump, although the new narration no longer mentions it (kept as a silent visual; flagged to the author).
4. **Chapter 9.** "You remember the answers. Haunted Notes remembers when." is its first two captions; the end card stays.
5. **No live typing.** In chapter 2 the sample texts are put into the textarea at once (an instant fill), not typed character by character, and the tab walk-through stays. The wrong quiz answer is still typed (it is the thing being shown).
6. **No dead time.** No wait shows nothing: every step highlights or does something, a wait remains only on a text card, and a chapter is no longer than its clip plus 0.4 s margin plus 1 s start-up allowance, except where its actions need longer (quiz, spaced repetition).
7. **Budget.** The measured run is 170 s or less. A chapter is never shorter than its clip plus the margin and the allowance. The other six clips are not edited, re-encoded or re-texted.
8. **Re-measure.** Every clip is re-measured in the real browser, the manifest is regenerated (durations and cues), the fit report is run, and `docs/DEMO_TIMING.md` is rewritten. A clip that does not fit is reported with a hold or a text to shorten.
9. **Text.** README gets "Why Haunted Notes" near the top; `DEMO_SCRIPT.md` says the project works from the first seconds; "1-3-7" is replaced by "2-3-5-7" wherever it appears.
10. **Safety.** Data restore, audio sync, Sound button, Pause, Stop, Escape, "Narration unavailable" and the tests keep working. No new dependency, no new network request.