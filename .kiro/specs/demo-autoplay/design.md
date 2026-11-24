# Design: self-playing "Run demo"

## Modules
| File | Kind | Role |
|---|---|---|
| `src/lib/demoScript.ts` | pure | Script as data: chapters, steps, actions with `ms`. `scriptTotalMs`, `locate(elapsed)`, `formatClock`. |
| `src/lib/demoSnapshot.ts` | pure | `takeSnapshot`, `serializeSnapshot`, `parseSnapshot` (never throws), `writeSnapshot`, `recoverSnapshot(storage, apply)`. |
| `src/demo/domActions.ts` | DOM | Looks up `[data-demo]`, types into inputs with the native value setter, clicks, highlights, scrolls. |
| `src/demo/runner.ts` | DOM | Executes the script, owns pause, speed, abort, the clock and cleanup. External store for the UI. |
| `src/components/DemoBar.tsx` | view | Bottom bar, from props only. |
| `src/components/DemoCard.tsx` | view | Text-only overlay for the intro and Built with Kiro cards. |
| `src/components/DemoPlayer.tsx` | view | Subscribes to the runner; renders shield, card and bar; Escape; `?demo=1`. |
| `src/components/RunDemoButton.tsx` | view | The "Run demo" button used in three places. |

`src/demo/` holds the effectful runner. `src/lib/` stays free of React, Zustand and DOM, as `tech.md` requires.

## Script model
```ts
type DemoAction =
  | { op: 'wait'; ms: number }
  | { op: 'click'; target: string; ms: number }
  | { op: 'type'; target: string; text: string; ms: number }   // keystrokes spread over ms
  | { op: 'clear'; target: string; ms: number }
  | { op: 'highlight'; target: string; ms: number }
  | { op: 'store'; name: 'emptyState' | 'loadDemoOnly' | 'timeTravelDay'; ms: number }
  | { op: 'quiz'; name: 'hint' | 'wrong' | 'right' | 'reveal' | 'next' | 'skip'; ms: number };
interface DemoStep { id: string; chapter: number; caption: string; card?: DemoCardText; actions: DemoAction[] }
```
A step lasts the sum of its action `ms`. The runner keeps an absolute schedule: action n ends at `start + Σms(0..n)`. A slow lookup shortens the next sleep instead of delaying the whole run, so the real total equals the scripted total. Pause stops the clock; speed divides every wait.

## Runner
`startDemo()`: guard against a second run, snapshot (memory and localStorage), `beginDemoRun()` (store: empty state, `demoRunning = true`, persisted writes suspended), play steps, then in `finally`: remove highlights, `endDemoRun(snapshot)` (single `set` that restores the data and clears the flag), delete the key, focus `#main-content`. Abort (Stop, Escape) throws `DemoAbort` from the next `sleepUntil`. A missing target throws `DemoMissingTarget`, which logs `console.warn`.

Persistence pause: `safeStorage.setItem` returns early while the module flag is set. The flag is set and cleared only inside `beginDemoRun` and `endDemoRun`, so the final restore is persisted.

Quiz actions find the card by matching the prompt text on screen with `normalizeBlanks(card.prompt)` from the store, then read `clozeWord`. Nothing is added to the DOM.

Photo tab: `switchTab` skips `loadOcrEngine()` and marks the engine as ready while `demoRunning` is true, so no module or asset is requested.

## Recovery on load
`main.tsx` calls `recoverSnapshot(localStorage, apply)` before rendering. `apply` calls `useStore.setState` with the restored fields. The key is removed after a successful apply, or when the value is corrupt.

## Controls and accessibility
Bar: `role="region"` `aria-label="Demo controls"`; caption `role="status"` `aria-live="polite"`; chapter dots are a non-interactive `ol` with `aria-current="step"`. Buttons: Pause/Resume, Stop, Speed; each min 44 by 44px, visible focus ring from the global rule. The shield is `position: fixed; inset: 0` below the bar. Outside the bar, keydown, keypress and keyup are cancelled except Escape and Tab. `prefers-reduced-motion`: `scrollIntoView({behavior:'auto'})`, highlight pulse and card fade disabled.

Layout: the bar is fixed at the bottom; while it is shown `.main-content` gets bottom padding equal to the bar height so nothing hides under it. At 390px the bar wraps into two rows.

## Correctness properties
1. **Restore is exact.** For any original state and any abort point (any mutation of the store after the snapshot), restoring gives exactly the original notes, flashcards, review log and flags.
2. **Round trip.** `parseSnapshot(serializeSnapshot(s))` equals `s` for valid state.
3. **Recovery is idempotent.** Running recovery a second time changes nothing and reports "none".
4. **Corrupt input never throws.** `parseSnapshot` on any string or JSON value returns a snapshot or `null`; `recoverSnapshot` deletes the key.
5. **Script totals.** The total is the sum of action durations, between 140 and 170 s; every caption has at most 12 words.

## Testing
Unit: script data (totals, captions, targets exist in rendered views, no answers in script text), snapshot functions, bar markup. Property: items 1 to 4 above. Source scan: no `fetch`, `window.open`, `URL.createObjectURL`, `whisper`, `tesseract`, `useWhisper` in the script and runner files. Browser (Playwright MCP): full run at 1280 and 390px, Stop, reload mid-run, console errors, measured total.
