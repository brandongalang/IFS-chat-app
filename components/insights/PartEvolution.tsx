'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Zap, Puzzle, Users, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

// Corresponds to the `timeline_events` table
type TimelineEvent = {
  id: string
  type: 'part_emerged' | 'breakthrough' | 'integration' | 'relationship_discovered'
  description: string | null
  created_at: string
}

interface PartEvolutionProps {
  events: TimelineEvent[]
}

const eventTypeMap = {
  part_emerged: {
    Icon: Sparkles,
    bgColor: 'bg-yellow-100',
    iconColor: 'text-yellow-600',
    title: 'Part Emerged',
  },
  breakthrough: {
    Icon: Zap,
    bgColor: 'bg-blue-100',
    iconColor: 'text-blue-600',
    title: 'Breakthrough',
  },
  integration: {
    Icon: Puzzle,
    bgColor: 'bg-green-100',
    iconColor: 'text-green-600',
    title: 'Integration',
  },
  relationship_discovered: {
    Icon: Users,
    bgColor: 'bg-purple-100',
    iconColor: 'text-purple-600',
    title: 'Relationship Discovered',
  },
}

export function PartEvolution({ events }: PartEvolutionProps) {
  // Sort events by date, newest first
  const sortedEvents = React.useMemo(
    () => [...events].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [events]
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Part Evolution</CardTitle>
      </CardHeader>
      <CardContent>
        {sortedEvents.length > 0 ? (
          <div className="relative pl-6">
            {/* Vertical line */}
            <div className="absolute left-0 top-0 h-full w-0.5 bg-gray-200" />
            {sortedEvents.map((event, index) => {
              const { Icon, bgColor, iconColor, title } = eventTypeMap[event.type]
              return (
                <div key={event.id} className="relative mb-8 pl-8">
                  {/* Circle icon */}
                  <div
                    className={cn(
                      'absolute -left-3 top-1 flex h-10 w-10 items-center justify-center rounded-full',
                      bgColor
                    )}
                  >
                    <Icon className={cn('h-5 w-5', iconColor)} />
                  </div>
                  <p className="font-semibold text-sm">{title}</p>
                  <p className="text-sm text-muted-foreground">{event.description}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(event.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-center text-muted-foreground">No evolution events recorded yet.</p>
        )}
      </CardContent>
    </Card>
  )
}
