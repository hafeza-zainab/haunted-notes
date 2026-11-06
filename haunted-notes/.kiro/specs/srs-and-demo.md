# Spaced Repetition & Demo Mode — Spec

## Requirements

### Spaced Repetition (SM-2 Lite)

**R1 — SRS fields on Flashcard**
Each `Flashcard` gains three new fields:
- `ease: number` — starts at `2.5`; controls how fast the interval grows
- `intervalDays: number` — starts at `0`; the number of days until the card is due again
- `dueAt: number` — Unix-ms timestamp of when the ghost is due; `Date.now()` on creation (immediately due)
- `reps: number` — number of consecutive correct reviews since the last reset; starts at `0`

**R2 — Correct-answer scheduling**
When a card is answered correctly the interval advances using a three-stage ramp:
- `reps === 0` → `intervalDays = 1`
- `reps === 1` → `intervalDays = 3`
- `reps ≥ 2`  → `intervalDays = round(intervalDays * ease)`

After computing the new interval:
- `dueAt = Date.now() + intervalDays * 86_400_000`
- `reps += 1`
- `ease` is unchanged on correct answers

The ghost is "banished" until `dueAt` arrives. When `Date.now() >= dueAt`, the ghost is "back" — visually indicated with a haunting style.

**R3 — Wrong-answer scheduling**
When a card is answered incorrectly:
- `reps = 0`
- `intervalDays = 0`
- `ease = max(1.3, ease - 0.2)`
- `dueAt = Date.now()` (card stays due immediately)

**R4 — Due determination**
A card is *due* (returned) only when **both** conditions hold: `reps > 0` (it has been reviewed at least once) AND `Date.now() >= dueAt`. New cards (`reps === 0`) are simply "haunting" and are never counted as due/returned — they haven't been scheduled into the future yet.

**R5 — Dashboard: "N ghosts returned today"**
The summary bar shows a count of cards where `reps > 0 && Date.now() >= dueAt`. The label reads "N ghost(s) returned" (or "No ghosts due" when zero).

**R6 — Dashboard: "Review due ghosts" button**
When `dueCount > 0` the summary bar shows a "Review due ghosts" button. Clicking it starts a quiz restricted to due cards only (sets a new `quizMode: 'due'` on the store, or passes `dueOnly: true` via `quizNoteId` variant). The quiz must use the existing QuizView with the due-only card pool.

**R7 — Room "due" badge**
Each `HauntedRoom` card that has ≥ 1 due flashcard shows a small `🔔 N due` badge next to the existing `👻 N` badge.

**R8 — Migration of existing cards**
On store hydration from localStorage, any `Flashcard` missing `ease`, `intervalDays`, `dueAt`, or `reps` is patched with defaults (`ease: 2.5, intervalDays: 0, reps: 0, dueAt: Date.now()`). This migration runs once inside the Zustand `onRehydrateStorage` callback.

**R9 — Pure SRS logic module**
All scheduling math lives in `src/lib/srs.ts` as exported pure functions with no React/store dependencies, making them trivially unit-testable:
- `defaultSrsFields(): SrsFields`
- `scheduleCorrect(card: SrsFields): SrsFields`
- `scheduleWrong(card: SrsFields): SrsFields`
- `isDue(card: SrsFields, now?: number): boolean`

The `Flashcard` type is extended with `SrsFields`. The store's `answerCard` action calls the appropriate scheduler function.

---

### Demo Mode

**R10 — "Try demo" button placement**
A "Try demo" button appears in two locations:
1. `EmptyState` — shown when no notes exist (alongside the existing "Add Note" button)
2. `AddNoteView` — shown as a secondary action below the submit/cancel buttons

**R11 — Demo data content**
Loading demo data inserts exactly three notes with pre-built flashcards (bypassing `generateFlashcards`). The topics and sample cards are:

| Topic | Note title | Returned card |
|---|---|---|
| Java Basics | "Java Basics" | `demo-card-java-jvm` — `reps: 1`, `dueAt` in past |
| Digital Marketing | "Digital Marketing" | `demo-card-mktg-content` — `reps: 1`, `dueAt` in past |
| Biology | "Biology" | none |

Each note has 3 cards. The 7 plain cards have `reps: 0` (new/haunting, never counted as due). Exactly two cards have `reps: 1` and `dueAt` in the past — these are immediately visible as "returned" ghosts, making the "N ghosts returned" stat and "Review due ghosts" button appear on first load.

**R12 — Demo loading constraints**
Loading demo data must not:
- Make any network requests
- Invoke OCR or speech transcription
- Require audio/microphone permissions

It is a pure synchronous data injection — a call to a `loadDemoData()` action on the store.

**R13 — Demo flag on the store**
A `isDemoLoaded: boolean` flag tracks whether demo data has been loaded, so:
- The "Try demo" button changes to disabled/hidden after loading
- The "Clear demo" option is shown

**R14 — "Clear demo" action**
A "Clear demo" button appears in the summary bar when `isDemoLoaded === true`. It removes all notes and flashcards whose `id` is prefixed with `"demo-"` and sets `isDemoLoaded = false`.

---

## Design

### Data model changes (`src/types.ts`)

```ts
export interface SrsFields {
  ease: number;          // default 2.5
  intervalDays: number;  // default 0
  dueAt: number;         // ms timestamp, default Date.now()
  reps: number;          // default 0
}

// Flashcard grows SrsFields
export interface Flashcard extends SrsFields {
  // ... existing fields unchanged ...
}
```

### New pure library: `src/lib/srs.ts`

```ts
export function defaultSrsFields(): SrsFields
export function scheduleCorrect(card: SrsFields): SrsFields
export function scheduleWrong(card: SrsFields): SrsFields
export function isDue(card: SrsFields, now?: number): boolean
export function isReturned(card: SrsFields, now?: number): boolean
```

`scheduleCorrect` implements the three-stage ramp described in R2.  
`scheduleWrong` resets as in R3.  
`isDue` returns `card.reps > 0 && (now ?? Date.now()) >= card.dueAt` — new cards (`reps === 0`) are never due.  
`isReturned` is an alias of `isDue` (same condition, kept as a named concept for readability at call sites).

No imports from React or Zustand — pure TypeScript.

### Store changes (`src/store/useStore.ts`)

**New state fields:**
- `isDemoLoaded: boolean` — defaults `false`
- `quizDueOnly: boolean` — when `true`, QuizView uses only due cards; defaults `false`

**New / changed actions:**
- `answerCard(cardId, correct)` — now calls `scheduleCorrect` or `scheduleWrong` from `srs.ts` in addition to the existing `updateWeaknessScore` call. Both are applied together (SRS fields + weaknessScore coexist).
- `loadDemoData()` — synchronously injects three demo notes + their pre-built cards (IDs prefixed `"demo-"`), sets `isDemoLoaded = true`.
- `clearDemoData()` — removes notes/cards with `id` starting with `"demo-"`, sets `isDemoLoaded = false`.
- `setQuizDueOnly(dueOnly: boolean)` — setter for `quizDueOnly`.

**Migration in `onRehydrateStorage`:**  
Zustand's persist middleware supports `onRehydrateStorage`. After rehydration, scan `flashcards` and patch any card missing SRS fields with `defaultSrsFields()`.

### QuizView changes (`src/components/QuizView.tsx`)

- **Snapshot queue**: On mount, eligible card IDs are collected into a `useRef` array (shuffled for variety). This snapshot never changes — store updates do not affect ordering or length within a round.
- **Linear walk**: A `useRef` index advances by 1 on every submit or skip. No re-scanning live store data for the next card.
- **Card lookup**: The displayed card is resolved from the live store via a `Map<id, Flashcard>` so weakness/SRS fields reflect the latest state, but the queue itself is frozen.
- **Answer normalisation**: Trim whitespace, strip leading/trailing punctuation, lowercase — using a `normalise()` helper — before comparing to `clozeWord`.
- **Wrong answer UX**: Show the correct answer immediately in feedback. Do not auto-advance; the submit button becomes "Next →". The user reads the answer, then presses Next to continue. A wrong answer still calls `answerCard` (lowers ease, keeps card haunting), but the card does not re-enter this round's queue.
- **Correct answer UX**: Auto-advance after 900 ms banish animation (unchanged).
- **Skip**: Advances the index without calling `answerCard` and without counting against the score.
- **Progress indicator**: Header shows "N / Total" position.
- **Completion screen**: Shows "N correct out of N asked (M skipped)" where asked = submitted cards only.
- When `quizDueOnly === true`, filter the pool to `isDue(card)` before building the queue.
- CSS class `ghost--returned` applied to returned cards (`isReturned(card)`).
- Calls `setQuizDueOnly(false)` on exit.

### DashboardView changes (`src/components/DashboardView.tsx`)

**Summary bar additions:**
- Count and display `dueCount` = number of flashcards where `isDue(card)`.
- "N ghost(s) returned" stat (or "No ghosts due").
- "Review due ghosts" button (shown only when `dueCount > 0`): calls `setQuizDueOnly(true)` then `setView('quiz')`.
- "Clear demo" button (shown only when `isDemoLoaded`): calls `clearDemoData()`.

**HauntedRoom badge:**
- Compute `dueInRoom = cards.filter(isDue).length`.
- When `dueInRoom > 0`, show `🔔 N due` badge in the `room-badges` area.

### EmptyState changes (`src/components/EmptyState.tsx`)

- Add "Try demo" button below the existing "Add Note" button.
- Button calls `loadDemoData()` then `setView('dashboard')`.
- After `isDemoLoaded === true`, hide or disable the "Try demo" button.

### AddNoteView changes (`src/components/AddNoteView.tsx`)

- Add a "Try demo" section below the form actions, only when `!isDemoLoaded`.
- Renders as a small secondary `<aside>` or simply a `<button className="btn-ghost">` with label "Try demo →".
- Calls `loadDemoData()` then `setView('dashboard')`.

### Demo data module: `src/lib/demoData.ts`

Returns hardcoded `Note[]` and `Flashcard[]` arrays. IDs are stable constants prefixed with `"demo-"`. Cards include all SRS fields. Two cards have `dueAt: Date.now() - 1` (set at call time, so they're immediately due).

```ts
export function buildDemoData(): { notes: Note[]; flashcards: Flashcard[] }
```

Sample cards (abbreviated):

**Java Basics** (note id: `demo-note-java`)
- "Java is a statically typed, object-oriented programming language." → blank: `statically`
- "A Java class is a blueprint for creating objects." → blank: `blueprint`
- "The JVM (Java Virtual Machine) interprets bytecode." → blank: `JVM` *(due in the past)*

**Digital Marketing** (note id: `demo-note-marketing`)
- "SEO stands for Search Engine Optimization." → blank: `SEO`
- "A conversion rate measures the percentage of visitors who complete a goal." → blank: `conversion`
- "Content marketing focuses on creating valuable content to attract audiences." → blank: `Content` *(due in the past)*

**Biology** (note id: `demo-note-biology`)
- "Photosynthesis is the process by which plants convert sunlight into glucose." → blank: `Photosynthesis`
- "DNA stands for deoxyribonucleic acid and carries genetic information." → blank: `DNA`
- "Mitosis is the process of cell division that produces two identical daughter cells." → blank: `Mitosis`

---

## Tasks

- [x] **Task 1 — Extend types** (`src/types.ts`)
  - Add `SrsFields` interface
  - Extend `Flashcard` with `SrsFields`

- [x] **Task 2 — Implement `src/lib/srs.ts`**
  - Export `defaultSrsFields`, `scheduleCorrect`, `scheduleWrong`, `isDue`
  - No external dependencies

- [x] **Task 3 — Update `src/lib/cloze.ts`**
  - `buildCard` must now initialize SRS fields via `defaultSrsFields()`
  - Import from `srs.ts`

- [x] **Task 4 — Implement `src/lib/demoData.ts`**
  - Hardcoded notes and flashcards with `"demo-"` prefixed IDs
  - Two cards with `dueAt` in the past
  - All fields populated (including SRS fields)

- [x] **Task 5 — Update store** (`src/store/useStore.ts`)
  - Add `isDemoLoaded`, `quizDueOnly` state fields
  - Update `answerCard` to apply SRS scheduling
  - Add `loadDemoData`, `clearDemoData`, `setQuizDueOnly` actions
  - Add `onRehydrateStorage` migration to patch legacy cards missing SRS fields

- [x] **Task 6 — Update `QuizView`** (`src/components/QuizView.tsx`)
  - Filter card pool to due cards when `quizDueOnly === true`
  - Show "ghost is back" CSS class (`ghost--returned`) for returned cards
  - Show "All due ghosts banished!" completion message when in due-only mode
  - Call `setQuizDueOnly(false)` on exit

- [x] **Task 7 — Update `DashboardView`** (`src/components/DashboardView.tsx`)
  - Compute `dueCount` and render "N ghost(s) returned" stat
  - Add "Review due ghosts" button
  - Add "Clear demo" button (conditional on `isDemoLoaded`)
  - Add `🔔 N due` badge to `HauntedRoom` cards

- [x] **Task 8 — Update `EmptyState`** (`src/components/EmptyState.tsx`)
  - Add "Try demo" button
  - Hide when `isDemoLoaded`

- [x] **Task 9 — Update `AddNoteView`** (`src/components/AddNoteView.tsx`)
  - Add "Try demo" secondary action below form buttons
  - Hide when `isDemoLoaded`

- [x] **Task 10 — CSS additions** (`src/index.css`)
  - `.ghost--returned` — tint and glow for "ghost is back" cards
  - `.badge--due` — style for the `🔔 N due` room badge
  - Any other new classes needed by the above changes

- [x] **Task 11 — Dev time-travel button**
  - Add `timeTravelDay()` action to the store: shifts every card's `dueAt` back by 86 400 000 ms
  - In `DashboardView`, compute `isDevMode = new URLSearchParams(window.location.search).get('dev') === '1'`
  - Render `⏩ +1 day` button in summary actions only when `isDevMode` is true
  - Add `.btn-dev` CSS (dashed green border, subtle background)

- [x] **Task 12 — Fix QuizView repeating questions** (`src/components/QuizView.tsx`)
  - Snapshot eligible card IDs into a frozen `useRef` queue on mount; never re-read live store for ordering
  - Walk queue with a `useRef` index; each card appears at most once per round
  - `normalise()` helper: trim + strip punctuation + lowercase before comparing answer to `clozeWord`
  - Wrong answer: show correct answer in feedback, button becomes "Next →", do not auto-advance
  - Correct answer: auto-advance after 900 ms banish animation (unchanged)
  - Skip: advance index, no `answerCard` call, not counted in score
  - Progress indicator "N / Total" in the header score area
  - Completion screen: "N correct out of N asked (M skipped)"
