# Haunted Notes

A Vite + React + TypeScript app for managing notes, flashcards, and audio-based note capture.

## Project structure

The app code lives in the nested project directory:

- `haunted-notes/` — application source and configuration

## Kiro files

The project includes Kiro metadata in the project root folder:

- `KIRO_LOG.md` — development log for specs, hooks, and steering changes
- `.kiro/specs/` — product specs and requirements documents
- `.kiro/hooks/` — automation hooks used during development
- `.kiro/steering/` — project-wide guidance and constraints

### Actual folders present

- `.kiro/specs/`
  - `haunted-notes.md`
  - `srs-and-demo.md`
- `.kiro/hooks/`
  - `lint-on-save.json`
  - `new-component-test.json`

## Local development

```bash
npm install
npm run dev
```

## Notes

- `KIRO_LOG.md` is located in `haunted-notes/KIRO_LOG.md` for this project directory.
- The README reflects the actual folder names and files present in the repository.
