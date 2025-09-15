import * as React from 'react'
import { BottomTabs } from '@/components/nav/BottomTabs'

export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen text-foreground flex flex-col">
      <div className="flex-1 flex flex-col pb-20 bg-background/50 backdrop-blur">{children}</div>
      <BottomTabs />
    </div>
  )
}
