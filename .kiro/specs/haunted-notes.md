# Haunted Notes — Spec

## Requirements

1. **Note input** — users can add notes by:
   - Typing free-form text
   - Speaking via the browser Web Speech API (interim + final transcript)
   - Uploading a photo which is processed by Tesseract.js OCR

2. **Flashcard generation** — each note is automatically split into cloze-deletion flashcards:
   - One card per viable sentence
   - A key term (long, non-stop-word) is hidden as a blank
   - Cards start with `weaknessScore = 1.0`

3. **Dashboard** — shows each unmastered flashcard as an animated ghost:
   - Ghost size and opacity encode weakness score (0 → 1)
   - Ghosts float using CSS animation
   - Mastered cards (score ≤ 0.05) are hidden; a counter shows how many are banished

4. **Quiz mode** — cycling through unmastered cards weakest-first:
   - User types the missing term
   - Correct: ghost plays banish animation (fade + rise), weakness score decays
   - Wrong: ghost shakes, weakness score increases
   - Optional sound feedback via Web Audio API (no external files)

5. **Persistence** — all state saved to `localStorage` via Zustand `persist`

6. **Accessibility** — WCAG AA contrast, keyboard-navigable, `aria-*` labels on ghosts, `prefers-reduced-motion` respected

7. **No backend** — purely client-side. Notes stay in localStorage; uploaded audio files are transcribed on-device (Whisper in a Web Worker) and photos are processed on-device by Tesseract.js. Network calls are limited to the one-time Whisper model download, the Tesseract.js assets (worker, WASM core, English language data) fetched from a CDN on first use, and the browser's own speech service for Live mic (Web Speech API; in some browsers audio goes to the browser vendor)

## Design

- React + Vite + TypeScript
- Zustand for global state with localStorage persistence
- Tesseract.js for in-browser OCR
- Web Speech API for voice
- Dark palette (`#0d0d14` bg, `#9b59ff` accent glow)
- Ghosts are inline SVG + CSS keyframe animations
- Mobile-first responsive grid

## Tasks

- [x] Project scaffold (Vite + React + TS)
- [x] Types (`Note`, `Flashcard`, `View`)
- [x] Cloze generation library (`src/lib/cloze.ts`)
- [x] OCR wrapper (`src/lib/ocr.ts`)
- [x] Speech wrapper (`src/lib/speech.ts`)
- [x] Zustand store with localStorage persistence
- [x] `GhostSvg` component
- [x] `AddNoteView` (type / voice / photo tabs)
- [x] `DashboardView` with ghost grid
- [x] `QuizView` with banish / shake animations
- [x] `EmptyState`
- [x] `NavBar` with sound toggle and ghost count badge
- [x] Global CSS — dark theme, reduced-motion, responsive
- [x] Kiro steering file (`.kiro/steering/product.md`)
- [x] Kiro hooks (lint-on-save, new-component-test)
