'use client'

import { Suspense } from 'react'
import { ChatLayout } from '@/components/chat/ChatLayout'
import { EtherealChat } from '@/components/ethereal/EtherealChat'

const ETHEREAL_CHAT = process.env.NEXT_PUBLIC_IFS_ETHEREAL_CHAT === 'true' || process.env.NEXT_PUBLIC_IFS_ETHEREAL_THEME === 'true'

export default function ChatPage() {
  return (
    <Suspense fallback={null}>
      {ETHEREAL_CHAT ? <EtherealChat /> : <ChatLayout />}
    </Suspense>
  )
}
