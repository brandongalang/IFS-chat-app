import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { ComingSoonProvider } from '@/components/common/ComingSoonProvider'
import { UpgradeModalProvider } from '@/components/common/upgrade-modal'

export const metadata: Metadata = {
  title: 'IFS Therapy Companion',
  description: 'Internal Family Systems therapy companion application',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-background text-foreground">
        <ThemeProvider>
          <UpgradeModalProvider>
            <ComingSoonProvider>
              {children}
            </ComingSoonProvider>
          </UpgradeModalProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
