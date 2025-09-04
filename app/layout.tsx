import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { ComingSoonProvider } from '@/components/common/ComingSoonProvider'
import { GlobalBackdrop } from '@/components/ethereal/GlobalBackdrop'

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
          <ComingSoonProvider>
            {/* Global ethereal backdrop */}
            <GlobalBackdrop />
            {children}
          </ComingSoonProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
