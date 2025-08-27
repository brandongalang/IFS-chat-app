'use client'

import Link from 'next/link'
import { Plus, CalendarDays, Lightbulb, Sprout, Map } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function InsightsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <div className="h-12" />
      <div className="flex justify-center">
        <div className="px-4 py-2 rounded-full bg-muted text-muted-foreground text-sm font-medium">Protector</div>
      </div>
      <main className="flex-1 px-4 py-6 flex items-start justify-center">
        <div className="w-full max-w-md">
          <div className="bg-card border border-border rounded-2xl shadow-sm p-6">
            <div className="w-8 h-8 rounded-full mx-auto mb-3 flex items-center justify-center text-muted-foreground">
              <Lightbulb className="w-5 h-5" />
            </div>
            <p className="text-center text-base leading-relaxed">
              I notice you've been avoiding certain conversations lately. This might be a protective part trying to keep you safe from conflict or rejection.
            </p>
            <p className="text-center text-xs text-muted-foreground mt-3">Based on your recent patterns</p>
            <p className="text-center font-medium mt-5">Does this protective pattern feel accurate to you?</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Button variant="outline">Not quite</Button>
              <Button variant="secondary">That fits</Button>
            </div>
            <div className="mt-5 text-center text-sm text-muted-foreground">
              <button className="underline underline-offset-4">Add context</button>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-center gap-1">
            <span className="size-1.5 rounded-full bg-muted-foreground/40" />
            <span className="size-1.5 rounded-full bg-muted-foreground/40" />
            <span className="size-1.5 rounded-full bg-muted-foreground" />
            <span className="size-1.5 rounded-full bg-muted-foreground/40" />
          </div>
        </div>
      </main>
      <nav className="relative border-t border-border bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="mx-auto max-w-md">
          <div className="grid grid-cols-4 text-center text-xs py-3 text-muted-foreground">
            <Link href="/" className="flex flex-col items-center gap-1">
              <CalendarDays className="w-5 h-5" />
              <span>Today</span>
            </Link>
            <button className="flex flex-col items-center gap-1 text-foreground">
              <Lightbulb className="w-5 h-5" />
              <span>Insights</span>
            </button>
            <button className="flex flex-col items-center gap-1">
              <Sprout className="w-5 h-5" />
              <span>Garden</span>
            </button>
            <button className="flex flex-col items-center gap-1">
              <Map className="w-5 h-5" />
              <span>Journey</span>
            </button>
          </div>
        </div>
        <div className="absolute inset-x-0 -top-6 flex justify-center">
          <Link href="/chat" aria-label="Start a new chat">
            <div className="size-14 rounded-full bg-primary text-primary-foreground shadow-xl grid place-items-center">
              <Plus className="w-7 h-7" />
            </div>
          </Link>
        </div>
      </nav>
    </div>
  )
}
