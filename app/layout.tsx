import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { ComingSoonProvider } from '@/components/common/ComingSoonProvider'
import DevModeBanner from '@/components/dev/DevModeBanner'

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
        <DevModeBanner />
        <ThemeProvider>
          <ComingSoonProvider>
            {children}
          </ComingSoonProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
