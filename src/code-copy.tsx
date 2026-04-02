'use client'

import { useEffect } from 'react'

/**
 * Scans [data-article-body] for <li> elements containing <strong> tags
 * that look like game codes (alphanumeric, 3+ chars, no spaces).
 * Injects a small clipboard-copy button next to each matching <strong>.
 */
export function CodeCopyButtons() {
  useEffect(() => {
    const body = document.querySelector('[data-article-body]')
    if (!body) return

    const items = body.querySelectorAll('li')

    items.forEach((li) => {
      const strong = li.querySelector('strong')
      if (!strong) return

      const text = strong.textContent?.trim() ?? ''
      // Must be alphanumeric (allowing underscores/hyphens), 3+ chars, no spaces
      if (!/^[A-Za-z0-9_-]{3,}$/.test(text)) return

      // Don't double-inject
      if (li.querySelector('.code-copy-btn')) return

      // Add group + relative classes to the <li>
      li.classList.add('group', 'relative')

      // Create copy button
      const btn = document.createElement('button')
      btn.className =
        'code-copy-btn opacity-0 group-hover:opacity-100 transition-opacity duration-150 inline-flex items-center justify-center ml-1.5 align-middle cursor-pointer rounded hover:bg-black/5'
      btn.type = 'button'
      btn.setAttribute('aria-label', `Copy code: ${text}`)
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>`

      btn.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        navigator.clipboard.writeText(text).then(() => {
          // Show tooltip
          const tooltip = document.createElement('span')
          tooltip.className = 'code-copy-tooltip'
          tooltip.textContent = 'Copied!'
          btn.style.position = 'relative'
          btn.appendChild(tooltip)

          // Remove after animation
          setTimeout(() => {
            tooltip.remove()
          }, 1500)
        })
      })

      // Insert button right after the <strong>
      strong.insertAdjacentElement('afterend', btn)
    })
  }, [])

  return null
}
