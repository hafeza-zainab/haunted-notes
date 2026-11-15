import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderToString } from 'react-dom/server';
import BackupPanel from './BackupPanel';

const BANNED = ['dangerouslySetInnerHTML', 'innerHTML', 'outerHTML', 'insertAdjacentHTML', 'document.write'];

describe('BackupPanel', () => {
  it('renders non-empty HTML without throwing', () => {
    expect(renderToString(<BackupPanel />).length).toBeGreaterThan(0);
  });

  it('has two buttons, a file input with accept, and an aria-live region', () => {
    const html = renderToString(<BackupPanel />);
    expect(html).toContain('Export backup');
    expect(html).toContain('Import backup');
    expect(html).toMatch(/<input[^>]*type="file"/);
    expect(html).toContain('accept=".json,application/json"');
    expect(html).toContain('aria-live="polite"');
  });

  it('uses no HTML injection APIs', () => {
    for (const f of ['BackupPanel.tsx', 'ImportDialog.tsx']) {
      const src = readFileSync(new URL(f, import.meta.url), 'utf8');
      for (const banned of BANNED) expect(src).not.toContain(banned);
    }
  });
});
