# Haunted Notes

> Your unfinished study notes come back to haunt you, until you banish them.

Built for **Kiroween 2026** (category: Frankenstein). Haunted Notes stitches together voice transcription, handwriting/photo OCR, rule-based flashcard generation and spaced repetition into one spooky study app. Everything runs in the browser: no backend, no accounts, no paid services, and your notes and audio never leave your device.

- **Live app:** <ADD NETLIFY URL>
- **Demo video:** <ADD YOUTUBE URL>
- **Try spaced repetition quickly:** open the app, click **Try demo**, then add `?dev=1` to the URL for a **+1 day** time-travel button.

## What it does

1. **Add a note** by typing, speaking (live mic), uploading a photo of printed text (OCR), or uploading an audio file (transcribed locally with Whisper, up to 3 minutes).
2. **Notes become ghosts.** Each note is split into fill-in-the-blank flashcards. Every unmastered card is a ghost haunting your dashboard, grouped into one "haunted room" per note.
3. **Quiz to banish.** Answer correctly and the ghost is banished. Answer wrong and it gets louder.
4. **Ghosts come back.** Spaced repetition (SM-2 lite) schedules each banished ghost to return when it is due for review.

## The Frankenstein stitch

| Piece | Tech (all free, runs in the browser) |
|---|---|
| Speech to text (audio files) | Whisper `whisper-tiny.en` via transformers.js, in a Web Worker |
| Live mic | Web Speech API |
| Photo to text | Tesseract.js with canvas preprocessing |
| Notes to flashcards | Rule-based cloze generation (no LLM) |
| Review scheduling | SM-2 lite in a pure module (`src/lib/srs.ts`) |
| UI | React, Vite, TypeScript, Zustand, hand-built SVG ghosts |

## Run locally

```
cd haunted-notes
npm install
npm run dev
```

Open http://localhost:5173. The first audio transcription downloads the Whisper model (about 40 MB) once; it is then cached by the browser. This is the only network call the app makes.

## How Kiro was used

See [KIRO_LOG.md](./KIRO_LOG.md) for the running log. The `.kiro/` folder at the root of this repo holds the artifacts:

- **Specs** (`.kiro/specs/`): requirements, design and tasks for the main app and for spaced repetition plus demo mode.
- **Steering** (`.kiro/steering/`): product and stack rules (free-only, no backend, accessibility, design palette).
- **Hooks** (`.kiro/hooks/`): lint on save, and test generation for new components.
- <ADD: property-based tests for srs.ts>
- <ADD: MCP server used, and what it enabled>
- <ADD: custom agent / Kiro power, if used>
- <ADD: spec vs vibe coding comparison, what you learned>

## Third-party software

React, Vite, TypeScript, Zustand, @huggingface/transformers (Whisper model `Xenova/whisper-tiny.en`), Tesseract.js. Each is used under its own open source license. All application code in this repository was written during the Kiroween 2026 submission period.

## License

MIT, see [LICENSE](./LICENSE).