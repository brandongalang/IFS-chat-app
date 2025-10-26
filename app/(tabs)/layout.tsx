import * as React from 'react'
import { BottomTabs } from '@/components/nav/BottomTabs'

export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col">
      <div className="flex flex-1 flex-col pb-24 lg:pb-28">{children}</div>
      <BottomTabs />
    </div>
  )
}
