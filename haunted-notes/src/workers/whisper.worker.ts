/**
 * Whisper transcription Web Worker — manual chunking edition.
 *
 * ── Inbound messages ──────────────────────────────────────────────────────
 *   { type: 'transcribe', audio: Float32Array, chunkSamples: number }
 *     audio        — full 16 kHz mono PCM for the clip
 *     chunkSamples — samples per chunk (caller pre-computes: 30 s × 16 000)
 *
 * ── Outbound messages ────────────────────────────────────────────────────
 *   { type: 'model_progress', progress: number }          — download 0–100
 *   { type: 'chunk_start',    chunkIndex: number, totalChunks: number }
 *   { type: 'chunk_result',   chunkIndex: number, totalChunks: number, text: string }
 *   { type: 'done' }
 *   { type: 'error',          message: string }
 */

import { pipeline, env } from '@huggingface/transformers';

env.allowLocalModels = false;

const MODEL_ID = 'Xenova/whisper-tiny.en';

// ── Model loading with WebGPU → WASM fallback ─────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let asr: any = null;

async function getASR() {
  if (asr) return asr;

  const loadWithDevice = async (device: 'webgpu' | 'wasm') => {
    return pipeline('automatic-speech-recognition', MODEL_ID, {
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
      device,
    });
  };

  // Try WebGPU first if the API is available, fall back to WASM silently.
  const hasWebGPU =
    typeof navigator !== 'undefined' && 'gpu' in navigator && navigator.gpu != null;

  if (hasWebGPU) {
    try {
      asr = await loadWithDevice('webgpu');
      return asr;
    } catch {
      // WebGPU initialised but failed (driver issue, unsupported model op, etc.)
      asr = null;
    }
  }

  asr = await loadWithDevice('wasm');
  return asr;
}

// ── Chunk helpers ─────────────────────────────────────────────────────────

/**
 * Slice the full PCM array into fixed-size chunks with a 2.5 s overlap
 * (stride_length_s = 5 means each end overlaps by 2.5 s on each side; we
 * replicate that by overlapping consecutive chunks by OVERLAP samples).
 *
 * For simplicity we pre-split here rather than relying on the pipeline's own
 * chunking, which would make per-chunk progress impossible.
 */
function buildChunks(audio: Float32Array, chunkSamples: number): Float32Array[] {
  // 2.5 s overlap at 16 kHz = 40 000 samples
  const OVERLAP = Math.round(chunkSamples * (2.5 / 30));
  const step    = chunkSamples - OVERLAP;
  const chunks: Float32Array[] = [];

  for (let start = 0; start < audio.length; start += step) {
    chunks.push(audio.slice(start, start + chunkSamples));
    if (start + chunkSamples >= audio.length) break;
  }

  return chunks;
}

// ── Message handler ───────────────────────────────────────────────────────

self.addEventListener(
  'message',
  async (event: MessageEvent<{ type: string; audio: Float32Array; chunkSamples: number }>) => {
    if (event.data.type !== 'transcribe') return;

    const { audio, chunkSamples } = event.data;

    try {
      const pipe = await getASR();

      const chunks = buildChunks(audio, chunkSamples);
      const totalChunks = chunks.length;

      for (let i = 0; i < totalChunks; i++) {
        self.postMessage({ type: 'chunk_start', chunkIndex: i, totalChunks });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result: any = await pipe(chunks[i]);

        const text: string = Array.isArray(result)
          ? result.map((r: { text: string }) => r.text).join(' ')
          : (result as { text: string }).text;

        self.postMessage({
          type: 'chunk_result',
          chunkIndex: i,
          totalChunks,
          text: text.trim(),
        });
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
