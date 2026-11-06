import { useRef, useState, useCallback, useEffect } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────

export type WhisperStatus =
  | 'idle'
  | 'decoding'       // AudioContext decode + resample
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

/** Accepted audio MIME types / extensions for the file picker. */
export const ACCEPTED_AUDIO = '.mp3,.wav,.m4a,.webm,audio/mpeg,audio/wav,audio/mp4,audio/webm';

const SAMPLE_RATE   = 16_000;
const CHUNK_SECS    = 30;
const CHUNK_SAMPLES = CHUNK_SECS * SAMPLE_RATE;   // 480 000

/** Maximum audio duration we'll accept (180 s = 3 minutes). */
const MAX_DURATION_S = 180;

/** If a single chunk produces no response within this many ms, abort. */
const CHUNK_TIMEOUT_MS = 90_000;

// ── Audio helpers ─────────────────────────────────────────────────────────

async function resampleTo16kMono(buffer: AudioBuffer): Promise<Float32Array> {
  if (buffer.sampleRate === SAMPLE_RATE && buffer.numberOfChannels === 1) {
    return buffer.getChannelData(0);
  }
  const offlineCtx = new OfflineAudioContext(
    1,
    Math.ceil(buffer.duration * SAMPLE_RATE),
    SAMPLE_RATE,
  );
  const src = offlineCtx.createBufferSource();
  src.buffer = buffer;
  src.connect(offlineCtx.destination);
  src.start(0);
  const rendered = await offlineCtx.startRendering();
  return rendered.getChannelData(0);
}

// ── Hook ─────────────────────────────────────────────────────────────────

export function useWhisper() {
  const workerRef    = useRef<Worker | null>(null);
  const timeoutRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  /** Terminate the current worker and null the ref. Safe to call repeatedly. */
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

  // Kill on unmount
  useEffect(() => () => killWorker(), [killWorker]);

  // ── Timeout watchdog ───────────────────────────────────────────────────

  const armTimeout = useCallback((chunkIndex: number) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      killWorker();
      setState((s) => ({
        ...s,
        status: 'error',
        error: `Chunk ${chunkIndex + 1} timed out after ${CHUNK_TIMEOUT_MS / 1000} s. The audio may be too long or the model stalled.`,
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

  /**
   * Abort an in-progress transcription. Terminates the worker so a fresh one
   * is created on the next `transcribe()` call. Resets status to idle.
   */
  const cancel = useCallback(() => {
    killWorker();
    setState(INITIAL_STATE);
  }, [killWorker]);

  // ── Public: reset ──────────────────────────────────────────────────────

  /**
   * Reset state after done or error without killing an active worker.
   * The worker (and its loaded model) is kept alive for the next run.
   */
  const reset = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  // ── Public: transcribe ─────────────────────────────────────────────────

  const transcribe = useCallback(
    async (
      file: File,
      /** Called after each chunk completes; append text incrementally. */
      onChunk: (text: string, chunkIndex: number, total: number) => void,
    ): Promise<void> => {
      setState({ ...INITIAL_STATE, status: 'decoding' });

      // ── 1. Decode + resample ─────────────────────────────────────────────
      let pcm: Float32Array;
      try {
        const arrayBuffer = await file.arrayBuffer();
        const audioCtx    = new AudioContext();
        const decoded     = await audioCtx.decodeAudioData(arrayBuffer);
        await audioCtx.close();

        // 3-minute cap check (before resampling to avoid unnecessary work)
        if (decoded.duration > MAX_DURATION_S) {
          setState((s) => ({
            ...s,
            status: 'error',
            error: `Please use a clip under 3 minutes (this file is ${Math.round(decoded.duration)} s).`,
          }));
          return;
        }

        pcm = await resampleTo16kMono(decoded);
      } catch (err) {
        setState((s) => ({
          ...s,
          status: 'error',
          error: `Could not decode audio file. Make sure it is a valid mp3, wav, m4a or webm. (${err instanceof Error ? err.message : err})`,
        }));
        return;
      }

      // ── 2. Set up worker ─────────────────────────────────────────────────
      setState((s) => ({ ...s, status: 'loading_model' }));

      // Reuse existing worker (keeps the model resident) or spawn a fresh one.
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
              chunkIndex: ci + 1,   // display as 1-based
              chunkTotal: ct,
            }));
            armTimeout(ci);
            break;
          }

          case 'chunk_result': {
            clearChunkTimeout();
            const ci = msg.chunkIndex ?? 0;
            const ct = msg.totalChunks ?? 1;
            // Keep state updated so the progress bar reflects completion
            setState((s) => ({
              ...s,
              status: 'transcribing',
              chunkIndex: ci + 1,
              chunkTotal: ct,
            }));
            onChunk(msg.text ?? '', ci, ct);
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

      // Transfer the buffer zero-copy to the worker
      worker.postMessage(
        { type: 'transcribe', audio: pcm, chunkSamples: CHUNK_SAMPLES },
        [pcm.buffer],
      );
    },
    [spawnWorker, armTimeout, clearChunkTimeout],
  );

  return { state, transcribe, cancel, reset };
}
