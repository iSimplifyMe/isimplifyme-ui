'use client'

import { useEffect } from 'react'
import { OUTBOUND_BEACON_PATH, beaconUrl, describeClick } from './outbound'

export interface OutboundClicksProps {
  /** Path of the static file to request. Must exist — ship `public/out.txt`. */
  beaconPath?: string
  /**
   * Hostnames to treat as internal alongside the page's own: a staging domain,
   * a sibling property, a booking host the site considers part of itself.
   */
  ignoreHosts?: readonly string[]
  /**
   * Set false to send nothing. A site that asks before analytics mounts this
   * inside its consent gate, or passes the gate's answer here.
   */
  enabled?: boolean
}

/**
 * Counts the clicks a server log cannot see — phone taps, email links, links
 * off the site, and anything the page labels with `data-track` (see
 * ./outbound.ts for what may leave the page).
 *
 * One delegated listener on the document, so every page stays a server
 * component and nothing has to be wrapped. Renders null.
 *
 *     <OutboundClicks />                       // in the root layout
 *     <a href="tel:+13125002674" data-track="header">…</a>
 *     <button data-track="book-online">…</button>
 *
 * Put `data-track` on the thing that gets clicked, not on a section around it:
 * the label is read from the nearest labelled ancestor, so a wrapper would
 * claim every click inside it.
 */
export function OutboundClicks({ beaconPath = OUTBOUND_BEACON_PATH, ignoreHosts, enabled = true }: OutboundClicksProps) {
  // A caller's inline array is a new array every render; its contents are not.
  const ignoreKey = (ignoreHosts ?? []).join(',')
  useEffect(() => {
    if (!enabled) return
    const ignored = ignoreKey ? ignoreKey.split(',') : []
    const onClick = (event: MouseEvent) => {
      // Left click, or middle click (auxclick) opening a background tab.
      if (event.type === 'auxclick' && event.button !== 1) return
      const target = event.target as Element | null
      if (!target?.closest) return
      const click = describeClick(target, {
        pathname: window.location.pathname,
        hostname: window.location.hostname,
        ignoreHosts: ignored,
      })
      if (!click) return
      // keepalive lets the request finish if the tab navigates; credentials
      // are omitted so not even our own cookies ride along.
      fetch(beaconUrl(click, Date.now(), beaconPath), {
        method: 'GET',
        keepalive: true,
        cache: 'no-store',
        credentials: 'omit',
      }).catch(() => {})
    }
    document.addEventListener('click', onClick, true)
    document.addEventListener('auxclick', onClick, true)
    return () => {
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('auxclick', onClick, true)
    }
  }, [beaconPath, ignoreKey, enabled])
  return null
}

export default OutboundClicks
