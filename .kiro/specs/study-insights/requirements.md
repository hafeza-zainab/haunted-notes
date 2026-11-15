# Requirements Document

## Introduction

Study Insights adds a progress panel to the Haunted Notes Dashboard. The panel shows the current study streak in days, the number of cards reviewed today, accuracy over the last 7 days, the 3 weakest rooms, and a simple bar chart of reviews per day. Review events are stored compactly in localStorage, capped at 500, with a schema version and safe handling of missing or corrupt data. All calculations are pure functions in `src/lib`, receive `now` as a parameter, and run fully offline. No new dependencies are added.

The user was unavailable during spec creation. Decisions were made autonomously and are recorded under "Assumptions" below.

## Assumptions

- A "room" is a note (`HauntedRoom` in the Dashboard). The "weakest" rooms use the same definition as the existing room sort: the average `weaknessScore` of the room's unbanished cards, highest first.
- A "review" is any call of `answerCard`, correct or wrong. This includes the Quiz "Reveal" action, which records a wrong answer. Skipped cards are not reviews.
- A "day" is a local calendar day. The pure functions take a `tzOffsetMinutes` parameter so tests are timezone-independent.
- The streak counts consecutive days with at least one review, ending today. If today has no review yet but yesterday has, the streak keeps counting up to yesterday, so a streak is not shown as broken before the day is over.
- "Last 7 days" means the 7 local calendar days ending with today, including today.
- Accuracy is `correct / reviews` in that window, in the range 0 to 1. With zero reviews there is no accuracy, shown as "No reviews yet" (never `NaN`, never 0%).
- A review event stores a timestamp, the note id of the card's room, and a correct flag. It stores no card text, prompt or answer.
- Events are kept after their note is deleted until the cap removes them. Deleted notes never appear in the weakest rooms, because the list is built from existing notes. Events still count toward streak, today count and accuracy.
- `resetAll` clears the review log. `clearDemoData` does not.
- The panel is shown on the Dashboard only when at least one note exists. An empty store keeps the existing `EmptyState`.
- Weakest rooms are display-only (non-interactive rows). Room names use the same `noteTitle` text the Dashboard already shows.

## Glossary

- **Insights_Panel**: The Dashboard component that shows the study statistics and the bar chart.
- **Insights_Lib**: The pure module `src/lib/insights.ts` that computes all statistics.
- **Review_Log_Lib**: The pure module `src/lib/reviewLog.ts` that appends, caps and sanitizes review events.
- **Store**: The Zustand store in `src/store/useStore.ts`, persisted to localStorage.
- **Review_Event**: A record `{ t, r, c }`: `t` is the review time in Unix ms, `r` is the room (note) id, `c` is `1` for correct or `0` for wrong.
- **Review_Log**: The persisted object `{ v, events }`: `v` is the schema version and `events` is an array of Review_Event ordered oldest first.
- **Schema_Version**: The integer `v` in the Review_Log. The current value is `1`.
- **Event_Cap**: The maximum number of events kept, `500`.
- **Local_Day**: A calendar day computed from a timestamp and a `tzOffsetMinutes` value.
- **Streak**: The count of consecutive Local_Days, ending today (or yesterday, see Assumptions), that each have at least one Review_Event.
- **Accuracy_7d**: The share of Review_Events in the last 7 Local_Days with `c = 1`, a number from 0 to 1, or `null` when there are none.
- **Weakest_Rooms**: Up to 3 rooms ordered by average `weaknessScore` of their unbanished cards, highest first.
- **Bar_Chart**: The inline SVG chart of reviews per Local_Day for the last 7 days.
- **Chart_Table**: The visually hidden table that gives the Bar_Chart data as text.
- **Answer_Text**: The `clozeWord`, `sentence` and any text revealing the answer of a flashcard.

## Requirements

### Requirement 1: Record review events

**User Story:** As a student, I want each answered card recorded, so that my progress can be measured over time.

#### Acceptance Criteria

1. WHEN the Store runs `answerCard` for an existing card, THE Store SHALL append one Review_Event with `t` set to the current time, `r` set to the card's `noteId`, and `c` set to 1 for a correct answer or 0 for a wrong answer.
2. WHEN the Quiz "Reveal" action runs, THE Store SHALL append one Review_Event with `c` set to 0.
3. WHEN a card is skipped in the Quiz, THE Store SHALL append no Review_Event.
4. IF `answerCard` is called with an id that matches no card, THEN THE Store SHALL leave the Review_Log unchanged.
5. THE Review_Log_Lib SHALL receive the event time as a parameter and SHALL NOT read the clock.
6. THE Review_Event SHALL contain no Answer_Text.

### Requirement 2: Cap the log at 500 events

**User Story:** As a student, I want the history to stay small, so that localStorage is not filled by old reviews.

#### Acceptance Criteria

1. WHEN an event is appended and the Review_Log would hold more than the Event_Cap, THE Review_Log_Lib SHALL remove the oldest events until it holds exactly the Event_Cap.
2. THE Review_Log_Lib SHALL return a Review_Log with at most the Event_Cap events for every input.
3. THE Review_Log_Lib SHALL keep the remaining events in their original order.
4. WHEN a sanitized log read from storage holds more than the Event_Cap events, THE Review_Log_Lib SHALL keep only the newest Event_Cap events.
5. WHEN an event is appended, THE Review_Log_Lib SHALL return a new Review_Log and SHALL NOT mutate the input.

### Requirement 3: Persist the log with a schema version

**User Story:** As a student, I want my history to survive a reload, so that my streak is not lost.

#### Acceptance Criteria

1. THE Store SHALL persist the Review_Log in the existing `haunted-notes-storage` localStorage entry.
2. THE Review_Log SHALL contain the Schema_Version `1`.
3. THE Review_Log_Lib SHALL serialize each Review_Event as a flat object of three short keys (`t`, `r`, `c`) with no nested data.
4. FOR ALL valid Review_Logs, sanitizing the JSON round trip of the log SHALL produce an equal Review_Log (round-trip property).

### Requirement 4: Migrate and sanitize persisted data

**User Story:** As a returning student, I want the app to load even if my stored data is old or damaged, so that I never get a blank or broken Dashboard.

#### Acceptance Criteria

1. WHEN the Store rehydrates and the persisted state has no Review_Log, THE Store SHALL set an empty Review_Log with the current Schema_Version, and SHALL keep notes and flashcards unchanged.
2. IF the persisted Review_Log is not an object, has a missing or non-integer `v`, or has `events` that is not an array, THEN THE Review_Log_Lib SHALL return an empty Review_Log with the current Schema_Version.
3. IF an item in `events` lacks a finite non-negative number `t`, a non-empty string `r`, or a `c` of 0 or 1, THEN THE Review_Log_Lib SHALL drop that item and SHALL keep the valid items.
4. IF the persisted `v` is greater than the current Schema_Version, THEN THE Review_Log_Lib SHALL return an empty Review_Log with the current Schema_Version.
5. WHEN the persisted `v` is lower than the current Schema_Version, THE Review_Log_Lib SHALL upgrade the events with the matching migration step and set `v` to the current Schema_Version.
6. THE Review_Log_Lib SHALL sort sanitized events by `t` ascending, keeping the original order for equal `t`.
7. THE Review_Log_Lib SHALL return a valid Review_Log for every input value without throwing.
8. WHEN the Store runs the migration in `onRehydrateStorage`, THE Store SHALL run the existing flashcard SRS migration unchanged.

### Requirement 5: Current streak

**User Story:** As a student, I want to see how many days in a row I studied, so that I stay motivated.

#### Acceptance Criteria

1. THE Insights_Lib SHALL compute the Streak from the events, `now` and `tzOffsetMinutes`.
2. THE Insights_Lib SHALL return a Streak that is an integer greater than or equal to 0.
3. WHEN there are no events, THE Insights_Lib SHALL return a Streak of 0.
4. WHEN there is at least one event today, THE Insights_Lib SHALL count consecutive Local_Days backward from today that each have an event.
5. WHEN there is no event today and at least one event yesterday, THE Insights_Lib SHALL count consecutive Local_Days backward from yesterday that each have an event.
6. WHEN the most recent event is older than yesterday, THE Insights_Lib SHALL return a Streak of 0.
7. WHEN an event has a time later than `now`, THE Insights_Lib SHALL ignore that event.
8. THE Insights_Panel SHALL display the Streak with the label "day streak" or "day streaks" matching the count, as text.

### Requirement 6: Cards reviewed today

**User Story:** As a student, I want to see how many cards I reviewed today, so that I can pace myself.

#### Acceptance Criteria

1. THE Insights_Lib SHALL return the count of events whose Local_Day equals today's Local_Day and whose time is not later than `now`.
2. WHEN there are no events today, THE Insights_Lib SHALL return 0.
3. THE Insights_Panel SHALL display the count as text with the label "reviewed today".

### Requirement 7: Accuracy over the last 7 days

**User Story:** As a student, I want to see my recent accuracy, so that I know whether I am improving.

#### Acceptance Criteria

1. THE Insights_Lib SHALL compute Accuracy_7d as correct events divided by all events within the 7 Local_Days ending today.
2. THE Insights_Lib SHALL return Accuracy_7d as a number from 0 to 1 inclusive, or `null`.
3. WHEN there are no events in the window, THE Insights_Lib SHALL return `null` and SHALL NOT return `NaN`.
4. THE Insights_Lib SHALL exclude events older than the window and events later than `now`.
5. WHILE Accuracy_7d is a number, THE Insights_Panel SHALL display it as a whole-number percentage with the label "accuracy, 7 days".
6. WHILE Accuracy_7d is `null`, THE Insights_Panel SHALL display "No reviews yet" in place of a percentage.

### Requirement 8: Three weakest rooms

**User Story:** As a student, I want to see which rooms need the most work, so that I can choose what to quiz next.

#### Acceptance Criteria

1. THE Insights_Lib SHALL return at most 3 Weakest_Rooms.
2. THE Insights_Lib SHALL order Weakest_Rooms by average `weaknessScore` of the room's unbanished cards, highest first, using the room id as the tie-breaker.
3. THE Insights_Lib SHALL exclude rooms that have no unbanished cards.
4. WHEN no room has an unbanished card, THE Insights_Panel SHALL display "No weak rooms. All ghosts are banished or none exist yet."
5. THE Insights_Panel SHALL display each weak room as its title with a text value of the form "weakness N%", where N is the average weakness as a whole number from 0 to 100.
6. THE Insights_Lib SHALL accept `now` as a parameter to decide which cards are banished.

### Requirement 9: Bar chart with a text alternative

**User Story:** As a student using a screen reader, I want the chart data available as text, so that I get the same information as sighted users.

#### Acceptance Criteria

1. THE Insights_Lib SHALL return one data point per Local_Day for the 7 days ending today, ordered oldest first, each with a date key, a weekday label, a review count and a correct count.
2. THE Bar_Chart SHALL render the 7 data points as an inline SVG using only `<svg>`, `<rect>` and `<text>` elements and no chart library.
3. THE Bar_Chart SHALL scale bar heights so the largest count fills the plot height, and SHALL render a bar of zero height for a count of 0.
4. THE Bar_Chart SHALL render the SVG with `role="img"` and an `aria-label` that summarizes the total reviews in the 7 days.
5. THE Insights_Panel SHALL render a Chart_Table, hidden visually with the existing `.sr-only` class, with one row per Local_Day showing the weekday label, review count and correct count.
6. THE Bar_Chart SHALL show each day's weekday label as visible text.
7. WHEN all 7 counts are 0, THE Insights_Panel SHALL render the Bar_Chart with 7 zero-height bars and display the text "No reviews in the last 7 days".
8. THE Bar_Chart SHALL use the `--accent` token for bars and the `--track` token for the baseline, and SHALL NOT convey a value by color alone.

### Requirement 10: Empty and loading states

**User Story:** As a new student, I want the panel to make sense before I have studied, so that it does not look broken.

#### Acceptance Criteria

1. WHEN the Review_Log is empty, THE Insights_Panel SHALL display a streak of 0, 0 reviewed today and "No reviews yet" for accuracy.
2. WHEN the Store holds no notes, THE Dashboard SHALL NOT render the Insights_Panel.
3. THE Insights_Lib SHALL return a defined result for an empty event list, an empty room list and any `now`.

### Requirement 11: Privacy and answer secrecy

**User Story:** As a student, I want quizzes to stay honest, so that the panel never shows me an answer before I answer.

#### Acceptance Criteria

1. THE Insights_Panel SHALL render no Answer_Text.
2. THE Chart_Table and the Bar_Chart `aria-label` SHALL contain no Answer_Text.
3. THE Insights_Panel SHALL make no network request.
4. THE Insights_Panel and its logic SHALL work fully offline.

### Requirement 12: Accessibility, design tokens and motion

**User Story:** As a student with accessibility needs, I want the panel to be readable and usable on a phone, so that I can use it anywhere.

#### Acceptance Criteria

1. THE Insights_Panel SHALL use only the palette tokens defined in `src/index.css` and SHALL NOT add new hues.
2. THE Insights_Panel SHALL show all text at a contrast ratio of at least 4.5:1 against its background, and SHALL show chart bars and the baseline at a contrast ratio of at least 3:1.
3. THE Insights_Panel SHALL be a `<section>` with an accessible name, and its statistics SHALL be readable as text in DOM order without the chart.
4. WHERE the Insights_Panel contains an interactive control, THE control SHALL have a minimum 44x44px tap target on mobile, a visible `:focus-visible` ring and keyboard access.
5. WHEN the viewport is 390px wide, THE Insights_Panel SHALL fit without horizontal scroll.
6. THE Insights_Panel SHALL NOT use animation or transition on the Bar_Chart.
7. IF any animation or transition is added to the Insights_Panel, THEN THE stylesheet SHALL disable it inside `@media (prefers-reduced-motion: reduce)`.
8. THE Insights_Panel SHALL NOT use `aria-live`, because the values change only on user reviews and not while the panel is in view.

### Requirement 13: Architecture and quality gates

**User Story:** As a maintainer, I want the logic isolated and tested, so that the feature is easy to change safely.

#### Acceptance Criteria

1. THE Insights_Lib and Review_Log_Lib SHALL contain no React, Zustand or DOM imports.
2. THE Insights_Lib and Review_Log_Lib SHALL accept `now` as a parameter and SHALL NOT call `Date.now()` except as a parameter default.
3. THE Insights_Panel SHALL read the Store and call Insights_Lib functions, and SHALL contain no statistics logic.
4. THE project SHALL add no new dependencies.
5. THE Insights_Lib and Review_Log_Lib SHALL have vitest unit tests and fast-check property tests with at least 100 runs per property.
6. WHEN the change is complete, `npm run build`, `npm run lint` and `npm test` SHALL all pass.
7. THE Review_Event type, the Review_Log type and the Schema_Version constant SHALL be defined in `src/types.ts` and `src/lib/reviewLog.ts`.
