'use client'

import type { MorningContextSummary, PartOption } from '@/lib/check-ins/shared'

interface MorningSummaryProps {
  context: MorningContextSummary
  partLookup: Map<string, PartOption>
}

export function MorningSummary({ context, partLookup }: MorningSummaryProps) {
  const parts = context.parts
    .map((partId) => partLookup.get(partId))
    .filter((part): part is PartOption => Boolean(part))

  return (
    <div className="grid gap-3 rounded-lg border border-border/50 bg-muted/30 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">This morning</p>
        <div className="flex gap-3 text-lg">
          <span title={context.emoji.mood.label} aria-label={`Morning mood: ${context.emoji.mood.label}`}>
            {context.emoji.mood.emoji}
          </span>
          <span title={context.emoji.energy.label} aria-label={`Morning energy: ${context.emoji.energy.label}`}>
            {context.emoji.energy.emoji}
          </span>
          <span
            title={context.emoji.intentionFocus.label}
            aria-label={`Morning intention focus: ${context.emoji.intentionFocus.label}`}
          >
            {context.emoji.intentionFocus.emoji}
          </span>
        </div>
      </div>
      {context.intention ? (
        <div className="text-sm">
          <p className="text-xs text-muted-foreground">Your intention:</p>
          <p className="mt-1 italic">&ldquo;{context.intention}&rdquo;</p>
        </div>
      ) : null}
      {parts.length > 0 ? (
        <div className="text-sm">
          <p className="text-xs text-muted-foreground">Active parts:</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {parts.map((part) => (
              <span key={part.id} className="inline-flex items-center gap-1 rounded-full bg-secondary/60 px-2.5 py-0.5 text-xs">
                <span aria-hidden>{part.emoji ?? '🧩'}</span>
                <span>{part.name}</span>
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}