'use client'

import Link from 'next/link'
import type { PartRow } from '@/lib/types/database'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface PartCardProps {
  part: PartRow
  className?: string
}

export function PartCard({ part, className }: PartCardProps) {
  const emoji = (part.visualization as { emoji?: string } | null)?.emoji ?? '🤗'

  return (
    <Link
      href={`/garden/${part.id}`}
      className={cn(
        'group relative block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        className
      )}
      aria-label={`View ${part.name}`}
    >
      <Card className="aspect-square flex flex-col items-center justify-center gap-4 p-6 text-center transition-transform duration-200 group-hover:-translate-y-1 group-hover:shadow-lg group-focus-visible:-translate-y-1">
        <span className="text-5xl md:text-6xl" aria-hidden="true">
          {emoji}
        </span>
        <span className="text-lg font-semibold text-foreground line-clamp-2">
          {part.name}
        </span>
      </Card>
    </Link>
  )
}
