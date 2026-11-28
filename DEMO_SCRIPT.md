# Haunted Notes: faceless demo video (no voice, no face)

Target length: 2:45 (hard limit under 3:00; judges need not watch past 3 minutes).
Format: screen recording + short on-screen captions. The narrated Run demo carries spoken narration (see "Record the narrated run" below); no music. Your voice is not recorded.

## What the rules require
- Under 3 minutes, public on YouTube, link pasted into the Devpost form.
- Shows the project working on the device it was built for (a web app in a browser).
- No third-party trademarks or copyrighted music or other material.
- Scored under "Presentation": clear end-to-end demo, what problem it solves, who it is for, why it matters, easy to follow, memorable.

## Fastest route: let the app play itself
The app has a self-playing **Run demo** (replaces the old 60-second tour). It takes about 2:10 at normal speed (exact times in `docs/DEMO_TIMING.md`), narrated, so it fits well under 3:00 with an end card on top.
1. Open the app at `/?demo=1` and click **Start with sound** (browsers only play sound after a click), or press **Run demo**. For a silent run that starts by itself use `/?demo=1&sound=0`. Use a clean browser window, zoom 110 to 125%.
2. Record the window with OBS or Game Bar (see below). After the click do not touch the mouse or keyboard: a transparent shield ignores clicks, and Escape stops the run.
3. The caption bar at the bottom is part of the recording. Chapters: the problem, four inputs, ghost rooms, the quiz, spaced repetition, study insights, your data stays yours, built with Kiro, end card.
4. Add an end card (live URL and GitHub repo, readable for at least 3 seconds) in Clipchamp. Keep the total under 3:00.
5. The run uses sample data only and restores your own notes afterwards. It does not show the offline mode or the phone-width view; cut those in separately if you want them (table below).

## The first 15 seconds: the project works from the start
Run demo has no title card. From the first frame the real app is on screen: the dashboard, already loaded with the built-in demo data and its ghosts, with the caption bar at the bottom. The judges see the project working while the problem is being said, and the pitch is the first thing they hear:

| Time | On screen | Narration and caption |
|---|---|---|
| 0:00 | The dashboard with the demo rooms and ghosts | "Taking notes is easy." |
| 0:02 | Same, rooms outlined | "Knowing what to revise," / "and when, across many subjects, is the hard part." |
| 0:07 | A ghost outlined | "Haunted Notes turns your notes into ghosts" |
| 0:10 | "Review ladder: 2, 3, 5, 7 days" outlined | "and remembers the revision schedule for you." |
| 0:12 | Start Quiz outlined | "You only have to remember the answers." |

Do not add a title card or a logo before it. If you cut an intro in the editor, start the recording at the click. The review method is the fixed 2-3-5-7 day ladder (reviews on days 2, 5, 10 and 17): say that, never another set of numbers, and never claim that other apps have no scheduling.

## Record the narrated run (with sound)
1. Turn on Windows Focus Assist so no notification sound or pop-up lands in the recording. Close other apps that make sound (music, chat, mail).
2. Leave the app's own sound button in the top bar as it is. During Run demo the right and wrong answer sounds play anyway, quietly under the narration, and follow the **Sound on / Sound off** button in the demo bar.
3. OBS Studio: add a **Window Capture** (or Display Capture) for the browser and an **Audio Output Capture** (Desktop Audio). Turn the **microphone off** (Mic/Auxiliary muted), so only the narration is recorded. Windows Game Bar: press Win+G, open the capture options and tick **Record system audio** (not the microphone).
4. Set the system volume to a normal level and check the OBS meter moves when you play a clip.
5. **Start the recording first**, then open `/?demo=1` and click **Start with sound** (or click **Run demo**). The click is needed once; after that leave the mouse alone.
6. Let the run finish on the end card, then stop the recording about 3 seconds later. The run is about 2:10 (exact times in `docs/DEMO_TIMING.md`), so the recording is a few seconds longer with the click and the stop; trim the ends in Clipchamp and add the end card (live URL and repo). You have room for about 45 seconds more under 3:00.
7. Play the file back with headphones: each clip should land on its chapter and nothing should be cut off. If a clip is too long for its chapter, see `docs/DEMO_TIMING.md`.
8. Say where the narration comes from: the README has the line `Narration: <ADD: tool used and its licence terms>`. Fill it in before you submit.

## Free tools
- Record: OBS Studio (free) or the Windows Game Bar (Win+G). Record at 1920x1080.
- Edit and captions: Clipchamp (free, built into Windows) or DaVinci Resolve (free). Use text overlays for captions.
- Sound: the narration comes from the app's own clips. Do not add music unless it is licensed for this use. The quiz's answer sounds are quiet and part of the demo.

## Before you record (privacy, since you will not be on camera)
1. Use a clean browser window (incognito, bookmarks bar hidden, no other tabs), zoom 110 to 125%.
2. Turn on Windows Focus Assist so no notification pops up.
3. Do not show Kiro's account menu, email addresses, the Devpost form, or your file explorer path.
4. Use the built-in demo data and a short sample audio clip, not personal notes.
5. Record each scene as a separate clip, so one mistake does not cost the whole take.

## Shot list with captions (one caption = 3 to 4 seconds, 8 words max)

| Time | Screen | Caption |
|---|---|---|
| 0:00-0:15 | The real dashboard with the demo ghosts (no title card) | "Taking notes is easy. Knowing what to revise, and when, is the hard part." |
| 0:15-0:20 | Add Note with the "Four inputs, one ghost pipeline" strip | "Students re-read notes, but rarely test themselves" |
| 0:20-0:45 | Add Note: show typing, the Audio tab (upload a short clip, speed up the transcription 2x), the Photo tab | "Type, speak, snap a photo, or upload audio" then "All processed in your browser" |
| 0:45-1:00 | Click Try demo: dashboard with rooms and the five ghost types | "Every unmastered fact becomes a ghost" |
| 1:00-1:35 | Quiz: use a Hint, answer wrong (shake), answer right (banish with particles), use Reveal, finish, press Review missed | "Answer right to banish it" then "Miss one, and it haunts you again" |
| 1:35-1:50 | Dashboard "Next ghost returns in 1 day", then the Run demo clock jump (two days) so orange ghosts return | "Spaced repetition brings ghosts back" |
| 1:50-2:00 | Study insights panel: streak, accuracy, chart | "Track your streak and weak rooms" |
| 2:00-2:10 | Turn on offline in DevTools, reload, Try demo works; show Export backup | "Works offline. Your notes stay in your browser" |
| 2:10-2:20 | Phone-width view (390px), then the Run demo button | "Built for phones, keyboards and reduced motion" |
| 2:20-2:38 | Quick cuts: the .kiro folder (specs, steering, hooks, agent), test run showing all tests passing, a Playwright screenshot | "Built with Kiro: specs, steering, hooks, a custom agent, MCP and property-based tests" |
| 2:38-2:45 | End card with the live URL and the GitHub repo | "Built for Kiroween 2026" |

Keep the cuts quick. Speed up (2x) anything slow, such as the transcription and the model download.

## Export and upload
1. Export as 1080p MP4.
2. Upload to YouTube as **Public** (not unlisted or private). Set "not made for kids" if asked.
3. Title: "Haunted Notes: Kiroween 2026 demo".
4. Description: one sentence on what it does, the live URL, the GitHub link, and "Built with Kiro for the Kiroween 2026 hackathon".
5. Open the video in a private window to confirm it plays, and check the length is under 3:00.

## Final checks
- No face, voice, email, tabs or notifications visible.
- Every screen shows the app working, not a mock-up.
- The live URL and repo link are readable for at least 3 seconds.
