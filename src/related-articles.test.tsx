/**
 * The thumbnails these two components paint.
 *
 * Until 2026-09-20 both rendered a raw `<img src={sourceFile}>`, so a browser
 * downloaded the original at full resolution to fill a card: measured on
 * endsights.com/roblox-tycoon-games, 3.905 MB of image weight for three
 * 379x237 thumbnails, two of them 1.9 MB each. The suite was green the whole
 * time, because neither component had a single test — a green run on a
 * component with no coverage is not evidence.
 *
 * So these assertions pin the property that produced the saving (the browser
 * is offered narrow candidates and a `sizes` hint, never the source file at
 * its own URL) rather than the identity of the component that provides it.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { RelatedArticles } from './related-articles';
import { BentoGrid } from './bento-grid';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  // Both components reveal their cards with framer-motion's `whileInView`,
  // which reaches for IntersectionObserver on mount. jsdom ships none. A stub
  // that never reports an intersection is the honest default: it leaves the
  // cards in their initial state, and nothing here asserts on the reveal.
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
      root = null;
      rootMargin = '';
      thresholds = [];
    },
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

const post = (over: Record<string, unknown> = {}) => ({
  title: 'Roblox Obby Games in 2026',
  slug: 'roblox-obby-games',
  date: '2026-08-10',
  excerptText: 'Why the oldest genre still outlasts its trends.',
  image: '/images/roblox-obby-genre.jpg',
  category: 'Roblox News',
  readingTime: '9 min read',
  ...over,
});

/** The `w` descriptors a `srcset` offers, as numbers. */
function candidates(img: HTMLImageElement): number[] {
  return (img.getAttribute('srcset') ?? '')
    .split(',')
    .map((c) => Number(c.trim().split(/\s+/)[1]?.replace('w', '')))
    .filter((n) => Number.isFinite(n));
}

describe('RelatedArticles thumbnails', () => {
  function render(props: Record<string, unknown> = {}) {
    act(() => {
      root.render(<RelatedArticles posts={[post()]} {...props} />);
    });
    return container.querySelector('img') as HTMLImageElement;
  }

  it('never points the browser at the source file', () => {
    const img = render();
    // The defect in one line: if this ever equals the path the caller passed,
    // every consumer is downloading a full-size original for a thumbnail again.
    expect(img.getAttribute('src')).not.toBe('/images/roblox-obby-genre.jpg');
    expect(img.getAttribute('src')).toContain('/_next/image');
  });

  it('offers narrow candidates, not one fixed size', () => {
    const w = candidates(render());
    expect(w.length).toBeGreaterThan(1);
    // A 379px card at 1x needs nothing near the 1536px source. Without a
    // candidate this small the browser has nothing cheap to pick.
    expect(Math.min(...w)).toBeLessThanOrEqual(384);
  });

  it('tells the browser how wide the card actually is', () => {
    // `sizes` is what makes the candidates usable: without it the browser
    // assumes 100vw and picks a desktop-width file for a one-third column.
    expect(render().getAttribute('sizes')).toBe(
      '(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw',
    );
  });

  it('lets a consumer in a narrower container say so', () => {
    expect(render({ imageSizes: '200px' }).getAttribute('sizes')).toBe('200px');
  });

  it('leaves the image decorative — the card heading already names the post', () => {
    // alt was deliberately emptied: the <h3> below carries the same string, so
    // a duplicate alt reads the title twice to a screen reader. Pinned here so
    // nobody "restores" it.
    expect(render().getAttribute('alt')).toBe('');
    expect(container.querySelector('h3')?.textContent).toBe(
      'Roblox Obby Games in 2026',
    );
  });

  it('renders no image at all for a post without one', () => {
    act(() => {
      root.render(<RelatedArticles posts={[post({ image: undefined })]} />);
    });
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('h3')).not.toBeNull();
  });

  it('renders nothing for an empty post list', () => {
    act(() => {
      root.render(<RelatedArticles posts={[]} />);
    });
    expect(container.querySelector('section')).toBeNull();
  });
});

describe('BentoGrid background images', () => {
  const item = (over: Record<string, unknown> = {}) => ({
    title: 'Sale orders',
    description: 'Synced nightly.',
    backgroundImage: '/images/bento-hero.jpg',
    ...over,
  });

  function render(items: Record<string, unknown>[]) {
    act(() => {
      root.render(<BentoGrid items={items as never} />);
    });
    return container.querySelector('img') as HTMLImageElement;
  }

  it('never points the browser at the source file', () => {
    const img = render([item()]);
    expect(img.getAttribute('src')).not.toBe('/images/bento-hero.jpg');
    expect(img.getAttribute('src')).toContain('/_next/image');
  });

  it('offers narrow candidates and a default `sizes` for its own grid', () => {
    const img = render([item()]);
    expect(Math.min(...candidates(img))).toBeLessThanOrEqual(384);
    expect(img.getAttribute('sizes')).toBe(
      '(min-width: 1024px) 50vw, (min-width: 640px) 50vw, 100vw',
    );
  });

  it('lets an item that knows its span override `sizes`', () => {
    expect(render([item({ imageSizes: '25vw' })]).getAttribute('sizes')).toBe(
      '25vw',
    );
  });

  it('renders no image for an item without a background', () => {
    render([item({ backgroundImage: undefined })]);
    expect(container.querySelector('img')).toBeNull();
  });
});
