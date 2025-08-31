'use client'

import { Suspense } from 'react'
import { ChatLayout } from '@/components/chat/ChatLayout'

export default function ChatPage() {
  return (
    <Suspense fallback={null}>
      <ChatLayout />
    </Suspense>
  )
}
