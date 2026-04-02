'use client'

import { useEffect, useState } from 'react'
import { motion, useMotionValue, useSpring } from 'framer-motion'

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

/** Check if the element (or an ancestor) is an interactive target. */
function getInteractiveKind(el: Element | null): 'pointer' | 'view' | null {
  let node = el
  while (node) {
    const attr = node.getAttribute?.('data-cursor')
    if (attr === 'view') return 'view'
    if (attr === 'pointer') return 'pointer'
    const tag = node.tagName?.toLowerCase()
    if (tag === 'a' || tag === 'button' || tag === 'input' || tag === 'select' || tag === 'textarea') {
      return 'pointer'
    }
    node = node.parentElement
  }
  return null
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

/**
 * Premium two-part custom cursor (outer ring + inner dot).
 *
 * - Outer ring: 32 px, border-only, concrete-300, mix-blend-mode: difference,
 *   follows cursor with a spring delay.
 * - Inner dot: 8 px, solid phosphor green, follows immediately.
 * - Scales up when hovering interactive elements.
 * - Shows "View" text on `[data-cursor="view"]` elements.
 * - Hidden on touch / coarse-pointer devices via CSS media query.
 */
export function CustomCursor() {
  /* raw mouse position ------------------------------------------------ */
  const mouseX = useMotionValue(-100)
  const mouseY = useMotionValue(-100)

  /* outer ring springs (lagging) -------------------------------------- */
  const ringX = useSpring(mouseX, { stiffness: 150, damping: 20, mass: 0.5 })
  const ringY = useSpring(mouseY, { stiffness: 150, damping: 20, mass: 0.5 })

  /* hover state ------------------------------------------------------- */
  const [hoverKind, setHoverKind] = useState<'pointer' | 'view' | null>(null)

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouseX.set(e.clientX)
      mouseY.set(e.clientY)

      const kind = getInteractiveKind(document.elementFromPoint(e.clientX, e.clientY))
      setHoverKind(kind)
    }

    window.addEventListener('mousemove', onMove, { passive: true })
    return () => window.removeEventListener('mousemove', onMove)
  }, [mouseX, mouseY])

  /* scale variants ---------------------------------------------------- */
  const isActive = hoverKind !== null
  const ringSize = hoverKind === 'view' ? 80 : isActive ? 48 : 32
  const dotSize = isActive ? 0 : 8

  return (
    <>
      {/* Inject hide-on-touch CSS */}
      <style>{`
        @media (pointer: coarse) {
          .custom-cursor-ring,
          .custom-cursor-dot { display: none !important; }
        }
        /* Hide default cursor site-wide on fine-pointer devices */
        @media (pointer: fine) {
          *, *::before, *::after { cursor: none !important; }
        }
      `}</style>

      {/* Outer ring */}
      <motion.div
        className="custom-cursor-ring"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          x: ringX,
          y: ringY,
          translateX: '-50%',
          translateY: '-50%',
          width: ringSize,
          height: ringSize,
          borderRadius: '50%',
          border: '1.5px solid var(--color-concrete-300, #b0b0b0)',
          pointerEvents: 'none' as const,
          zIndex: 99999,
          mixBlendMode: 'difference' as const,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'width 0.3s ease, height 0.3s ease',
        }}
      >
        {hoverKind === 'view' && (
          <span
            style={{
              fontFamily: 'monospace',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase' as const,
              color: 'var(--color-concrete-300, #b0b0b0)',
              userSelect: 'none' as const,
            }}
          >
            View
          </span>
        )}
      </motion.div>

      {/* Inner dot */}
      <motion.div
        className="custom-cursor-dot"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          x: mouseX,
          y: mouseY,
          translateX: '-50%',
          translateY: '-50%',
          width: dotSize,
          height: dotSize,
          borderRadius: '50%',
          backgroundColor: 'var(--color-phosphor, #33ff33)',
          pointerEvents: 'none' as const,
          zIndex: 99999,
          transition: 'width 0.25s ease, height 0.25s ease',
        }}
      />
    </>
  )
}
