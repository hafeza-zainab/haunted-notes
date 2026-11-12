# Haunting Atmosphere: Spec

Builds on `haunted-notes.md` and `srs-and-demo.md`. Visual and audio polish only: no change to
scheduling, card generation, fixed `_____` blanks or the answer-leak fixes.

## Requirements

**R1: Five ghost types.** A ghost's look depends on its card's `weaknessScore` (0 to 1), split into
five equal bands: wisp (0 to <0.2), ghoul (<0.4), banshee (<0.6), phantom (<0.8), poltergeist
(0.8 to 1). Each type has a different SVG body shape, eyes and glow. Each type's rendered SVG is
under 2 KB. Size and opacity still encode weakness (existing rule).

**R2: Atmosphere.** Slow fog layers and a faint flicker sit behind the app. Pure CSS, no libraries,
only `transform` and `opacity` animate, fixed-position and non-interactive, so there is no layout
shift and no effect on hit targets.

**R3: Banish.** A correct answer dissolves the ghost into a few drifting particles (about 900 ms,
matching the existing auto-advance). A soft sound plays only when sound is on. Sound is OFF by
default for new visitors.

**R4: Returned ghosts.** A ghost that is back (`reps > 0` and due) keeps the orange aura and
additionally does a short shake-in when it appears. New ghosts do neither.

**R5: Haunted level meter.** The header shows a meter with five tiers (Calm, Uneasy, Restless,
Crowded, Overrun) derived from the weakness of all unbanished ghosts. A higher tier darkens the
room (vignette) and makes it more crowded (more fog layers and drifting specks).

**R6: Constraints.**
- Keep every contrast token and AA result; atmosphere layers sit behind opaque cards and add at
  most about 6% accent tint to the page background.
- Keep 44px minimum targets on mobile; the meter is not interactive.
- `prefers-reduced-motion: reduce` gives a static equivalent: no movement, no flicker, no
  particles; the banished ghost is dimmed instead of animated; the meter and its text stay.
- Do not break the fixed `_____` blanks or the answer-leak fixes (aria-labels and titles keep using
  the normalised prompt).

## Design

- `src/lib/haunt.ts` (pure): `ghostTypeFor(weakness)`, `hauntedLevel(cards, now?)`, `LEVEL_NAMES`.
- `src/components/ghostShapes.tsx`: one small component per ghost type (inner SVG only).
- `src/components/GhostSvg.tsx`: picks the shape from `weakness`; class `ghost-type--<type>`.
- `src/components/BanishParticles.tsx`: seven fixed particles (no randomness in render).
- `src/components/Atmosphere.tsx`: fog layers, specks and vignette in one fixed `aria-hidden` layer.
- `src/components/HauntMeter.tsx`: the header meter (`role="meter"`, labelled by its visible text).
- `App.tsx` sets `data-level` on the app shell; CSS reads it for vignette, fog and specks.
- Store: `soundEnabled` defaults to `false`; the correct-answer sound becomes a soft shimmer.

## Tasks

1. [ ] `haunt.ts` plus property tests (band coverage, monotonic type, level monotonic, banishing never raises the level).
2. [ ] Five ghost shapes plus a test that each rendered SVG is under 2048 bytes.
3. [ ] `GhostSvg` uses the type; per-type glow and float speed in CSS.
4. [ ] `BanishParticles` and the new banish keyframes; soft sound; sound off by default.
5. [ ] Returned shake-in.
6. [ ] `Atmosphere` and `HauntMeter`; `data-level` in `App.tsx`; NavBar shows the meter.
7. [ ] Reduced-motion block updated for every new animation (static equivalents).
8. [ ] Lint, tests, build. Run ghost-ui-reviewer and the Playwright checks at 390px and 1280px, before and after screenshots, fix only FAILs.
