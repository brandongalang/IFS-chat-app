import { InsightCarousel } from '@/components/insights/InsightCarousel'

export default function InsightsPage() {
  return (
    <div className="flex flex-col items-center w-full p-4 md:p-6">
      <div className="w-full max-w-2xl">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight">Your Insights</h1>
          <p className="text-muted-foreground mt-2">
            Reflect on these observations from your recent sessions.
          </p>
        </header>
        <main className="flex justify-center">
          <InsightCarousel />
        </main>
      </div>
    </div>
  )
}
