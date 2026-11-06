---
inclusion: always
---

# Haunted Notes — Project Steering

Project: Haunted Notes. Study app, spooky UI, no backend.
Stack: React + Vite + TypeScript, localStorage only, no paid services.
Rules: small components, accessible (contrast, keyboard, reduced-motion),
mobile-first, keep dependencies minimal.
Network calls: allowed ONLY for the one-time Whisper model download
(Xenova/whisper-tiny.en via @huggingface/transformers CDN). All other
data stays client-side; no other outbound network calls.
Design: dark palette, one accent glow color, ghosts are SVG + CSS animation.

## Architecture notes
- All state lives in `src/store/useStore.ts` (Zustand, persisted to localStorage)
- Types live in `src/types.ts`
- Components are small and single-purpose, kept in `src/components/`
- Pages/views in `src/views/`
- Utilities (cloze generation, OCR wrapper) in `src/lib/`

## Accessibility requirements
- All interactive elements are keyboard-navigable with visible focus rings
- Colour contrast meets WCAG AA (4.5:1 for text)
- All animations respect `prefers-reduced-motion`
- Ghosts use `aria-label` describing their flashcard content

## Ghost design rules
- Ghosts are inline SVG components animated with CSS keyframes
- Ghost size/opacity encodes weakness score (0–1)
- Banish animation: fade + float-up, 600 ms
- Wrong-answer shake animation: horizontal shake, 400 ms
