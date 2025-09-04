"use client"

import { Suspense } from "react"
import { Quicksand } from "next/font/google"
import { EtherealChat } from "@/components/ethereal/EtherealChat"

const quicksand = Quicksand({ subsets: ["latin"], weight: ["400", "600"], variable: "--font-ethereal" })

export default function EtherealChatPage() {
  return (
    <Suspense fallback={null}>
      <div className={`${quicksand.variable} font-sans min-h-dvh h-dvh relative overflow-hidden`}
        style={{
          // lock this route to a dark, teal-gray ambiance regardless of theme
          background: "linear-gradient(180deg, rgba(4,13,16,1) 0%, rgba(14,26,30,1) 50%, rgba(10,20,22,1) 100%)"
        }}
      >
        <EtherealChat />
      </div>
    </Suspense>
  )
}
