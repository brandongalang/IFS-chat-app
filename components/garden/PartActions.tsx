'use client'

import { useCallback, useState, useTransition } from 'react'
import Link from 'next/link'
import type { PartRow } from '@/lib/types/database'
import { addPartNote, updatePartDetails } from '@/app/garden/actions'
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
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'

interface PartActionsProps {
  part: PartRow
}

function usePartActionToasts() {
  const { toast } = useToast()

  const notifyPartUpdated = useCallback(() => {
    toast({
      title: 'Part Updated',
      description: 'Your changes have been saved.',
    })
  }, [toast])

  const notifyNoteAdded = useCallback(() => {
    toast({
      title: 'Note added',
      description: 'Clarification saved for this part.',
    })
  }, [toast])

  const notifyEmptyNote = useCallback(() => {
    toast({
      title: 'Note is empty',
      description: 'Add some details before saving a clarification.',
      variant: 'destructive',
    })
  }, [toast])

  const notifyError = useCallback((description: string) => {
    toast({
      title: 'Error',
      description,
      variant: 'destructive',
    })
  }, [toast])

  return {
    notifyPartUpdated,
    notifyNoteAdded,
    notifyEmptyNote,
    notifyError,
  }
}

export function PartActions({ part }: PartActionsProps) {
  const { notifyPartUpdated, notifyNoteAdded, notifyEmptyNote, notifyError } = usePartActionToasts()
  const [isUpdatePending, startUpdate] = useTransition()
  const [isNotePending, startAddNote] = useTransition()
  const [isOpen, setIsOpen] = useState(false)
  const [name, setName] = useState(part.name)
  const initialEmoji = (part.visualization as { emoji?: string })?.emoji || '🤗'
  const [emoji, setEmoji] = useState(initialEmoji)
  const [clarificationNote, setClarificationNote] = useState('')

  const handleSave = () => {
    startUpdate(async () => {
      const formData = new FormData()
      formData.append('partId', part.id)
      formData.append('name', name)
      formData.append('emoji', emoji)

      const result = await updatePartDetails(formData)

      if (result.success) {
        notifyPartUpdated()
        setIsOpen(false)
      } else {
        // Handle both string errors and validation errors
        const errorMessage = typeof result.error === 'string'
          ? result.error
          : 'Validation failed. Please check your input.'
        notifyError(errorMessage)
      }
    })
  }

  const handleAddNote = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const noteContent = clarificationNote.trim()

    if (!noteContent) {
      notifyEmptyNote()
      return
    }

    startAddNote(async () => {
      const formData = new FormData()
      formData.append('partId', part.id)
      formData.append('content', noteContent)

      const result = await addPartNote(formData)

      if (result.success) {
        notifyNoteAdded()
        setClarificationNote('')
      } else {
        const errorMessage = typeof result.error === 'string'
          ? result.error
          : 'Could not save your note. Please try again.'
        notifyError(errorMessage)
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
                <Button onClick={handleSave} disabled={isUpdatePending}>
                  {isUpdatePending ? 'Saving...' : 'Save Changes'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button asChild className="w-full">
            <Link href={`/chat?partId=${part.id}`}>Chat about this Part</Link>
          </Button>

          <div className="space-y-3 rounded-lg border p-4">
            <form onSubmit={handleAddNote} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="clarification-note">Clarification Note</Label>
                <Textarea
                  id="clarification-note"
                  value={clarificationNote}
                  onChange={(event) => setClarificationNote(event.target.value)}
                  placeholder="Capture context, requests, or insights you want to remember about this part."
                  rows={4}
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={isNotePending || clarificationNote.trim().length === 0}
              >
                {isNotePending ? 'Saving Note...' : 'Save Clarification'}
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
