'use client'

import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const MotionButton = motion(Button)

type WizardStatus = 'idle' | 'pending' | 'success'

interface CheckInWizardProps {
  children: ReactNode
  onNext: () => void
  onBack?: () => void
  disableNext?: boolean
  isLastStep?: boolean
  nextLabel?: string
  submitLabel?: string
  status?: WizardStatus
}

export function CheckInWizard({
  children,
  onNext,
  onBack,
  disableNext = false,
  isLastStep = false,
  nextLabel = 'Next',
  submitLabel = 'Finish',
  status = 'idle',
}: CheckInWizardProps) {
  const isPending = status === 'pending'
  const isSuccess = status === 'success'
  const actionLabel = useMemo(() => {
    if (isPending) {
      return isLastStep ? 'Saving…' : 'Working…'
    }
    if (isSuccess) {
      return isLastStep ? 'Saved' : 'Done'
    }
    return isLastStep ? submitLabel : nextLabel
  }, [isPending, isSuccess, isLastStep, submitLabel, nextLabel])

  return (
    <div className="grid gap-6">
      <div className="grid gap-6">{children}</div>
      <div className="flex items-center justify-between gap-2">
        <MotionButton
          variant="ghost"
          type="button"
          onClick={onBack}
          disabled={!onBack || isPending}
          whileTap={{ scale: onBack ? 0.96 : 1 }}
          transition={{ duration: 0.12 }}
        >
          Back
        </MotionButton>
        <MotionButton
          type="button"
          onClick={onNext}
          disabled={disableNext || isPending}
          aria-busy={isPending}
          data-status={status}
          className={cn(
            'min-w-[8rem]',
            isPending && 'cursor-progress',
            isSuccess && 'bg-emerald-600 text-emerald-50 hover:bg-emerald-500',
          )}
          whileTap={{ scale: disableNext || isPending ? 1 : 0.96 }}
          transition={{ duration: 0.12 }}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={status}
              className="flex items-center justify-center gap-2"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              aria-live="polite"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isSuccess && !isPending ? <CheckCircle2 className="h-4 w-4" /> : null}
              {actionLabel}
            </motion.span>
          </AnimatePresence>
        </MotionButton>
      </div>
    </div>
  )
}
