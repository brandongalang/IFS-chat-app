'use client'

import { useEffect, useMemo, useRef } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

// Streams text with gentle, per-word glow and per-char fade for newly arrived content
export function StreamingText({ text }: { text: string }) {
  const prefersReducedMotion = useReducedMotion()
  const prevCharLen = useRef(0)
  const prevWordCount = useRef(0)

  const tokens = useMemo(() => (text ?? '').split(/(\s+)/), [text])
  const wordsOnly = useMemo(() => tokens.filter(t => !/^\s+$/.test(t)), [tokens])

  useEffect(() => {
    prevCharLen.current = Math.max(prevCharLen.current, (text ?? '').length)
    prevWordCount.current = Math.max(prevWordCount.current, wordsOnly.length)
  }, [text, wordsOnly.length])

  if (prefersReducedMotion) {
    return <span>{text}</span>
  }

  let wordIndex = 0
  let charSeen = 0

  return (
    <span aria-live="polite">
      {tokens.map((tok, i) => {
        if (/^\s+$/.test(tok)) {
          charSeen += tok.length
          return <span key={`s-${i}`}>{tok}</span>
        }
        const isNewWord = wordIndex >= prevWordCount.current
        const startCharIndex = charSeen
        const chars = Array.from(tok)
        wordIndex += 1
        charSeen += tok.length
        return (
          <motion.span
            key={`w-${i}`}
            initial={isNewWord ? { opacity: 0.5, filter: 'blur(2px)' } : {}}
            animate={{ opacity: 1, filter: 'blur(0px)' }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="inline-block"
          >
            {chars.map((ch, ci) => {
              const globalIndex = startCharIndex + ci
              const isNewChar = globalIndex >= prevCharLen.current
              return (
                <motion.span
                  key={ci}
                  initial={isNewChar ? { opacity: 0 } : {}}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                >
                  {ch}
                </motion.span>
              )
            })}
          </motion.span>
        )
      })}
    </span>
  )
}
