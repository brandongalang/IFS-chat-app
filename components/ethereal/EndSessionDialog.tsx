"use client"

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface EndSessionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onStartNewSession: () => void
}

export function EndSessionDialog({
  open,
  onOpenChange,
  onStartNewSession,
}: EndSessionDialogProps) {
  const router = useRouter()

  const handleBackToToday = () => {
    // Navigate to the Today page root
    router.push('/')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="end-session-dialog">
        <DialogHeader>
          <DialogTitle>Session Ended</DialogTitle>
          <DialogDescription>
            Your notes have been saved. Ready to return to your Today page?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={onStartNewSession}
            data-testid="start-new-session"
          >
            Start New Session
          </Button>
          <Button
            onClick={handleBackToToday}
            data-testid="back-to-today"
          >
            Back to Today
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
