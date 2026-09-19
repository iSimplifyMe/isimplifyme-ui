/**
 * Clicks the server logs cannot see, counted without analytics.
 *
 * A tap on a phone number, an email link, a link off the site or any element
 * the page has labelled sends one GET for a tiny static file, with the click
 * described in its query string. CloudFront's access log already records every
 * request, query string included, so the log IS the counter — no cookie, no
 * identifier, no third party, no server code. Read it with
 * ~/claude/projects/iSM/scripts/outbound_clicks.py.
 *
 * The visitor's link is never touched: no redirect, no rewritten href, no
 * preventDefault. The beacon rides alongside the click.
 *
 * Internal links are deliberately silent — a click that ends in a request to
 * our own server is already in the same access log as a page view.
 *
 * WHAT MAY LEAVE THE PAGE: an event name, the current path, a hostname, and
 * labels the site's own source code wrote. Never a phone number, an email
 * address, a link's path or query string, form input, or anything a visitor
 * typed. `BEACON_KEYS` is the whole vocabulary and outbound.test.ts fails if
 * this file starts emitting a key that is not on it.
 */

/** Default path of the static file the beacon requests. */
export const OUTBOUND_BEACON_PATH = '/out.txt'

export type OutboundKind = 'tel' | 'mailto' | 'out' | 'amazon' | 'merchant' | 'track'

/** Every query key the beacon may ever carry. Adding one is a privacy decision. */
export const BEACON_KEYS = ['e', 'p', 'n', 'h', 'i', 'm', 't'] as const

export interface OutboundClick {
  /** `e` — what happened. */
  kind: OutboundKind
  /** `p` — pathname of the page the click happened on. */
  page: string
  /** `n` — the site's own label for this element (`data-track`), or a product name. */
  label?: string
  /** `h` — hostname of an outbound link. Hostname only: never the path or query. */
  host?: string
  /** `i` — 1-based position of the element in its list, when the site says so. */
  position?: number
  /** `m` — merchant name, for kind "merchant". */
  merchant?: string
}

/** The part of an element this module reads; a DOM Element satisfies it. */
export interface ElementLike {
  getAttribute(name: string): string | null
  closest(selector: string): ElementLike | null
}

export interface ClickContext {
  /** Pathname of the current page. */
  pathname: string
  /** The page's own hostname. A link here is internal, not outbound. */
  hostname: string
  /** Extra hostnames to treat as internal (a staging domain, a sibling property). */
  ignoreHosts?: readonly string[]
}

const clip = (value: string, max: number) => value.trim().slice(0, max)

const LABEL_MAX = 60

/** The site's own label for the clicked thing, from the nearest `data-track`. */
function labelFor(element: ElementLike): string | undefined {
  const labelled = element.closest('[data-track]')
  const label = labelled?.getAttribute('data-track')
  if (!label) return undefined
  return clip(label, LABEL_MAX) || undefined
}

/** Hostname of an absolute http(s) href, or null when it is not one we can read. */
function hostOf(href: string): string | null {
  if (!/^https?:\/\//i.test(href)) return null
  try {
    return new URL(href).hostname.toLowerCase() || null
  } catch {
    return null
  }
}

function isInternal(host: string, context: ClickContext): boolean {
  const own = context.hostname.toLowerCase()
  const bare = (h: string) => (h.startsWith('www.') ? h.slice(4) : h)
  if (bare(host) === bare(own)) return true
  return (context.ignoreHosts ?? []).some((ignored) => bare(host) === bare(ignored.toLowerCase()))
}

/**
 * Describes the click on `element`, or null when there is nothing to count.
 *
 * Order matters: a product link is a product link even though it is also
 * outbound, and an element inside a link belongs to the link.
 */
export function describeClick(element: ElementLike, context: ClickContext): OutboundClick | null {
  const page = clip(context.pathname, 120) || '/'
  const anchor = element.closest('a[href]')

  if (anchor) {
    const href = anchor.getAttribute('href') ?? ''
    const label = labelFor(element)

    const merchant = anchor.getAttribute('data-merchant')
    const isAmazon = anchor.getAttribute('data-amazon') !== null
    if (isAmazon || merchant !== null) {
      // adellion's original event, keys unchanged so outbound_clicks.py keeps reading it.
      const position = Number.parseInt(anchor.getAttribute('data-position') ?? '', 10)
      return {
        kind: isAmazon ? 'amazon' : 'merchant',
        page,
        label: clip(anchor.getAttribute('data-product') ?? '', 80) || label,
        position: Number.isFinite(position) ? position : 0,
        ...(isAmazon || !merchant ? {} : { merchant: clip(merchant, 40) }),
      }
    }

    // A phone number and an email address are the message, not a label for it.
    if (/^tel:/i.test(href)) return { kind: 'tel', page, label }
    if (/^mailto:/i.test(href)) return { kind: 'mailto', page, label }

    const host = hostOf(href)
    if (!host || isInternal(host, context)) return null
    return { kind: 'out', page, host, label }
  }

  // Not a link: a booking or chat opener, a store badge drawn as a button, a
  // tool's "calculate". Only fires where the site asked for it by name.
  const label = labelFor(element)
  return label ? { kind: 'track', page, label } : null
}

/** `t` makes every click its own URL, so neither the browser nor the edge answers one from cache. */
export function beaconUrl(
  click: OutboundClick,
  now: number = Date.now(),
  beaconPath: string = OUTBOUND_BEACON_PATH,
): string {
  const params = new URLSearchParams({ e: click.kind, p: click.page })
  if (click.label) params.set('n', click.label)
  if (click.host) params.set('h', click.host)
  if (click.position !== undefined) params.set('i', String(click.position))
  if (click.merchant) params.set('m', click.merchant)
  params.set('t', String(now))
  return `${beaconPath}?${params.toString()}`
}
