import * as React from 'react'
import { BottomTabs } from '@/components/nav/BottomTabs'
import { isNewUIEnabled } from '@/config/features'

export default function TabsLayout({ children }: { children: React.ReactNode }) {
  const newUI = isNewUIEnabled()
  
  return (
    <div className="min-h-screen text-foreground flex flex-col">
      <div className={`flex-1 flex flex-col ${newUI ? 'pb-24' : 'pb-20 bg-background/50 backdrop-blur'}`}>{children}</div>
      <BottomTabs />
    </div>
  )
}
