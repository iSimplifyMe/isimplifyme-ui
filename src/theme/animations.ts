import type { Variants, Transition } from 'framer-motion'

// ---------------------------------------------------------------------------
// Transition presets
// ---------------------------------------------------------------------------

/** Smooth spring — feels organic, no overshoot */
export const springSmooth: Transition = {
  type: 'spring',
  damping: 25,
  stiffness: 120,
}

/** Snappy spring — punchy, slight overshoot */
export const springSnappy: Transition = {
  type: 'spring',
  damping: 15,
  stiffness: 300,
}

/** Exponential ease-out — fast start, long deceleration (Lusion-style) */
export const easeOutExpo: [number, number, number, number] = [0.16, 1, 0.3, 1]

/** Smooth cubic in-out — elegant, balanced */
export const easeInOutCubic: [number, number, number, number] = [0.65, 0, 0.35, 1]

/** Quint ease-out — silky deceleration for reveals */
export const easeOutQuint: [number, number, number, number] = [0.22, 1, 0.36, 1]

export const transitions = {
  springSmooth,
  springSnappy,
  easeOutExpo,
  easeInOutCubic,
  easeOutQuint,
}

// ---------------------------------------------------------------------------
// 1. Page entrance animations
// ---------------------------------------------------------------------------

/** Fade in + translate Y with spring easing — the workhorse entrance */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { ...springSmooth, mass: 0.8 },
  },
}

/** Pure opacity fade — minimal, elegant */
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.8, ease: easeOutExpo },
  },
}

/** Horizontal reveal from the left */
export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -60 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.7, ease: easeOutExpo },
  },
}

/** Horizontal reveal from the right */
export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 60 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.7, ease: easeOutExpo },
  },
}

/** Scale from 0.9 to 1 with opacity — cards, modals, popovers */
export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, ease: easeOutQuint },
  },
}

export const entrances = {
  fadeUp,
  fadeIn,
  slideInLeft,
  slideInRight,
  scaleIn,
}

// ---------------------------------------------------------------------------
// 2. Stagger systems
// ---------------------------------------------------------------------------

/** Standard stagger — 0.1s between children (lists, nav items) */
export const staggerChildren: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.05,
    },
  },
}

/** Fast stagger — 0.05s (grids, icon sets, badges) */
export const staggerFast: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.02,
    },
  },
}

/** Slow stagger — 0.15s (hero elements, feature blocks) */
export const staggerSlow: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.1,
    },
  },
}

export const staggers = {
  staggerChildren,
  staggerFast,
  staggerSlow,
}

// ---------------------------------------------------------------------------
// 3. Scroll-triggered variants
// ---------------------------------------------------------------------------

/** Section reveal from bottom — for viewport-enter triggers */
export const revealFromBottom: Variants = {
  hidden: {
    opacity: 0,
    y: 80,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.9,
      ease: easeOutExpo,
    },
  },
}

/** Clip-path mask reveal — wipe-up effect (clay.global style) */
export const revealMask: Variants = {
  hidden: {
    clipPath: 'inset(100% 0% 0% 0%)',
    opacity: 0,
  },
  visible: {
    clipPath: 'inset(0% 0% 0% 0%)',
    opacity: 1,
    transition: {
      duration: 1,
      ease: easeOutExpo,
      opacity: { duration: 0.4 },
    },
  },
}

/** Parallax offset upward — use with useScroll + useTransform */
export const parallaxUp: Variants = {
  hidden: { y: 60 },
  visible: {
    y: -60,
    transition: { duration: 1.2, ease: 'linear' },
  },
}

/** Parallax offset downward */
export const parallaxDown: Variants = {
  hidden: { y: -40 },
  visible: {
    y: 40,
    transition: { duration: 1.2, ease: 'linear' },
  },
}

export const reveals = {
  fadeUp,
  fadeIn,
  slideInLeft,
  slideInRight,
  scaleIn,
  revealFromBottom,
  revealMask,
  parallaxUp,
  parallaxDown,
}

// ---------------------------------------------------------------------------
// 4. Micro-interactions
// ---------------------------------------------------------------------------

/** Magnetic hover — subtle pull toward cursor direction */
export const magneticHover: Variants = {
  rest: { x: 0, y: 0 },
  hover: {
    // Actual magnetic offset is driven by cursor position in the component;
    // this variant provides the spring return behavior.
    transition: { type: 'spring', damping: 20, stiffness: 300, mass: 0.5 },
  },
}

/** Card hover — scale up, elevate shadow, warm border glow */
export const cardHover: Variants = {
  rest: {
    scale: 1,
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
    borderColor: 'rgba(255,255,255,0)',
    transition: { duration: 0.3, ease: easeOutExpo },
  },
  hover: {
    scale: 1.02,
    boxShadow: '0 16px 48px rgba(0,0,0,0.18)',
    borderColor: 'rgba(57,255,20,0.15)',
    transition: { duration: 0.3, ease: easeOutExpo },
  },
}

/** Button hover — scale + glow ring */
export const buttonHover: Variants = {
  rest: {
    scale: 1,
    boxShadow: '0 0 0 0px rgba(57,255,20,0)',
    transition: { duration: 0.2, ease: easeOutExpo },
  },
  hover: {
    scale: 1.04,
    boxShadow: '0 0 20px 4px rgba(57,255,20,0.25)',
    transition: { duration: 0.2, ease: easeOutExpo },
  },
  tap: {
    scale: 0.97,
    transition: { duration: 0.1 },
  },
}

/** Link hover — underline expand from center */
export const linkHover: Variants = {
  rest: {
    scaleX: 0,
    originX: 0.5,
    transition: { duration: 0.25, ease: easeOutExpo },
  },
  hover: {
    scaleX: 1,
    originX: 0.5,
    transition: { duration: 0.35, ease: easeOutExpo },
  },
}

export const interactions = {
  magneticHover,
  cardHover,
  buttonHover,
  linkHover,
}

// ---------------------------------------------------------------------------
// 5. Brand animations (Atomic Horror)
// ---------------------------------------------------------------------------

/** CRT flicker — realistic irregular timing with brightness dips */
export const flicker: Variants = {
  idle: {
    opacity: [1, 0.94, 1, 0.97, 1, 0.99, 1, 0.96, 1],
    transition: {
      duration: 0.4,
      repeat: Infinity,
      repeatDelay: 4,
      times: [0, 0.1, 0.15, 0.35, 0.4, 0.6, 0.7, 0.85, 1],
    },
  },
}

/** Glitch — horizontal displacement + skew for color-split feel */
export const glitch: Variants = {
  idle: {
    x: [0, -3, 5, -2, 4, -1, 0],
    skewX: [0, -1, 2, -0.5, 1, 0, 0],
    filter: [
      'hue-rotate(0deg)',
      'hue-rotate(-10deg)',
      'hue-rotate(5deg)',
      'hue-rotate(-3deg)',
      'hue-rotate(8deg)',
      'hue-rotate(-2deg)',
      'hue-rotate(0deg)',
    ],
    transition: {
      duration: 0.35,
      repeat: Infinity,
      repeatDelay: 6,
      times: [0, 0.1, 0.25, 0.4, 0.6, 0.85, 1],
    },
  },
}

/** Radiation pulse — breathing scale with faint glow bloom */
export const radiationPulse: Variants = {
  idle: {
    scale: [1, 1.008, 1, 1.004, 1],
    filter: [
      'drop-shadow(0 0 0px rgba(57,255,20,0))',
      'drop-shadow(0 0 6px rgba(57,255,20,0.3))',
      'drop-shadow(0 0 2px rgba(57,255,20,0.1))',
      'drop-shadow(0 0 8px rgba(57,255,20,0.25))',
      'drop-shadow(0 0 0px rgba(57,255,20,0))',
    ],
    transition: {
      duration: 3,
      repeat: Infinity,
      ease: 'easeInOut',
      times: [0, 0.3, 0.5, 0.75, 1],
    },
  },
}

/** Scanline — moving horizontal line overlay */
export const scanline: Variants = {
  idle: {
    backgroundPosition: ['0% 0%', '0% 100%'],
    transition: {
      duration: 8,
      repeat: Infinity,
      ease: 'linear',
    },
  },
}

/** Typewriter — text reveal via clip-path widening */
export const typewriter: Variants = {
  hidden: {
    clipPath: 'inset(0 100% 0 0)',
  },
  visible: {
    clipPath: 'inset(0 0% 0 0)',
    transition: {
      duration: 1.5,
      ease: 'linear',
    },
  },
}

export const brand = {
  flicker,
  glitch,
  radiationPulse,
  scanline,
  typewriter,
}

// ---------------------------------------------------------------------------
// Legacy aliases (backward compatibility)
// ---------------------------------------------------------------------------

/** @deprecated Use `staggerChildren` instead */
export const stagger = staggerChildren

/** @deprecated Use `scaleIn` instead */
export const bentoCard = scaleIn

/** @deprecated Use `radiationPulse` instead */
export const radiationHum = radiationPulse
