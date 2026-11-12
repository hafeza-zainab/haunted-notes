import React, { useState, useRef, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { startSpeechRecognition } from '../lib/speech';
import { extractTextFromImage } from '../lib/ocr';
import { useWhisper, ACCEPTED_AUDIO } from '../lib/useWhisper';
import type { NoteInputMethod } from '../types';

const TABS: { id: NoteInputMethod; label: string; icon: string }[] = [
  { id: 'type',  label: 'Type',       icon: '⌨'  },
  { id: 'mic',   label: 'Live mic',   icon: '🎤' },
  { id: 'photo', label: 'Photo',      icon: '📷' },
  { id: 'audio', label: 'Audio file', icon: '🎵' },
];

const AddNoteView: React.FC = () => {
  const addNote      = useStore((s) => s.addNote);
  const setView      = useStore((s) => s.setView);
  const isDemoLoaded = useStore((s) => s.isDemoLoaded);
  const loadDemoData = useStore((s) => s.loadDemoData);

  const [inputMethod, setInputMethod] = useState<NoteInputMethod>('type');
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const stopSpeechRef = useRef<(() => void) | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const { state: whisper, transcribe, cancel: cancelWhisper, reset: resetWhisper } = useWhisper();

  const whisperBusy =
    whisper.status === 'decoding' ||
    whisper.status === 'loading_model' ||
    whisper.status === 'transcribing';

  // ── Tab switch ─────────────────────────────────────────────────────────
  const switchTab = (m: NoteInputMethod) => {
    setInputMethod(m);
    setError('');
    if (m !== 'mic' && listening) {
      stopSpeechRef.current?.();
      setListening(false);
    }
  };

  // ── Live mic ───────────────────────────────────────────────────────────
  const toggleVoice = useCallback(() => {
    if (listening) {
      stopSpeechRef.current?.();
      stopSpeechRef.current = null;
      setListening(false);
    } else {
      setError('');
      const stop = startSpeechRecognition(
        (transcript, final) => {
          if (final) setText((t) => t + (t ? ' ' : '') + transcript);
        },
        (err) => {
          setError(`Microphone error: ${err}`);
          setListening(false);
        },
      );
      stopSpeechRef.current = stop;
      setListening(true);
    }
  }, [listening]);

  // ── Photo / OCR ────────────────────────────────────────────────────────
  const handlePhotoFile = useCallback(async (file: File) => {
    setError('');
    setOcrProgress(0);
    try {
      const extracted = await extractTextFromImage(file, setOcrProgress);
      setText((t) => t + (t ? '\n' : '') + extracted);
    } catch (e) {
      setError(`OCR failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setOcrProgress(null);
    }
  }, []);

  const onPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handlePhotoFile(file);
    e.target.value = '';
  };

  // ── Audio file / Whisper ───────────────────────────────────────────────
  const handleAudioFile = useCallback(
    async (file: File) => {
      setError('');
      resetWhisper();

      const ACCEPTED_EXTS = /\.(mp3|wav|m4a|webm)$/i;
      if (!ACCEPTED_EXTS.test(file.name) && !file.type.startsWith('audio/')) {
        setError('Unsupported file type. Please upload an mp3, wav, m4a or webm file.');
        return;
      }

      await transcribe(file, (chunkText, chunkIndex) => {
        // Append each chunk's text as it arrives so the user sees progress
        setText((t) => {
          const separator = t ? (chunkIndex === 0 ? '\n' : ' ') : '';
          return t + separator + chunkText;
        });
      });
    },
    [transcribe, resetWhisper],
  );

  const onAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleAudioFile(file);
    e.target.value = '';
  };

  // Surface whisper errors to the shared error field
  // (Adjusting state during render instead of in an effect: same behavior,
  // fires once each time a new whisper error appears.)
  const whisperError = whisper.status === 'error' ? whisper.error : null;
  const [seenWhisperError, setSeenWhisperError] = useState<string | null>(null);
  if (whisperError !== seenWhisperError) {
    setSeenWhisperError(whisperError);
    if (whisperError) setError(whisperError);
  }

  // ── Cancel / Reset audio ───────────────────────────────────────────────
  const handleCancelAudio = () => {
    cancelWhisper();
    setError('');
    // Don't clear text — the user may want to keep partial results
    if (audioInputRef.current) audioInputRef.current.value = '';
  };

  const handleResetAudio = () => {
    resetWhisper();
    setError('');
    setText('');
    if (audioInputRef.current) audioInputRef.current.value = '';
  };

  // ── Submit ─────────────────────────────────────────────────────────────
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) {
      setError('Please add some text first.');
      return;
    }
    const cardCount = addNote({ rawText: text.trim(), inputMethod });
    setSuccess(true);
    setText('');
    resetWhisper();
    if (cardCount === 0) {
      setError(
        'No ghosts could be made from this text. Try adding more detail.',
      );
      setSuccess(false);
      // Note was still saved — just no flashcards yet
    } else {
      setTimeout(() => {
        setSuccess(false);
        setView('dashboard');
      }, 1200);
    }
  };

  const anyBusy = ocrProgress !== null || whisperBusy;

  // Chunk progress percentage (0–100) for the progress bar
  const chunkPct =
    whisper.chunkTotal > 0
      ? Math.round((whisper.chunkIndex / whisper.chunkTotal) * 100)
      : 0;

  return (
    <section className="add-note-view" aria-label="Add a new note">
      <h2>Add Note</h2>

      {/* Method selector */}
      <div className="method-tabs" role="tablist" aria-label="Input method">
        {TABS.map(({ id, label, icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={inputMethod === id}
            className={`tab-btn ${inputMethod === id ? 'active' : ''}`}
            onClick={() => switchTab(id)}
          >
            <span aria-hidden="true">{icon}</span> {label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} noValidate>
        {/* Shared text area */}
        <label htmlFor="note-text" className="sr-only">Note text</label>
        <textarea
          id="note-text"
          className="note-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            inputMethod === 'mic'
              ? 'Press "Start listening" then speak…'
              : inputMethod === 'photo'
              ? 'Upload a photo and the text will appear here…'
              : inputMethod === 'audio'
              ? 'Upload an audio file and the transcript will appear here…'
              : 'Type your notes here…'
          }
          rows={7}
          aria-describedby={error ? 'note-error' : undefined}
        />

        {/* ── Live mic controls ── */}
        {inputMethod === 'mic' && (
          <div className="voice-controls">
            <button
              type="button"
              className={`btn-secondary ${listening ? 'listening' : ''}`}
              onClick={toggleVoice}
              aria-pressed={listening}
            >
              {listening ? '⏹ Stop listening' : '▶ Start listening'}
            </button>
            {listening && (
              <span className="listening-indicator" aria-live="polite">
                🎙 Listening…
              </span>
            )}
          </div>
        )}

        {/* ── Photo controls ── */}
        {inputMethod === 'photo' && (
          <div className="photo-controls">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => photoInputRef.current?.click()}
              disabled={ocrProgress !== null}
            >
              📂 Choose image
            </button>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={onPhotoChange}
              aria-label="Upload image for OCR"
            />
            {ocrProgress !== null && (
              <div className="task-progress" role="status" aria-live="polite">
                <span className="progress-label">Reading image…</span>
                <progress value={ocrProgress} max={100} aria-label="OCR progress" />
                <span className="progress-pct">{ocrProgress}%</span>
              </div>
            )}
            <p className="input-hint">Works best with clear printed text.</p>
          </div>
        )}

        {/* ── Audio file controls ── */}
        {inputMethod === 'audio' && (
          <div className="audio-controls">

            {/* File picker — hidden while busy or done */}
            {!whisperBusy && whisper.status !== 'done' && (
              <>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => audioInputRef.current?.click()}
                >
                  📂 Choose audio file
                </button>
                <input
                  ref={audioInputRef}
                  type="file"
                  accept={ACCEPTED_AUDIO}
                  className="sr-only"
                  onChange={onAudioChange}
                  aria-label="Upload audio file for transcription"
                />
              </>
            )}

            {/* Decoding spinner */}
            {whisper.status === 'decoding' && (
              <div className="task-progress" role="status" aria-live="polite">
                <span className="progress-label">Decoding audio…</span>
                <progress aria-label="Decoding audio" />
              </div>
            )}

            {/* Model download with real percentage */}
            {whisper.status === 'loading_model' && (
              <div className="task-progress" role="status" aria-live="polite">
                <span className="progress-label">
                  Downloading Whisper model… (one-time)
                </span>
                <progress
                  value={whisper.modelProgress}
                  max={100}
                  aria-label={`Model download ${whisper.modelProgress}%`}
                />
                <span className="progress-pct">{whisper.modelProgress}%</span>
              </div>
            )}

            {/* Per-chunk progress with real fraction */}
            {whisper.status === 'transcribing' && (
              <div className="task-progress" role="status" aria-live="polite">
                <span className="progress-label">
                  Transcribing {whisper.chunkIndex} of {whisper.chunkTotal}…
                </span>
                <progress
                  value={chunkPct}
                  max={100}
                  aria-label={`Transcribing chunk ${whisper.chunkIndex} of ${whisper.chunkTotal}`}
                />
                <span className="progress-pct">{chunkPct}%</span>
              </div>
            )}

            {/* Cancel button — shown during any active phase */}
            {whisperBusy && (
              <button
                type="button"
                className="btn-danger-outline"
                onClick={handleCancelAudio}
                aria-label="Cancel transcription"
              >
                ✕ Cancel
              </button>
            )}

            {/* Done state */}
            {whisper.status === 'done' && (
              <div className="audio-done-row">
                <p className="success-msg" role="status" aria-live="polite">
                  ✓ Transcription complete — edit the text above if needed.
                </p>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={handleResetAudio}
                  aria-label="Clear transcript and start over"
                >
                  ↺ Reset
                </button>
              </div>
            )}

            {/* Error Reset */}
            {whisper.status === 'error' && (
              <button
                type="button"
                className="btn-ghost"
                onClick={handleResetAudio}
                aria-label="Clear and try again"
              >
                ↺ Try again
              </button>
            )}

            <p className="audio-hint">
              Supported: mp3, wav, m4a, webm · Max 3 minutes.
              The model (~40 MB) downloads once and is cached in your browser.
            </p>
          </div>
        )}

        {error && (
          <p id="note-error" className="error-msg" role="alert">
            {error}
          </p>
        )}
        {success && (
          <p className="success-msg" role="status" aria-live="polite">
            ✓ Note added — haunting your dashboard!
          </p>
        )}

        <div className="form-actions">
          <button
            type="submit"
            className="btn-primary"
            disabled={anyBusy}
          >
            ➕ Add Note
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setView('dashboard')}
          >
            Cancel
          </button>
        </div>
      </form>

      {/* ── Demo shortcut ── */}
      {!isDemoLoaded && (
        <aside className="demo-shortcut" aria-label="Try a demo">
          <p className="demo-shortcut-text">Want to see it in action first?</p>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => { loadDemoData(); setView('dashboard'); }}
            aria-label="Load demo notes and go to dashboard"
          >
            👻 Try demo →
          </button>
        </aside>
      )}
    </section>
  );
};

export default AddNoteView;
