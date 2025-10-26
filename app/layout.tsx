import type { Metadata, Viewport } from 'next'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { ComingSoonProvider } from '@/components/common/ComingSoonProvider'
import { GlobalBackdrop } from '@/components/ethereal/GlobalBackdrop'
import { ThemeController } from '@/components/ethereal/ThemeController'
import { SupabaseSessionListener } from '@/components/auth/supabase-session-listener'
import { UserProvider } from '@/context/UserContext'

export const metadata: Metadata = {
  title: 'IFS Therapy Companion',
  description: 'Internal Family Systems therapy companion application',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Epilogue:wght@400;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined" rel="stylesheet" />
      </head>
      <body className="bg-background text-foreground">
        <ThemeProvider>
          <ComingSoonProvider>
            <UserProvider>
              {/* Global ethereal backdrop & theme controller */}
              <GlobalBackdrop />
              <ThemeController />
              <SupabaseSessionListener />
              {children}
            </UserProvider>
          </ComingSoonProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
