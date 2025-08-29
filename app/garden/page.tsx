import { searchParts } from '@/mastra/tools/part-tools'
import type { PartRow } from '@/lib/types/database'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

// PartCard component to display a single part in the garden
interface PartCardProps {
  part: PartRow
}

function PartCard({ part }: PartCardProps) {
  // Type assertion for visualization JSON
  const visualization = part.visualization as { emoji?: string; color?: string }

  return (
    <Link href={`/garden/${part.id}`} passHref>
      <Card className="cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all duration-200 h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <span className="text-4xl">{visualization?.emoji || '🤗'}</span>
            <span className="flex-1">{part.name}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground capitalize">{part.role || 'No role defined'}</p>
            <div className="flex gap-2">
              <Badge variant="secondary" className="capitalize">{part.category}</Badge>
              <Badge variant="outline" className="capitalize">{part.status}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

// The main server component for the Garden page
export default async function GardenPage() {
  // In dev mode, searchParts will use the default user ID from .env.local
  const result = await searchParts({})

  if (!result.success || !result.data) {
    return (
      <div className="container mx-auto p-4 text-center">
        <h1 className="text-3xl font-bold mb-6">The Parts Garden</h1>
        <p className="text-red-500">
          Could not load parts: {result.error || 'An unknown error occurred.'}
        </p>
        <p className="text-muted-foreground mt-2">
          Please ensure your Supabase credentials are correctly configured in your .env.local file and that the database is running.
        </p>
      </div>
    )
  }

  const parts = result.data

  return (
    <div className="container mx-auto p-4 md:p-6">
      <header className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight">The Parts Garden</h1>
        <p className="text-muted-foreground mt-2">
          A place to get to know all of your discovered parts.
        </p>
      </header>

      <main>
        {parts.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center border-2 border-dashed rounded-lg p-12">
            <h2 className="text-2xl font-semibold">Your garden is ready to grow</h2>
            <p className="mt-2 text-muted-foreground">
              As you explore your inner world through chat, new parts will be discovered and will appear here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {parts.map((part) => (
              <PartCard key={part.id} part={part} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
