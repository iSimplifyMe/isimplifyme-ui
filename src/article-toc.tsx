'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

interface TocItem {
  id: string
  text: string
  level: number
}

function extractHeadings(html: string): TocItem[] {
  const regex = /<h([23])[^>]*(?:id="([^"]*)")?[^>]*>(.*?)<\/h[23]>/gi
  const items: TocItem[] = []
  let match: RegExpExecArray | null

  while ((match = regex.exec(html)) !== null) {
    const level = parseInt(match[1])
    const existingId = match[2]
    const text = match[3].replace(/<[^>]*>/g, '').trim()
    const id = existingId || text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    if (text) items.push({ id, text, level })
  }

  return items
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function ArticleToc({
  html,
  accentColor = 'cobalt',
}: {
  html: string
  accentColor?: 'cobalt' | 'hazard' | 'fallout'
}) {
  const headings = extractHeadings(html)
  const [activeId, setActiveId] = useState<string>('')

  useEffect(() => {
    // Inject IDs into headings in the DOM
    const article = document.querySelector('[data-article-body]')
    if (!article) return

    const h2h3 = article.querySelectorAll('h2, h3')
    h2h3.forEach((el) => {
      if (!el.id) {
        el.id = slugify(el.textContent || '')
      }
    })

    // Intersection observer for active heading
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id)
          }
        }
      },
      { rootMargin: '-80px 0px -70% 0px', threshold: 0 },
    )

    h2h3.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [html])

  if (headings.length < 2) return null

  const accentMap = {
    cobalt: {
      active: 'text-cobalt-400',
      border: 'border-cobalt-400',
      hover: 'hover:text-cobalt-400',
    },
    hazard: {
      active: 'text-hazard-400',
      border: 'border-hazard-400',
      hover: 'hover:text-hazard-400',
    },
    fallout: {
      active: 'text-fallout-400',
      border: 'border-fallout-400',
      hover: 'hover:text-fallout-400',
    },
  }

  const accent = accentMap[accentColor]

  return (
    <nav
      className="hidden xl:block sticky top-28 max-h-[calc(100vh-8rem)] overflow-y-auto"
      aria-label="Table of contents"
    >
      <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.25em] text-concrete-400">
        In this article
      </p>
      <ul className="space-y-0.5 border-l border-concrete-700">
        {headings.map((h) => (
          <li key={h.id}>
            <a
              href={`#${h.id}`}
              onClick={(e) => {
                e.preventDefault()
                document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
              className={`block border-l-2 py-1.5 text-sm leading-snug transition-all duration-200 ${
                h.level === 3 ? 'pl-6' : 'pl-4'
              } ${
                activeId === h.id
                  ? `${accent.active} ${accent.border} font-medium`
                  : `text-concrete-400 border-transparent ${accent.hover}`
              }`}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export function ReadingTime({ html }: { html: string }) {
  const text = html.replace(/<[^>]*>/g, '')
  const words = text.trim().split(/\s+/).length
  const minutes = Math.max(1, Math.ceil(words / 238))
  return <>{minutes} min read</>
}
