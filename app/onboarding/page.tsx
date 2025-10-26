import { cookies, headers } from 'next/headers'

export const dynamic = 'force-dynamic'

import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard'

export default async function OnboardingPage() {
  // Placeholder scaffold: we will render the real wizard soon.
  // For now, provide a simple, accessible container so middleware redirects have a destination.
  const c = cookies()
  const h = headers()
  void c
  void h

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 text-foreground sm:px-6">
      <h1 className="text-3xl font-semibold">Let&apos;s get to know your system</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This gentle check-in helps Trailhead tailor support to the parts that need the most care.
      </p>

      <section className="mt-8 rounded-3xl bg-card shadow-lg shadow-primary/10 ring-1 ring-border/60 p-6">
        <OnboardingWizard />
      </section>
    </main>
  )
}
