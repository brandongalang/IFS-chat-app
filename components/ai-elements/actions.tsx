
'use client';

import { cn } from '@/lib/utils';
import type { ComponentProps } from 'react';

export type ActionsProps = ComponentProps<'div'>;

export const Actions = ({ className, ...props }: ActionsProps) => (
  <div
    className={cn(
      'flex w-full flex-col gap-2 rounded-xl bg-zinc-800 p-4',
      className,
    )}
    {...props}
  />
);

export type ActionsContentProps = ComponentProps<'div'>;

export const ActionsContent = ({ className, ...props }: ActionsContentProps) => (
  <div className={cn('text-zinc-400', className)} {...props} />
);

export type ActionsTriggerProps = ComponentProps<'button'>;

export const ActionsTrigger = ({
  className,
  ...props
}: ActionsTriggerProps) => (
  <button
    className={cn(
      'flex w-full items-center justify-between rounded-lg px-4 py-2 text-left text-zinc-400 transition-colors hover:bg-zinc-700',
      className,
    )}
    {...props}
  />
);
