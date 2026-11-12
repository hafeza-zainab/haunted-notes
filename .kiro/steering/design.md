---
inclusion: fileMatch
fileMatchPattern: ["src/**/*.tsx", "src/**/*.css"]
---

# Haunted Notes: Design Rules

Applies whenever a component or stylesheet is in context. Complements `product.md`.

## Palette tokens (defined in `src/index.css` `:root`)
Use the tokens. Do not hardcode new colors in components.

| Token | Value | Use |
|---|---|---|
| `--bg` | `#0d0d14` | page background |
| `--bg-surface` | `#14141f` | inputs, inset areas |
| `--bg-elevated` | `#1c1c2e` | cards, dialogs |
| `--accent` | `#9b59ff` | the one accent glow color |
| `--accent-glow` | `rgba(155,89,255,0.35)` | glows, focus halos |
| `--text` / `--text-muted` | `#e8e8f0` / `#8888a8` | body / secondary text |
| `--danger` / `--success` | `#ff5555` / `#50fa7b` | wrong / correct feedback |
| `--ghost-fill`, `--ghost-stroke`, `--ghost-eyes` | accent-derived | ghost SVG parts |
| `--border` | accent at 25% | card and input borders |

One accent glow color only. The single sanctioned secondary hue is the warm orange
used for "returned" ghosts and due UI (`.ghost--returned`, `.badge--due`, `.btn-due`).
Do not introduce further hues.

## Spacing scale
Use multiples of 0.25rem: `0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4` rem. Radius: `--radius`
(12px) for cards, `--radius-sm` (6px) for controls.

## Ghost animation rules
- Ghosts are inline SVG, animated with CSS keyframes only. No animation libraries.
- Size and opacity encode weakness score (0 to 1).
- Float: `ghost-float` loop. Banish: fade + float-up, 600 ms. Wrong-answer shake:
  horizontal, 400 ms.
- Animate `transform` and `opacity` only. Avoid animating layout properties.

## Motion (required)
- Every `@keyframes` animation, transition-heavy effect and looping glow MUST have an
  override inside `@media (prefers-reduced-motion: reduce)` that disables or
  replaces it with a static state.
- When adding a new animation class, add it to the reduced-motion block in the same
  change.

## Accessibility
- Text contrast at least WCAG AA: 4.5:1 for normal text, 3:1 for large text and UI
  borders. Check `--text-muted` on `--bg-elevated` before using it for essential text.
- Every interactive element is keyboard reachable with a visible `:focus-visible` ring.
- Tap targets at least 44x44px on mobile.
- Ghosts carry an `aria-label` describing their flashcard content. Feedback regions use
  `aria-live`.
- Never convey state by color alone; pair it with an icon or text.

## Layout
- Mobile-first. Base styles target 390px wide, then add `min-width` breakpoints.
- No horizontal scroll at 390px.
