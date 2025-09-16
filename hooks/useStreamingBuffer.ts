"use client"

import { useEffect, useMemo, useRef } from "react"

interface StreamingChar {
  char: string
  isNew: boolean
}

export interface StreamingToken {
  value: string
  isWhitespace: boolean
  isNewWord: boolean
  chars: StreamingChar[]
}

/**
 * Tracks the streaming state of a chat message. Given the full text content,
 * the hook returns tokens annotated with whether each word/character is new
 * compared to the previous render. This allows presentation components to
 * animate only the incremental pieces of the response.
 */
export function useStreamingBuffer(text: string) {
  const prevCharLen = useRef(0)
  const prevWordCount = useRef(0)

  const tokens = useMemo<StreamingToken[]>(() => {
    const rawTokens = (text ?? "").split(/(\s+)/)

    let wordIndex = 0
    let charSeen = 0

    return rawTokens.map((value) => {
      const isWhitespace = /^\s+$/.test(value)

      if (isWhitespace) {
        charSeen += value.length
        return {
          value,
          isWhitespace,
          isNewWord: false,
          chars: Array.from(value).map((char) => ({ char, isNew: false })),
        }
      }

      const isNewWord = wordIndex >= prevWordCount.current
      const startCharIndex = charSeen
      const chars = Array.from(value).map((char, charIndex) => {
        const globalIndex = startCharIndex + charIndex
        return {
          char,
          isNew: globalIndex >= prevCharLen.current,
        }
      })

      wordIndex += 1
      charSeen += value.length

      return {
        value,
        isWhitespace,
        isNewWord,
        chars,
      }
    })
  }, [text])

  const wordsOnlyCount = useMemo(
    () => tokens.filter((token) => !token.isWhitespace).length,
    [tokens]
  )

  useEffect(() => {
    const nextLength = (text ?? "").length
    prevCharLen.current = Math.max(prevCharLen.current, nextLength)
    prevWordCount.current = Math.max(prevWordCount.current, wordsOnlyCount)
  }, [text, wordsOnlyCount])

  return tokens
}

