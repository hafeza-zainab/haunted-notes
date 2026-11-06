/**
 * Whisper transcription Web Worker — manual chunking edition.
 *
 * ── Inbound messages ──────────────────────────────────────────────────────
 *   { type: 'transcribe', audio: Float32Array, chunkSamples: number }
 *     audio        — full 16 kHz mono PCM (already downmixed + normalised)
 *     chunkSamples — samples per chunk (30 s × 16 000 = 480 000)
 *
 * ── Outbound messages ────────────────────────────────────────────────────
 *   { type: 'model_progress', progress: number }                   — 0–100
 *   { type: 'chunk_start',   chunkIndex: number, totalChunks: number }
 *   { type: 'chunk_result',  chunkIndex: number, totalChunks: number, text: string }
 *   { type: 'done' }
 *   { type: 'error',         message: string }
 */

import { pipeline, env } from '@huggingface/transformers';

env.allowLocalModels = false;

const MODEL_ID = 'Xenova/whisper-tiny.en';

// ── Model loading (WASM only) ─────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let asr: any = null;

async function getASR() {
  if (asr) return asr;

  asr = await pipeline('automatic-speech-recognition', MODEL_ID, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    progress_callback: (p: any) => {
      if (
        (p.status === 'downloading' || p.status === 'loading') &&
        typeof p.progress === 'number'
      ) {
        self.postMessage({ type: 'model_progress', progress: Math.round(p.progress) });
      }
    },
    dtype: 'q8',
    device: 'wasm', // WASM only — WebGPU caused token-loop hallucinations
  });

  return asr;
}

// ── Chunk helpers ─────────────────────────────────────────────────────────

/**
 * Slice PCM into non-overlapping chunks of exactly chunkSamples.
 * No overlap means no boundary repetition.
 */
function buildChunks(audio: Float32Array, chunkSamples: number): Float32Array[] {
  const chunks: Float32Array[] = [];
  for (let start = 0; start < audio.length; start += chunkSamples) {
    chunks.push(audio.slice(start, start + chunkSamples));
  }
  return chunks;
}

/**
 * Return true if the chunk is effectively silent.
 * RMS threshold: 0.01 (roughly –40 dBFS).
 */
function isSilent(chunk: Float32Array, rmsThreshold = 0.01): boolean {
  let sumSq = 0;
  for (let i = 0; i < chunk.length; i++) {
    sumSq += chunk[i] * chunk[i];
  }
  return Math.sqrt(sumSq / chunk.length) < rmsThreshold;
}

/**
 * Return true if the result looks like a hallucination loop:
 * one word accounts for > 50% of all words in the output.
 */
function isHallucination(text: string): boolean {
  const words = text.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length < 4) return false; // too short to judge
  const freq: Record<string, number> = {};
  for (const w of words) freq[w] = (freq[w] ?? 0) + 1;
  const maxCount = Math.max(...Object.values(freq));
  return maxCount / words.length > 0.5;
}

// ── Message handler ───────────────────────────────────────────────────────

self.addEventListener(
  'message',
  async (
    event: MessageEvent<{ type: string; audio: Float32Array; chunkSamples: number }>,
  ) => {
    if (event.data.type !== 'transcribe') return;

    const { audio, chunkSamples } = event.data;

    try {
      const pipe = await getASR();

      const chunks      = buildChunks(audio, chunkSamples);
      const totalChunks = chunks.length;

      for (let i = 0; i < totalChunks; i++) {
        self.postMessage({ type: 'chunk_start', chunkIndex: i, totalChunks });

        // Skip silent chunks entirely — nothing useful to transcribe
        if (isSilent(chunks[i])) {
          self.postMessage({ type: 'chunk_result', chunkIndex: i, totalChunks, text: '' });
          continue;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result: any = await pipe(chunks[i], {
          // Generation guards to prevent token-loop repetition
          no_repeat_ngram_size: 3,
          repetition_penalty:   1.2,
          max_new_tokens:       128,
        });

        const raw: string = Array.isArray(result)
          ? result.map((r: { text: string }) => r.text).join(' ')
          : (result as { text: string }).text;

        const text = raw.trim();

        // Discard hallucination loops — append nothing for this chunk
        if (isHallucination(text)) {
          self.postMessage({ type: 'chunk_result', chunkIndex: i, totalChunks, text: '' });
          continue;
        }

        self.postMessage({ type: 'chunk_result', chunkIndex: i, totalChunks, text });
      }

      self.postMessage({ type: 'done' });
    } catch (err) {
      self.postMessage({
        type: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  },
);
