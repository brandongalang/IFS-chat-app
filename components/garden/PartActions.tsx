'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import type { PartRow } from '@/lib/types/database'
import { updatePartDetails } from '@/app/garden/actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/hooks/use-toast'

interface PartActionsProps {
  part: PartRow
}

export function PartActions({ part }: PartActionsProps) {
  const [isPending, startTransition] = useTransition()
  const [isOpen, setIsOpen] = useState(false)
  const [name, setName] = useState(part.name)
  const initialEmoji = (part.visualization as { emoji?: string })?.emoji || '🤗'
  const [emoji, setEmoji] = useState(initialEmoji)

  const handleSave = () => {
    startTransition(async () => {
      const formData = new FormData()
      formData.append('partId', part.id)
      formData.append('name', name)
      formData.append('emoji', emoji)

      const result = await updatePartDetails(formData)

      if (result.success) {
        toast({
          title: 'Part Updated',
          description: 'Your changes have been saved.',
        })
        setIsOpen(false)
      } else {
        // Handle both string errors and validation errors
        const errorMessage = typeof result.error === 'string'
          ? result.error
          : 'Validation failed. Please check your input.'
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        })
      }
    })
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full">Edit Name & Emoji</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Part</DialogTitle>
                <DialogDescription>
                  Update the name and emoji for your part.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">
                    Name
                  </Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="emoji" className="text-right">
                    Emoji
                  </Label>
                  <Input
                    id="emoji"
                    value={emoji}
                    onChange={(e) => setEmoji(e.target.value)}
                    className="col-span-3"
                    maxLength={2} // Emojis can sometimes be 2 chars
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleSave} disabled={isPending}>
                  {isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button asChild className="w-full">
            <Link href={`/chat?partId=${part.id}`}>Chat about this Part</Link>
          </Button>
        </CardContent>
      </Card>
    </>
  )
}
