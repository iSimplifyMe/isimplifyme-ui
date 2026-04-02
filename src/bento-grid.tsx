'use client'

import { motion } from 'framer-motion'
// bentoCard and stagger imports removed — individual cards now use whileInView with index-based delay
import type { ReactNode } from 'react'

export interface BentoItem {
  id: string
  /** Grid column span (1-4) */
  colSpan?: 1 | 2 | 3 | 4
  /** Grid row span (1-3) */
  rowSpan?: 1 | 2 | 3
  children: ReactNode
  className?: string
  /** Optional background image URL */
  backgroundImage?: string
  /** Alt text for background image */
  backgroundAlt?: string
  /** Accent color for hover effects: 'fallout' | 'cobalt' | 'hazard' */
  accentColor?: 'fallout' | 'cobalt' | 'hazard'
}

interface BentoGridProps {
  items: BentoItem[]
  className?: string
}

const colSpanMap: Record<number, string> = {
  1: 'col-span-1',
  2: 'sm:col-span-2',
  3: 'sm:col-span-2 lg:col-span-3',
  4: 'sm:col-span-2 lg:col-span-4',
}

const rowSpanMap: Record<number, string> = {
  1: 'row-span-1 min-h-[200px]',
  2: 'row-span-2 min-h-[420px]',
  3: 'row-span-3 min-h-[640px]',
}

const accentStyles: Record<string, { border: string; shadow: string; innerShadow: string }> = {
  fallout: {
    border: 'hover:border-fallout-400/30',
    shadow: 'hover:shadow-[0_0_30px_-5px_rgba(26,255,40,0.08)]',
    innerShadow: 'hover:[box-shadow:inset_0_1px_0_0_rgba(255,255,255,0.08),inset_0_0_40px_-10px_rgba(26,255,40,0.03),0_0_30px_-5px_rgba(26,255,40,0.08)]',
  },
  cobalt: {
    border: 'hover:border-cobalt-400/30',
    shadow: 'hover:shadow-[0_0_30px_-5px_rgba(74,119,255,0.08)]',
    innerShadow: 'hover:[box-shadow:inset_0_1px_0_0_rgba(255,255,255,0.08),inset_0_0_40px_-10px_rgba(74,119,255,0.03),0_0_30px_-5px_rgba(74,119,255,0.08)]',
  },
  hazard: {
    border: 'hover:border-hazard-400/30',
    shadow: 'hover:shadow-[0_0_30px_-5px_rgba(255,164,26,0.08)]',
    innerShadow: 'hover:[box-shadow:inset_0_1px_0_0_rgba(255,255,255,0.08),inset_0_0_40px_-10px_rgba(255,164,26,0.03),0_0_30px_-5px_rgba(255,164,26,0.08)]',
  },
}

export function BentoGrid({ items, className = '' }: BentoGridProps) {
  return (
    <motion.div
      className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 ${className}`}
    >
      {items.map((item, index) => {
        const accent = accentStyles[item.accentColor ?? 'fallout']
        return (
          <motion.div
            key={item.id}
            className={`
              group/card relative rounded-2xl overflow-hidden
              border border-concrete-700
              bg-concrete-800
              transition-all duration-500 ease-out
              hover:scale-[1.02]
              ${accent.border}
              ${accent.shadow}
              ${colSpanMap[item.colSpan ?? 1]}
              ${rowSpanMap[item.rowSpan ?? 1]}
              ${item.className ?? ''}
            `}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{
              duration: 0.5,
              delay: index * 0.08,
              ease: [0.25, 0.46, 0.45, 0.94],
            }}
          >
            {/* Background image layer */}
            {item.backgroundImage && (
              <>
                <img
                  src={item.backgroundImage}
                  alt={item.backgroundAlt ?? ''}
                  className="absolute inset-0 h-full w-full object-cover transition-all duration-700 ease-out group-hover/card:scale-105 group-hover/card:brightness-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#141414]/75 to-[#141414]/40" />
              </>
            )}
            {/* Content layer */}
            <div className="relative z-10 h-full">
              {item.children}
            </div>
          </motion.div>
        )
      })}
    </motion.div>
  )
}
