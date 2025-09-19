"use client"

import type { CompletionSummary } from '@/lib/onboarding/types'

interface OnboardingCompletionSummaryProps {
  summary: CompletionSummary
  onContinue: () => void
}

export function OnboardingCompletionSummary({ summary, onContinue }: OnboardingCompletionSummaryProps) {
  const parts = summary.parts
  const sentences = summary.sentences.length > 0
    ? summary.sentences
    : ['Thank you for exploring your system with us. We will keep integrating what you shared.']

  const themeChips = summary.themes.slice(0, 3)
  const somatic = summary.somatic.filter(Boolean)

  return (
    <div className="space-y-8 rounded-md border border-border/40 bg-background/80 p-6 shadow-sm">
      <header className="space-y-3">
        <h2 className="text-2xl font-semibold tracking-tight">Welcome — we&apos;ve got your reflections.</h2>
        <div className="space-y-2 text-sm text-muted-foreground">
          {sentences.map((sentence, index) => (
            <p key={index}>{sentence}</p>
          ))}
        </div>
      </header>

      {themeChips.length > 0 ? (
        <section>
          <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Themes that stood out</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {themeChips.map(theme => (
              <span
                key={theme.id}
                className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
              >
                {theme.label} · {theme.score}%
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {parts.length > 0 ? (
        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Protective parts we heard</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              We&apos;ll stay curious with these parts and keep them connected to your Self-led pace.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {parts.map(part => (
              <article key={part.id} className="rounded-md border border-border/40 bg-background p-3">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold">{part.name}</h4>
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">{part.tone}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{part.focus}</p>
                <p className="mt-2 text-sm">{part.intention}</p>
                <p className="mt-2 text-xs text-muted-foreground">Clue: “{part.evidence}”</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid gap-3 md:grid-cols-2">
        <InfoCard
          title="Somatic signals"
          body={somatic.length > 0 ? somatic.join(', ') : 'None surfaced just yet — stay curious and we will keep listening.'}
        />
        <InfoCard
          title="Feeling to rebuild trust with"
          body={summary.least_trusted_feeling ?? 'We will notice together when a feeling feels hard to trust.'}
        />
        <InfoCard
          title="Non-negotiable belief"
          body={summary.core_belief ?? 'We will keep an ear out for the beliefs that feel most rigid.'}
        />
        <InfoCard
          title="First reflex after mistakes"
          body={summary.mistake_reflex ?? 'We will notice the first reflex together the next time it appears.'}
        />
      </section>

      <div className="flex flex-col items-center gap-2 border-t border-border/40 pt-4 text-center text-sm text-muted-foreground">
        <p>Whenever you&apos;re ready, let&apos;s bring this grounded insight into today.</p>
        <button
          type="button"
          className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          onClick={onContinue}
        >
          Continue
        </button>
      </div>
    </div>
  )
}

function InfoCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-md border border-border/40 bg-background p-3">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
      <p className="mt-1 text-sm leading-snug text-foreground/90">{body}</p>
    </div>
  )
}
