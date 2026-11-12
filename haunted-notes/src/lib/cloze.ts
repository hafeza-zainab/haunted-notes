import type { Flashcard, Note } from '../types';
import { defaultSrsFields } from './srs';

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_CARDS = 12;
const MIN_WORDS = 8;
const MAX_WORDS = 35;

/** If fewer than this many cards are produced, run the relaxed fallback pass. */
const FALLBACK_THRESHOLD = 5;

const STOP_WORDS = new Set([
  'a','an','the','is','are','was','were','be','been','being',
  'have','has','had','do','does','did','will','would','could','should',
  'may','might','must','shall','can','need','dare','ought','used',
  'i','you','he','she','it','we','they','me','him','her','us','them',
  'my','your','his','its','our','their','this','that','these','those',
  'and','but','or','nor','for','yet','so','of','in','on','at','to',
  'by','as','if','up','out','about','with','from','into','through',
  'not','no','also','than','then','when','which','who','what','how',
  'all','any','both','each','few','more','most','other','some','such',
]);

// ── Utilities ────────────────────────────────────────────────────────────────

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const BULLET_PREFIX =
  /^(?:[•\-*]\s+|\(?[A-Za-z0-9]{1,3}[.):\s]\s*|Q\d+[.:]\s*)/;

function stripPrefix(line: string): string {
  return line.replace(BULLET_PREFIX, '').trim();
}

// ── Over-long candidate splitter ─────────────────────────────────────────────

/**
 * Split a candidate that exceeds MAX_WORDS into sub-candidates of 10–30 words.
 *
 * Split points (in priority order):
 *   - commas, semicolons
 *   - coordinating conjunctions used mid-sentence: " but ", " so ", " and then "
 *   - relative clause marker: " which "
 *   - a capital letter starting a new word after a space (new sentence onset)
 *
 * Pieces are then greedily recombined so each sub-candidate lands in 10–30 words.
 */
function resplitOverlong(text: string): string[] {
  // Split on the markers; keep the delimiter text so we don't lose meaning
  const rawPieces = text
    .split(/(?<=\w),\s*|(?<=\w);\s*|\s+but\s+|\s+so\s+|\s+which\s+|\s+and\s+then\s+/i)
    .map((p) => p.trim())
    .filter(Boolean);

  // Also split on capital-letter sentence starts within a piece
  const pieces: string[] = [];
  for (const piece of rawPieces) {
    // Look for an interior capital after a lowercase word — rough new-sentence marker
    const subSplit = piece.split(/(?<=[a-z]{2,}\.?\s)(?=[A-Z])/).map((p) => p.trim()).filter(Boolean);
    pieces.push(...subSplit);
  }

  if (pieces.length <= 1) return [text]; // can't split further

  // Greedily recombine pieces into chunks of 10–30 words
  const results: string[] = [];
  let current = '';

  for (const piece of pieces) {
    const candidate = current ? `${current} ${piece}` : piece;
    const wc = wordCount(candidate);

    if (wc > 30 && current) {
      // Current chunk is already big enough; emit and start fresh
      if (wordCount(current) >= 10) results.push(current.trim());
      current = piece;
    } else {
      current = candidate;
    }
  }
  if (current && wordCount(current) >= 10) results.push(current.trim());

  return results.length > 0 ? results : [text];
}

// ── Text segmentation ────────────────────────────────────────────────────────

function extractCandidates(rawText: string): string[] {
  const candidates: string[] = [];

  const lines = rawText.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    let segments: string[];

    if (/[.!?]$/.test(line)) {
      segments = [stripPrefix(line)];
    } else if (BULLET_PREFIX.test(line)) {
      segments = [stripPrefix(line)];
    } else {
      segments = line
        .split(/(?<=[.!?])\s+/)
        .map((s) => stripPrefix(s.trim()))
        .filter(Boolean);
    }

    for (const seg of segments) {
      const wc = wordCount(seg);
      if (wc > MAX_WORDS) {
        // Resplit overlong segments rather than dropping them
        candidates.push(...resplitOverlong(seg));
      } else {
        candidates.push(seg);
      }
    }
  }

  return candidates;
}

// ── Sentence scoring ─────────────────────────────────────────────────────────

function scoreCandidate(s: string): number {
  let score = 0;
  if (/\b(is|are|means|refers\s+to|defined\s+as|known\s+as|called)\b/i.test(s)) score += 3;
  const afterFirst = s.slice(s.indexOf(' ') + 1);
  if (/\b[A-Z][a-z]{2,}\b/.test(afterFirst)) score += 2;
  if (/\b[A-Z]{2,5}\b/.test(s)) score += 2;
  if (/\d/.test(s)) score += 1;
  if (wordCount(s) < 11) score -= 1;
  return score;
}

// ── Cloze-word selection (strict pass) ───────────────────────────────────────

/**
 * A word is a valid strict cloze target if it is:
 *   1. An all-caps acronym (2–5 letters)
 *   2. A mid-sentence capitalised term (≥ 4 letters, not the opening word)
 *   3. The content word immediately after a definitional verb
 *
 * Never valid: stop-words, pure numbers, bullet markers, length < 3.
 */
function isStrictTarget(word: string, sentence: string): boolean {
  if (word.length < 3) return false;
  if (STOP_WORDS.has(word.toLowerCase())) return false;
  if (/^\d+$/.test(word)) return false;
  if (/^[•\-*]$/.test(word)) return false;

  if (/^[A-Z]{2,5}$/.test(word)) return true;

  const firstWord = sentence.split(/\s+/)[0];
  if (word !== firstWord && /^[A-Z][a-z]{3,}$/.test(word)) return true;

  const defMatch = sentence.match(
    /\b(?:is|are|means|called|defined\s+as|known\s+as|refers\s+to)\s+(\S+)/i,
  );
  if (defMatch) {
    const defWord = defMatch[1].replace(/[^A-Za-z]/g, '');
    if (
      defWord.toLowerCase() === word.toLowerCase() &&
      defWord.length >= 3 &&
      !STOP_WORDS.has(defWord.toLowerCase())
    ) return true;
  }

  return false;
}

function pickClozeWordStrict(sentence: string): string | null {
  // 1. Definitional target
  const defMatch = sentence.match(
    /\b(?:is|are|means|called|defined\s+as|known\s+as|refers\s+to)\s+([A-Za-z][A-Za-z-]{2,})/i,
  );
  if (defMatch && !STOP_WORDS.has(defMatch[1].toLowerCase())) return defMatch[1];

  const tokens = sentence.match(/\b[A-Za-z-]{3,}\b/g) ?? [];
  const valid  = tokens.filter((w) => isStrictTarget(w, sentence));
  if (valid.length === 0) return null;

  const acronym = valid.find((w) => /^[A-Z]{2,5}$/.test(w));
  if (acronym) return acronym;

  const firstWord = sentence.split(/\s+/)[0];
  const capTerms  = valid
    .filter((w) => w !== firstWord && /^[A-Z]/.test(w))
    .sort((a, b) => b.length - a.length);
  if (capTerms.length > 0) return capTerms[0];

  valid.sort((a, b) => b.length - a.length);
  return valid[0];
}

// ── Cloze-word selection (relaxed fallback) ───────────────────────────────────

/**
 * Relaxed rules used when the strict pass yields fewer than FALLBACK_THRESHOLD cards.
 *
 * In addition to strict targets, also accepts:
 *   - Any capitalised word (even at sentence start), ≥ 3 letters
 *   - Any word that contains a digit or a "." (e.g. "H2", "4.0.6", "v3.2")
 *   - The longest non-stop-word of 6+ letters (lowercase is fine)
 *
 * Still never allows: stop-words, pure numbers, bullet markers.
 */
function isRelaxedTarget(word: string): boolean {
  if (word.length < 3) return false;
  if (STOP_WORDS.has(word.toLowerCase())) return false;
  if (/^\d+$/.test(word)) return false;
  if (/^[•\-*]$/.test(word)) return false;

  // Capitalised word
  if (/^[A-Z]/.test(word) && word.length >= 3) return true;

  // Contains a digit or dot (version strings, chemical symbols)
  if (/[\d.]/.test(word) && /[A-Za-z]/.test(word)) return true;

  // Long lowercase non-stopword
  if (word.length >= 6) return true;

  return false;
}

function pickClozeWordRelaxed(sentence: string): string | null {
  // Still try strict first
  const strict = pickClozeWordStrict(sentence);
  if (strict) return strict;

  // Tokenise including alphanumeric (captures "H2", "v3.2")
  const tokens = sentence.match(/\b[A-Za-z0-9][A-Za-z0-9.-]*\b/g) ?? [];
  const valid  = tokens.filter((w) => isRelaxedTarget(w));
  if (valid.length === 0) return null;

  // Prefer acronyms, then capitalized, then longest
  const acronym = valid.find((w) => /^[A-Z]{2,5}$/.test(w));
  if (acronym) return acronym;

  const capTerms = valid.filter((w) => /^[A-Z]/.test(w)).sort((a, b) => b.length - a.length);
  if (capTerms.length > 0) return capTerms[0];

  valid.sort((a, b) => b.length - a.length);
  return valid[0];
}

// ── Card builder ─────────────────────────────────────────────────────────────

function makeClozePrompt(sentence: string, word: string): string {
  const blank = '_'.repeat(word.length);
  return sentence.replace(new RegExp(`\\b${escapeRegex(word)}\\b`, 'i'), blank);
}

/**
 * Safety check: never emit a card whose blank is a stop-word or pure number.
 * This is a final guard in case either picker slips through.
 */
function isSafeBlank(word: string): boolean {
  if (!word) return false;
  if (STOP_WORDS.has(word.toLowerCase())) return false;
  if (/^\d+$/.test(word)) return false;
  return true;
}

function buildCard(
  sentence: string,
  noteId: string,
  pickFn: (s: string) => string | null,
): Flashcard | null {
  const word = pickFn(sentence);
  if (!word || !isSafeBlank(word)) return null;
  return {
    id: `card-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    noteId,
    sentence,
    clozeWord: word,
    prompt: makeClozePrompt(sentence, word),
    weaknessScore: 1,
    streakCorrect: 0,
    streakWrong: 0,
    lastReviewed: null,
    ...defaultSrsFields(),
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export function generateFlashcards(note: Note): Flashcard[] {
  // 1. Extract and filter candidates
  const raw = extractCandidates(note.rawText).filter((s) => {
    const wc = wordCount(s);
    return wc >= MIN_WORDS && wc <= MAX_WORDS;
  });

  // 2. Deduplicate
  const seen = new Set<string>();
  const unique = raw.filter((s) => {
    const key = s.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // 3. Score and sort
  const scored = unique
    .map((s) => ({ sentence: s, score: scoreCandidate(s) }))
    .sort((a, b) => b.score - a.score);

  // 4. Strict pass
  const cards: Flashcard[] = [];
  const usedSentences = new Set<string>();

  for (const { sentence } of scored) {
    if (cards.length >= MAX_CARDS) break;
    const card = buildCard(sentence, note.id, pickClozeWordStrict);
    if (card) {
      cards.push(card);
      usedSentences.add(sentence);
    }
  }

  // 5. Relaxed fallback pass — runs on sentences not already used
  if (cards.length < FALLBACK_THRESHOLD) {
    for (const { sentence } of scored) {
      if (cards.length >= MAX_CARDS) break;
      if (usedSentences.has(sentence)) continue;
      const card = buildCard(sentence, note.id, pickClozeWordRelaxed);
      if (card) {
        cards.push(card);
        usedSentences.add(sentence);
      }
    }
  }

  return cards;
}

export function updateWeaknessScore(card: Flashcard, correct: boolean): Flashcard {
  const streakCorrect = correct ? card.streakCorrect + 1 : 0;
  const streakWrong   = correct ? 0 : card.streakWrong + 1;
  const weakness      = correct
    ? Math.max(0, card.weaknessScore * 0.7)
    : Math.min(1, card.weaknessScore + 0.25);
  return { ...card, streakCorrect, streakWrong, weaknessScore: weakness, lastReviewed: Date.now() };
}
