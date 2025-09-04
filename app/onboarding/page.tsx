import { cookies, headers } from 'next/headers'
import Link from 'next/link'

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
    <main className="mx-auto max-w-2xl px-4 py-10" style={{ letterSpacing: 'var(--eth-letter-spacing-user)' }}>
      <h1 className="text-2xl font-thin" style={{ letterSpacing: 'var(--eth-letter-spacing-assistant)', color: 'rgba(255,255,255,var(--eth-assistant-opacity))' }}>onboarding</h1>
      <p className="mt-2 text-sm" style={{ color: 'rgba(255,255,255,var(--eth-user-opacity))' }}>
        let&apos;s get to know your system. this short, kind check-in helps tailor your support.
      </p>

      <section className="mt-6">
        <OnboardingWizard />
      </section>
    </main>
  )
}
