import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Babykrantje.nl — het kraamcadeau dat je niet ontgroeit',
  description: 'Een echte krant over de eerste dag van je kind. In tien minuten gemaakt, thuisbezorgd op krantenpapier.',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-touch-icon.png',
  },
  other: {
    'theme-color': '#8FA88A',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="nl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,300..900;1,8..60,300..700&family=Bricolage+Grotesque:opsz,wght@12..96,300..800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
