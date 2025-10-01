import { getPartById, getPartRelationships, getPartNotes } from '@/lib/data/parts-server'
import { createClient } from '@/lib/supabase/server'
import { resolveUserId } from '@/config/dev'
import type { PartRow, PartNoteRow } from '@/lib/types/database'
import type { PartRelationshipWithDetails } from '@/lib/data/parts.schema'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ArrowLeft } from 'lucide-react'
import { PartActions } from '@/components/garden/PartActions'

// Define the props for the page, including the dynamic parameter
interface PartDetailPageProps {
  params: Promise<{
    partId: string
  }>
}

// Helper component to display a list of items (like triggers or emotions)
function InfoList({ title, items }: { title: string; items?: string[] | null }) {
  if (!items || items.length === 0) {
    return (
      <div>
        <h3 className="font-semibold text-gray-800 dark:text-gray-200">{title}</h3>
        <p className="text-sm text-muted-foreground">None recorded yet.</p>
      </div>
    )
  }
  return (
    <div>
      <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">{title}</h3>
      <div className="flex flex-wrap gap-2">
        {items.map((item, index) => (
          <Badge key={index} variant="secondary" className="text-sm">
            {item}
          </Badge>
        ))}
      </div>
    </div>
  )
}

// Helper component for story sections
function StorySection({ title, content }: { title: string; content?: string | null }) {
  if (!content) return null
  return (
    <div>
      <h3 className="font-semibold text-lg mb-1">{title}</h3>
      <p className="text-muted-foreground whitespace-pre-wrap">{content}</p>
    </div>
  )
}

export default async function PartDetailPage({ params }: PartDetailPageProps) {
  const { partId } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const userId = resolveUserId(user?.id)
  const deps = { userId, client: supabase }

  // Fetch part details and relationships in parallel for efficiency
  const [partResult, relationshipsResult, notesResult] = await Promise.all([
    getPartById({ partId }, deps),
    getPartRelationships({ partId, includePartDetails: true, limit: 20 }, deps),
    getPartNotes({ partId }, deps),
  ])

  // Handle case where the part is not found or fails to load
  if (!partResult) {
    return (
      <div className="container mx-auto p-4 text-center">
        <h1 className="text-2xl font-bold">Part Not Found</h1>
        <p className="text-red-500 mt-2">
          The requested part could not be found.
        </p>
        <Button asChild className="mt-4">
          <Link href="/garden">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Garden
          </Link>
        </Button>
      </div>
    )
  }

  const part: PartRow = partResult
  const visualization = part.visualization as { emoji?: string; color?: string }
  const story = part.story as { origin?: string; currentState?: string; purpose?: string }
  const relationships: PartRelationshipWithDetails[] =
    relationshipsResult && Array.isArray(relationshipsResult)
      ? (relationshipsResult as PartRelationshipWithDetails[])
      : []
  const notes: PartNoteRow[] = notesResult ?? []

  return (
    <div className="container mx-auto p-4 md:p-6">
      {/* Header */}
      <header className="mb-8">
        <div className="mb-4">
          <Button asChild variant="outline" size="sm">
            <Link href="/garden">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Garden
            </Link>
          </Button>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <span className="text-6xl">{visualization?.emoji || '🤗'}</span>
          <div>
            <h1 className="text-4xl font-bold">{part.name}</h1>
            <div className="flex items-center gap-2 mt-2">
              <Badge className="capitalize text-base" variant="default">
                {part.category}
              </Badge>
              <Badge className="capitalize text-base" variant="secondary">
                {part.status}
              </Badge>
            </div>
          </div>
        </div>
      </header>

      {/* Main content grid */}
      <div className="grid md:grid-cols-3 gap-6">
        <main className="md:col-span-2 space-y-6">
          {/* Story Card */}
          <Card>
            <CardHeader>
              <CardTitle>Story & Purpose</CardTitle>
              <CardDescription>The narrative and role of this part.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <StorySection title="Role / Purpose" content={part.role || story?.purpose} />
              <StorySection title="Current State" content={story?.currentState} />
              <StorySection title="Origin Story" content={story?.origin} />
            </CardContent>
          </Card>

          {/* Details Card */}
          <Card>
            <CardHeader>
              <CardTitle>Characteristics</CardTitle>
              <CardDescription>The typical triggers, emotions, and beliefs.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <InfoList title="Triggers" items={part.triggers} />
              <InfoList title="Emotions" items={part.emotions} />
              <InfoList title="Beliefs" items={part.beliefs} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Clarification Notes</CardTitle>
              <CardDescription>Short reflections and context you&apos;ve saved for this part.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {notes.length > 0 ? (
                <ul className="space-y-3">
                  {notes.map((note) => (
                    <li key={note.id} className="rounded-lg border p-3">
                      <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {new Date(note.created_at).toLocaleString()}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No clarification notes recorded yet.</p>
              )}
            </CardContent>
          </Card>
        </main>

        {/* Sidebar */}
        <aside className="space-y-6 md:col-span-1">
          {/* Relationships Card */}
          <Card>
            <CardHeader>
              <CardTitle>Relationships</CardTitle>
            </CardHeader>
            <CardContent>
              {relationships && relationships.length > 0 ? (
                <ul className="space-y-4">
                  {relationships.map((rel) => (
                    <li key={rel.id} className="text-sm flex items-baseline">
                      <span className="font-semibold capitalize w-24">{rel.type}:</span>
                      <div className="flex flex-wrap gap-1 ml-2">
                        {rel.parts
                          .filter((p) => p.id !== part.id)
                          .map((p) => (
                            <Button asChild variant="link" size="sm" className="p-0 h-auto" key={p.id}>
                              <Link href={`/garden/${p.id}`}>{p.name ?? 'View part'}</Link>
                            </Button>
                          ))}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No relationships recorded yet.</p>
              )}
            </CardContent>
          </Card>

          {/* Actions Card */}
          <PartActions part={part} />
        </aside>
      </div>
    </div>
  )
}
