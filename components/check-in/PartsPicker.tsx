'use client'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { PartOption } from '@/lib/check-ins/shared'

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

  return (
    <div className={cn('grid gap-2', className)}>
      <Label>{label}</Label>
      {hasOptions ? (
        <>
          <div className="flex flex-wrap gap-2">
            {options.map((part) => {
              const selected = selectedIds.includes(part.id)
              return (
                <Button
                  key={part.id}
                  type="button"
                  variant={selected ? 'default' : 'outline'}
                  className={cn('h-auto rounded-full px-3 py-1 text-sm', selected && 'shadow-sm')}
                  onClick={() => onToggle(part.id)}
                >
                  <span className="mr-1" aria-hidden>
                    {part.emoji ?? '🧩'}
                  </span>
                  {part.name}
                </Button>
              )
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">New part?</span> Mention it below or start a chat to explore together.
          </p>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">{emptyHint}</p>
      )}
    </div>
  )
}
