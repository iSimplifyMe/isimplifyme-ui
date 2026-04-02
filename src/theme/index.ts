export { colors } from './colors'
export type { ColorToken } from './colors'

// Animations — individual exports
export {
  // Transition presets
  springSmooth,
  springSnappy,
  easeOutExpo,
  easeInOutCubic,
  easeOutQuint,
  transitions,

  // Page entrances
  fadeUp,
  fadeIn,
  slideInLeft,
  slideInRight,
  scaleIn,
  entrances,

  // Stagger systems
  staggerChildren,
  staggerFast,
  staggerSlow,
  staggers,

  // Scroll-triggered reveals
  revealFromBottom,
  revealMask,
  parallaxUp,
  parallaxDown,
  reveals,

  // Micro-interactions
  magneticHover,
  cardHover,
  buttonHover,
  linkHover,
  interactions,

  // Brand (Atomic Horror)
  flicker,
  glitch,
  radiationPulse,
  scanline,
  typewriter,
  brand,

  // Legacy aliases
  stagger,
  bentoCard,
  radiationHum,
} from './animations'
