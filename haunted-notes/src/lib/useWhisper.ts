import { useRef, useState, useCallback, useEffect } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────

export type WhisperStatus =
  | 'idle'
  | 'decoding'       // AudioContext decode, downmix, normalise, resample
  | 'loading_model'  // model weights downloading
  | 'transcribing'   // chunk-by-chunk inference
  | 'done'
  | 'error';

export interface WhisperState {
  status: WhisperStatus;
  modelProgress: number;  // 0–100, meaningful during loading_model
  chunkIndex: number;     // 1-based current chunk (0 when not transcribing)
  chunkTotal: number;     // total chunks for this file
  error: string;
}

const INITIAL_STATE: WhisperState = {
  status: 'idle',
  modelProgress: 0,
  chunkIndex: 0,
  chunkTotal: 0,
  error: '',
};

// ── Constants ─────────────────────────────────────────────────────────────

export const ACCEPTED_AUDIO =
  '.mp3,.wav,.m4a,.webm,audio/mpeg,audio/wav,audio/mp4,audio/webm';

const SAMPLE_RATE   = 16_000;
const CHUNK_SECS    = 30;
const CHUNK_SAMPLES = CHUNK_SECS * SAMPLE_RATE; // 480 000

const MAX_DURATION_S   = 180;   // 3-minute hard cap
const CHUNK_TIMEOUT_MS = 90_000;

/** Target peak amplitude after normalisation (linear, 0–1). */
const NORMALISE_PEAK = 0.9;

// ── Audio helpers ─────────────────────────────────────────────────────────

/**
 * Convert a decoded AudioBuffer to a 16 kHz mono Float32Array suitable for
 * Whisper, in three steps:
 *
 * 1. Downmix to mono by averaging all channels sample-by-sample.
 * 2. Normalise peak amplitude to NORMALISE_PEAK so quiet recordings don't
 *    confuse Whisper with near-zero values.
 * 3. Resample to 16 kHz via OfflineAudioContext (or return as-is if already
 *    16 kHz mono after the first two steps).
 */
async function preparePCM(buffer: AudioBuffer): Promise<Float32Array> {
  const nCh      = buffer.numberOfChannels;
  const nFrames  = buffer.length;

  // ── Step 1: downmix to mono ─────────────────────────────────────────────
  let mono: Float32Array;
  if (nCh === 1) {
    // Copy so we own the data for step 2
    mono = buffer.getChannelData(0).slice();
  } else {
    mono = new Float32Array(nFrames);
    for (let ch = 0; ch < nCh; ch++) {
      const channelData = buffer.getChannelData(ch);
      for (let i = 0; i < nFrames; i++) {
        mono[i] += channelData[i];
      }
    }
    for (let i = 0; i < nFrames; i++) {
      mono[i] /= nCh;
    }
  }

  // ── Step 2: peak normalise ──────────────────────────────────────────────
  let peak = 0;
  for (let i = 0; i < mono.length; i++) {
    const abs = Math.abs(mono[i]);
    if (abs > peak) peak = abs;
  }
  if (peak > 0 && peak !== NORMALISE_PEAK) {
    const gain = NORMALISE_PEAK / peak;
    for (let i = 0; i < mono.length; i++) {
      mono[i] *= gain;
    }
  }

  // ── Step 3: resample to 16 kHz ──────────────────────────────────────────
  if (buffer.sampleRate === SAMPLE_RATE) {
    return mono; // already correct rate, no need for OfflineAudioContext
  }

  // Wrap the mono data in a new AudioBuffer at the original sample rate so
  // OfflineAudioContext can resample it.
  const tmpCtx = new AudioContext({ sampleRate: buffer.sampleRate });
  const tmpBuf = tmpCtx.createBuffer(1, nFrames, buffer.sampleRate);
  tmpBuf.copyToChannel(new Float32Array(mono.buffer.slice(0) as ArrayBuffer), 0);
  await tmpCtx.close();

  const offlineCtx = new OfflineAudioContext(
    1,
    Math.ceil(buffer.duration * SAMPLE_RATE),
    SAMPLE_RATE,
  );
  const src = offlineCtx.createBufferSource();
  src.buffer = tmpBuf;
  src.connect(offlineCtx.destination);
  src.start(0);
  const rendered = await offlineCtx.startRendering();
  return rendered.getChannelData(0).slice();
}

// ── Hook ─────────────────────────────────────────────────────────────────

export function useWhisper() {
  const workerRef  = useRef<Worker | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [state, setState] = useState<WhisperState>(INITIAL_STATE);

  // ── Worker lifecycle ───────────────────────────────────────────────────

  const spawnWorker = useCallback((): Worker => {
    const w = new Worker(
      new URL('../workers/whisper.worker.ts', import.meta.url),
      { type: 'module' },
    );
    workerRef.current = w;
    return w;
  }, []);

  const killWorker = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (workerRef.current) {
      workerRef.current.onmessage = null;
      workerRef.current.onerror   = null;
      workerRef.current.terminate();
      workerRef.current = null;
    }
  }, []);

  useEffect(() => () => killWorker(), [killWorker]);

  // ── Timeout watchdog ───────────────────────────────────────────────────

  const armTimeout = useCallback((chunkIndex: number) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      killWorker();
      setState((s) => ({
        ...s,
        status: 'error',
        error: `Chunk ${chunkIndex + 1} timed out after ${
          CHUNK_TIMEOUT_MS / 1000
        } s. The audio may be corrupted or the model stalled.`,
      }));
    }, CHUNK_TIMEOUT_MS);
  }, [killWorker]);

  const clearChunkTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // ── Public: cancel ─────────────────────────────────────────────────────

  const cancel = useCallback(() => {
    killWorker();
    setState(INITIAL_STATE);
  }, [killWorker]);

  // ── Public: reset ──────────────────────────────────────────────────────

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  // ── Public: transcribe ─────────────────────────────────────────────────

  const transcribe = useCallback(
    async (
      file: File,
      onChunk: (text: string, chunkIndex: number, total: number) => void,
    ): Promise<void> => {
      setState({ ...INITIAL_STATE, status: 'decoding' });

      // ── 1. Decode, downmix, normalise, resample ───────────────────────────
      let pcm: Float32Array;
      try {
        const arrayBuffer = await file.arrayBuffer();
        const audioCtx    = new AudioContext();
        const decoded     = await audioCtx.decodeAudioData(arrayBuffer);
        await audioCtx.close();

        if (decoded.duration > MAX_DURATION_S) {
          setState((s) => ({
            ...s,
            status: 'error',
            error: `Please use a clip under 3 minutes (this file is ${Math.round(
              decoded.duration,
            )} s).`,
          }));
          return;
        }

        pcm = await preparePCM(decoded);
      } catch (err) {
        setState((s) => ({
          ...s,
          status: 'error',
          error: `Could not decode audio file. Make sure it is a valid mp3, wav, m4a or webm. (${
            err instanceof Error ? err.message : err
          })`,
        }));
        return;
      }

      // ── 2. Hand off to worker ─────────────────────────────────────────────
      setState((s) => ({ ...s, status: 'loading_model' }));

      const worker = workerRef.current ?? spawnWorker();

      worker.onmessage = (event: MessageEvent) => {
        const msg = event.data as {
          type: string;
          progress?: number;
          chunkIndex?: number;
          totalChunks?: number;
          text?: string;
          message?: string;
        };

        switch (msg.type) {
          case 'model_progress':
            setState((s) => ({
              ...s,
              status: 'loading_model',
              modelProgress: Math.round(msg.progress ?? 0),
            }));
            break;

          case 'chunk_start': {
            const ci = msg.chunkIndex ?? 0;
            const ct = msg.totalChunks ?? 1;
            setState((s) => ({
              ...s,
              status: 'transcribing',
              chunkIndex: ci + 1,
              chunkTotal: ct,
            }));
            armTimeout(ci);
            break;
          }

          case 'chunk_result': {
            clearChunkTimeout();
            const ci = msg.chunkIndex ?? 0;
            const ct = msg.totalChunks ?? 1;
            setState((s) => ({
              ...s,
              status: 'transcribing',
              chunkIndex: ci + 1,
              chunkTotal: ct,
            }));
            // text may be empty if the worker filtered a silence/hallucination chunk
            if (msg.text) onChunk(msg.text, ci, ct);
            break;
          }

          case 'done':
            clearChunkTimeout();
            setState((s) => ({ ...s, status: 'done' }));
            break;

          case 'error':
            clearChunkTimeout();
            setState((s) => ({
              ...s,
              status: 'error',
              error: msg.message ?? 'Unknown transcription error.',
            }));
            break;
        }
      };

      worker.onerror = (e) => {
        clearChunkTimeout();
        setState((s) => ({
          ...s,
          status: 'error',
          error: `Worker error: ${e.message}`,
        }));
      };

      worker.postMessage(
        { type: 'transcribe', audio: pcm, chunkSamples: CHUNK_SAMPLES },
        [pcm.buffer],
      );
    },
    [spawnWorker, armTimeout, clearChunkTimeout],
  );

  return { state, transcribe, cancel, reset };
}
