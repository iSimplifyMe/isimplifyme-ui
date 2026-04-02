'use client'

import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface SectionRevealProps {
  children: ReactNode
  /** Slide-in direction (default: 'up') */
  direction?: 'up' | 'left' | 'right'
  /** Stagger delay in seconds (default: 0) */
  delay?: number
  className?: string
}

/* ------------------------------------------------------------------ */
/*  Offsets per direction                                              */
/* ------------------------------------------------------------------ */

const offsets: Record<
  NonNullable<SectionRevealProps['direction']>,
  { x: number; y: number }
> = {
  up: { x: 0, y: 60 },
  left: { x: -60, y: 0 },
  right: { x: 60, y: 0 },
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

/**
 * Wraps children in a `motion.div` that fades + slides into view
 * when the element enters the viewport.
 *
 * Animation runs once (`viewport.once: true`) and triggers 100 px
 * before the element is fully visible.
 */
export function SectionReveal({
  children,
  direction = 'up',
  delay = 0,
  className = '',
}: SectionRevealProps) {
  const { x, y } = offsets[direction]

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, x, y }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{
        duration: 0.7,
        delay,
        ease: [0.22, 1, 0.36, 1], // custom ease-out expo
      }}
    >
      {children}
    </motion.div>
  )
}
