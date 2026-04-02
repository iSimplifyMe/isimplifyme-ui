'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react'

/* ------------------------------------------------------------------ */
/*  Context                                                           */
/* ------------------------------------------------------------------ */

interface SmoothScrollContextValue {
  /** Current vertical scroll position (px) */
  scrollY: number
  /** 0 → 1 progress through the full document height */
  progress: number
}

const SmoothScrollContext = createContext<SmoothScrollContextValue>({
  scrollY: 0,
  progress: 0,
})

export function useScrollProgress() {
  return useContext(SmoothScrollContext)
}

/* ------------------------------------------------------------------ */
/*  Provider                                                          */
/* ------------------------------------------------------------------ */

interface SmoothScrollProviderProps {
  children: ReactNode
}

/**
 * Lenis-style smooth scrolling using **CSS-only** techniques.
 *
 * - `scroll-behavior: smooth` on the root container
 * - `overscroll-behavior: none` to prevent pull-to-refresh / overscroll
 * - Exposes scrollY & progress via React context so downstream
 *   components can build parallax / progress-bar effects.
 */
export function SmoothScrollProvider({ children }: SmoothScrollProviderProps) {
  const [scrollY, setScrollY] = useState(0)
  const [progress, setProgress] = useState(0)

  const handleScroll = useCallback(() => {
    const y = window.scrollY
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight
    setScrollY(y)
    setProgress(maxScroll > 0 ? y / maxScroll : 0)
  }, [])

  useEffect(() => {
    // Inject global smooth-scroll styles once
    const id = '__smooth-scroll-styles'
    if (!document.getElementById(id)) {
      const style = document.createElement('style')
      style.id = id
      style.textContent = `
        html {
          scroll-behavior: smooth;
          overscroll-behavior: none;
        }
        body {
          overscroll-behavior: none;
        }
      `
      document.head.appendChild(style)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll() // seed initial values
    return () => window.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  return (
    <SmoothScrollContext.Provider value={{ scrollY, progress }}>
      {children}
    </SmoothScrollContext.Provider>
  )
}
