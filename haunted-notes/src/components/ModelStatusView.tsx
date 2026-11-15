import React from 'react';
import type { ModelStatus } from '../lib/offlineStatus';

const CONTENT: Record<ModelStatus, { icon: string; text: string; hint?: string }> = {
  ready: { icon: '✓', text: 'Whisper model ready offline' },
  'not-downloaded': {
    icon: '↓',
    text: 'Whisper model not downloaded yet',
    hint: 'A one-time download is needed before audio works offline.',
  },
  unknown: { icon: '?', text: 'Offline model status unknown' },
};

interface Props {
  status: ModelStatus;
}

/** Presentational: icon plus text, never color alone. */
const ModelStatusView: React.FC<Props> = ({ status }) => {
  const { icon, text, hint } = CONTENT[status];
  return (
    <p className="model-status" data-status={status} role="status">
      <span className="model-status-icon" aria-hidden="true">{icon}</span>
      <span>
        {text}
        {hint ? `. ${hint}` : ''}
      </span>
    </p>
  );
};

export default ModelStatusView;
