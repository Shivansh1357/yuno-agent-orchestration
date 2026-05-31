// Shared Framer Motion variants + helpers.
// All motion is transform/opacity only (60fps friendly) and respects
// prefers-reduced-motion via Framer's <MotionConfig reducedMotion="user">.

import type { Transition, Variants } from 'framer-motion'

export const EASE: Transition['ease'] = [0.22, 1, 0.36, 1]

// Page / route transition wrapper.
export const pageVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  enter: { opacity: 1, y: 0, transition: { duration: 0.22, ease: EASE } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.16, ease: EASE } },
}

// Container that staggers its direct children in.
export const staggerContainer = (stagger = 0.03, max = 12): Variants => ({
  initial: {},
  enter: {
    transition: {
      // Cap effective stagger so very long lists don't lag.
      staggerChildren: stagger,
      delayChildren: 0,
      staggerDirection: 1,
    },
  },
  // `max` reserved for callers that want to clamp item count externally.
  exit: { transition: { staggerChildren: 0, staggerDirection: -1 } },
  ...(max ? {} : {}),
})

// Item entrance (cards, runs, feed rows).
export const listItem: Variants = {
  initial: { opacity: 0, y: 10 },
  enter: { opacity: 1, y: 0, transition: { duration: 0.24, ease: EASE } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.14, ease: EASE } },
}

// Live-feed item streaming in at the top.
export const feedItem: Variants = {
  initial: { opacity: 0, x: -8 },
  enter: { opacity: 1, x: 0, transition: { duration: 0.22, ease: EASE } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
}

// Chat bubble entrance.
export const bubbleItem: Variants = {
  initial: { opacity: 0, y: 8, scale: 0.98 },
  enter: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.2, ease: EASE } },
}

// Modal / drawer.
export const overlayVariants: Variants = {
  initial: { opacity: 0 },
  enter: { opacity: 1, transition: { duration: 0.16 } },
  exit: { opacity: 0, transition: { duration: 0.12 } },
}

export const modalVariants: Variants = {
  initial: { opacity: 0, y: 12, scale: 0.97 },
  enter: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.2, ease: EASE } },
  exit: { opacity: 0, y: 8, scale: 0.98, transition: { duration: 0.14, ease: EASE } },
}

// Micro-interactions.
export const hoverLift = { y: -3, transition: { duration: 0.16, ease: EASE } }
export const tapScale = { scale: 0.97 }
