'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useUpgradeModal } from '@/components/common/upgrade-modal'
import type { PartRow } from '@/lib/types/database'

// PartCard component to display a single part in the garden
interface PartCardProps {
  part: PartRow
}

function PartCard({ part }: PartCardProps) {
  const visualization = part.visualization as { emoji?: string; color?: string }

  return (
    <Link href={`/garden/${part.id}`} passHref>
      <Card className="cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all duration-200 h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <span className="text-4xl">{visualization?.emoji || '🤗'}</span>
            <span className="flex-1">{part.name}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground capitalize">{part.role || 'No role defined'}</p>
            <div className="flex gap-2">
              <Badge variant="secondary" className="capitalize">{part.category}</Badge>
              <Badge variant="outline" className="capitalize">{part.status}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

// Component for hidden parts
function HiddenPartCard() {
  const { openModal } = useUpgradeModal()

  const handleClick = () => {
    openModal(
      'Unlock This Part',
      'This part is hidden. Upgrade to a paid plan to unlock this and all future parts you discover.'
    )
  }

  return (
    <Card
      onClick={handleClick}
      className="flex flex-col items-center justify-center text-center p-6 bg-secondary/50 border-dashed h-full cursor-pointer hover:border-primary/50 transition-all duration-200"
    >
      <Lock className="w-12 h-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold">Part Discovered</h3>
      <p className="text-sm text-muted-foreground mt-1 mb-4">
        Click to unlock this part.
      </p>
      <Button variant="secondary">Unlock</Button>
    </Card>
  )
}

// Main client component that decides which card to render
export function PartCardClient({ part }: PartCardProps) {
  if (part.is_hidden) {
    return <HiddenPartCard />
  }

  return <PartCard part={part} />
}
