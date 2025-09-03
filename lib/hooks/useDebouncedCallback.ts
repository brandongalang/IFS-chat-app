"use client"

import { useCallback, useRef } from 'react'

export function useDebouncedCallback<T extends (...args: any[]) => void>(fn: T, delay = 500) {
  const timer = useRef<number | null>(null)

  return useCallback((...args: Parameters<T>) => {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      fn(...args)
    }, delay)
  }, [fn, delay]) as T
}
