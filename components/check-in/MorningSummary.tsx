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
    <div className="grid gap-4 rounded-lg border border-border/60 bg-muted/40 p-4">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Morning snapshot</p>
        <div className="mt-2 flex gap-4 text-2xl">
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
      {context.mindForToday ? (
        <div className="grid gap-1 text-sm">
          <p className="text-muted-foreground">You shared this morning:</p>
          <blockquote className="border-l-2 pl-3 italic">“{context.mindForToday}”</blockquote>
        </div>
      ) : null}
      {context.intention ? (
        <div className="grid gap-1 text-sm">
          <p className="text-muted-foreground">Intention you set:</p>
          <blockquote className="border-l-2 pl-3 italic">“{context.intention}”</blockquote>
        </div>
      ) : null}
      {parts.length > 0 ? (
        <div className="grid gap-2 text-sm">
          <p className="text-muted-foreground">Parts you noticed:</p>
          <div className="flex flex-wrap gap-2">
            {parts.map((part) => (
              <span key={part.id} className="inline-flex items-center gap-1 rounded-full bg-secondary/60 px-3 py-1 text-xs">
                <span aria-hidden>{part.emoji ?? '🧩'}</span>
                <span>{part.name}</span>
              </span>
            ))}
          </div>
        </div>
      ) : null}
      <p className="text-xs text-muted-foreground">This prompt will greet you this evening:</p>
      <blockquote className="text-sm italic">“{context.generatedPrompt}”</blockquote>
    </div>
  )
}