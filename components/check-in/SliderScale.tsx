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
  helpText?: string
  disabled?: boolean
  className?: string
}

const DEFAULT_LABELS = ['Very low', 'Low', 'OK', 'High', 'Very high']

export function SliderScale({
  id,
  label,
  value,
  onChange,
  min = 1,
  max = 5,
  step = 1,
  labels = DEFAULT_LABELS,
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

  // Calculate positions for tick labels as percentages across the track
  const positions = useMemo(
    () => Array.from({ length: labels.length }, (_, i) => (i / (labels.length - 1)) * 100),
    [labels.length]
  )

  const selectedLabel = useMemo(
    () => labels[value - min] || labels[Math.floor(labels.length / 2)],
    [labels, value, min]
  )

  return (
    <div className={cn('grid gap-3', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
        {/* Show selected label inline on desktop only */}
        <span className="hidden text-xs font-medium text-muted-foreground md:inline" aria-live="polite">
          {selectedLabel}
        </span>
      </div>
      {helpText ? <p className="text-xs text-muted-foreground">{helpText}</p> : null}
      <div className="relative px-1 pt-2 pb-3 md:pb-6">
        <Slider
          id={id}
          min={min}
          max={max}
          step={step}
          value={[value]}
          onValueChange={handleValueChange}
          disabled={disabled}
          aria-label={label}
          aria-valuetext={selectedLabel}
          className="w-full"
        />
      </div>
      {/* Desktop: show all tick labels below slider */}
      <div className="relative hidden px-1 md:block">
        <div className="flex justify-between">
          {labels.map((tickLabel, index) => (
            <span
              key={index}
              className="text-[10px] text-muted-foreground/60"
              style={{ position: 'absolute', left: `${positions[index]}%`, transform: 'translateX(-50%)' }}
            >
              {tickLabel}
            </span>
          ))}
        </div>
      </div>
      {/* Mobile: show only the selected label below slider with smooth transition */}
      <div
        key={value}
        className="mt-1 text-center text-base font-medium text-foreground transition-opacity duration-200 md:hidden"
        role="status"
        aria-live="polite"
      >
        {selectedLabel}
      </div>
    </div>
  )
}
