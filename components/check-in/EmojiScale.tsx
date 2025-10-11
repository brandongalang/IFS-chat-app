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

  const currentScore = idToScore.get(value) ?? 3

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
