# Requirements: captions that match the narration

## Introduction
Run demo plays nine narration clips. Its captions were written freehand and did not match the voice, and the quiz chapter was much longer than its clip, so answers were given in silence. The captions become the subtitles of the narration, shown when each phrase is spoken, and the answer sounds play during the run.

Source of truth for the words: `NARRATION_SCRIPT.md` (the text that was turned into audio).

## Requirements
1. **Subtitles are the narration.** For every chapter, the captions of its steps, joined in order, equal the chapter's text in `NARRATION_SCRIPT.md` word for word. Each caption is 12 words or fewer.
2. **Cues.** `public/demo-audio/manifest.json` lists, per clip, the exact words and the start time of every phrase (`cues`). A cue is measured from the quiet gap before the phrase in the WAV file. A cue placed inside a phrase with no gap is marked `estimated`.
3. **Timing.** A step's caption starts at its cue time plus up to 200 ms (600 ms for an estimated cue). The first caption of each clip starts with the chapter.
4. **First sound.** The first clip starts inside the click, and the script clock waits (at most 1.5 s) until that audio is really playing, so the first captions do not run ahead of the voice on a slow-starting device. A failing clip ends the wait.
5. **Chapter lengths.** A chapter is its clip plus room to read the last screen. Every clip still ends at least 0.4 s plus a 1 s start-up allowance before its chapter ends. The run is at least as long as all clips together, and under 2:55.
6. **Screen follows the words.** The screen shows what the words say, when they are said: the quiz chapter uses a three-card room so the round ends in time for "review only the cards you missed". Where the screen holds sample data or a simulated clock jump, the bar says so in a separate label, because the caption is now pure narration.
7. **Typos.** The quiz step that says typos are forgiven types the answer with one wrong letter when the answer has 6 or more letters (the quiz accepts that), and types it exactly otherwise.
8. **Answer sounds.** The right and wrong answer sounds play during a run, at 40% volume, following the Sound button of the bar. Outside a run, the app's own sound setting is unchanged. Nothing about the sound is saved.
9. **Quality.** Lint, tests and build pass. No new dependency, no new network request.