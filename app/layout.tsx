import type { Metadata } from 'next'
import './globals.css'

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
    <html lang="en" className="dark">
      <body className="bg-background text-foreground">{children}</body>
    </html>
  )
}