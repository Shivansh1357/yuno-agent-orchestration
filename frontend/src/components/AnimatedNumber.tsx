import { useEffect, useRef } from 'react'
import { animate, useReducedMotion } from 'framer-motion'

// Animates a numeric value with a count-up, formatting each frame.
// Falls back to an instant set when the user prefers reduced motion.
export function AnimatedNumber({
  value,
  format,
  className,
}: {
  value: number
  format: (v: number) => string
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const prev = useRef(value)
  const reduce = useReducedMotion()

  useEffect(() => {
    const node = ref.current
    if (!node) return
    const from = prev.current
    prev.current = value

    if (reduce || from === value) {
      node.textContent = format(value)
      return
    }
    const controls = animate(from, value, {
      duration: 0.5,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => {
        node.textContent = format(latest)
      },
    })
    return () => controls.stop()
  }, [value, format, reduce])

  return (
    <span ref={ref} className={className}>
      {format(value)}
    </span>
  )
}
