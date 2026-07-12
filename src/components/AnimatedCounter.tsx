import { animate } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'

/** Counts up to `value` with a spring-ish ease — used for the days-together number. */
export function AnimatedCounter({ value, className }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(0)
  const from = useRef(0) // count up from 0 on mount, then from the previous value
  useEffect(() => {
    const controls = animate(from.current, value, {
      duration: 1,
      ease: 'easeOut',
      onUpdate: (v) => setDisplay(Math.round(v)),
    })
    from.current = value
    return () => controls.stop()
  }, [value])
  return <span className={className}>{display.toLocaleString()}</span>
}
