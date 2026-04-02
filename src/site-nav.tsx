'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { analytics } from './analytics'

interface NavLink {
  label: string
  href: string
}

interface SiteNavProps {
  siteName: string
  links: NavLink[]
  accentColor?: 'fallout' | 'cobalt' | 'hazard'
  logoSrc?: string
  logoHeight?: number
}

const hoverColorMap = {
  fallout: 'hover:text-fallout-400',
  cobalt: 'hover:text-cobalt-400',
  hazard: 'hover:text-hazard-400',
}

const underlineColorMap = {
  fallout: 'bg-fallout-400',
  cobalt: 'bg-cobalt-400',
  hazard: 'bg-hazard-400',
}

export function SiteNav({
  siteName,
  links,
  accentColor = 'fallout',
  logoSrc,
  logoHeight = 20,
}: SiteNavProps) {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  const hoverClass = hoverColorMap[accentColor]
  const underlineClass = underlineColorMap[accentColor]

  return (
    <>
      <motion.nav
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
          scrolled
            ? 'border-b border-concrete-700/30 bg-white/90 backdrop-blur-xl shadow-sm'
            : 'border-b border-transparent bg-white/0'
        }`}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <a
            href="/"
            className={`transition-opacity duration-300 hover:opacity-80`}
          >
            {logoSrc ? (
              <img src={logoSrc} alt={siteName} style={{ height: logoHeight }} className="w-auto" />
            ) : (
              <span className={`font-mono text-sm font-bold uppercase tracking-[0.2em] text-concrete-50 ${hoverClass}`}>
                {siteName}
              </span>
            )}
          </a>

          <div className="hidden items-center gap-8 md:flex">
            {links.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={() => analytics.navClick(link.label)}
                className={`group relative font-mono text-xs uppercase tracking-wider text-concrete-400 transition-colors duration-300 ${hoverClass}`}
              >
                {link.label}
                <span className={`absolute -bottom-1 left-0 h-px w-0 ${underlineClass} transition-all duration-300 group-hover:w-full`} />
              </a>
            ))}
          </div>

          <button
            type="button"
            className="relative z-50 flex h-8 w-8 flex-col items-center justify-center gap-1.5 md:hidden"
            onClick={() => { analytics.mobileMenuToggle(!mobileOpen); setMobileOpen(!mobileOpen) }}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          >
            <span
              className={`block h-px w-5 bg-concrete-200 transition-all duration-300 ${
                mobileOpen ? 'translate-y-[3.5px] rotate-45' : ''
              }`}
            />
            <span
              className={`block h-px w-5 bg-concrete-200 transition-all duration-300 ${
                mobileOpen ? '-translate-y-[3.5px] -rotate-45' : ''
              }`}
            />
          </button>
        </div>
      </motion.nav>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-8 bg-concrete-950/95 backdrop-blur-xl md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {links.map((link, i) => (
              <motion.a
                key={link.label}
                href={link.href}
                className={`font-mono text-sm uppercase tracking-[0.2em] text-concrete-300 transition-colors duration-300 ${hoverClass}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ delay: i * 0.05 + 0.1 }}
                onClick={() => { analytics.navClick(link.label); setMobileOpen(false) }}
              >
                {link.label}
              </motion.a>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
