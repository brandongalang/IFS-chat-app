"use client"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface EndSessionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onStartNewSession: () => void
}

export function EndSessionDialog({ open, onOpenChange, onStartNewSession }: EndSessionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Session Ended</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p className="text-muted-foreground mb-4">
            Your session has been successfully ended. Would you like to start a new session?
          </p>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button onClick={onStartNewSession}>
              Start New Session
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
