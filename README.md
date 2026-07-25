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

## Security

Report security issues to [ai@isimplifyme.com](mailto:ai@isimplifyme.com).

---

Maintained by [iSimplifyMe](https://isimplifyme.com) — AI orchestration infrastructure and answer-engine optimization.
