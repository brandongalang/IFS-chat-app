'use client'

import { useState, useLayoutEffect, useRef, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { InboxButtonActionSchema, InboxActionButton } from '@/types/inbox'

type ActionLayout = 'pills' | 'grid' | 'stack'

interface UniversalActionsProps {
  actions: InboxButtonActionSchema
  onAction: (value: string, freeText?: string) => void
  disabled?: boolean
  className?: string
}

/**
 * Determine the best layout based on button count and label lengths.
 * - pills: horizontal row for 1-2 buttons with short labels
 * - grid: 2-column grid for 3-4 buttons with medium labels
 * - stack: full-width vertical for long labels or many buttons
 */
function determineLayout(buttons: InboxActionButton[]): ActionLayout {
  if (buttons.length === 0) return 'stack'

  const maxLabelLen = Math.max(...buttons.map(b => b.label.length))
  const avgLabelLen = buttons.reduce((sum, b) => sum + b.label.length, 0) / buttons.length
  const hasEmojis = buttons.some(b => b.emoji)

  // Pills: 1-2 buttons with short labels (under 20 chars)
  if (buttons.length <= 2 && maxLabelLen <= 20) {
    return 'pills'
  }

  // Pills: up to 4 buttons with very short labels (under 12 chars)
  if (buttons.length <= 4 && maxLabelLen <= 12 && !hasEmojis) {
    return 'pills'
  }

  // Grid: 3-4 buttons with medium labels (under 25 chars average)
  if (buttons.length >= 3 && buttons.length <= 4 && avgLabelLen <= 25 && maxLabelLen <= 35) {
    return 'grid'
  }

  // Stack: everything else (long labels, many buttons, emojis)
  return 'stack'
}

function PillsLayout({
  buttons,
  onSelect,
  selectedValue,
  disabled
}: {
  buttons: InboxActionButton[]
  onSelect: (value: string) => void
  selectedValue: string | null
  disabled?: boolean
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {buttons.map((btn) => (
        <Button
          key={btn.value}
          type="button"
          size="sm"
          variant={
            selectedValue === btn.value
              ? 'default'
              : btn.variant === 'ghost'
                ? 'ghost'
                : btn.variant === 'secondary'
                  ? 'secondary'
                  : 'outline'
          }
          className={cn(
            'rounded-full px-4',
            selectedValue === btn.value && 'ring-2 ring-ring ring-offset-2'
          )}
          disabled={disabled}
          onClick={() => onSelect(btn.value)}
        >
          {btn.emoji && <span className="mr-1">{btn.emoji}</span>}
          {btn.label}
        </Button>
      ))}
    </div>
  )
}

function GridLayout({
  buttons,
  onSelect,
  selectedValue,
  disabled
}: {
  buttons: InboxActionButton[]
  onSelect: (value: string) => void
  selectedValue: string | null
  disabled?: boolean
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {buttons.map((btn) => (
        <Button
          key={btn.value}
          type="button"
          size="sm"
          variant={
            selectedValue === btn.value
              ? 'default'
              : btn.variant === 'ghost'
                ? 'ghost'
                : 'outline'
          }
          className={cn(
            'h-auto min-h-[36px] whitespace-normal py-2 px-3 text-left justify-start',
            selectedValue === btn.value && 'ring-2 ring-ring ring-offset-2'
          )}
          disabled={disabled}
          onClick={() => onSelect(btn.value)}
        >
          {btn.emoji && <span className="mr-1.5 text-base">{btn.emoji}</span>}
          <span className="line-clamp-2">{btn.label}</span>
        </Button>
      ))}
    </div>
  )
}

function StackLayout({
  buttons,
  onSelect,
  selectedValue,
  disabled
}: {
  buttons: InboxActionButton[]
  onSelect: (value: string) => void
  selectedValue: string | null
  disabled?: boolean
}) {
  return (
    <div className="flex flex-col gap-2">
      {buttons.map((btn) => (
        <Button
          key={btn.value}
          type="button"
          variant={
            selectedValue === btn.value
              ? 'default'
              : btn.variant === 'ghost'
                ? 'ghost'
                : 'outline'
          }
          className={cn(
            'w-full justify-start h-auto min-h-[44px] whitespace-normal py-3 px-4 text-left',
            selectedValue === btn.value && 'ring-2 ring-ring ring-offset-2'
          )}
          disabled={disabled}
          onClick={() => onSelect(btn.value)}
        >
          {btn.emoji && <span className="mr-2 text-lg">{btn.emoji}</span>}
          <span>{btn.label}</span>
        </Button>
      ))}
    </div>
  )
}

export function UniversalActions({
  actions,
  onAction,
  disabled,
  className
}: UniversalActionsProps) {
  const [freeText, setFreeText] = useState('')
  const [selectedValue, setSelectedValue] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const layout = useMemo(() => determineLayout(actions.buttons), [actions.buttons])

  const handleButtonSelect = (value: string) => {
    setSelectedValue(value)

    // If no free text allowed, submit immediately
    if (!actions.allowFreeText) {
      setIsSubmitting(true)
      onAction(value)
    }
  }

  const handleSubmit = () => {
    if (selectedValue || freeText.trim()) {
      setIsSubmitting(true)
      onAction(selectedValue ?? 'free_text', freeText.trim() || undefined)
    }
  }

  const canSubmit = (selectedValue || freeText.trim()) && !isSubmitting

  return (
    <div className={cn('space-y-3', className)}>
      {/* Buttons */}
      {actions.buttons.length > 0 && (
        <>
          {layout === 'pills' && (
            <PillsLayout
              buttons={actions.buttons}
              onSelect={handleButtonSelect}
              selectedValue={selectedValue}
              disabled={disabled || isSubmitting}
            />
          )}
          {layout === 'grid' && (
            <GridLayout
              buttons={actions.buttons}
              onSelect={handleButtonSelect}
              selectedValue={selectedValue}
              disabled={disabled || isSubmitting}
            />
          )}
          {layout === 'stack' && (
            <StackLayout
              buttons={actions.buttons}
              onSelect={handleButtonSelect}
              selectedValue={selectedValue}
              disabled={disabled || isSubmitting}
            />
          )}
        </>
      )}

      {/* Free text input */}
      {actions.allowFreeText && (
        <div className="space-y-2">
          <Textarea
            placeholder={actions.freeTextPlaceholder ?? 'Share your thoughts...'}
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            className="min-h-[80px] resize-none text-sm"
            disabled={disabled || isSubmitting}
          />
          {canSubmit && (
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={disabled || isSubmitting}
              className="rounded-full"
            >
              {isSubmitting ? 'Submitting...' : 'Submit'}
            </Button>
          )}
        </div>
      )}

      {/* Helper text */}
      {actions.helperText && (
        <p className="text-[11px] text-foreground/60">{actions.helperText}</p>
      )}
    </div>
  )
}

export { determineLayout, type ActionLayout }
