# Requirements Document

## Introduction

Data Safety and Offline gives Haunted Notes users control over their data and lets the app load without a network. Users can export all notes, flashcards and review history to a JSON file with a schema version, and import such a file after strict validation and an explicit confirmation. The import file is treated as untrusted input. A hand-written service worker and web app manifest make the app shell load offline and be installable. The service worker is registered only in production builds. The Audio tab shows whether the Whisper model is already stored in the browser, so the user knows whether audio transcription works offline.

The feature depends on the `study-insights` spec, which is built first. It reuses the `ReviewLog` type and `sanitizeReviewLog` from `src/lib/reviewLog.ts`. All validation, export and merge logic lives in pure modules in `src/lib`. No new dependency and no new network call is added.

The user was unavailable during spec creation. Decisions were made autonomously and are recorded under "Assumptions".

## Assumptions

- Export contains `notes`, `flashcards` and `reviewLog`. UI settings (`currentView`, `soundEnabled`, `quizNoteId`, `quizDueOnly`, `isDemoLoaded`) are not exported and never imported.
- The export envelope is `{ app: "haunted-notes", schemaVersion: 1, exportedAt, notes, flashcards, reviewLog }`. `reviewLog` is the study-insights `ReviewLog` object (`{ v, events }`), kept as is.
- Limits (constants in `src/lib/backup.ts`): file size 5 MiB; 500 notes; 5000 flashcards; note `rawText` 20000 characters; note `title` 200; flashcard `sentence` 1000, `prompt` 1000, `clozeWord` 100; ids 100 characters; `reviewLog.events` input length 5000 (the log is then capped to 500 by `sanitizeReviewLog`).
- A count over a limit, a wrong envelope or an unknown `schemaVersion` rejects the whole file. A single invalid note, card or event inside valid limits is dropped and counted in the summary, so one bad record does not block the rest.
- Numeric ranges for flashcards: `ease` 1.3 to 5, `intervalDays` 0 to 36500, `reps`, `streakCorrect` and `streakWrong` integers 0 to 10000, `weaknessScore` 0 to 1, timestamps finite numbers from 0 to 8.64e15 (the valid `Date` range).
- A flashcard whose `noteId` is not among the notes of the file or of the current store is dropped. A flashcard missing only the SRS fields (legacy) gets `defaultSrsFields(now)`.
- Merge never overwrites. When an incoming note or card has the same `id` as an existing one, the existing record is kept unchanged. A flashcard is also treated as a duplicate when an existing card has the same `noteId`, `sentence` and `clozeWord`.
- Review events are merged as a union keyed by `t`, `r` and `c`, then passed through `sanitizeReviewLog`, so the 500-event cap of study-insights still applies. Only the oldest events can be dropped by that cap.
- An incoming `reviewLog` with a `v` newer than this app understands is ignored and a warning is shown. The rest of the file is still imported.
- Import is available on the Dashboard even when no notes exist. The backup panel is a component on the Dashboard below the room list.
- The confirm dialog and summary show only counts and warnings. They never show note text, card text, prompts or answers, so no Answer_Text reaches the DOM through import.
- The service worker file is `public/sw.js`. A small inline Vite plugin in `vite.config.ts` stamps a build id and the precache list into the built `sw.js`. This is code in the repo, not a dependency.
- The precache list holds `index.html`, the Manifest, the icons and every first-party hashed JS and CSS file the build emits, including lazy chunks, so the Audio and Photo tab code loads offline. Source maps, `.wasm` and model files are excluded. The Whisper model, its runtime and the Tesseract assets stay in the browser's own caches.
- Navigation requests use network first with a cached `index.html` fallback, so an online user always receives the newest build. The new worker calls `skipWaiting` and `clients.claim`, and removes only old caches whose name starts with `haunted-shell-`.
- Installability icons are PNG files (192, 512 and a maskable 512) generated once by a Node script that uses only built-in modules (`zlib`, `fs`).
- The Whisper model is considered ready offline when the `transformers-cache` Cache Storage bucket (used by `@huggingface/transformers`) holds the `Xenova/whisper-tiny.en` config, tokenizer and ONNX files. This is a best-effort check of an internal cache name, and the status falls back to "unknown" if the Cache API is unavailable.
- Browser verification (build, preview, Playwright) is run by the implementing agent. If it cannot run, the result is recorded as UNVERIFIED in `KIRO_LOG.md` and the service worker registration stays behind the production guard.

## Glossary

- **Backup_Lib**: The pure module `src/lib/backup.ts` with the export builder, validator, sanitizer and merge functions.
- **Offline_Status_Lib**: The pure module `src/lib/offlineStatus.ts` that computes the Model_Status.
- **Backup_Panel**: The Dashboard component with the Export and Import controls and the result message.
- **Import_Dialog**: The confirm dialog opened after a file passes validation.
- **Store**: The Zustand store in `src/store/useStore.ts`, persisted to localStorage.
- **Export_File**: The JSON file produced by export.
- **Backup_Data**: The validated object `{ notes, flashcards, reviewLog }` extracted from an Export_File.
- **Schema_Version**: The integer `schemaVersion` of the Export_File. The current value is `1`.
- **Untrusted_Input**: Any imported file content, treated as hostile until validated.
- **Import_Summary**: Counts of notes, flashcards and review events that are new, skipped as duplicates, or dropped as invalid, plus warnings.
- **Forbidden_Key**: One of `__proto__`, `constructor` and `prototype`.
- **Merge_Result**: The merged `notes`, `flashcards` and `reviewLog` plus the Import_Summary.
- **Service_Worker**: The hand-written script `public/sw.js`.
- **Shell_Cache**: The Cache Storage bucket named `haunted-shell-<build id>` that holds the app shell.
- **App_Shell**: `index.html`, the hashed JS and CSS bundles of the initial build, the manifest and the icons.
- **Manifest**: The file `public/manifest.webmanifest`.
- **Model_Cache**: The Cache Storage bucket `transformers-cache` managed by `@huggingface/transformers`.
- **Model_Status**: One of `ready`, `not-downloaded` or `unknown`.
- **Audio_Tab**: The audio input tab of `AddNoteView`.
- **Answer_Text**: The `clozeWord`, `sentence` and any text revealing the answer of a flashcard.

## Requirements

### Requirement 1: Export all data to a JSON file

**User Story:** As a student, I want to download all my notes, cards and review history, so that I have a backup I control.

#### Acceptance Criteria

1. WHEN the user activates the Export button, THE Backup_Panel SHALL download one JSON file that contains all notes, all flashcards and the review log from the Store.
2. THE Backup_Lib SHALL build the Export_File with the fields `app` set to `haunted-notes`, `schemaVersion` set to 1, `exportedAt` set to the time passed as a parameter, `notes`, `flashcards` and `reviewLog`.
3. THE Backup_Lib SHALL receive the export time as a parameter and SHALL NOT read the clock.
4. THE Backup_Panel SHALL name the downloaded file `haunted-notes-backup-YYYY-MM-DD.json` using the local date of the export.
5. WHEN the Store holds no notes, THE Backup_Panel SHALL still export a valid Export_File with empty arrays.
6. THE Backup_Panel SHALL release the temporary download URL after the download starts.
7. THE Export_File SHALL exclude the UI settings listed in Assumptions.
8. WHEN the export finishes, THE Backup_Panel SHALL show a text status message in an `aria-live` region stating the number of notes and flashcards exported.

### Requirement 2: Round-trip fidelity

**User Story:** As a student, I want an exported file to restore exactly what I exported, so that no study data changes in transit.

#### Acceptance Criteria

1. FOR ALL valid Backup_Data, serializing it to an Export_File string then validating that string SHALL produce Backup_Data equal to the original (round-trip property).
2. THE Backup_Lib SHALL serialize the Export_File as JSON text that `JSON.parse` accepts.
3. THE Backup_Lib SHALL keep the order of `notes`, `flashcards` and `reviewLog.events` through export and validation.

### Requirement 3: Import file intake

**User Story:** As a student, I want to pick a backup file and see a clear result, so that I know whether the file is usable.

#### Acceptance Criteria

1. WHEN the user activates the Import button, THE Backup_Panel SHALL open a file picker that accepts `.json` files.
2. IF the selected file is larger than 5 MiB, THEN THE Backup_Panel SHALL reject the file before reading its content and SHALL show an error message that names the limit.
3. IF the file content is not valid JSON, THEN THE Backup_Lib SHALL return an error result with the reason `not-json` and THE Backup_Panel SHALL show an error message.
4. IF the file cannot be read, THEN THE Backup_Panel SHALL show an error message and leave the Store unchanged.
5. WHEN a file is rejected for any reason, THE Store SHALL remain unchanged.
6. THE Backup_Lib SHALL return a result value for every input and SHALL NOT throw for any input string or any parsed value.
7. WHEN the user selects the same file twice in a row, THE Backup_Panel SHALL process the file again.

### Requirement 4: Structure, type, length, count and version validation

**User Story:** As a student, I want files that are damaged or from other apps rejected, so that my data stays consistent.

#### Acceptance Criteria

1. IF the parsed value is not a plain object, THEN THE Backup_Lib SHALL reject the file with the reason `not-an-object`.
2. IF `app` is not the string `haunted-notes`, THEN THE Backup_Lib SHALL reject the file with the reason `wrong-app`.
3. IF `schemaVersion` is not an integer, THEN THE Backup_Lib SHALL reject the file with the reason `bad-version`.
4. IF `schemaVersion` is greater than 1 or less than 1, THEN THE Backup_Lib SHALL reject the file with the reason `unknown-version`.
5. IF `notes` or `flashcards` is not an array, THEN THE Backup_Lib SHALL reject the file with the reason `bad-shape`.
6. IF `notes` holds more than 500 items or `flashcards` holds more than 5000 items, THEN THE Backup_Lib SHALL reject the file with the reason `too-many`.
7. WHEN a note does not have a string `id` of 1 to 100 characters, a string `rawText` of 0 to 20000 characters, an `inputMethod` that is one of `type`, `mic`, `photo` or `audio`, and a finite `createdAt` in range, THE Backup_Lib SHALL drop that note and count it as invalid.
8. WHEN a note has a `title` that is not a string of 0 to 200 characters, THE Backup_Lib SHALL drop the `title` field and keep the note.
9. WHEN a flashcard has a missing or mistyped `id`, `noteId`, `sentence`, `clozeWord` or `prompt`, or a string longer than its limit, or a numeric field out of its range, THE Backup_Lib SHALL drop that flashcard and count it as invalid.
10. WHEN a flashcard has a `noteId` that matches no valid note in the file and no note in the Store, THE Backup_Lib SHALL drop that flashcard and count it as orphaned.
11. WHEN a flashcard lacks all four SRS fields `ease`, `intervalDays`, `dueAt` and `reps`, THE Backup_Lib SHALL fill them with the values of `defaultSrsFields` for the import time passed as a parameter.
12. WHEN two items in the file have the same `id` within `notes` or within `flashcards`, THE Backup_Lib SHALL keep the first and count the later ones as duplicates.

### Requirement 5: Sanitization and prototype pollution defense

**User Story:** As a student, I want a malicious file unable to change how the app behaves, so that importing is safe.

#### Acceptance Criteria

1. THE Backup_Lib SHALL build every accepted note, flashcard and event as a new object that contains exactly the known keys and no other keys.
2. WHEN a record in the file has keys that are not part of its schema, THE Backup_Lib SHALL omit those keys from the result.
3. THE Backup_Lib SHALL NOT copy any Forbidden_Key from the file to any result object, at any depth.
4. IF an `id` or `noteId` equals a Forbidden_Key, THEN THE Backup_Lib SHALL drop the record that holds it and count it as invalid.
5. THE Backup_Lib SHALL use `Map` or `Set` for every lookup keyed by a value from the file.
6. THE Backup_Lib SHALL NOT use `Object.assign`, spread or `JSON.parse` revivers to copy untrusted objects into result objects.
7. WHEN validation of any input finishes, THE `Object.prototype` SHALL have no property that was absent before validation.
8. FOR ALL parsed JSON values, including values with own keys named `__proto__`, validation SHALL return a result without throwing.

### Requirement 6: Safe rendering

**User Story:** As a student, I want imported text never to run as code, so that a bad file cannot attack the app.

#### Acceptance Criteria

1. THE Backup_Panel and THE Import_Dialog SHALL render every value derived from the file as React text content.
2. THE Backup_Panel and THE Import_Dialog SHALL NOT use `dangerouslySetInnerHTML`, `innerHTML`, `outerHTML`, `insertAdjacentHTML` or `document.write`.
3. THE Import_Dialog SHALL show only counts and fixed warning texts and SHALL NOT show note text, flashcard text or Answer_Text.
4. THE Backup_Panel SHALL NOT place Answer_Text in the DOM, in attributes or in `aria-live` messages at any time during export or import.
5. WHEN the file name of the selected file is shown, THE Backup_Panel SHALL render it as text content only.

### Requirement 7: Summary and confirmation before merge

**User Story:** As a student, I want to see what an import will do and approve it, so that nothing changes by surprise.

#### Acceptance Criteria

1. WHEN a file passes validation, THE Backup_Panel SHALL open the Import_Dialog that shows the Import_Summary before any change to the Store.
2. THE Import_Summary SHALL state, for notes, flashcards and review events, the number to add, the number skipped as duplicates and the number dropped as invalid.
3. THE Import_Dialog SHALL have the role `dialog`, `aria-modal` set to true and an accessible name.
4. WHEN the Import_Dialog opens, THE Import_Dialog SHALL move keyboard focus to its Cancel button.
5. WHILE the Import_Dialog is open, THE Import_Dialog SHALL keep keyboard focus inside the dialog.
6. WHEN the user presses Escape or activates Cancel, THE Backup_Panel SHALL close the Import_Dialog, leave the Store unchanged and return focus to the Import button.
7. WHEN the user activates Confirm, THE Backup_Panel SHALL merge the data into the Store once and show a result message in an `aria-live` region.
8. THE Import_Dialog buttons SHALL be at least 44 by 44 CSS pixels.
9. IF the Import_Summary has zero notes, zero flashcards and zero review events to add, THEN THE Import_Dialog SHALL state that nothing new will be added and SHALL NOT offer the Confirm button.
10. WHEN the Import_Summary contains warnings, THE Import_Dialog SHALL list each warning as text.

### Requirement 8: Merge without duplicates or data loss

**User Story:** As a student, I want importing to add to my data, so that I never lose what I already have.

#### Acceptance Criteria

1. THE Backup_Lib SHALL keep every existing note and flashcard of the Store unchanged after a merge.
2. WHEN an incoming note has the same `id` as an existing note, THE Backup_Lib SHALL skip the incoming note.
3. WHEN an incoming flashcard has the same `id` as an existing flashcard, or the same `noteId`, `sentence` and `clozeWord` as an existing flashcard, THE Backup_Lib SHALL skip the incoming flashcard.
4. THE Backup_Lib SHALL append new notes and new flashcards after the existing ones, in file order.
5. FOR ALL pairs of Store state and valid Backup_Data, THE merged result SHALL contain no two notes with the same `id` and no two flashcards with the same `id` or with the same `noteId`, `sentence` and `clozeWord`.
6. FOR ALL pairs of Store state and valid Backup_Data, merging the same Backup_Data a second time SHALL leave the notes, flashcards and review log unchanged (idempotence).
7. FOR ALL pairs of Store state and valid Backup_Data, THE Import_Summary counts SHALL satisfy added plus skipped equal to the number of valid incoming items, for notes and for flashcards.
8. THE Backup_Lib SHALL NOT change any field of an existing flashcard, including SRS fields, when an incoming flashcard matches it.
9. WHEN the merge is applied, THE Store SHALL replace `notes`, `flashcards` and `reviewLog` in one state update.
10. THE Store SHALL leave `currentView`, `soundEnabled`, `quizNoteId`, `quizDueOnly` and `isDemoLoaded` unchanged by an import.

### Requirement 9: Review log integration

**User Story:** As a student, I want my study streak and accuracy to survive a restore, so that insights stay correct.

#### Acceptance Criteria

1. THE Backup_Lib SHALL export the review log exactly as stored, with its own `v` field.
2. WHEN an incoming `reviewLog` has a `v` equal to the current review log version, THE Backup_Lib SHALL validate its events with `sanitizeReviewLog`.
3. IF an incoming `reviewLog` has a `v` newer than `REVIEW_LOG_VERSION` or is not an object, THEN THE Backup_Lib SHALL ignore it, add a warning to the Import_Summary and import the other data.
4. THE Backup_Lib SHALL merge events as a union keyed by `t`, `r` and `c` and SHALL pass the union through `sanitizeReviewLog`, so the result has at most 500 events in order of `t`.
5. IF an incoming event has an `r` that is not a string of 1 to 100 characters or is a Forbidden_Key, THEN THE Backup_Lib SHALL drop the event and count it as invalid.
6. IF `reviewLog.events` in the file holds more than 5000 items, THEN THE Backup_Lib SHALL reject the file with the reason `too-many`.

### Requirement 10: Service worker and app shell caching

**User Story:** As a student, I want the app to open without a network, so that I can study anywhere.

#### Acceptance Criteria

1. WHERE the build is a production build, THE app SHALL register the Service_Worker after the window `load` event.
2. WHILE the build is a development build, THE app SHALL NOT register a Service_Worker.
3. THE Service_Worker SHALL store the App_Shell in a Shell_Cache whose name contains the build id.
4. WHEN a navigation request is made, THE Service_Worker SHALL try the network first and SHALL answer with the cached `index.html` when the network fails.
5. WHEN a same-origin GET request for a hashed asset is made, THE Service_Worker SHALL answer from the Shell_Cache when present and otherwise fetch it from the network and store a successful response.
6. THE Service_Worker SHALL pass every request that is not a same-origin GET request to the network without caching it.
7. THE Service_Worker SHALL NOT cache responses with a status other than 200.
8. THE Service_Worker SHALL NOT read, write or delete the Model_Cache or any bucket whose name does not start with `haunted-shell-`.
9. THE Service_Worker SHALL NOT cache or intercept requests to the Whisper model host or the Tesseract asset host, and SHALL NOT cache any response for a `.wasm`, `.onnx` or `.traineddata` file.
10. IF registration of the Service_Worker fails, THEN THE app SHALL continue to work without it and SHALL log one console warning.
11. THE app SHALL work with the Service_Worker absent, in browsers without service worker support and in non-secure contexts.

### Requirement 11: Web app manifest and installability

**User Story:** As a student, I want to install the app on my device, so that it opens like a native app.

#### Acceptance Criteria

1. THE Manifest SHALL define `name`, `short_name`, `start_url`, `scope`, `display` set to `standalone`, `background_color`, `theme_color` and `icons`.
2. THE Manifest `icons` SHALL include one PNG of 192 by 192 pixels, one PNG of 512 by 512 pixels and one maskable PNG of 512 by 512 pixels, and each file SHALL exist in `public/`.
3. THE Manifest `theme_color` and `background_color` SHALL equal the `--bg` token value `#0d0d14`.
4. THE `index.html` SHALL link the Manifest and an Apple touch icon.
5. THE Manifest `start_url` and `scope` SHALL be relative so the app works under any base path.
6. THE icon generator script SHALL produce the PNG files using only built-in Node modules.

### Requirement 12: Versioned cache and safe updates

**User Story:** As a student, I want new versions to arrive without getting stuck on an old one, so that fixes reach me.

#### Acceptance Criteria

1. WHEN the app is built, THE build SHALL write a new build id and the list of App_Shell URLs into the built `sw.js`, so that the file content changes whenever the bundle changes.
2. WHEN a new Service_Worker installs, THE Service_Worker SHALL call `skipWaiting` after its Shell_Cache is filled.
3. WHEN a new Service_Worker activates, THE Service_Worker SHALL delete every cache whose name starts with `haunted-shell-` and differs from the current Shell_Cache, and SHALL call `clients.claim`.
4. THE app SHALL register the Service_Worker with `updateViaCache` set to `none` so the browser always checks `sw.js` on the network.
5. THE Service_Worker SHALL NOT cache `sw.js` or `manifest.webmanifest` responses.
6. IF a precache request fails during install, THEN THE Service_Worker SHALL fail the install so the previous worker stays active.
7. WHEN a navigation succeeds on the network, THE Service_Worker SHALL update the cached `index.html`.
8. THE Service_Worker SHALL contain a fixed marker so a test can check that both the build id and the precache list were stamped.

### Requirement 13: Offline model status in the Audio tab

**User Story:** As a student, I want to know whether audio transcription works offline, so that I download the model before I lose the network.

#### Acceptance Criteria

1. WHEN the Audio_Tab is shown, THE Audio_Tab SHALL display the Model_Status as text.
2. THE Offline_Status_Lib SHALL compute the Model_Status from a list of cached request URLs, a model id and a list of required file names.
3. WHEN the cached URLs contain every required file name for the model id, THE Audio_Tab SHALL display "Whisper model ready offline".
4. WHEN the cached URLs miss any required file, THE Audio_Tab SHALL display "Whisper model not downloaded yet" and a sentence that a one-time download is needed.
5. IF the Cache API is unavailable or reading the Model_Cache fails, THEN THE Audio_Tab SHALL display "Offline model status unknown".
6. WHEN the model download finishes, THE Audio_Tab SHALL refresh the Model_Status.
7. THE Audio_Tab SHALL show the Model_Status with text and an icon, and SHALL NOT convey the status by color alone.
8. THE Audio_Tab SHALL read the Model_Cache only after the Audio_Tab is first shown, and SHALL NOT import `@huggingface/transformers` for that check.
9. THE Model_Status check SHALL NOT start a network request.

### Requirement 14: Verification and installability log

**User Story:** As the project owner, I want offline behavior proven in a real browser, so that I trust the claim.

#### Acceptance Criteria

1. WHEN `npm run build` and `npm run preview` have started the production build, THE verifier SHALL load the app with Playwright, wait until the Service_Worker controls the page, go offline, reload, and confirm that the page renders.
2. WHILE the browser is offline after the reload, THE verifier SHALL confirm that Try demo loads demo notes and that a quiz question can be answered.
3. THE verifier SHALL record in `haunted-notes/KIRO_LOG.md` the result of the manifest check, the icon load check, the Service_Worker registration check and the offline reload check.
4. IF the verification cannot be run, THEN THE verifier SHALL record the result as UNVERIFIED with the reason in `haunted-notes/KIRO_LOG.md`.
5. THE verifier SHALL confirm that the development server run does not register a Service_Worker.

### Requirement 15: Project constraints

**User Story:** As the maintainer, I want this feature to respect project rules, so that it stays small, accessible and private.

#### Acceptance Criteria

1. THE feature SHALL add no entry to `dependencies` or `devDependencies` in `package.json`.
2. THE feature SHALL add no network call beyond those allowed in `product.md` and `tech.md`.
3. THE Backup_Lib and THE Offline_Status_Lib SHALL import no React, Zustand or DOM code and SHALL read no clock.
4. THE Backup_Lib SHALL have unit tests and fast-check property tests that run at least 100 iterations each.
5. FOR ALL inputs from `fc.anything()` and from JSON strings with crafted keys, THE Backup_Lib validator SHALL return a result and SHALL NOT throw (error-condition property).
6. THE Backup_Panel and Import_Dialog SHALL use the existing palette tokens, keep tap targets of at least 44 by 44 pixels, show a visible focus ring and have no animation that lacks a `prefers-reduced-motion` override.
7. THE feature SHALL add no new persisted Store field and so SHALL need no new migration.
8. THE feature SHALL keep layouts free of horizontal scroll at 390 pixels width.
