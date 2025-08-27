'use client'

import * as React from 'react'

export type ToastItem = {
  id?: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  duration?: number
  // Additional props forwarded to <Toast />
  [key: string]: any
}

type ToastContextValue = {
  toasts: ToastItem[]
  toast: (t: ToastItem) => string
  dismiss: (id?: string) => void
  clear: () => void
}

const ToastContext = React.createContext<ToastContextValue | null>(null)

export function ToastProviderInternal({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([])

  const toast = React.useCallback((t: ToastItem) => {
    const id = t.id || Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev, { ...t, id }])
    if (t.duration && t.duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== id))
      }, t.duration)
    }
    return id
  }, [])

  const dismiss = React.useCallback((id?: string) => {
    if (!id) return setToasts((prev) => prev.slice(1))
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const clear = React.useCallback(() => setToasts([]), [])

  const value = React.useMemo(() => ({ toasts, toast, dismiss, clear }), [toasts, toast, dismiss, clear])

  return (
    <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = React.useContext(ToastContext)
  if (!ctx) {
    // Provide a safe fallback so consuming components don't crash
    return {
      toasts: [] as ToastItem[],
      toast: (_t: ToastItem) => '',
      dismiss: (_id?: string) => {},
      clear: () => {},
    }
  }
  return ctx
}
