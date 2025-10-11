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
  onCancel?: () => void
  onSave: () => void
  isSaving?: boolean
  canSave?: boolean
  saveLabel?: string
  cancelLabel?: string
  status?: WizardStatus
}

export function CheckInWizard({
  children,
  onCancel,
  onSave,
  isSaving = false,
  canSave = true,
  saveLabel = 'Save check-in',
  cancelLabel = 'Cancel',
  status = 'idle',
}: CheckInWizardProps) {
  const isPending = status === 'pending' || isSaving
  const isSuccess = status === 'success'

  const actionLabel = useMemo(() => {
    if (isPending) {
      return 'Saving…'
    }
    if (isSuccess) {
      return 'Saved'
    }
    return saveLabel
  }, [isPending, isSuccess, saveLabel])

  return (
    <div className="grid gap-8">
      <div className="grid gap-8">{children}</div>
      <div className="flex items-center justify-between gap-3 pt-2">
        {onCancel ? (
          <MotionButton
            variant="ghost"
            type="button"
            onClick={onCancel}
            disabled={isPending}
            whileTap={{ scale: isPending ? 1 : 0.96 }}
            transition={{ duration: 0.12 }}
          >
            {cancelLabel}
          </MotionButton>
        ) : (
          <div />
        )}
        <MotionButton
          type="button"
          onClick={onSave}
          disabled={!canSave || isPending}
          aria-busy={isPending}
          data-status={status}
          className={cn(
            'min-w-[10rem]',
            isPending && 'cursor-progress',
            isSuccess && 'bg-emerald-600 text-emerald-50 hover:bg-emerald-500',
          )}
          whileTap={{ scale: !canSave || isPending ? 1 : 0.96 }}
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
