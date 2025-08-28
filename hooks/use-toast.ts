'use client'

import type { ReactNode } from 'react'
import type { ToastProps } from '@/components/ui/toast'

export type ToastItem = {
  id?: string
  title?: ReactNode
  description?: ReactNode
  action?: ReactNode
  duration?: number
} & Partial<ToastProps>

export function useToast() {
  return {
    toasts: [] as ToastItem[],
    toast: (_t: ToastItem) => '',
    dismiss: (_id?: string) => {},
    clear: () => {},
  }
}

