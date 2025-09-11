import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { ComingSoonProvider } from '@/components/common/ComingSoonProvider'
import { GlobalBackdrop } from '@/components/ethereal/GlobalBackdrop'
import { ThemeController } from '@/components/ethereal/ThemeController'
import { UserProvider } from '@/context/UserContext'

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
            <UserProvider>
              {/* Global ethereal backdrop & theme controller */}
              <GlobalBackdrop />
              <ThemeController />
              {children}
            </UserProvider>
          </ComingSoonProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
