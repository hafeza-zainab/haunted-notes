/**
 * Thin wrapper around the browser Web Speech API.
 * Returns a cleanup function to stop recognition.
 *
 * The Web Speech API is not fully standardised; we define the minimal
 * interface ourselves so TypeScript doesn't complain.
 */

interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  start(): void;
  stop(): void;
}

interface ISpeechRecognitionCtor {
  new (): ISpeechRecognition;
}

type AnyWindow = Window & {
  SpeechRecognition?: ISpeechRecognitionCtor;
  webkitSpeechRecognition?: ISpeechRecognitionCtor;
};

export function startSpeechRecognition(
  onResult: (transcript: string, final: boolean) => void,
  onError: (err: string) => void,
): () => void {
  const w = window as AnyWindow;
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;

  if (!Ctor) {
    onError('Speech recognition is not supported in this browser.');
    return () => {};
  }

  const recognition = new Ctor();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onresult = (event: SpeechRecognitionEvent) => {
    let interim = '';
    let finalText = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const t = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalText += t;
      } else {
        interim += t;
      }
    }
    if (finalText) onResult(finalText, true);
    else if (interim) onResult(interim, false);
  };

  recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
    onError(event.error);
  };

  recognition.start();
  return () => recognition.stop();
}
