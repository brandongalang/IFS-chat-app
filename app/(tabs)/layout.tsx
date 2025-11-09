import * as React from 'react'
import { BottomTabs } from '@/components/nav/BottomTabs'

export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen text-foreground flex flex-col">
      <div className="flex-1 flex flex-col pb-24">{children}</div>
      <BottomTabs />
    </div>
  )
}
