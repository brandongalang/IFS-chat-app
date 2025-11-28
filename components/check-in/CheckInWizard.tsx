'use client'

import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { isNewUIEnabled } from '@/config/features'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

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
  const newUI = isNewUIEnabled()
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

  if (newUI) {
    return (
      <div className="grid gap-6">
        <div className="grid gap-6">{children}</div>
        <div className="flex items-center justify-between gap-3 pt-4 border-t border-[var(--hs-border-subtle)]">
          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              disabled={isPending}
              className="hs-btn-secondary px-5 py-2.5 text-sm disabled:opacity-50"
            >
              {cancelLabel}
            </button>
          ) : (
            <div />
          )}
          <motion.button
            type="button"
            onClick={() => {
              if (canSave && !isPending) {
                onSave()
              }
            }}
            disabled={!canSave || isPending}
            aria-busy={isPending}
            aria-disabled={!canSave || isPending}
            data-status={status}
            className={cn(
              'min-w-[10rem] px-6 py-2.5 rounded-full font-medium text-sm transition-all duration-200',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              isSuccess
                ? 'bg-emerald-500 text-white'
                : 'bg-[var(--hs-primary)] text-white hover:bg-[var(--hs-primary-dark)]',
              isPending && 'cursor-progress',
            )}
            whileTap={{ scale: !canSave || isPending ? 1 : 0.97 }}
            transition={{ duration: 0.12 }}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={status}
                className="flex items-center justify-center gap-2"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                aria-live="polite"
              >
                {isPending ? (
                  <MaterialIcon name="progress_activity" className="text-base animate-spin" />
                ) : null}
                {isSuccess && !isPending ? (
                  <MaterialIcon name="check_circle" className="text-base" />
                ) : null}
                {actionLabel}
              </motion.span>
            </AnimatePresence>
          </motion.button>
        </div>
      </div>
    )
  }

  // Original UI
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
          onClick={() => {
            if (canSave && !isPending) {
              onSave()
            }
          }}
          disabled={!canSave || isPending}
          aria-busy={isPending}
          aria-disabled={!canSave || isPending}
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
