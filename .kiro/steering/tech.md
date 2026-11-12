---
inclusion: always
---

# Haunted Notes: Tech Rules

## Stack
React + Vite + TypeScript, Zustand (persisted to localStorage). No backend. No paid
services. Keep dependencies minimal and pin exact versions when adding any.

## Network
Allowed network calls (see `product.md`): the one-time Whisper model download, the
one-time Tesseract.js assets (worker, WASM core, English language data from a CDN),
and the browser's speech service for Live mic only (Web Speech API). Nothing else
leaves the browser. Audio files and photos are processed on-device. Demo mode, SRS
and quizzes must work fully offline.

## Heavy libraries are lazy-loaded
`@huggingface/transformers` (Whisper) and `tesseract.js` (OCR) must never be in the
initial bundle. Load them with dynamic `import()` the first time the Audio or Photo
tab is used, and show a small skeleton or progress state while loading.

## Logic lives in pure modules
- Business logic goes in `src/lib/*.ts` as pure functions: no React, no Zustand, no
  DOM, no `Date.now()` hidden inside (accept `now` as a parameter with a default).
- Components stay thin: they read the store, call lib functions, render.
- State and actions live only in `src/store/useStore.ts`. Types live in `src/types.ts`.
- Persisted state changes need a migration in the store's `onRehydrateStorage`.

## Specs location
- Create all specs only in `C:\dev\kiro\.kiro\specs\` (the workspace root), never in `haunted-notes/.kiro/`.

## Conventions
- Small, single-purpose components in `src/components/`.
- TypeScript strict; no `any`. Run `npm run build` (runs `tsc -b`) and `npm run lint`
  after every change.
- Do not edit unrelated code while implementing a task.
