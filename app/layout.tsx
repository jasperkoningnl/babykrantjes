import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Babykrantjes Generator',
  description: 'Maak je eigen babykrantje met AI',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="nl">
      <body>{children}</body>
    </html>
  )
}