"use client"

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function BackButton({ className }: { className?: string }) {
  const router = useRouter()

  const onBack = React.useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
    } else {
      router.replace('/')
    }
  }, [router])

  return (
    <Button variant="outline" size="sm" className={className} onClick={onBack}>
      <ArrowLeft className="mr-2 h-4 w-4" />
      Back
    </Button>
  )
}
