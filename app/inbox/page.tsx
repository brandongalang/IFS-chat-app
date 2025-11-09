import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { InboxShelf } from '@/components/inbox/InboxShelf'
import { PageContainer } from '@/components/common/PageContainer'
import { Button } from '@/components/ui/button'
import { isInboxEnabled } from '@/config/features'

import { InboxPageAnalytics } from './InboxPageAnalytics'

export const metadata: Metadata = {
  title: 'Inbox · IFS Therapy Companion',
  description: 'Review the full inbox triage list including insights, nudges, and notifications.',
}

export const dynamic = 'force-dynamic'

export default function InboxPage() {
  const inboxEnabled = isInboxEnabled()

  if (!inboxEnabled) {
    notFound()
  }

  return (
    <main className="min-h-screen bg-background/60 pb-16 pt-10">
      <InboxPageAnalytics />
      <PageContainer className="flex flex-col gap-6" size="full">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Inbox</h1>
            <p className="mt-2 max-w-xl text-sm text-foreground/70">
              Triage new insights and notifications collected for you. Use quick actions or open an item to dive deeper.
            </p>
          </div>
          <Button asChild variant="secondary" size="sm">
            <Link href="/">Back to Today</Link>
          </Button>
        </header>

        <InboxShelf className="mt-0 w-full" />
      </PageContainer>
    </main>
  )
}
