'use client'

import { cn } from '@/lib/utils'
import { type FormHTMLAttributes, type TextareaHTMLAttributes, type ButtonHTMLAttributes } from 'react'

export const PromptInput = ({ className, ...props }: FormHTMLAttributes<HTMLFormElement>) => (
  <form
    className={cn('border border-border rounded-lg p-2 bg-card', className)}
    {...props}
  />
)

export const PromptInputTextarea = ({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea
    className={cn(
      'w-full resize-none p-3 outline-none rounded-md',
      'bg-[hsl(var(--secondary))] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]',
      'border border-[hsl(var(--input))] focus:ring-2 focus:ring-[hsl(var(--ring))] focus:border-transparent',
      className
    )}
    rows={3}
    {...props}
  />
)

export const PromptInputToolbar = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex justify-between items-center mt-2', className)} {...props} />
)

export const PromptInputTools = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex items-center gap-2', className)} {...props} />
)

export const PromptInputSubmit = ({ className, disabled, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { status?: string }) => (
  <button className={cn('px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50', className)} disabled={disabled} {...props} />
)


