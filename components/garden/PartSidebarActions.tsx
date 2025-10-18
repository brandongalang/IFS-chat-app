'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import type { PartRow } from '@/lib/types/database'
import { addPartNote } from '@/app/garden/actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'

interface PartSidebarActionsProps {
  part: PartRow
}

export function PartSidebarActions({ part }: PartSidebarActionsProps) {
  const { toast } = useToast()
  const [isNotePending, startAddNote] = useTransition()
  const [clarificationNote, setClarificationNote] = useState('')

  const handleAddNote = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const noteContent = clarificationNote.trim()

    if (!noteContent) {
      toast({
        title: 'Note is empty',
        description: 'Add some details before saving a clarification.',
        variant: 'destructive',
      })
      return
    }

    startAddNote(async () => {
      const formData = new FormData()
      formData.append('partId', part.id)
      formData.append('content', noteContent)

      const result = await addPartNote(formData)

      if (result.success) {
        toast({
          title: 'Note added',
          description: 'Clarification saved for this part.',
        })
        setClarificationNote('')
      } else {
        const errorMessage = typeof result.error === 'string'
          ? result.error
          : 'Could not save your note. Please try again.'

        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        })
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
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
  )
}
