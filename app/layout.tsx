import type { Metadata, Viewport } from 'next'
import { Epilogue, Material_Symbols_Outlined } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { ComingSoonProvider } from '@/components/common/ComingSoonProvider'
import { SupabaseSessionListener } from '@/components/auth/supabase-session-listener'
import { UserProvider } from '@/context/UserContext'

const epilogue = Epilogue({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-epilogue',
})

const materialSymbols = Material_Symbols_Outlined({
  subsets: ['latin'],
  weight: '300',
  display: 'swap',
  variable: '--font-material-symbols',
  style: 'normal',
  axes: ['FILL', 'GRAD', 'opsz', 'wght'],
})

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
    <html
      lang="en"
      suppressHydrationWarning
      className={`${epilogue.variable} ${materialSymbols.variable}`}
    >
      <body className="trailhead-body font-trailhead bg-background text-foreground antialiased">
        <ThemeProvider>
          <ComingSoonProvider>
            <UserProvider>
              <SupabaseSessionListener />
              {children}
            </UserProvider>
          </ComingSoonProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
