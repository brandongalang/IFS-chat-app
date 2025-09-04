'use client'

import { useEffect, useMemo, useRef } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

export function StreamingText({ text }: { text: string }) {
  const prefersReducedMotion = useReducedMotion()
  const prevLen = useRef(0)
  const chars = useMemo(() => Array.from(text || ''), [text])

  useEffect(() => {
    // after render, update reference so next update only animates new chars
    prevLen.current = Math.max(prevLen.current, chars.length)
  }, [chars.length])

  if (prefersReducedMotion) {
    return <span>{text}</span>
  }

  return (
    <span aria-live="polite">
      {chars.map((ch, i) => (
        <motion.span
          key={i}
          initial={{ opacity: i >= prevLen.current ? 0 : 1 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.38, ease: 'easeOut' }}
        >
          {ch}
        </motion.span>
      ))}
    </span>
  )
}
