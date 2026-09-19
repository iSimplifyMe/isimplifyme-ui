/**
 * jsdom prints "Not implemented: navigation to another Document" while these
 * run. That is the point: the clicks are real and the hrefs are untouched, so
 * jsdom tries to follow them.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { BEACON_KEYS, OUTBOUND_BEACON_PATH, beaconUrl, describeClick } from './outbound'
import { OutboundClicks } from './outbound-clicks'

const SITE = { pathname: '/contact', hostname: 'example.com' }

/** Builds the markup and returns the element the visitor actually clicks. */
function clicked(html: string, selector = '[data-hit]'): Element {
  document.body.innerHTML = html
  const element = document.querySelector(selector)
  if (!element) throw new Error(`no ${selector} in ${html}`)
  return element
}

const read = (...parts: string[]) => fs.readFileSync(path.join(process.cwd(), ...parts), 'utf-8')

describe('describeClick — phone and email', () => {
  it('counts a phone tap, and carries the label instead of the number', () => {
    const click = describeClick(clicked('<a data-hit href="tel:+13125002674" data-track="header">Call us</a>'), SITE)
    expect(click).toEqual({ kind: 'tel', page: '/contact', label: 'header' })
    expect(beaconUrl(click!, 1)).not.toContain('3125002674')
  })

  it('counts an unlabelled phone tap with no label at all', () => {
    expect(describeClick(clicked('<a data-hit href="tel:+13125002674">Call</a>'), SITE)).toEqual({
      kind: 'tel',
      page: '/contact',
      label: undefined,
    })
  })

  it('counts an email click without the address', () => {
    const click = describeClick(clicked('<a data-hit href="mailto:hello@example.com" data-track="footer">Email</a>'), SITE)
    expect(click).toEqual({ kind: 'mailto', page: '/contact', label: 'footer' })
    expect(beaconUrl(click!, 1)).not.toContain('hello')
  })

  it('reads the label off the clicked child when the anchor is unlabelled', () => {
    const click = describeClick(clicked('<a href="tel:+1312"><span data-hit data-track="hero">Call</span></a>'), SITE)
    expect(click?.label).toBe('hero')
  })
})

describe('describeClick — links off the site', () => {
  it('keeps the hostname and nothing else from the URL', () => {
    const click = describeClick(
      clicked('<a data-hit href="https://apply.rate.com/loans?ref=secret&ssn=nope#frag" data-track="apply">Apply</a>'),
      SITE,
    )
    expect(click).toEqual({ kind: 'out', page: '/contact', host: 'apply.rate.com', label: 'apply' })
    const url = beaconUrl(click!, 1)
    expect(url).not.toContain('loans')
    expect(url).not.toContain('secret')
    expect(url).not.toContain('ssn')
  })

  it('lower-cases the hostname', () => {
    expect(describeClick(clicked('<a data-hit href="https://MAPS.Google.com/x">Directions</a>'), SITE)?.host).toBe('maps.google.com')
  })

  it('ignores our own host, with or without www', () => {
    expect(describeClick(clicked('<a data-hit href="https://example.com/about">About</a>'), SITE)).toBeNull()
    expect(describeClick(clicked('<a data-hit href="https://www.example.com/about">About</a>'), SITE)).toBeNull()
  })

  it('ignores a relative link — a request to us is already in the log', () => {
    expect(describeClick(clicked('<a data-hit href="/services" data-track="nav">Services</a>'), SITE)).toBeNull()
  })

  it('ignores the hosts the site calls its own', () => {
    const context = { ...SITE, ignoreHosts: ['staging.example.com', 'Example.net'] }
    expect(describeClick(clicked('<a data-hit href="https://staging.example.com/x">x</a>'), context)).toBeNull()
    expect(describeClick(clicked('<a data-hit href="https://example.net/x">x</a>'), context)).toBeNull()
    expect(describeClick(clicked('<a data-hit href="https://other.example.org/x">x</a>'), context)?.host).toBe('other.example.org')
  })

  it('ignores schemes it cannot read a hostname from', () => {
    expect(describeClick(clicked('<a data-hit href="javascript:void(0)">x</a>'), SITE)).toBeNull()
    expect(describeClick(clicked('<a data-hit href="sms:+13125002674">Text</a>'), SITE)).toBeNull()
  })
})

describe('describeClick — product links keep adellion’s shape', () => {
  it('reads an Amazon card link', () => {
    expect(
      describeClick(
        clicked('<a data-hit data-amazon href="https://amazon.com/dp/1" data-product="Elgato HD60 X" data-position="2">Buy</a>'),
        { pathname: '/capture-cards', hostname: 'adellion.com' },
      ),
    ).toEqual({ kind: 'amazon', page: '/capture-cards', label: 'Elgato HD60 X', position: 2 })
  })

  it('reads a merchant card link and keeps the merchant name', () => {
    expect(
      describeClick(
        clicked('<a data-hit data-merchant="Secretlab" href="https://secretlab.co/x" data-product="Titan Evo" data-position="1">Buy</a>'),
        { pathname: '/best-gaming-chairs', hostname: 'adellion.com' },
      ),
    ).toEqual({ kind: 'merchant', page: '/best-gaming-chairs', label: 'Titan Evo', position: 1, merchant: 'Secretlab' })
  })

  it('emits exactly the query adellion’s reader already parses', () => {
    const click = describeClick(
      clicked('<a data-hit data-amazon href="https://amazon.com/dp/1" data-product="Elgato HD60 X" data-position="2">Buy</a>'),
      { pathname: '/capture-cards', hostname: 'adellion.com' },
    )
    expect(Object.fromEntries(new URLSearchParams(beaconUrl(click!, 1700000000000).split('?')[1]))).toEqual({
      e: 'amazon',
      p: '/capture-cards',
      n: 'Elgato HD60 X',
      i: '2',
      t: '1700000000000',
    })
  })

  it('survives a missing position', () => {
    const click = describeClick(clicked('<a data-hit data-amazon href="https://amazon.com/dp/1" data-product="x">Buy</a>'), SITE)
    expect(click?.position).toBe(0)
  })
})

describe('describeClick — labelled things that are not links', () => {
  it('counts a button the site asked to count', () => {
    expect(describeClick(clicked('<button data-hit data-track="book-online">Book</button>'), SITE)).toEqual({
      kind: 'track',
      page: '/contact',
      label: 'book-online',
    })
  })

  it('stays silent on an unlabelled click anywhere else', () => {
    expect(describeClick(clicked('<div data-hit>just words</div>'), SITE)).toBeNull()
  })

  it('an element inside a link belongs to the link, not to itself', () => {
    const click = describeClick(clicked('<a href="tel:+1312" data-track="header"><svg data-hit data-track="icon"></svg></a>'), SITE)
    expect(click?.kind).toBe('tel')
  })
})

describe('describeClick — clipping and defaults', () => {
  it('clips long values and defaults an empty path', () => {
    const click = describeClick(clicked(`<button data-hit data-track="${'x'.repeat(300)}">go</button>`), {
      pathname: 'p'.repeat(300),
      hostname: 'example.com',
    })
    expect(click?.label).toHaveLength(60)
    expect(click?.page).toHaveLength(120)
    expect(describeClick(clicked('<button data-hit data-track="go"></button>'), { pathname: '', hostname: 'example.com' })?.page).toBe('/')
  })

  it('treats a blank label as no label', () => {
    expect(describeClick(clicked('<button data-hit data-track="   ">go</button>'), SITE)).toBeNull()
    expect(describeClick(clicked('<a data-hit href="tel:+1312" data-track="  ">Call</a>'), SITE)?.label).toBeUndefined()
  })
})

describe('beaconUrl', () => {
  it('is a same-origin GET for the static beacon file', () => {
    expect(beaconUrl({ kind: 'tel', page: '/' }, 1).startsWith(`${OUTBOUND_BEACON_PATH}?`)).toBe(true)
    expect(beaconUrl({ kind: 'tel', page: '/' }, 1, '/beacon.txt').startsWith('/beacon.txt?')).toBe(true)
  })

  it('is unique per click, so no cache answers it', () => {
    const click = { kind: 'out' as const, page: '/x', host: 'y.com' }
    expect(beaconUrl(click, 1)).not.toBe(beaconUrl(click, 2))
  })

  it('omits the keys a click has nothing to say about', () => {
    expect(beaconUrl({ kind: 'tel', page: '/contact' }, 1)).toBe('/out.txt?e=tel&p=%2Fcontact&t=1')
  })

  /**
   * The privacy guarantee is the size of this vocabulary. A new key here means
   * something new about the visitor can leave the page, so it has to be named
   * in BEACON_KEYS and in this literal before any test passes again.
   */
  it('never emits a key outside the allow-list', () => {
    expect([...BEACON_KEYS]).toEqual(['e', 'p', 'n', 'h', 'i', 'm', 't'])
    const kinds = ['tel', 'mailto', 'out', 'amazon', 'merchant', 'track'] as const
    for (const kind of kinds) {
      const url = beaconUrl({ kind, page: '/p', label: 'l', host: 'h.com', position: 1, merchant: 'm' }, 1)
      for (const key of new URLSearchParams(url.split('?')[1]).keys()) {
        expect(BEACON_KEYS).toContain(key)
      }
    }
  })
})

describe('<OutboundClicks /> on a real page', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  let container: HTMLElement
  let root: ReturnType<typeof createRoot>

  const mount = (props: Record<string, unknown> = {}) => {
    act(() => root.render(createElement(OutboundClicks, props)))
  }

  beforeEach(() => {
    ;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
    fetchMock = vi.fn(() => Promise.resolve({ ok: true } as Response))
    vi.stubGlobal('fetch', fetchMock)
    document.body.innerHTML = ''
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    vi.unstubAllGlobals()
  })

  it('sends exactly one cookieless beacon per tap, and leaves the link alone', () => {
    mount()
    const link = document.createElement('a')
    link.href = 'tel:+13125002674'
    link.dataset.track = 'header'
    document.body.appendChild(link)

    const event = new MouseEvent('click', { bubbles: true, cancelable: true })
    link.dispatchEvent(event)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toMatch(/^\/out\.txt\?e=tel&p=[^&]*&n=header&t=\d+$/)
    expect(init).toMatchObject({ method: 'GET', credentials: 'omit', cache: 'no-store', keepalive: true })
    expect(init.headers).toBeUndefined()
    // The visitor's own click still does what it was going to do.
    expect(event.defaultPrevented).toBe(false)
    expect(link.getAttribute('href')).toBe('tel:+13125002674')
  })

  it('sends nothing for a click with nothing to count', () => {
    mount()
    document.body.appendChild(document.createElement('p')).dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('counts a middle click that opens a background tab, but not a right click', () => {
    mount()
    const link = document.createElement('a')
    link.href = 'https://apply.rate.com/x'
    document.body.appendChild(link)
    link.dispatchEvent(new MouseEvent('auxclick', { bubbles: true, button: 2 }))
    expect(fetchMock).not.toHaveBeenCalled()
    link.dispatchEvent(new MouseEvent('auxclick', { bubbles: true, button: 1 }))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toContain('h=apply.rate.com')
  })

  it('sends nothing at all while disabled — a consent gate can hold it shut', () => {
    mount({ enabled: false })
    const link = document.createElement('a')
    link.href = 'tel:+13125002674'
    document.body.appendChild(link)
    link.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('stops listening when it unmounts', () => {
    mount()
    const link = document.createElement('a')
    link.href = 'tel:+13125002674'
    document.body.appendChild(link)
    act(() => root.unmount())
    link.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(fetchMock).not.toHaveBeenCalled()
    root = createRoot(container) // afterEach unmounts something valid
  })

  it('respects a custom beacon path and the site’s own hosts', () => {
    mount({ beaconPath: '/b.txt', ignoreHosts: ['apply.rate.com'] })
    const ignored = document.createElement('a')
    ignored.href = 'https://apply.rate.com/x'
    document.body.appendChild(ignored)
    ignored.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(fetchMock).not.toHaveBeenCalled()

    const counted = document.createElement('a')
    counted.href = 'https://maps.google.com/x'
    document.body.appendChild(counted)
    counted.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toMatch(/^\/b\.txt\?/)
  })
})

describe('the source keeps its promises', () => {
  const component = read('src', 'outbound-clicks.tsx')

  it('sends no cookies', () => {
    expect(component).toContain("credentials: 'omit'")
  })

  it('never touches the visitor’s link', () => {
    expect(component).not.toMatch(/\.href\s*=|preventDefault|window\.open|location\.assign|location\.replace/)
  })

  it('names no third-party host anywhere in the beacon code', () => {
    for (const source of [component, read('src', 'outbound.ts')]) {
      expect(source).not.toMatch(/https?:\/\/(?!$)[a-z0-9.-]+\.(com|net|io|ai)\//i)
    }
  })
})
