"use client"

import * as React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'

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
  const router = useRouter()
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
            data-testid="csd-back-to-chat"
            onClick={() => {
              onOpenChange(false)
              router.push('/chat')
            }}
          >
            Back to Chat
          </Button>
          <Button
            data-testid="csd-notify"
            variant="secondary"
            onClick={() => {
              onOpenChange(false)
            }}
          >
            Notify me later
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

