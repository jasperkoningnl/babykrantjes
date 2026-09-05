const { buildSecurityHeaders } = require('./security-headers')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  async headers() {
    return [
      {
        // Dit omvat pagina's, API-routes en door Next gegenereerde assets.
        source: '/(.*)',
        headers: buildSecurityHeaders(process.env),
      },
    ]
  },
}

module.exports = nextConfig
