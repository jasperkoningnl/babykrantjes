const STATIC_ORIGINS = Object.freeze({
  googleFontsStyles: 'https://fonts.googleapis.com',
  googleFontsFiles: 'https://fonts.gstatic.com',
  tmdbImages: 'https://image.tmdb.org',
})

function exactHttpsOrigin(value, variable) {
  if (!value) return null
  let url
  try {
    url = new URL(value)
  } catch {
    throw new Error(`${variable} moet een geldige absolute URL zijn`)
  }
  if (url.protocol !== 'https:' || url.origin === 'null') {
    throw new Error(`${variable} moet een HTTPS-origin zijn`)
  }
  if (url.hostname.includes('*') || url.username || url.password) {
    throw new Error(`${variable} moet een geldige absolute URL zonder wildcard of credentials zijn`)
  }
  return url.origin
}

function buildContentSecurityPolicy(env = {}) {
  const supabase = exactHttpsOrigin(env.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL')
  // De checkout is momenteel alleen UI. Voeg pas een concrete provider-origin toe
  // wanneer de browser daar werkelijk formulieren, frames of requests voor gebruikt.
  const payment = exactHttpsOrigin(env.PAYMENT_PROVIDER_ORIGIN, 'PAYMENT_PROVIDER_ORIGIN')
  const add = (base, value) => value ? [...base, value] : base

  const directives = {
    "default-src": ["'self'"],
    "base-uri": ["'self'"],
    "object-src": ["'none'"],
    "frame-ancestors": ["'none'"],
    "script-src": ["'self'", "'unsafe-inline'"],
    "style-src": ["'self'", "'unsafe-inline'", STATIC_ORIGINS.googleFontsStyles],
    "font-src": ["'self'", STATIC_ORIGINS.googleFontsFiles],
    "img-src": add(["'self'", 'data:', STATIC_ORIGINS.tmdbImages], supabase),
    "connect-src": add(add(["'self'"], supabase), payment),
    "form-action": add(["'self'"], payment),
    "frame-src": payment ? [payment] : ["'none'"],
    "manifest-src": ["'self'"],
    "worker-src": ["'self'", 'blob:'],
    "upgrade-insecure-requests": [],
  }

  return Object.entries(directives)
    .map(([directive, sources]) => `${directive}${sources.length ? ` ${sources.join(' ')}` : ''}`)
    .join('; ')
}

function buildSecurityHeaders(env = {}) {
  const payment = exactHttpsOrigin(env.PAYMENT_PROVIDER_ORIGIN, 'PAYMENT_PROVIDER_ORIGIN')
  const paymentPolicy = payment ? `payment=(self "${payment}")` : 'payment=()'
  return [
    { key: 'Content-Security-Policy', value: buildContentSecurityPolicy(env) },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: `camera=(), microphone=(), geolocation=(), ${paymentPolicy}, usb=()` },
    // Bewust door de app beheerd, zodat dit ook op custom domains consistent is.
    { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  ]
}

module.exports = { STATIC_ORIGINS, buildContentSecurityPolicy, buildSecurityHeaders }
