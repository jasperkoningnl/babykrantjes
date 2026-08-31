// middleware.ts
// @version 2.0.0
// Tijdelijk slot voor de volledige applicatie via HTTP Basic Auth.
//
// Vereiste server-only environment variables:
// - SITE_AUTH_USER
// - SITE_AUTH_PASSWORD
//
// /api/cron/* wordt niet door Basic Auth onderschept, omdat deze routes hun
// eigen CRON_SECRET/Bearer-controle uitvoeren. Debug- en testpagina's blijven
// daarnaast standaard met een 404 afgesloten, ook na succesvolle Basic Auth.

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

function unauthorizedResponse(): NextResponse {
  return new NextResponse('Authenticatie vereist', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Babykrantje tijdelijk", charset="UTF-8"',
      'Cache-Control': 'no-store',
    },
  })
}

function unavailableResponse(): NextResponse {
  return new NextResponse('Tijdelijke toegangsbeveiliging is niet geconfigureerd', {
    status: 503,
    headers: { 'Cache-Control': 'no-store' },
  })
}

async function constantTimeEqual(left: string, right: string): Promise<boolean> {
  const encoder = new TextEncoder()
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(left)),
    crypto.subtle.digest('SHA-256', encoder.encode(right)),
  ])

  const leftBytes = new Uint8Array(leftHash)
  const rightBytes = new Uint8Array(rightHash)
  let difference = 0

  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index] ^ rightBytes[index]
  }

  return difference === 0
}

async function hasValidBasicAuth(request: NextRequest): Promise<boolean> {
  const expectedUser = process.env.SITE_AUTH_USER
  const expectedPassword = process.env.SITE_AUTH_PASSWORD
  if (!expectedUser || !expectedPassword) return false

  const authorization = request.headers.get('authorization')
  if (!authorization?.startsWith('Basic ')) return false

  try {
    const encodedCredentials = authorization.slice('Basic '.length).trim()
    const credentialBytes = Uint8Array.from(
      atob(encodedCredentials),
      (character) => character.charCodeAt(0)
    )
    const credentials = new TextDecoder().decode(credentialBytes)
    const separator = credentials.indexOf(':')
    if (separator < 0) return false

    const suppliedUser = credentials.slice(0, separator)
    const suppliedPassword = credentials.slice(separator + 1)
    const [userMatches, passwordMatches] = await Promise.all([
      constantTimeEqual(suppliedUser, expectedUser),
      constantTimeEqual(suppliedPassword, expectedPassword),
    ])

    return userMatches && passwordMatches
  } catch {
    return false
  }
}

function isDebugOrTestPage(pathname: string): boolean {
  return (
    pathname.startsWith('/api/debug/') ||
    pathname === '/test-results' ||
    pathname === '/test-patterns'
  )
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Vercel Cron gebruikt een Bearer-token en controleert CRON_SECRET in de route.
  if (pathname === '/api/cron' || pathname.startsWith('/api/cron/')) {
    return NextResponse.next()
  }

  if (!process.env.SITE_AUTH_USER || !process.env.SITE_AUTH_PASSWORD) {
    console.error('[BasicAuth] SITE_AUTH_USER of SITE_AUTH_PASSWORD ontbreekt')
    return unavailableResponse()
  }

  if (!(await hasValidBasicAuth(request))) {
    return unauthorizedResponse()
  }

  if (isDebugOrTestPage(pathname) && process.env.ENABLE_TEST_PAGE !== 'true') {
    return new NextResponse(null, {
      status: 404,
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|favicon.svg|apple-touch-icon.png).*)',
  ],
}
