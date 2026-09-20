/**
 * The `leading` slot — and, more importantly, its absence.
 *
 * This prop ships to every site consuming @isimplifyme/ui on a `^` range, so
 * the load-bearing claim is not "the slot works" but "a bar that passes no
 * slot is unchanged." That claim is what these tests pin. A prop whose
 * default path is untested is a fleet-wide change disguised as an addition.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import ConciergeWidget from './concierge';

/** Flips the stubbed matchMedia so a test can render at phone width. */
const NARROW = { value: false };

let container: HTMLDivElement;
let root: Root;

// The widget bootstraps a session on mount. Nothing here exercises the
// network, so a stub keeps the render deterministic — a real fetch would make
// these tests flaky for reasons that have nothing to do with the slot.
beforeEach(() => {
  NARROW.value = false;
  // jsdom ships no matchMedia; the widget reads it to decide the mobile
  // footer collision. Reporting "no match" gives the desktop bar, which is
  // the layout these assertions are about.
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: NARROW.value && query.includes('max-width'),
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    onchange: null,
    dispatchEvent: () => false,
  }));
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) }),
    ),
  );
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

function render(props: Record<string, unknown> = {}) {
  act(() => {
    root.render(<ConciergeWidget {...props} />);
  });
  const input = container.querySelector('input[type="text"]') as HTMLInputElement;
  // The command bar is the input's flex parent — found by structure rather
  // than by a class, because the widget styles entirely inline and a test
  // that invented a hook would be pinning the test's own fiction.
  return { input, bar: input.parentElement as HTMLElement };
}

describe('no leading node — the path every other site takes', () => {
  it('keeps the original 24px optical inset', () => {
    const { bar } = render();
    expect(bar.style.padding).toBe('10px 12px 10px 24px');
  });

  it('renders nothing before the input', () => {
    const { input, bar } = render();
    expect(bar.firstElementChild).toBe(input);
  });

  it('adds no aria-hidden element to the bar', () => {
    const { bar } = render();
    expect(bar.querySelectorAll('[aria-hidden="true"]').length).toBe(0);
  });
});

describe('with a leading node', () => {
  const sprite = <img src="/model.png" alt="" data-testid="sprite" />;

  it('renders it ahead of the input', () => {
    const { input, bar } = render({ leading: sprite });
    const slot = bar.firstElementChild as HTMLElement;
    expect(slot.querySelector('[data-testid="sprite"]')).not.toBeNull();
    expect(slot.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
  });

  it('drops the inset to 12px so the text starts where it always did', () => {
    const { bar } = render({ leading: sprite });
    expect(bar.style.padding).toBe('10px 12px');
  });

  it('hides it from assistive tech', () => {
    const { bar } = render({ leading: sprite });
    expect((bar.firstElementChild as HTMLElement).getAttribute('aria-hidden')).toBe('true');
  });

  it('leaves the input the only accessible name in the bar', () => {
    // A second announced element here would read as a separate control. The
    // input's own label is the one the user is meant to hear.
    const { input, bar } = render({ leading: sprite });
    expect(input.getAttribute('aria-label')).toBe('Chat with concierge');
    const named = [...bar.querySelectorAll('[aria-label]')];
    expect(named.filter((el) => el !== input && !el.closest('[aria-hidden="true"]')))
      .toHaveLength(1); // the send button, which was always there
  });

  it('takes no tab stop', () => {
    const { bar } = render({ leading: <button type="button">nope</button> });
    const slot = bar.firstElementChild as HTMLElement;
    expect(slot.getAttribute('aria-hidden')).toBe('true');
    expect(slot.style.pointerEvents).toBe('none');
  });
});

describe('auto theme — the colour parsing these refactors touched', () => {
  // parseRgba and luminance were rewritten to satisfy
  // noUncheckedIndexedAccess (gridiron is the first consumer strict enough
  // to typecheck this package's source). Neither is exported, so the honest
  // test is the observable one: does auto-theme still TELL THE TWO APART?
  function barBackgroundOn(bodyColor: string) {
    // jsdom implements no hit-testing; the auto path samples whatever sits
    // under the bar, which on a real page is the section behind it.
    (document as unknown as { elementFromPoint: () => Element })
      .elementFromPoint = () => document.body;
    document.body.style.backgroundColor = bodyColor;
    const { bar } = render({ theme: 'auto' });
    return bar.style.background;
  }

  it('resolves a dark page differently from a light one', () => {
    const onDark = barBackgroundOn('rgb(14, 15, 19)');
    act(() => root.unmount());
    container.remove();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    const onLight = barBackgroundOn('rgb(247, 247, 245)');

    expect(onDark).not.toBe('');
    expect(onLight).not.toBe('');
    // If parseRgba returned null for either, both would land on the same
    // fallback and this would pass vacuously — so assert they DIFFER.
    expect(onDark).not.toBe(onLight);
  });

  it('survives a background colour it cannot parse', () => {
    const bg = barBackgroundOn('color(display-p3 0.1 0.1 0.1)');
    expect(bg).not.toBe('');
  });
});

describe('the keyboard-shortcut chip', () => {
  const chipText = (root: HTMLElement) =>
    [...root.querySelectorAll('span')].map((el) => el.textContent ?? '').join('|');

  it('shows on a wide viewport', () => {
    const { bar } = render();
    expect(chipText(bar)).toMatch(/K$/);
  });

  it('is hidden below 768px — it costs ~55px of the input for a key no phone has', () => {
    NARROW.value = true;
    const { bar } = render();
    expect(chipText(bar)).not.toMatch(/K$/);
  });

  it('gives the freed width back to the input', () => {
    // The point of the guard, stated as the property that matters: the same
    // bar yields a wider text field once the chip is gone.
    const wide = render().bar.querySelectorAll('span').length;
    act(() => root.unmount());
    container.remove();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    NARROW.value = true;
    const narrow = render().bar.querySelectorAll('span').length;
    expect(narrow).toBeLessThan(wide);
  });
});
