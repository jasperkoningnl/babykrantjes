import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'babykrantje.nl — Een babykrantje, in een handomdraai',
  description: 'Vertel het geboorteverhaal in tien minuten. Wij maken er een echte voorpagina van.',
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
