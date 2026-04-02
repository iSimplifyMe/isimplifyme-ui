'use client'

import { motion } from 'framer-motion'

interface ArticleNavProps {
  prev?: { title: string; slug: string }
  next?: { title: string; slug: string }
  accentColor?: 'cobalt' | 'hazard' | 'fallout'
}

const colorMap = {
  cobalt: { hover: 'hover:text-[#4a77ff]', border: 'hover:border-[#4a77ff]/30', text: 'text-[#1A1A1A]', borderBase: 'border-[#E5E5E5]' },
  hazard: { hover: 'hover:text-[#0EA5D6]', border: 'hover:border-[#0EA5D6]/30', text: 'text-[#1A1A1A]', borderBase: 'border-[#E5E5E5]' },
  fallout: { hover: 'hover:text-gold', border: 'hover:border-gold/30', text: 'text-concrete-50', borderBase: 'border-concrete-700/60' },
}

export function ArticleNav({ prev, next, accentColor = 'cobalt' }: ArticleNavProps) {
  if (!prev && !next) return null

  const colors = colorMap[accentColor]

  return (
    <nav className="mx-auto max-w-3xl px-6 py-12" aria-label="Article navigation">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {prev ? (
          <a href={`/${prev.slug}`} className={`group flex flex-col rounded-xl border ${colors.borderBase} p-5 transition-all duration-300 ${colors.border}`}>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#a8a29e] mb-2">&larr; Previous</span>
            <span className={`font-[family-name:var(--font-display)] text-sm font-bold ${colors.text} transition-colors ${colors.hover} line-clamp-2`}>{prev.title}</span>
          </a>
        ) : <div />}
        {next ? (
          <a href={`/${next.slug}`} className={`group flex flex-col items-end text-right rounded-xl border ${colors.borderBase} p-5 transition-all duration-300 ${colors.border}`}>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#a8a29e] mb-2">Next &rarr;</span>
            <span className={`font-[family-name:var(--font-display)] text-sm font-bold ${colors.text} transition-colors ${colors.hover} line-clamp-2`}>{next.title}</span>
          </a>
        ) : <div />}
      </div>
    </nav>
  )
}
