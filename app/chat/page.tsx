"use client"

import { Suspense } from "react"
import { Inter } from "next/font/google"
import { EtherealChat } from "@/components/ethereal/EtherealChat"

const inter = Inter({ subsets: ["latin"], weight: ["100", "300", "400", "600"], variable: "--font-ethereal" })

export default function ChatPage() {
  return (
    <Suspense fallback={null}>
      <div className={`${inter.variable} font-sans min-h-[100dvh] h-[100dvh] relative overflow-hidden`}>
        <EtherealChat />
      </div>
    </Suspense>
  )
}
