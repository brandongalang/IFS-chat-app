'use client'

import type { ReactNode } from 'react'

export type ToastItem = {
  id?: string
  title?: ReactNode
  description?: ReactNode
  action?: ReactNode
  duration?: number
  // Additional props forwarded to <Toast />
  [key: string]: any
}

export function useToast() {
  return {
    toasts: [] as ToastItem[],
    toast: (_t: ToastItem) => '',
    dismiss: (_id?: string) => {},
    clear: () => {},
  }
}

