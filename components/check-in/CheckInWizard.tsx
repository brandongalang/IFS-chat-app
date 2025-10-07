'use client'

import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'

interface CheckInWizardProps {
  children: ReactNode
  onNext: () => void
  onBack?: () => void
  disableNext?: boolean
  isSubmitting?: boolean
  isLastStep?: boolean
  nextLabel?: string
  submitLabel?: string
}

export function CheckInWizard({
  children,
  onNext,
  onBack,
  disableNext = false,
  isSubmitting = false,
  isLastStep = false,
  nextLabel = 'Next',
  submitLabel = 'Finish',
}: CheckInWizardProps) {
  return (
    <div className="grid gap-6">
      <div className="grid gap-6">{children}</div>
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" type="button" onClick={onBack} disabled={!onBack || isSubmitting}>
          Back
        </Button>
        <Button
          type="button"
          onClick={onNext}
          disabled={disableNext || isSubmitting}
          className="min-w-[8rem]"
        >
          {isSubmitting ? 'Saving…' : isLastStep ? submitLabel : nextLabel}
        </Button>
      </div>
    </div>
  )
}
