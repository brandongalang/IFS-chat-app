import * as React from 'react'
import { BottomTabs } from '@/components/nav/BottomTabs'

export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <div className="flex-1 flex flex-col">{children}</div>
      <BottomTabs />
    </div>
  )
}
