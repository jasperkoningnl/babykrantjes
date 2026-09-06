'use client'

let renewing: Promise<Response> | null = null
export function renewAdminSession(): Promise<Response> {
  if (!renewing) {
    const renew = () => fetch('/api/admin/session', { method: 'PUT', signal: AbortSignal.timeout(30000) })
    // Coordinate refresh-token rotation across tabs in the same browser.
    renewing = Promise.resolve(navigator.locks ? navigator.locks.request('babykrant-admin-renew', renew) : renew())
      .finally(() => { renewing = null })
  }
  return renewing
}
