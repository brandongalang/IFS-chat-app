'use client'

import { motion } from 'framer-motion'

import { cn } from '@/lib/utils'
import type { EmojiOption } from '@/lib/check-ins/shared'

const MotionButton = motion.button

interface EmojiScaleProps {
  label: string
  options: EmojiOption[]
  value: string
  onChange: (value: string) => void
  description?: string
}

export function EmojiScale({ label, options, value, onChange, description }: EmojiScaleProps) {
  const selectedOption = options.find((option) => option.id === value)

  return (
    <fieldset className="grid gap-3" aria-label={label}>
      <legend className="text-sm font-medium text-foreground">{label}</legend>
      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      <div className="grid grid-cols-5 gap-2">
        {options.map((option) => {
          const selected = option.id === value
          return (
            <MotionButton
              type="button"
              key={option.id}
              onClick={() => onChange(option.id)}
              className={cn(
                'relative flex flex-col items-center gap-1 rounded-lg border bg-background px-3 py-2 text-2xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                selected
                  ? 'border-primary/70 bg-primary/15 text-primary shadow-[0_12px_28px_-18px_rgba(79,70,229,0.45)] ring-2 ring-primary/40'
                  : 'border-border/70 text-foreground hover:border-primary/40 hover:bg-primary/5',
              )}
              aria-pressed={selected}
              data-selected={selected ? '' : undefined}
              whileTap={{ scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            >
              <span aria-hidden>{option.emoji}</span>
              <span className="text-xs text-muted-foreground">{option.label}</span>
            </MotionButton>
          )
        })}
      </div>
      <span className="sr-only" aria-live="polite">
        {selectedOption ? `${selectedOption.label} selected` : ''}
      </span>
    </fieldset>
  )
}
