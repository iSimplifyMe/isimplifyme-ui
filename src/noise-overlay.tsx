'use client'

/**
 * Full-screen fixed noise/grain overlay.
 *
 * Uses a tiny base64-encoded noise PNG tiled across the viewport.
 * Sits above all content (z-index 9999) but ignores pointer events.
 * Mix-blend-mode: overlay gives a subtle film-grain look on any background.
 */

/* 4x4 noise PNG, base64-encoded (~180 bytes) */
const NOISE_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAYAAAAeP4ixAAABhGlDQ1BJQ0MgcHJvZmlsZQAAeJx9kT1Iw0AYht+mSotUHOwg4pChOlkQFXHUKhShQqgVWnUwufQPmjQkKS6OgmvBwZ/FqoOLs65uXIVB8AfE6cirRIl/iwktYjx47Li/e7Je9+7ALcaZZjVMw5oum2mE3FpJbsqBV4RQB9CGEFCZpYxJ0kp+I6ve/SoXq85i/u6/qyeNWAgEg8ywzTJt4gnt60Nc57xGErSirE58RjJl2Q+JHrisdvnAuuOzzmyYik54lDxEKhi5UuZrVDK5IniaOKqpu8IM1j1XOLZ72UdY8ZPCMJC0jhHEOEbGRQhgVtKjR0aJNo31MiT/q8afIpZCrDEaOAahQIblx/+D352ahckJNykYA7pfHOdjFAjsAvW6b38f23bzBAp8AlevG950JAHpp1007/ZyF7wOgYcPW5q3Jj+aR7Dr4aCFu+nNE04PiImV8oaAXr2fk8HoB+J0a0V9qcpP7MILfWsi/qcBgt0v0aq1h7xc4AUfqKoD+94AoXY/b58yjsT7wIDAoGe7vB3a+/s5Af7kZvkJv0dAMF1SZi8BAAA=' // opaque noise tile

export function NoiseOverlay() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        pointerEvents: 'none',
        mixBlendMode: 'overlay',
        opacity: 0.04,
        backgroundImage: `url("${NOISE_PNG}")`,
        backgroundRepeat: 'repeat',
        backgroundSize: '50px 50px',
      }}
    />
  )
}
