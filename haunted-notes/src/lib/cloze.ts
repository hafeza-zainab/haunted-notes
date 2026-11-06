import type { Flashcard, Note } from '../types';

// ── Constants ────────────────────────────────────────────────────────────────

/** Hard cap on flashcards generated from a single note. */
const MAX_CARDS = 12;

/** Word-count bounds for a viable candidate sentence. */
const MIN_WORDS = 8;
const MAX_WORDS = 35;

/** Stop-words — never blanked out. */
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

// ── Text segmentation ────────────────────────────────────────────────────────

/**
 * Regex that matches a leading bullet / question-number prefix to strip
 * before displaying the candidate.
 *
 * Matches:
 *   • bullet        →  "• "
 *   - dash bullet   →  "- "
 *   Q17:            →  "Q17: "
 *   17.             →  "17. "
 *   (b)             →  "(b) "
 */
const BULLET_PREFIX = /^(?:[•\-\*]\s+|\(?[A-Za-z0-9]{1,3}[.):\s]\s*|Q\d+[.:]\s*)/;

/**
 * Strip a leading bullet/number prefix from a line and trim.
 */
function stripPrefix(line: string): string {
  return line.replace(BULLET_PREFIX, '').trim();
}

/**
 * Split raw note text into candidate strings using both structural markers
 * (newlines, bullets, numbered lines) and sentence-ending punctuation.
 *
 * Each candidate has its bullet/number prefix removed before being returned.
 */
function extractCandidates(rawText: string): string[] {
  const candidates: string[] = [];

  // First split on newlines to respect list structure
  const lines = rawText.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // If the line already ends with sentence punctuation, treat it as-is after stripping
    if (/[.!?]$/.test(line)) {
      candidates.push(stripPrefix(line));
      continue;
    }

    // Lines that are bullet/numbered items but lack a sentence-final period
    // are themselves candidates; add a synthetic period so downstream scoring
    // doesn't penalise them.
    if (BULLET_PREFIX.test(line)) {
      candidates.push(stripPrefix(line));
      continue;
    }

    // For plain paragraph lines, also split on sentence-ending punctuation
    // to handle multi-sentence prose on a single line.
    const sentences = line.split(/(?<=[.!?])\s+/);
    for (const s of sentences) {
      const stripped = stripPrefix(s.trim());
      if (stripped) candidates.push(stripped);
    }
  }

  return candidates;
}

// ── Sentence quality scoring ─────────────────────────────────────────────────

/**
 * Count whitespace-separated words in a string.
 */
function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Score a candidate for flashcard worthiness (higher = better).
 *
 *   +3  definition pattern — "X is/are/means/called/defined as …"
 *   +2  mid-sentence capitalised term (proper noun / key term)
 *   +2  acronym present (2–5 uppercase letters, e.g. SEO, HTTP, PPC)
 *   +1  contains a digit (date, quantity)
 *   −1  word count in the short range (8–10 words)
 */
function scoreCandidate(s: string): number {
  let score = 0;

  if (/\b(is|are|means|refers\s+to|defined\s+as|known\s+as|called)\b/i.test(s)) {
    score += 3;
  }

  // Mid-sentence capitalised word (skip first word)
  const afterFirst = s.slice(s.indexOf(' ') + 1);
  if (/\b[A-Z][a-z]{2,}\b/.test(afterFirst)) score += 2;

  // Acronym (all-caps, 2–5 letters)
  if (/\b[A-Z]{2,5}\b/.test(s)) score += 2;

  if (/\d/.test(s)) score += 1;

  const wc = wordCount(s);
  if (wc < 11) score -= 1;

  return score;
}

// ── Cloze-word selection ─────────────────────────────────────────────────────

/**
 * Decide whether a token is a valid cloze target.
 *
 * Valid targets:
 *   1. An all-caps acronym (SEO, HTTP, PPC — 2–5 letters)
 *   2. A mid-sentence capitalised word (proper noun / key term, ≥ 4 letters)
 *   3. The word immediately after a definitional verb
 *      (is / are / means / called / defined as)
 *
 * A token is NEVER valid if it is:
 *   - a stop-word
 *   - a pure number / bullet marker
 *   - shorter than 3 characters
 */
function isValidClozeTarget(word: string, sentence: string): boolean {
  if (word.length < 3) return false;
  if (STOP_WORDS.has(word.toLowerCase())) return false;
  if (/^\d+$/.test(word)) return false;       // pure number
  if (/^[•\-\*]$/.test(word)) return false;   // bullet marker

  // Acronym
  if (/^[A-Z]{2,5}$/.test(word)) return true;

  // Mid-sentence capitalised word (≥ 4 letters)
  const firstWord = sentence.split(/\s+/)[0];
  if (
    word !== firstWord &&
    /^[A-Z][a-z]{3,}$/.test(word)
  ) return true;

  // Word immediately following a definitional verb
  const defVerbPattern =
    /\b(?:is|are|means|called|defined\s+as|known\s+as|refers\s+to)\s+(\S+)/i;
  const defMatch = sentence.match(defVerbPattern);
  if (defMatch) {
    // Strip punctuation from the matched token before comparing
    const defWord = defMatch[1].replace(/[^A-Za-z]/g, '');
    if (
      defWord.toLowerCase() === word.toLowerCase() &&
      defWord.length >= 3 &&
      !STOP_WORDS.has(defWord.toLowerCase())
    ) return true;
  }

  return false;
}

/**
 * Pick the best cloze word from a candidate sentence.
 *
 * Priority:
 *   1. Definitional verb target ("… is Photosynthesis …")
 *   2. All-caps acronym
 *   3. Mid-sentence capitalised term (longest first)
 *   4. Any valid target word (longest first)
 */
function pickClozeWord(sentence: string): string | null {
  // 1. Definitional target
  const defMatch = sentence.match(
    /\b(?:is|are|means|called|defined\s+as|known\s+as|refers\s+to)\s+([A-Za-z][A-Za-z\-]{2,})/i,
  );
  if (defMatch) {
    const w = defMatch[1];
    if (!STOP_WORDS.has(w.toLowerCase())) return w;
  }

  // Tokenise (alphabetic runs only)
  const tokens = sentence.match(/\b[A-Za-z\-]{3,}\b/g) ?? [];
  const valid  = tokens.filter((w) => isValidClozeTarget(w, sentence));
  if (valid.length === 0) return null;

  // 2. Acronym
  const acronym = valid.find((w) => /^[A-Z]{2,5}$/.test(w));
  if (acronym) return acronym;

  // 3. Mid-sentence capitalised term, longest first
  const firstWord = sentence.split(/\s+/)[0];
  const capTerms  = valid
    .filter((w) => w !== firstWord && /^[A-Z]/.test(w))
    .sort((a, b) => b.length - a.length);
  if (capTerms.length > 0) return capTerms[0];

  // 4. Any valid target, longest first
  valid.sort((a, b) => b.length - a.length);
  return valid[0];
}

/** Replace the first occurrence of `word` (whole-word, case-insensitive) with blanks. */
function makeClozePrompt(sentence: string, word: string): string {
  const blank = '_'.repeat(word.length);
  return sentence.replace(new RegExp(`\\b${escapeRegex(word)}\\b`, 'i'), blank);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate up to MAX_CARDS flashcards from a note.
 *
 * Pipeline:
 *   1. Extract candidates (newlines, bullets, numbered lines, sentence splits)
 *   2. Strip leading bullet/number prefixes
 *   3. Reject candidates outside the 8–35-word window
 *   4. Score remaining candidates and take the top MAX_CARDS
 *   5. For each, pick a cloze word that passes isValidClozeTarget
 */
export function generateFlashcards(note: Note): Flashcard[] {
  const raw = extractCandidates(note.rawText);

  // Filter by word count
  const inBounds = raw.filter((s) => {
    const wc = wordCount(s);
    return wc >= MIN_WORDS && wc <= MAX_WORDS;
  });

  // Deduplicate (same text can appear if the note has repeated lines)
  const seen   = new Set<string>();
  const unique = inBounds.filter((s) => {
    const key = s.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Score and take the best candidates first
  const scored = unique
    .map((s) => ({ sentence: s, score: scoreCandidate(s) }))
    .sort((a, b) => b.score - a.score);

  const cards: Flashcard[] = [];

  for (const { sentence } of scored) {
    if (cards.length >= MAX_CARDS) break;

    const word = pickClozeWord(sentence);
    if (!word) continue;

    cards.push({
      id: `card-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      noteId: note.id,
      sentence,
      clozeWord: word,
      prompt: makeClozePrompt(sentence, word),
      weaknessScore: 1,
      streakCorrect: 0,
      streakWrong: 0,
      lastReviewed: null,
    });
  }

  return cards;
}

/**
 * Recalculate weakness score after an answer.
 * Score decays toward 0 on correct answers, climbs toward 1 on wrong ones.
 */
export function updateWeaknessScore(
  card: Flashcard,
  correct: boolean,
): Flashcard {
  const streakCorrect = correct ? card.streakCorrect + 1 : 0;
  const streakWrong   = correct ? 0 : card.streakWrong + 1;

  const weakness = correct
    ? Math.max(0, card.weaknessScore * 0.7)
    : Math.min(1, card.weaknessScore + 0.25);

  return {
    ...card,
    streakCorrect,
    streakWrong,
    weaknessScore: weakness,
    lastReviewed: Date.now(),
  };
}
