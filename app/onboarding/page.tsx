import { cookies, headers } from 'next/headers'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function OnboardingPage() {
  // Placeholder scaffold: we will render the real wizard soon.
  // For now, provide a simple, accessible container so middleware redirects have a destination.
  const c = cookies()
  const h = headers()
  void c
  void h

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Onboarding</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Let&apos;s get to know your system. This short, kind check-in helps tailor your support.
      </p>

      <section className="mt-6 rounded-md border p-6">
        <p className="text-sm">
          The onboarding wizard UI is coming next. In the meantime, you can return to Today.
        </p>
        <div className="mt-4">
          <Link
            href="/today"
            className="inline-flex items-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Go to Today
          </Link>
        </div>
      </section>
    </main>
  )
}
