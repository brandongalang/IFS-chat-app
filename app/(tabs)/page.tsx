'use client'

import { GuardedLink } from '@/components/common/GuardedLink'
import { CheckInCard } from '@/components/home/CheckInCard'
import { BackgroundImageLayer } from "@/components/ethereal/BackgroundImageLayer"
import { Vignette } from "@/components/ethereal/Vignette"
import { Inter } from "next/font/google"

const inter = Inter({ subsets: ["latin"], weight: ["100", "300", "400", "600"], variable: "--font-ethereal" })

export default function HomePage() {
  return (
    <div
      className={`${inter.variable} font-sans min-h-dvh h-dvh relative overflow-hidden`}
      style={{
        background: "linear-gradient(180deg, rgba(4,13,16,1) 0%, rgba(14,26,30,1) 50%, rgba(10,20,22,1) 100%)",
      }}
    >
      <BackgroundImageLayer />
      <Vignette />
      <div className="relative z-10 flex flex-col h-full overflow-y-auto">
        {/* Header */}
        <header className="px-4 pt-6 pb-2 max-w-md w-full mx-auto" style={{ letterSpacing: 'var(--eth-letter-spacing-user)' }}>
          <div className="flex items-center justify-between text-sm text-white/60">
            <span>09:57</span>
            <span className="font-medium" style={{ color: 'rgba(255,255,255,var(--eth-user-opacity))' }}>good evening.</span>
            <GuardedLink href="/profile" aria-label="profile" className="size-6 rounded-full bg-white/10" />
          </div>
        </header>

        {/* Calendar strip */}
        <div className="max-w-md w-full mx-auto px-4 mt-2">
          <div className="grid grid-cols-7 gap-2 text-center text-xs text-white/60">
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d, i) => (
              <div key={d + i} className="flex flex-col gap-1">
                <span>{d}</span>
                <div className="rounded-md bg-white/10 py-1">27</div>
              </div>
            ))}
          </div>
        </div>

        {/* Action cards */}
        <main className="flex-1 px-4 py-6 flex items-start justify-center">
          <div className="w-full max-w-md grid grid-cols-2 gap-3">
            <CheckInCard />

            {/* Daily meditations (spans 2 columns) */}
            <div className="col-span-2 rounded-xl border border-white/15 bg-white/10 backdrop-blur-xl p-4 mt-2">
              <div className="text-xs font-semibold text-white/60 tracking-wide">DAILY MEDITATIONS</div>
              <div className="mt-3 text-sm text-white/90">
                <blockquote className="italic">“So whatever you want to do, just do it… Making a damn fool of yourself is absolutely essential.”</blockquote>
                <div className="text-xs text-white/60 mt-2">— Gloria Steinem</div>
              </div>
              <div className="mt-3 text-xs text-white/60">Tap to explore more insights</div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
