// lib/waybackFetch.ts
// @version 1.0.0
// Robust fetch utility for Wayback Machine API calls
// Handles timeouts, retries, and rate limiting

const WAYBACK_TIMEOUT = 15000  // 15 seconds
const MAX_RETRIES = 3
const RETRY_DELAYS = [2000, 4000, 8000]  // Exponential backoff: 2s, 4s, 8s

/**
 * Fetch with timeout, retry logic, and rate limit handling
 * Designed specifically for unreliable Wayback Machine API
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retryCount = 0
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), WAYBACK_TIMEOUT)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    // Handle rate limiting (429 Too Many Requests)
    if (response.status === 429 && retryCount < MAX_RETRIES) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '5') * 1000
      const delay = Math.min(retryAfter, 30000)  // Max 30s wait
      console.log(`[WaybackFetch] Rate limited (429), retrying after ${delay}ms... (attempt ${retryCount + 1}/${MAX_RETRIES})`)
      await sleep(delay)
      return fetchWithRetry(url, options, retryCount + 1)
    }

    // Handle server errors (5xx) and some client errors
    if ((response.status >= 500 || response.status === 403) && retryCount < MAX_RETRIES) {
      const delay = RETRY_DELAYS[retryCount] || 8000
      console.log(`[WaybackFetch] Error ${response.status}, retrying after ${delay}ms... (attempt ${retryCount + 1}/${MAX_RETRIES})`)
      await sleep(delay)
      return fetchWithRetry(url, options, retryCount + 1)
    }

    return response
  } catch (error: any) {
    clearTimeout(timeoutId)

    // Retry on timeout, network errors, DNS failures
    const isRetryableError =
      error.name === 'AbortError' ||
      error.code === 'ETIMEDOUT' ||
      error.code === 'EAI_AGAIN' ||
      error.code === 'ECONNRESET' ||
      error.message?.includes('fetch failed')

    if (isRetryableError && retryCount < MAX_RETRIES) {
      const delay = RETRY_DELAYS[retryCount] || 8000
      console.log(`[WaybackFetch] Network error (${error.name || error.code}), retrying after ${delay}ms... (attempt ${retryCount + 1}/${MAX_RETRIES})`)
      await sleep(delay)
      return fetchWithRetry(url, options, retryCount + 1)
    }

    // Out of retries or non-retryable error
    console.error(`[WaybackFetch] Failed after ${retryCount + 1} attempts:`, error.message || error)
    throw error
  }
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
