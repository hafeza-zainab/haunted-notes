import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderToString } from 'react-dom/server';
import ModelStatusView from './ModelStatusView';
import ModelStatus from './ModelStatus';

describe('ModelStatusView', () => {
  it('shows ready text and an icon', () => {
    const html = renderToString(<ModelStatusView status="ready" />);
    expect(html).toContain('Whisper model ready offline');
    expect(html).toContain('model-status-icon');
  });

  it('shows not-downloaded text with the one-time download sentence', () => {
    const html = renderToString(<ModelStatusView status="not-downloaded" />);
    expect(html).toContain('Whisper model not downloaded yet');
    expect(html).toContain('one-time download');
    expect(html).toContain('model-status-icon');
  });

  it('shows unknown text and an icon', () => {
    const html = renderToString(<ModelStatusView status="unknown" />);
    expect(html).toContain('Offline model status unknown');
    expect(html).toContain('model-status-icon');
  });
});

describe('ModelStatus', () => {
  it('renders the unknown state before the cache is read', () => {
    expect(renderToString(<ModelStatus refreshKey="idle" />)).toContain(
      'Offline model status unknown',
    );
  });

  it('does not import @huggingface/transformers or fetch', () => {
    for (const f of ['ModelStatus.tsx', 'ModelStatusView.tsx', '../lib/modelCache.ts']) {
      const src = readFileSync(new URL(f, import.meta.url), 'utf8');
      expect(src).not.toContain('@huggingface/transformers');
      expect(src).not.toMatch(/\bfetch\s*\(/);
    }
  });
});
