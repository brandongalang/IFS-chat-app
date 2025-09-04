'use client'

import { Suspense } from 'react'
import { ChatLayout } from '@/components/chat/ChatLayout'
import { EtherealChat } from '@/components/ethereal/EtherealChat'

// Default to ethereal presentation unless explicitly disabled
const isOn = (v?: string) => v === 'true' || v === '1' || v === 'on'
const isOff = (v?: string) => v === 'false' || v === '0' || v === 'off'
const CHAT_ENV = process.env.NEXT_PUBLIC_IFS_ETHEREAL_CHAT
const THEME_ENV = process.env.NEXT_PUBLIC_IFS_ETHEREAL_THEME
const ETHEREAL_CHAT = isOff(CHAT_ENV) ? false : (isOn(CHAT_ENV) || isOn(THEME_ENV) || CHAT_ENV === undefined)

export default function ChatPage() {
  return (
    <Suspense fallback={null}>
      {ETHEREAL_CHAT ? <EtherealChat /> : <ChatLayout />}
    </Suspense>
  )
}
