'use client'

import { useEffect, useState } from 'react'

export function ReadingProgress({ color = '#4a77ff' }: { color?: string }) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    function onScroll() {
      const article = document.querySelector('[data-article-body]')
      if (!article) return
      const rect = article.getBoundingClientRect()
      const total = article.scrollHeight
      const visible = window.innerHeight
      const scrolled = -rect.top
      const pct = Math.min(100, Math.max(0, (scrolled / (total - visible)) * 100))
      setProgress(pct)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] h-[2px]" style={{ background: 'transparent' }}>
      <div
        className="h-full transition-[width] duration-100 ease-out"
        style={{ width: `${progress}%`, background: color }}
      />
    </div>
  )
}
