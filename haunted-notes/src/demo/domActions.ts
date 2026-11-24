/**
 * src/demo/domActions.ts
 *
 * The few things "Run demo" does to the real page. Elements are found only by
 * their `data-demo` attribute. Nothing here opens a dialog, starts a download or
 * talks to the network: it clicks, types and outlines.
 */

/** Thrown from any wait when the user presses Stop or Escape. */
export class DemoAbort extends Error {
  constructor() {
    super('Demo stopped');
    this.name = 'DemoAbort';
  }
}

/** Thrown when an element the script needs is not on the page. */
export class DemoMissingTarget extends Error {
  readonly target: string;
  constructor(target: string) {
    super(`Demo target not found: data-demo="${target}"`);
    this.name = 'DemoMissingTarget';
    this.target = target;
  }
}

export const HIGHLIGHT_CLASS = 'demo-highlight';

export function findTarget(name: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-demo="${name}"]`);
}

export function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Set a React-controlled field's value the way typing does, so onChange fires. */
export function setFieldValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (!setter) throw new Error('Cannot set field value');
  setter.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

export function isField(el: HTMLElement): el is HTMLInputElement | HTMLTextAreaElement {
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
}

/** Outline an element and scroll it into view. Instant when reduced motion is on. */
export function highlight(el: HTMLElement): void {
  el.classList.add(HIGHLIGHT_CLASS);
  el.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
}

export function clearHighlights(): void {
  document.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach((el) => el.classList.remove(HIGHLIGHT_CLASS));
}

/** Move focus to the main region so it is never left on a removed element. */
export function focusMain(): void {
  document.getElementById('main-content')?.focus();
}
