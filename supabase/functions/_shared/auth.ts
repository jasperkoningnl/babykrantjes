const SCRAPE_SECRET_HEADER = 'x-scrape-secret'

type SecretReader = () => string | undefined

function readScrapeSecret(): string | undefined {
  const runtime = globalThis as typeof globalThis & {
    Deno?: { env: { get(name: string): string | undefined } }
  }
  return runtime.Deno?.env.get('SCRAPE_FUNCTION_SECRET')
}

async function secretsMatch(provided: string, expected: string): Promise<boolean> {
  const encoder = new TextEncoder()
  const [providedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(provided)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ])
  const providedBytes = new Uint8Array(providedHash)
  const expectedBytes = new Uint8Array(expectedHash)
  let difference = 0

  for (let index = 0; index < providedBytes.length; index += 1) {
    difference |= providedBytes[index] ^ expectedBytes[index]
  }

  return difference === 0
}

/**
 * Authenticeert interne scrape-aanroepen voordat de service-role client
 * wordt aangemaakt. Supabase anon/publishable keys zijn hier nooit geldig.
 */
export async function withScrapeAuth(
  request: Request,
  onAuthorized: () => Promise<Response>,
  getSecret: SecretReader = readScrapeSecret
): Promise<Response> {
  const expected = getSecret()
  const provided = request.headers.get(SCRAPE_SECRET_HEADER)

  if (!expected || !provided || !(await secretsMatch(provided, expected))) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  return onAuthorized()
}
