'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'

import { animationDefaults } from '@/config/animation'
import { useStreamingBuffer } from '@/hooks/useStreamingBuffer'

// Streams text with gentle, per-word glow, color shift, upward motion, and per-char fade for newly arrived content
export function StreamingText({ text, onAnimationComplete }: { text: string, onAnimationComplete?: () => void }) {
  const tokens = useStreamingBuffer(text)

  const defaultWordDurationMs = animationDefaults.wordDurationMs
  const defaultCharDurationMs = animationDefaults.charDurationMs

  const { wordMs, charMs } = useMemo(() => {
    if (typeof window === 'undefined') {
      return { wordMs: defaultWordDurationMs, charMs: defaultCharDurationMs }
    }

    const styles = getComputedStyle(document.documentElement)
    const wordVar = Number(styles.getPropertyValue('--eth-word-duration').trim() || 0)
    const charVar = Number(styles.getPropertyValue('--eth-char-duration').trim() || 0)

    return {
      wordMs: wordVar || defaultWordDurationMs,
      charMs: charVar || defaultCharDurationMs,
    }
  }, [defaultWordDurationMs, defaultCharDurationMs])

  return (
    <span aria-live="polite">
      {tokens.map((token, tokenIndex) => {
        if (token.isWhitespace) {
          return <span key={`s-${tokenIndex}`}>{token.value}</span>
        }

        return (
          <motion.span
            key={`w-${tokenIndex}`}
            initial={token.isNewWord ? { opacity: 0, y: 8, color: 'rgba(128, 200, 200, 0.95)' } : {}}
            animate={{ opacity: 1, y: 0, color: 'rgba(255,255,255,1)' }}
            transition={{ duration: wordMs / 1000, ease: [0.25, 0.1, 0, 1] }}
            className="inline-block"
            onAnimationComplete={onAnimationComplete}
          >
            {token.chars.map((char, charIndex) => (
              <motion.span
                key={charIndex}
                initial={char.isNew ? { opacity: 0 } : {}}
                animate={{ opacity: 1 }}
                transition={{ duration: charMs / 1000, ease: [0.25, 0.1, 0, 1] }}
              >
                {char.char}
              </motion.span>
            ))}
          </motion.span>
        )
      })}
    </span>
  )
}
