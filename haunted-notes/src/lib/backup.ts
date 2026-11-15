import type { Flashcard, Note, ReviewEvent, ReviewLog, SrsFields } from '../types';
import { REVIEW_LOG_VERSION, emptyReviewLog, sanitizeReviewLog } from './reviewLog';
import { defaultSrsFields } from './srs';

export const BACKUP_APP = 'haunted-notes';
export const BACKUP_SCHEMA_VERSION = 1;
export const BACKUP_LIMITS = {
  fileBytes: 5 * 1024 * 1024,
  notes: 500,
  flashcards: 5000,
  events: 5000,
  id: 100,
  rawText: 20000,
  title: 200,
  sentence: 1000,
  prompt: 1000,
  clozeWord: 100,
} as const;

export interface BackupData {
  notes: Note[];
  flashcards: Flashcard[];
  reviewLog: ReviewLog;
}

export interface ExportFile extends BackupData {
  app: string;
  schemaVersion: number;
  exportedAt: number;
}

/** Builds the export envelope. Copies exactly the three data fields; UI settings are never included. */
export function buildExport(data: BackupData, now: number): ExportFile {
  return {
    app: BACKUP_APP,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: now,
    notes: data.notes,
    flashcards: data.flashcards,
    reviewLog: data.reviewLog,
  };
}

export function serializeExport(file: ExportFile): string {
  return JSON.stringify(file, null, 2);
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

/**
 * File name `haunted-notes-backup-YYYY-MM-DD.json` using the local date.
 * `tzOffsetMinutes` follows `Date.prototype.getTimezoneOffset` (UTC minus local, in minutes).
 */
export function backupFileName(now: number, tzOffsetMinutes = 0): string {
  const local = new Date(now - tzOffsetMinutes * 60000);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth() + 1;
  const d = local.getUTCDate();
  return `haunted-notes-backup-${pad(y, 4)}-${pad(m, 2)}-${pad(d, 2)}.json`;
}

/** True when `bytes` is a finite number from 0 to the file size limit, inclusive. */
export function isFileSizeAllowed(bytes: number): boolean {
  return Number.isFinite(bytes) && bytes >= 0 && bytes <= BACKUP_LIMITS.fileBytes;
}

// ---- Validation and sanitization (untrusted input) ---------------------

export type RejectReason =
  | 'not-json'
  | 'not-an-object'
  | 'wrong-app'
  | 'bad-version'
  | 'unknown-version'
  | 'bad-shape'
  | 'too-many';

export type ImportWarning = 'review-log-ignored';

export interface DroppedCounts {
  notes: number;
  flashcards: number;
  events: number;
}

export type ValidateResult =
  | { ok: true; data: BackupData; dropped: DroppedCounts; warnings: ImportWarning[] }
  | { ok: false; reason: RejectReason };

export interface ValidateContext {
  existingNoteIds: ReadonlySet<string>;
  now: number;
}

const MAX_TIME = 8.64e15;
const FORBIDDEN_KEYS: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype']);
const INPUT_METHODS: ReadonlySet<string> = new Set(['type', 'mic', 'photo', 'audio']);

/** True for objects whose prototype is Object.prototype or null (what JSON.parse produces). */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function isForbiddenKey(key: string): boolean {
  return FORBIDDEN_KEYS.has(key);
}

/** Reads an own property only; inherited values are treated as absent. */
function own(obj: Record<string, unknown>, key: string): unknown {
  return Object.hasOwn(obj, key) ? obj[key] : undefined;
}

function isIdString(v: unknown): v is string {
  return typeof v === 'string' && v.length >= 1 && v.length <= BACKUP_LIMITS.id && !isForbiddenKey(v);
}

function isTime(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= MAX_TIME;
}

function inRange(v: unknown, min: number, max: number): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
}

function isCount(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 10000;
}

function strWithin(v: unknown, min: number, max: number): v is string {
  return typeof v === 'string' && v.length >= min && v.length <= max;
}

/** Returns a new Note built from known keys only, or null when the record is invalid. */
export function sanitizeNote(item: unknown): Note | null {
  if (!isPlainObject(item)) return null;
  const id = own(item, 'id');
  const rawText = own(item, 'rawText');
  const inputMethod = own(item, 'inputMethod');
  const createdAt = own(item, 'createdAt');
  const title = own(item, 'title');
  if (!isIdString(id)) return null;
  if (!strWithin(rawText, 0, BACKUP_LIMITS.rawText)) return null;
  if (typeof inputMethod !== 'string' || !INPUT_METHODS.has(inputMethod)) return null;
  if (!isTime(createdAt)) return null;
  const method = inputMethod as Note['inputMethod'];
  if (strWithin(title, 0, BACKUP_LIMITS.title)) {
    return { id, rawText, inputMethod: method, createdAt, title };
  }
  return { id, rawText, inputMethod: method, createdAt };
}

/** Returns a new Flashcard built from known keys only, or null when the record is invalid. */
export function sanitizeCard(item: unknown, now: number): Flashcard | null {
  if (!isPlainObject(item)) return null;
  const id = own(item, 'id');
  const noteId = own(item, 'noteId');
  const sentence = own(item, 'sentence');
  const clozeWord = own(item, 'clozeWord');
  const prompt = own(item, 'prompt');
  const weaknessScore = own(item, 'weaknessScore');
  const streakCorrect = own(item, 'streakCorrect');
  const streakWrong = own(item, 'streakWrong');
  const lastReviewed = own(item, 'lastReviewed');
  if (!isIdString(id) || !isIdString(noteId)) return null;
  if (!strWithin(sentence, 0, BACKUP_LIMITS.sentence)) return null;
  if (!strWithin(clozeWord, 0, BACKUP_LIMITS.clozeWord)) return null;
  if (!strWithin(prompt, 0, BACKUP_LIMITS.prompt)) return null;
  if (!inRange(weaknessScore, 0, 1)) return null;
  if (!isCount(streakCorrect) || !isCount(streakWrong)) return null;
  if (lastReviewed !== null && !isTime(lastReviewed)) return null;

  const hasEase = Object.hasOwn(item, 'ease');
  const hasInterval = Object.hasOwn(item, 'intervalDays');
  const hasDue = Object.hasOwn(item, 'dueAt');
  const hasReps = Object.hasOwn(item, 'reps');
  let srs: SrsFields;
  if (!hasEase && !hasInterval && !hasDue && !hasReps) {
    srs = defaultSrsFields(now);
  } else {
    const ease = own(item, 'ease');
    const intervalDays = own(item, 'intervalDays');
    const dueAt = own(item, 'dueAt');
    const reps = own(item, 'reps');
    if (!inRange(ease, 1.3, 5)) return null;
    if (!inRange(intervalDays, 0, 36500)) return null;
    if (!isTime(dueAt)) return null;
    if (!isCount(reps)) return null;
    srs = { ease, intervalDays, dueAt, reps };
  }
  return {
    id,
    noteId,
    sentence,
    clozeWord,
    prompt,
    weaknessScore,
    streakCorrect,
    streakWrong,
    lastReviewed,
    ease: srs.ease,
    intervalDays: srs.intervalDays,
    dueAt: srs.dueAt,
    reps: srs.reps,
  };
}

interface ReviewLogOutcome {
  log: ReviewLog;
  droppedEvents: number;
  ignored: boolean;
}

function readReviewLog(raw: unknown): ReviewLogOutcome | 'too-many' {
  if (raw === undefined) return { log: emptyReviewLog(), droppedEvents: 0, ignored: false };
  if (!isPlainObject(raw)) return { log: emptyReviewLog(), droppedEvents: 0, ignored: true };
  const v = own(raw, 'v');
  const events = own(raw, 'events');
  if (Array.isArray(events) && events.length > BACKUP_LIMITS.events) return 'too-many';
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > REVIEW_LOG_VERSION || !Array.isArray(events)) {
    return { log: emptyReviewLog(), droppedEvents: 0, ignored: true };
  }
  const clean: ReviewEvent[] = [];
  let droppedEvents = 0;
  for (const item of events as unknown[]) {
    if (!isPlainObject(item)) {
      droppedEvents += 1;
      continue;
    }
    const t = own(item, 't');
    const r = own(item, 'r');
    const c = own(item, 'c');
    if (!isTime(t) || !isIdString(r) || (c !== 0 && c !== 1)) {
      droppedEvents += 1;
      continue;
    }
    clean.push({ t, r, c });
  }
  return { log: sanitizeReviewLog({ v, events: clean }), droppedEvents, ignored: false };
}

/** Total function: never throws, always returns a result. */
export function validateBackup(raw: unknown, ctx: ValidateContext): ValidateResult {
  try {
    if (!isPlainObject(raw)) return { ok: false, reason: 'not-an-object' };
    if (own(raw, 'app') !== BACKUP_APP) return { ok: false, reason: 'wrong-app' };
    const version = own(raw, 'schemaVersion');
    if (typeof version !== 'number' || !Number.isInteger(version)) return { ok: false, reason: 'bad-version' };
    if (version !== BACKUP_SCHEMA_VERSION) return { ok: false, reason: 'unknown-version' };
    const rawNotes = own(raw, 'notes');
    const rawCards = own(raw, 'flashcards');
    if (!Array.isArray(rawNotes) || !Array.isArray(rawCards)) return { ok: false, reason: 'bad-shape' };
    if (rawNotes.length > BACKUP_LIMITS.notes || rawCards.length > BACKUP_LIMITS.flashcards) {
      return { ok: false, reason: 'too-many' };
    }
    const outcome = readReviewLog(own(raw, 'reviewLog'));
    if (outcome === 'too-many') return { ok: false, reason: 'too-many' };

    const notes: Note[] = [];
    const noteIds = new Set<string>();
    let droppedNotes = 0;
    for (const item of rawNotes as unknown[]) {
      const note = sanitizeNote(item);
      if (note === null || noteIds.has(note.id)) {
        droppedNotes += 1;
        continue;
      }
      noteIds.add(note.id);
      notes.push(note);
    }

    const cards: Flashcard[] = [];
    const cardIds = new Set<string>();
    let droppedCards = 0;
    for (const item of rawCards as unknown[]) {
      const card = sanitizeCard(item, ctx.now);
      if (
        card === null ||
        cardIds.has(card.id) ||
        !(noteIds.has(card.noteId) || ctx.existingNoteIds.has(card.noteId))
      ) {
        droppedCards += 1;
        continue;
      }
      cardIds.add(card.id);
      cards.push(card);
    }

    const warnings: ImportWarning[] = outcome.ignored ? ['review-log-ignored'] : [];
    return {
      ok: true,
      data: { notes, flashcards: cards, reviewLog: outcome.log },
      dropped: { notes: droppedNotes, flashcards: droppedCards, events: outcome.droppedEvents },
      warnings,
    };
  } catch {
    return { ok: false, reason: 'bad-shape' };
  }
}

export function parseBackupText(text: string, ctx: ValidateContext): ValidateResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'not-json' };
  }
  return validateBackup(parsed, ctx);
}
