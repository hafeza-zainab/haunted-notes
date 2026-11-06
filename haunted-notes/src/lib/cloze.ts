import type { Flashcard, Note } from '../types';

// ── Constants ────────────────────────────────────────────────────────────────

/** Hard cap on flashcards generated from a single note. */
const MAX_CARDS = 12;

/**
 * Sentence length bounds (characters, after trimming).
 * Too short → not enough context; too long → confusing as a cloze prompt.
 */
const MIN_SENTENCE_LEN = 30;
const MAX_SENTENCE_LEN = 200;

/** Stop-words too generic to be useful cloze targets. */
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

// ── Sentence utilities ───────────────────────────────────────────────────────

/** Split text into sentences at `.`, `!`, `?` followed by whitespace or end. */
function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length >= MIN_SENTENCE_LEN && s.length <= MAX_SENTENCE_LEN);
}

// ── Sentence quality scoring ─────────────────────────────────────────────────

/**
 * Score a sentence for "flashcard worthiness" (higher = better).
 *
 * Bonus signals:
 *   +3  definition pattern: "X is Y" / "X are Y" / "X refers to Y" / "X means Y"
 *   +2  contains a capitalised term (not sentence-initial capitalisation)
 *   +1  contains a digit/number (dates, quantities)
 *   -1  sentence is very short (30–50 chars) — less context
 *
 * A base score of 0 is still acceptable; scoring only influences selection order.
 */
function scoreSentence(sentence: string): number {
  let score = 0;

  // Definition pattern: "X is/are/means/refers to …"
  if (/\b(is|are|means|refers\s+to|defined\s+as|known\s+as)\b/i.test(sentence)) {
    score += 3;
  }

  // Mid-sentence capitalised word (proper noun / key term)
  // Skip the very first word (always capitalised)
  const midWords = sentence.slice(sentence.indexOf(' ') + 1);
  if (/\b[A-Z][a-z]{2,}\b/.test(midWords)) {
    score += 2;
  }

  // Contains a number
  if (/\d/.test(sentence)) {
    score += 1;
  }

  // Slight penalty for very short sentences
  if (sentence.length < 50) {
    score -= 1;
  }

  return score;
}

// ── Cloze word selection ─────────────────────────────────────────────────────

/** Extract candidate words: alphabetic, length ≥ 4, not stop words. */
function candidateWords(sentence: string): string[] {
  const words = sentence.match(/\b[A-Za-z]{4,}\b/g) ?? [];
  return words.filter(w => !STOP_WORDS.has(w.toLowerCase()));
}

/**
 * Pick the best cloze word from a sentence.
 *
 * Priority order:
 *   1. A mid-sentence capitalised term (proper noun / key term)
 *   2. The longest unique candidate word
 *   3. The longest candidate overall
 */
function pickClozeWord(sentence: string): string | null {
  const candidates = candidateWords(sentence);
  if (candidates.length === 0) return null;

  // 1. Capitalised mid-sentence term
  const midWords = sentence.slice(sentence.indexOf(' ') + 1);
  const capMatch = midWords.match(/\b[A-Z][a-z]{3,}\b/);
  if (capMatch && !STOP_WORDS.has(capMatch[0].toLowerCase())) {
    return capMatch[0];
  }

  // 2. Longest unique candidate
  const unique = candidates.filter(
    w => candidates.filter(c => c.toLowerCase() === w.toLowerCase()).length === 1,
  );
  const pool = unique.length > 0 ? unique : candidates;
  pool.sort((a, b) => b.length - a.length);
  return pool[0];
}

/** Build a cloze prompt: replace the target word with underscores. */
function makeClozePrompt(sentence: string, word: string): string {
  const blank = '_'.repeat(word.length);
  return sentence.replace(new RegExp(`\\b${word}\\b`, 'i'), blank);
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate up to MAX_CARDS flashcards from a note.
 *
 * Steps:
 *   1. Split into sentences within the length bounds
 *   2. Score each sentence for flashcard worthiness
 *   3. Keep the top-scoring sentences (up to MAX_CARDS)
 *   4. Build a cloze card for each
 */
export function generateFlashcards(note: Note): Flashcard[] {
  const sentences = splitSentences(note.rawText);

  // Score and sort descending; stable sort preserves original order for ties
  const scored = sentences
    .map(s => ({ sentence: s, score: scoreSentence(s) }))
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
