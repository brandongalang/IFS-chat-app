"use client"

import { Suspense } from "react"
import { EtherealChat } from "@/components/ethereal/EtherealChat"

export default function ChatPage() {
  return (
    <Suspense fallback={null}>
      <div className="min-h-[100dvh]">
        <EtherealChat />
      </div>
    </Suspense>
  )
}
