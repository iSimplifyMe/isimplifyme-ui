'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useInView } from 'framer-motion'
import { flicker } from './theme'
import { analytics } from './analytics'

interface SiteLink {
  label: string
  href: string
  active?: boolean
}

const sites: SiteLink[] = [
  { label: 'Studio', href: 'https://simplified.media' },
  { label: 'Endsights', href: 'https://endsights.com' },
  { label: 'Adellion', href: 'https://adellion.com' },
]

const footerLinks = [
  { label: 'Privacy Policy', href: '/privacy-policy' },
  { label: 'Terms of Use', href: '/terms-of-use' },
  { label: 'Cookie Policy', href: '/cookie-policy' },
  { label: 'DMCA', href: '/dmca' },
  { label: 'Contact', href: '/contact' },
  { label: 'Advertise', href: '/advertise' },
  { label: 'AI Transparency', href: '/ai-transparency' },
]

function AnimatedCounter({ value, label }: { value: number; label: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true })
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!isInView) return
    let frame = 0
    const duration = 40
    const step = () => {
      frame++
      const progress = Math.min(frame / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.round(eased * value))
      if (frame < duration) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [isInView, value])

  return (
    <div ref={ref} className="flex flex-col items-center gap-1">
      <span className="text-lg tabular-nums text-[#a8a29e]">{count}</span>
      <span className="text-[10px] uppercase tracking-[0.15em] text-[#57534e]">{label}</span>
    </div>
  )
}

interface ControlPanelFooterProps {
  activeSite: 'studio' | 'endsights' | 'adellion'
}

export function ControlPanelFooter({ activeSite }: ControlPanelFooterProps) {
  return (
    <footer className="relative border-t border-[#292524] bg-[#141414]">
      {/* Glow line above footer */}
      <div className="absolute -top-px left-0 right-0 h-px bg-gradient-to-r from-transparent via-fallout-400/30 to-transparent" />

      {/* Noise texture overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
          backgroundSize: '128px 128px',
        }}
      />

      {/* CRT scanline overlay */}
      <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.06)_2px,rgba(0,0,0,0.06)_4px)]" />

      <div className="relative mx-auto max-w-7xl px-6 py-12 md:py-16">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-8">

          {/* Column 1: Logo + tagline */}
          <div className="flex flex-col items-center md:items-start">
            <img src="https://simplified.media/images/sm-logo-full.svg" alt="Simplified Media" className="h-[12px] w-auto" />
            <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-[#78716c]">
              Engineering Worlds. Defining Experiences.
            </p>
          </div>

          {/* Column 2: Site toggle switches */}
          <div className="flex items-start justify-center gap-8">
            {sites.map((site) => {
              const isActive = site.label.toLowerCase() === activeSite
              return (
                <a
                  key={site.label}
                  href={site.href}
                  onClick={() => analytics.networkSiteClick(site.label)}
                  className="group flex flex-col items-center gap-2.5"
                >
                  <div
                    className={`
                      relative h-7 w-12 rounded-full border transition-all duration-300
                      ${isActive
                        ? 'border-fallout-500/60 bg-fallout-500/10 shadow-[inset_0_1px_4px_rgba(0,0,0,0.3)]'
                        : 'border-[#44403c]/80 bg-[#1e1e1e] shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)] group-hover:border-[#78716c]/60'
                      }
                    `}
                  >
                    <motion.div
                      className={`
                        absolute top-0.5 h-5.5 w-5.5 rounded-full shadow-sm
                        ${isActive
                          ? 'bg-fallout-400 shadow-[0_0_8px_rgba(26,255,40,0.4)]'
                          : 'bg-[#78716c] group-hover:bg-[#a8a29e]'
                        }
                      `}
                      animate={{ x: isActive ? 22 : 2 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  </div>
                  <span
                    className={`font-mono text-[10px] uppercase tracking-[0.2em] transition-all
                      ${isActive
                        ? 'text-fallout-400 [text-shadow:0_0_8px_rgba(26,255,40,0.3)]'
                        : 'text-[#78716c] group-hover:text-[#a8a29e]'
                      }
                    `}
                  >
                    {site.label}
                  </span>
                </a>
              )
            })}
          </div>

          {/* Column 3: Status indicators with animated counters */}
          <motion.div
            className="flex items-start justify-center gap-6 font-mono text-xs text-phosphor md:justify-end"
            variants={flicker}
            animate="idle"
          >
            <AnimatedCounter value={7} label="Projects" />
            <AnimatedCounter value={3} label="Sites" />
            <div className="flex flex-col items-center gap-1.5">
              <div className="relative h-3 w-3">
                <div className="absolute inset-0 rounded-full bg-fallout-500 shadow-[0_0_8px] shadow-fallout-500/60" />
                <div className="absolute inset-0 animate-ping rounded-full bg-fallout-400/40" />
              </div>
              <span className="text-[10px] uppercase tracking-[0.15em] text-[#57534e]">Status</span>
            </div>
          </motion.div>
        </div>

        {/* Divider + bottom row */}
        <div className="mt-10 border-t border-[#292524] pt-6">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#57534e]">
              &copy; {new Date().getFullYear()} Simplified Media Network
            </span>
            <nav className="flex gap-6">
              {footerLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={() => analytics.navClick(link.label)}
                  className="font-mono text-[10px] uppercase tracking-wider text-[#57534e] transition-colors hover:text-[#a8a29e]"
                >
                  {link.label}
                </a>
              ))}
            </nav>
          </div>
        </div>
      </div>
    </footer>
  )
}
