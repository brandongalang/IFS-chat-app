'use client'

import { useCallback, useMemo } from 'react'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'

interface SliderScaleProps {
  id?: string
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  labels?: string[]
  leftLabel?: string
  rightLabel?: string
  useGradient?: boolean
  helpText?: string
  disabled?: boolean
  className?: string
}

const DEFAULT_LABELS = ['Very low', 'Low', 'OK', 'High', 'Very high']

// Helper to abbreviate labels for mobile display
function abbreviateLabel(label: string): string {
  // Extract first 1-2 meaningful words, up to ~14 chars
  const words = label.split(/\s+/).filter(Boolean)
  if (words.length === 0) return label
  
  // If first word is short enough, try including second word
  if (words[0].length <= 8 && words.length > 1) {
    const twoWords = `${words[0]} ${words[1]}`
    if (twoWords.length <= 14) {
      return twoWords
    }
  }
  
  // Otherwise return first word, truncated if needed
  return words[0].length <= 14 ? words[0] : words[0].slice(0, 14)
}

export function SliderScale({
  id,
  label,
  value,
  onChange,
  min = 1,
  max = 5,
  step = 1,
  labels = DEFAULT_LABELS,
  leftLabel,
  rightLabel,
  useGradient = true,
  helpText,
  disabled = false,
  className,
}: SliderScaleProps) {
  const handleValueChange = useCallback(
    (values: number[]) => {
      if (values.length > 0) {
        onChange(values[0])
      }
    },
    [onChange]
  )

  const selectedLabel = useMemo(
    () => labels[value - min] || labels[Math.floor(labels.length / 2)],
    [labels, value, min]
  )

  // Generate abbreviated labels for mobile
  const leftMobile = leftLabel ? abbreviateLabel(leftLabel) : undefined
  const rightMobile = rightLabel ? abbreviateLabel(rightLabel) : undefined

  // Generate unique ID for endpoint labels container for aria-describedby
  const endpointsId = id ? `${id}-endpoints` : undefined

  return (
    <div className={cn('grid gap-3', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
      </div>
      {helpText ? <p className="text-xs text-muted-foreground">{helpText}</p> : null}
      <div className="relative px-1 pt-6 pb-3 md:pb-3">
        {/* Endpoint labels */}
        {(leftLabel || rightLabel) && (
          <div
            id={endpointsId}
            className="absolute left-0 right-0 top-0 flex justify-between px-1 pointer-events-none select-none"
            aria-hidden="true"
          >
            {leftLabel && (
              <span
                className="text-xs text-muted-foreground/70 max-w-[40%] whitespace-nowrap overflow-hidden text-ellipsis"
                aria-label={`Left endpoint: ${leftLabel}`}
              >
                <span className="md:hidden">{leftMobile}</span>
                <span className="hidden md:inline">{leftLabel}</span>
              </span>
            )}
            {rightLabel && (
              <span
                className="text-xs text-muted-foreground/70 max-w-[40%] whitespace-nowrap overflow-hidden text-ellipsis text-right"
                aria-label={`Right endpoint: ${rightLabel}`}
              >
                <span className="md:hidden">{rightMobile}</span>
                <span className="hidden md:inline">{rightLabel}</span>
              </span>
            )}
          </div>
        )}
        <Slider
          id={id}
          min={min}
          max={max}
          step={step}
          value={[value]}
          onValueChange={handleValueChange}
          disabled={disabled}
          withGradient={useGradient}
          aria-label={label}
          aria-valuetext={selectedLabel}
          aria-describedby={endpointsId}
          className="w-full"
        />
      </div>
    </div>
  )
}
