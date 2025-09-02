import * as React from 'react'
import { BackButton } from '@/components/common/BackButton'

export function ComingSoonView({ featureName }: { featureName?: string }) {
  return (
    <main className="mx-auto max-w-md p-6 text-center" data-testid="coming-soon-page">
      <h1 className="text-2xl font-semibold mb-2">Coming soon</h1>
      <p className="text-muted-foreground mb-6">
        This feature is coming soon. We’re focused on building a great chat experience first.
      </p>
      {featureName ? (
        <p className="text-xs text-muted-foreground mb-6">Feature: {featureName}</p>
      ) : null}
      <div className="flex justify-center">
        <BackButton />
      </div>
    </main>
  )
}

