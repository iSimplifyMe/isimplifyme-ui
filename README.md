# @isimplifyme/ui

React/Next.js component library powering [iSimplifyMe](https://isimplifyme.com) properties — design-system primitives (bento grid, section reveal, smooth scroll, custom cursor, noise overlay), article components (layout, table of contents, image lightbox, related articles), SEO helpers, bot-detection middleware, and the iSM Concierge widget.

This is an internal library, versioned for iSimplifyMe site deployments and published to GitHub Packages. It is public for transparency — the components here ship on production client sites — but it is not currently accepting external contributions, and the API changes on iSimplifyMe's schedule.

## Install

The package is published to GitHub Packages, not the public npm registry:

```
# .npmrc
@isimplifyme:registry=https://npm.pkg.github.com
```

```bash
npm install @isimplifyme/ui
```

Peer dependencies: `react ^19`, `react-dom ^19`, `next ^16`, `framer-motion ^12`.

## Exports

Each component is exported on its own subpath — `@isimplifyme/ui/bento`, `@isimplifyme/ui/seo`, `@isimplifyme/ui/concierge`, and so on. See `package.json` `exports` for the full map.

## Click beacon

`OutboundClicks` counts the clicks a server access log cannot see: phone taps, email links, links off the site, and anything the page labels itself. A click sends one `GET /out.txt?e=<event>&p=<page>&…&t=<ms>` for a tiny static file, and the CDN's own access log is the counter — no cookie, no identifier, no third party, no server code, and the visitor's link is never rewritten.

```tsx
// app/layout.tsx
import { OutboundClicks } from '@isimplifyme/ui/outbound-clicks'
;<OutboundClicks />

// anywhere
<a href="tel:+13125002674" data-track="header">(312) 500-2674</a>
<button data-track="book-online">Book online</button>
```

The consuming site must ship the file the beacon asks for — `public/out.txt`, any short body — or every click is a 404 (still logged, but it reads as an error).

| `e` | fires on | also carries |
| --- | --- | --- |
| `tel` | `a[href^="tel:"]` | `n` label |
| `mailto` | `a[href^="mailto:"]` | `n` label |
| `out` | an `http(s)` link to another host | `h` hostname, `n` label |
| `amazon` / `merchant` | `a[data-amazon]` / `a[data-merchant]` | `n` product, `i` position, `m` merchant |
| `track` | any `[data-track]` that is not inside a link | `n` label |

What may leave the page is an event name, the current path, a hostname, and labels written in the site's own source — never a phone number, an email address, a link's path or query, or anything a visitor typed. `BEACON_KEYS` in `src/outbound.ts` is the whole vocabulary, and `src/outbound.test.ts` fails if a new key appears without being named there.

Internal links are deliberately silent: a click that ends in a request to our own server is already in the same log as a page view. Pass `ignoreHosts` for hostnames the site considers its own, and `enabled={false}` (or mount inside a consent gate) where a site asks before it measures.

## Tests

```bash
npm install
npm test        # vitest
npm run typecheck
```

## Security

Report security issues to [ai@isimplifyme.com](mailto:ai@isimplifyme.com).

---

Maintained by [iSimplifyMe](https://isimplifyme.com) — AI orchestration infrastructure and answer-engine optimization.
