'use client'

import { useCallback, useMemo } from 'react'
import { SliderScale } from './SliderScale'
import type { EmojiOption } from '@/lib/check-ins/shared'

interface EmojiScaleProps {
  label: string
  options: EmojiOption[]
  value: string
  onChange: (value: string) => void
  description?: string
}

export function EmojiScale({ label, options, value, onChange, description }: EmojiScaleProps) {
  // Map emoji option IDs to numeric scores (1-5)
  const idToScore = useMemo(() => {
    const map = new Map<string, number>()
    options.forEach((option) => {
      // Runtime validation: scores must be in range 1-5
      if (option.score < 1 || option.score > 5) {
        console.warn(`EmojiScale: Invalid score ${option.score} for option ${option.id}. Scores must be 1-5.`)
      }
      map.set(option.id, option.score)
    })
    return map
  }, [options])

  const scoreToId = useMemo(() => {
    const map = new Map<number, string>()
    options.forEach((option) => {
      map.set(option.score, option.id)
    })
    return map
  }, [options])

  const currentScore = (() => {
    const score = idToScore.get(value)
    if (score === undefined) {
      if (process.env.NODE_ENV === 'development') {
        // Surface unexpected IDs loudly during development
        console.warn(`EmojiScale: Unknown option ID \"${value}\", defaulting to middle score`)
      }
      return 3
    }
    return score
  })()

  const labels = useMemo(() => {
    return options.map((option) => option.label)
  }, [options])

  const handleSliderChange = useCallback(
    (score: number) => {
      const id = scoreToId.get(score)
      if (id) {
        onChange(id)
      }
    },
    [scoreToId, onChange]
  )

  return (
    <SliderScale
      label={label}
      value={currentScore}
      onChange={handleSliderChange}
      min={1}
      max={5}
      step={1}
      labels={labels}
      helpText={description}
    />
  )
}
