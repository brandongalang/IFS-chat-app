'use client'

import { useCallback } from 'react'

type StreamUpdate = (content: string, streaming: boolean) => void

interface StreamBufferOptions {
  onUpdate: StreamUpdate
  initialContent?: string
}

interface StreamBufferControls {
  appendTokens: (chunk: string) => void
  finalize: () => Promise<string>
  getContent: () => string
}

const DEFAULT_STEP_MS = 150
const DEFAULT_STEP_CHARS = 8

const resolveStreamConfig = () => {
  if (typeof window === 'undefined') {
    return { stepMs: DEFAULT_STEP_MS, stepChars: DEFAULT_STEP_CHARS }
  }

  const styles = getComputedStyle(document.documentElement)
  const rawMs = Number(styles.getPropertyValue('--eth-stream-tick').trim())
  const rawChars = Number(styles.getPropertyValue('--eth-stream-chars').trim())

  return {
    stepMs: Number.isFinite(rawMs) && rawMs > 0 ? rawMs : DEFAULT_STEP_MS,
    stepChars: Number.isFinite(rawChars) && rawChars > 0 ? rawChars : DEFAULT_STEP_CHARS,
  }
}

export function useStreamBuffer() {
  return useCallback(
    ({ onUpdate, initialContent = '' }: StreamBufferOptions): StreamBufferControls => {
      const { stepMs, stepChars } = resolveStreamConfig()

      let buffer = ''
      let accumulated = initialContent
      let flushInterval: ReturnType<typeof setInterval> | null = null
      let finalizeRequested = false
      let finalizePromise: Promise<string> | null = null
      let finalizeResolve: ((value: string) => void) | null = null
      let hasCompleted = false

      const stopFlusher = () => {
        if (flushInterval) {
          clearInterval(flushInterval)
          flushInterval = null
        }
      }

      const flushRemaining = () => {
        if (buffer.length > 0) {
          accumulated += buffer
          buffer = ''
        }
      }

      const complete = () => {
        if (hasCompleted) {
          finalizeResolve?.(accumulated)
          return
        }

        hasCompleted = true
        stopFlusher()
        flushRemaining()
        onUpdate(accumulated, false)
        finalizeResolve?.(accumulated)
        finalizeResolve = null
        finalizePromise = null
        finalizeRequested = false
      }

      const flushOnce = () => {
        if (buffer.length > 0) {
          const take = Math.min(stepChars, buffer.length)
          const part = buffer.slice(0, take)
          buffer = buffer.slice(take)
          accumulated += part
          onUpdate(accumulated, true)
        }

        if (buffer.length === 0) {
          stopFlusher()
          if (finalizeRequested) {
            complete()
          }
        }
      }

      const startFlusher = () => {
        if (!flushInterval) {
          flushInterval = setInterval(flushOnce, stepMs)
        }
      }

      const appendTokens = (chunk: string) => {
        if (!chunk || hasCompleted) return
        buffer += chunk
        startFlusher()
      }

      const finalize = () => {
        if (hasCompleted) {
          return Promise.resolve(accumulated)
        }

        if (!finalizePromise) {
          finalizeRequested = true
          finalizePromise = new Promise<string>((resolve) => {
            finalizeResolve = resolve
            if (!flushInterval) {
              complete()
            }
          })
        }

        return finalizePromise
      }

      const getContent = () => accumulated + buffer

      return { appendTokens, finalize, getContent }
    },
    [],
  )
}

