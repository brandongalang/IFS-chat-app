import { searchParts } from '@/mastra/tools/part-tools'
import { PartCardClient } from '@/components/garden/part-card-client'

// The main server component for the Garden page
export default async function GardenPage() {
  // In dev mode, searchParts will use the default user ID from .env.local
  const result = await searchParts({ limit: 20 })

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
              <PartCardClient key={part.id} part={part} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
