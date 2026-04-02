'use client'

import { useEffect } from 'react'

const ANIMATED_SELECTORS = 'h2, h3, p, ul, ol, blockquote, img, table, figure'

export function ArticleAnimations() {
  useEffect(() => {
    const container = document.querySelector('[data-article-body]')
    if (!container) return

    const children = container.querySelectorAll(`:scope > ${ANIMATED_SELECTORS}`)

    // Apply hidden class to all elements
    children.forEach((el) => {
      el.classList.add('prose-reveal-hidden')
    })

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.remove('prose-reveal-hidden')
            entry.target.classList.add('prose-reveal-visible')
            observer.unobserve(entry.target)
          }
        })
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -40px 0px',
      },
    )

    children.forEach((el, i) => {
      ;(el as HTMLElement).style.transitionDelay = `${i * 0.04}s`
      observer.observe(el)
    })

    return () => {
      observer.disconnect()
    }
  }, [])

  return null
}
