import { describe, it, expect, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import LoadNotice from './LoadNotice';
import { useStore } from '../store/useStore';

function render(notice: { dropped: number; unreadable: boolean; backedUp: boolean } | null) {
  // renderToStaticMarkup reads the store's initial state
  const initial = useStore.getInitialState();
  Object.assign(initial, { loadNotice: notice });
  return renderToStaticMarkup(<LoadNotice />);
}

afterEach(() => {
  Object.assign(useStore.getInitialState(), { loadNotice: null });
});

describe('LoadNotice', () => {
  it('renders nothing when there is no notice', () => {
    expect(render(null)).toBe('');
  });

  it('renders a status line with counts and a Dismiss button', () => {
    const html = render({ dropped: 2, unreadable: false, backedUp: true });
    expect(html).toContain('role="status"');
    expect(html).toContain('2 saved items could not be loaded; a backup copy was kept.');
    expect(html).toContain('>Dismiss</button>');
  });

  it('never contains note or card text', () => {
    useStore.setState({ notes: [{ id: 'n', rawText: 'SECRET-NOTE-TEXT', inputMethod: 'type', createdAt: 0 }] });
    const html = render({ dropped: 1, unreadable: false, backedUp: true });
    expect(html).not.toContain('SECRET-NOTE-TEXT');
    useStore.setState({ notes: [] });
  });
});
