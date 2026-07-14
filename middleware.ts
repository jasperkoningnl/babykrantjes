// middleware.ts
// @version 1.0.0
// Debug- en testroutes zijn in productie afgesloten. Zet ENABLE_TEST_PAGE=true
// (environment variable) om ze bewust open te zetten, bijv. op een preview
// deploy. Zonder flag krijgen deze paden een 404.

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(_request: NextRequest) {
  if (process.env.ENABLE_TEST_PAGE === 'true') {
    return NextResponse.next()
  }
  return new NextResponse(null, { status: 404 })
}

export const config = {
  matcher: [
    '/api/debug/:path*',
    '/api/test/:path*',
    '/test-results',
    '/test-patterns',
  ],
}
