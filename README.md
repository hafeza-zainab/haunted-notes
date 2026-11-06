# Haunted Notes

A Vite + React + TypeScript app for managing notes, flashcards, and audio-based note capture.

**Live app:** <URL>  
**Demo video:** <YouTube URL>

## What it does

Haunted Notes turns audio, live speech, and photos into notes, then creates flashcards and schedules review sessions.

## The Frankenstein stitch

| Piece | Tech (all free, runs in the browser) |
|---|---|
| Speech to text (audio files) | Whisper `whisper-tiny.en` via transformers.js, in a Web Worker |
| Live mic | Web Speech API |
| Photo to text | Tesseract.js with canvas preprocessing |
| Notes to flashcards | Rule-based cloze generation (no LLM) |
| Review scheduling | SM-2 lite in a pure module (`src/lib/srs.ts`) |
| UI | React, Vite, TypeScript, Zustand, hand-built SVG ghosts |

No backend, no accounts, no paid services. Notes and audio never leave the device. The only network call is the one-time Whisper model download (about 40 MB), which the browser then caches.

## Third-party software

React, Vite, TypeScript, Zustand, @huggingface/transformers (Whisper model `Xenova/whisper-tiny.en`), Tesseract.js. Each is used under its own open source license. All application code in this repository was written during the Kiroween 2026 submission period.

## Kiro files and write-up

- [Kiro usage log](haunted-notes/KIRO_LOG.md)
- [Kiro write-up](KIRO_WRITEUP.md)
- [Hooks](.kiro/hooks/)
- [Steering](.kiro/steering/)
- [Specs](haunted-notes/.kiro/specs/)

The specs currently present are `haunted-notes.md` and `srs-and-demo.md`. The hooks currently present are `lint-on-save.json` and `new-component-test.json`.

## Run locally

```bash
cd haunted-notes
npm install
npm run dev
```

Click Try demo, then add ?dev=1 to the URL for a +1 day time-travel button.
