// proxy.ts
// @version 2.0.0
// Productroutes zijn publiek bereikbaar; krantdata en mutaties worden in de
// route handlers via een HttpOnly gastensessie geautoriseerd. Alleen debug- en
// testroutes worden hier centraal afgesloten.

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

function isDebugOrTestPage(pathname: string): boolean {
  return (
    pathname.startsWith('/api/debug/') ||
    pathname.startsWith('/api/test/') ||
    pathname === '/test-results' ||
    pathname === '/test-patterns'
  )
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isDebugOrTestPage(pathname) && (process.env.NODE_ENV === 'production' || process.env.ENABLE_TEST_PAGE !== 'true')) {
    return new NextResponse(null, {
      status: 404,
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/api/debug/:path*',
    '/api/test/:path*',
    '/test-results',
    '/test-patterns',
  ],
}
