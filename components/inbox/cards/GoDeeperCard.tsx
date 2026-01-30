'use client';

import type { FollowUpEnvelope as GoDeeperEnvelope } from '@/lib/data/parts';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface GoDeeperCardProps {
  envelope: GoDeeperEnvelope;
  onStartChat?: (envelope: GoDeeperEnvelope) => void;
  onDismiss?: (envelope: GoDeeperEnvelope) => void;
  className?: string;
}

export function GoDeeperCard({ envelope, onStartChat, onDismiss, className }: GoDeeperCardProps) {
  const { payload } = envelope;

  return (
    <div
      className={cn(
        'rounded-xl border border-border/40 bg-gradient-to-br from-primary/5 to-primary/10 p-4',
        className
      )}
    >
      <div className="text-[10px] font-semibold tracking-[0.24em] text-primary/80">GO DEEPER</div>
      <div className="mt-3">
        <p className="text-base font-semibold leading-tight text-foreground">{payload.title}</p>
        <p className="mt-2 text-sm text-foreground/80">{payload.summary}</p>
        {payload.inference && (
          <p className="mt-2 text-xs text-foreground/60 italic">{payload.inference}</p>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        <Button size="sm" className="rounded-full px-4" onClick={() => onStartChat?.(envelope)}>
          Start conversation
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="rounded-full px-3 text-foreground/60"
          onClick={() => onDismiss?.(envelope)}
        >
          Not now
        </Button>
      </div>
    </div>
  );
}
