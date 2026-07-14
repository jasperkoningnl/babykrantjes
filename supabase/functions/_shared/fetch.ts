// supabase/functions/_shared/fetch.ts
// Fetch met timeout, retries en exponential backoff voor de scrape-jobs.
// Deno-versie van lib/waybackFetch.ts uit de Next.js app.

const DEFAULT_TIMEOUT = 20000
const MAX_RETRIES = 3
const RETRY_DELAYS = [2000, 4000, 8000]

export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retryCount = 0
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    // 429: respecteer Retry-After
    if (response.status === 429 && retryCount < MAX_RETRIES) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '5', 10) * 1000
      const delay = Math.min(retryAfter, 30000)
      await response.body?.cancel()
      await sleep(delay)
      return fetchWithRetry(url, options, retryCount + 1)
    }

    // Serverfouten en 403 (vaak tijdelijke bot-detectie): retry met backoff
    if ((response.status >= 500 || response.status === 403) && retryCount < MAX_RETRIES) {
      const delay = RETRY_DELAYS[retryCount] ?? 8000
      await response.body?.cancel()
      await sleep(delay)
      return fetchWithRetry(url, options, retryCount + 1)
    }

    return response
  } catch (error) {
    clearTimeout(timeoutId)

    if (retryCount < MAX_RETRIES) {
      const delay = RETRY_DELAYS[retryCount] ?? 8000
      await sleep(delay)
      return fetchWithRetry(url, options, retryCount + 1)
    }

    throw error
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'nl-NL,nl;q=0.9,en;q=0.8',
}
