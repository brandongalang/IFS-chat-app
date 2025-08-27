"use client"

import * as React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

export function ComingSoonDialog({
  open,
  onOpenChange,
  featureName,
  description,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  featureName?: string
  description?: string
}) {
  const title = 'Coming soon'
  const desc = description ?? "This feature is coming soon. We’re focused on building a great chat experience first."

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="coming-soon-dialog">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{desc}</DialogDescription>
        </DialogHeader>
        <div className="py-2 text-sm text-muted-foreground">
          {featureName ? `Feature: ${featureName}` : null}
        </div>
        <DialogFooter>
          <Button
            data-testid="csd-back"
            onClick={() => {
              onOpenChange(false)
            }}
          >
            Back
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

