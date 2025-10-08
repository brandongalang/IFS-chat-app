'use client'

import { motion } from 'framer-motion'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { PartOption } from '@/lib/check-ins/shared'

const MotionButton = motion(Button)

interface PartsPickerProps {
  label: string
  options: PartOption[]
  selectedIds: string[]
  onToggle: (id: string) => void
  emptyHint?: string
  className?: string
}

export function PartsPicker({
  label,
  options,
  selectedIds,
  onToggle,
  emptyHint = 'Capture new parts in your notes or during a chat.',
  className,
}: PartsPickerProps) {
  const hasOptions = options.length > 0
  const selectedSummary = selectedIds
    .map((id) => options.find((part) => part.id === id)?.name)
    .filter((name): name is string => Boolean(name))
    .join(', ')

  return (
    <div className={cn('grid gap-2', className)}>
      <Label>{label}</Label>
      {hasOptions ? (
        <>
          <div className="flex flex-wrap gap-2">
            {options.map((part) => {
              const selected = selectedIds.includes(part.id)
              return (
                <MotionButton
                  key={part.id}
                  type="button"
                  variant="outline"
                  className={cn(
                    'h-auto rounded-full border px-3 py-1 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                    selected
                      ? 'border-primary/60 bg-primary/15 text-primary shadow-[0_10px_24px_-18px_rgba(79,70,229,0.5)] ring-2 ring-primary/40'
                      : 'border-border/70 text-foreground hover:border-primary/40 hover:bg-primary/5',
                  )}
                  onClick={() => onToggle(part.id)}
                  aria-pressed={selected}
                  data-selected={selected ? '' : undefined}
                  whileTap={{ scale: 0.92 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                >
                  <span className="mr-1" aria-hidden>
                    {part.emoji ?? '🧩'}
                  </span>
                  {part.name}
                </MotionButton>
              )
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">New part?</span> Mention it below or start a chat to explore together.
          </p>
          <span className="sr-only" aria-live="polite">
            {selectedSummary.length > 0 ? `Selected parts: ${selectedSummary}.` : 'No parts selected.'}
          </span>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">{emptyHint}</p>
      )}
    </div>
  )
}
